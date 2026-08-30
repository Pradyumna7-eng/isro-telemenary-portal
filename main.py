import io
import sys
import os

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
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
    try:
        coll = get_components_collection()
        if coll.count_documents({}) == 0:
            print("[Startup] Database empty. Running initial telemetry seed...")
            run_seed()
    except Exception as e:
        print(f"[Startup Seeding Notice]: {e}")

def find_index_file():
    candidates = [
        os.path.join(STATIC_DIR, "index.html"),
        os.path.join(BASE_DIR, "index.html"),
        os.path.join(os.getcwd(), "static", "index.html"),
        os.path.join(os.getcwd(), "index.html")
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None

@app.api_route("/", methods=["GET", "HEAD"], response_class=HTMLResponse)
def serve_index():
    index_path = find_index_file()
    if index_path:
        return FileResponse(index_path)
    return HTMLResponse("<h2>ISRO Telemetry Portal is Live!</h2><p>index.html loaded.</p>")

@app.post("/api/auth/login")
def login(req: LoginRequest):
    if req.operatorId and len(req.accessKey) >= 4:
        return {
            "status": "success",
            "token": "SESSION_ISRO_ISTRAC_SECURE_TOKEN_9921",
            "operatorId": req.operatorId,
            "clearance": "MISSION_CONTROLLER_LEVEL_3"
        }
    raise HTTPException(status_code=401, detail="Invalid operator security credentials")

@app.api_route("/api/vehicles", methods=["GET", "HEAD"])
@app.api_route("/api/vehicles/", methods=["GET", "HEAD"])
def list_vehicles():
    coll = get_components_collection()
    vehicles = coll.distinct("vehicle")
    if not vehicles:
        vehicles = ["LVM3", "PSLV", "SSLV"]
    return [{"id": v, "name": VEHICLE_DISPLAY_NAMES.get(v, v)} for v in vehicles]

@app.api_route("/api/vehicles/{vehicle}/summary", methods=["GET", "HEAD"])
def vehicle_summary(vehicle: str):
    coll = get_components_collection()
    total = coll.count_documents({"vehicle": vehicle})
    if total == 0:
        defaults = {"LVM3": (456, 390, 63, 3), "PSLV": (324, 273, 48, 3), "SSLV": (180, 153, 24, 3)}
        tot, pas, rej, wea = defaults.get(vehicle, (400, 350, 40, 10))
        return {
            "name": VEHICLE_DISPLAY_NAMES.get(vehicle, vehicle),
            "totalComponents": tot,
            "passed": pas,
            "rejects": rej,
            "weather": wea,
            "lotId": f"Lot ID: {vehicle}_LOT_01",
        }

    rejects = coll.count_documents({"vehicle": vehicle, "final_flag": True})
    weather = coll.count_documents({"vehicle": vehicle, "weather_flag": True})
    passed = max(0, total - rejects - weather)

    one = coll.find_one({"vehicle": vehicle})
    lot_id = one.get("lot_id", f"{vehicle}_LOT_01") if one else f"{vehicle}_LOT_01"

    return {
        "name": VEHICLE_DISPLAY_NAMES.get(vehicle, vehicle),
        "totalComponents": total,
        "passed": passed,
        "rejects": rejects,
        "weather": weather,
        "lotId": f"Lot ID: {lot_id}",
    }

@app.api_route("/api/vehicles/{vehicle}/table", methods=["GET", "HEAD"])
def vehicle_table(vehicle: str, limit: int = 30):
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

@app.api_route("/api/components/{component_id}", methods=["GET", "HEAD"])
def component_detail(component_id: str):
    coll = get_components_collection()
    doc = coll.find_one({"component_id": component_id}, {"_id": 0})
    if not doc:
        return {
            "componentId": component_id,
            "status": "STATUS: HARDWARE REJECT",
            "category": "Spatial Parametric Outlier",
            "explanationA": "Spatial silicon pinhole defect: Iddq (0h=45.2uA) exceeds wafer 3-sigma boundary",
            "explanationB": "Thermal drift within flight envelope: forecast 168h = 53.4uA (Safe)",
            "shapIddq": "burnin_slope_0_24 (+0.87), iddq_0h_baseline (+8.80)",
            "shapLeakage": "leakage_gradient (+5.40), oxide_temperature (+0.84)",
            "shapPropDelay": "clock_jitter (+2.00)",
            "anomalyScoreA": 0.81,
        }

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

@app.api_route("/api/health", methods=["GET", "HEAD"])
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
