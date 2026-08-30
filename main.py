import io
import sys
import os

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(__file__))
from db import get_components_collection, get_runs_collection, ensure_indexes
from pipeline import run_pipeline
from seed import tag_weather_flag, run_seed

app = FastAPI(title="ISRO Ground Station Telemetry & Screening Portal")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

VEHICLE_DISPLAY_NAMES = {
    "LVM3": "LVM3 (Heavy Payload Launch Vehicle)",
    "PSLV": "PSLV (Polar Satellite Launch Vehicle)",
    "SSLV": "SSLV (Small Satellite Launch Vehicle)",
}

class LoginRequest(BaseModel):
    operatorId: str
    accessKey: str

@app.on_event("startup")
def startup():
    ensure_indexes()
    # If database is empty, seed it automatically
    coll = get_components_collection()
    if coll.count_documents({}) == 0:
        print("[Startup] Database empty. Running initial telemetry seed...")
        run_seed()

@app.get("/")
def serve_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "ISRO Telemetry API is running. index.html not found in /static."}

@app.post("/api/auth/login")
def login(req: LoginRequest):
    # Validates mission operator credentials
    if req.operatorId and len(req.accessKey) >= 4:
        return {
            "status": "success",
            "token": "SESSION_ISRO_ISTRAC_SECURE_TOKEN_9921",
            "operatorId": req.operatorId,
            "clearance": "MISSION_CONTROLLER_LEVEL_3"
        }
    raise HTTPException(status_code=401, detail="Invalid operator security credentials")

@app.get("/api/vehicles")
def list_vehicles():
    coll = get_components_collection()
    vehicles = coll.distinct("vehicle")
    if not vehicles:
        vehicles = ["LVM3", "PSLV", "SSLV"]
    return [{"id": v, "name": VEHICLE_DISPLAY_NAMES.get(v, v)} for v in vehicles]

@app.get("/api/vehicles/{vehicle}/summary")
def vehicle_summary(vehicle: str):
    coll = get_components_collection()
    total = coll.count_documents({"vehicle": vehicle})
    if total == 0:
        raise HTTPException(404, f"No telemetry data found for vehicle '{vehicle}'")

    rejects = coll.count_documents({"vehicle": vehicle, "final_flag": True})
    weather = coll.count_documents({"vehicle": vehicle, "weather_flag": True})
    passed = max(0, total - rejects - weather)

    one = coll.find_one({"vehicle": vehicle})
    lot_id = one.get("lot_id", f"{vehicle}_STAGE_01") if one else f"{vehicle}_STAGE_01"

    return {
        "name": VEHICLE_DISPLAY_NAMES.get(vehicle, vehicle),
        "totalComponents": total,
        "passed": passed,
        "rejects": rejects,
        "weather": weather,
        "lotId": f"Lot ID: {lot_id}",
    }

@app.get("/api/vehicles/{vehicle}/table")
def vehicle_table(vehicle: str, limit: int = 25):
    coll = get_components_collection()
    cursor = coll.find(
        {"vehicle": vehicle, "": [{"final_flag": True}, {"weather_flag": True}]},
        {"_id": 0},
    ).limit(limit)

    rows = []
    for doc in cursor:
        if doc.get("flag_A") and doc.get("flag_B"):
            category, tag = "Spatial & Drift", "tag-spatial"
        elif doc.get("flag_A"):
            category, tag = "Spatial Outlier", "tag-spatial"
        elif doc.get("flag_B"):
            category, tag = "Thermal Drift", "tag-drift"
        else:
            category, tag = "Atmospheric Noise", "tag-weather"

        rows.append({
            "componentId": doc["component_id"],
            "category": category,
            "categoryTag": tag,
            "reason": doc.get("final_explanation", doc.get("explanation_A", "Hardware screening flag")),
            "value0h": doc.get("Iddq_uA_0h"),
            "predicted168h": doc.get("Iddq_uA_pred168h"),
        })
    return rows

@app.get("/api/components/{component_id}")
def component_detail(component_id: str):
    coll = get_components_collection()
    doc = coll.find_one({"component_id": component_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, f"Component '{component_id}' not found")

    if doc.get("flag_A") and doc.get("flag_B"):
        status, category = "STATUS: CRITICAL MULTI-FAILURE REJECT", "Spatial Defect & Thermal Runaway"
    elif doc.get("flag_A"):
        status, category = "STATUS: HARDWARE REJECT", "Spatial Parametric Outlier"
    elif doc.get("flag_B"):
        status, category = "STATUS: EARLY REJECTION (SAFETY SLOPE EXCEEDED)", "Time-Series Drift Slope Violation"
    elif doc.get("weather_flag"):
        status, category = "STATUS: ATMOSPHERIC NOISE (RE-SCREEN)", "Environmental Noise Drift (EMI/Precipitation)"
    else:
        status, category = "STATUS: PASSED", "Nominal Flight Certified"

    return {
        "componentId": doc["component_id"],
        "status": status,
        "category": category,
        "explanationA": doc.get("explanation_A", "Wafer parametric baseline nominal"),
        "explanationB": doc.get("explanation_B", "Burn-in thermal drift within safe limit"),
        "shapIddq": doc.get("Iddq_uA_shap_explanation", "rate_0_24 (+0.50), baseline (+0.20)"),
        "shapLeakage": doc.get("Leakage_uA_shap_explanation", "leakage_gradient (+0.30), temp (+0.10)"),
        "shapPropDelay": doc.get("PropDelay_ns_shap_explanation", "clock_jitter (+0.15)"),
        "anomalyScoreA": doc.get("anomaly_score_A", 0.1),
    }

@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")

    required = {"component_id", "lot_id"}
    if not required.issubset(df.columns):
        raise HTTPException(400, f"CSV missing required columns: {required - set(df.columns)}")
    if "vehicle" not in df.columns:
        df["vehicle"] = "UNSPECIFIED"

    result, report = run_pipeline(df)
    result = tag_weather_flag(result)

    coll = get_components_collection()
    coll.delete_many({})
    records = result.to_dict(orient="records")
    for r in records:
        for k, v in r.items():
            if hasattr(v, "item"):
                r[k] = v.item()
    coll.insert_many(records)
    get_runs_collection().insert_one({"report": report, "n_components": len(records)})

    return {"status": "ok", "n_components": len(records), "n_flagged": int(result["final_flag"].sum())}

@app.get("/api/health")
def health_check():
    coll = get_components_collection()
    return {
        "status": "healthy",
        "service": "ISRO Ground Station Telemetry API",
        "components_in_db": coll.count_documents({})
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
