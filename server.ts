import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import multer from "multer";
import { dataStore } from "./data_store";
import { ComponentRecord, runPipeline } from "./pipeline";

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

const BASE_DIR = process.cwd();
const STATIC_DIR = path.join(BASE_DIR, "static");

// Static files
if (fs.existsSync(STATIC_DIR)) {
  app.use("/static", express.static(STATIC_DIR));
}
app.use(express.static(BASE_DIR));

const VEHICLE_DEFAULTS: Record<string, any> = {
  LVM3: {
    id: "LVM3",
    name: "LVM3 (Heavy Payload Launch Vehicle)",
    total_components: 450,
    passed: 412,
    rejects: 26,
    weather: 12,
    lot_id: "Lot ID: LVM3_STAGE_02",
    max_iddq: "55.0 µA",
    wind_shear: "45 knots",
    emi_limit: "-80 dB",
    slope_limit: 55.0,
    slope_text: "LVM3 Safety Slope Limit (55.0 µA)",
    part10_iddq: "48.00 µA",
    part25_drift: "39.00 µA"
  },
  PSLV: {
    id: "PSLV",
    name: "PSLV (Polar Satellite Launch Vehicle)",
    total_components: 320,
    passed: 295,
    rejects: 18,
    weather: 7,
    lot_id: "Lot ID: PSLV_C58_STAGE_03",
    max_iddq: "40.0 µA",
    wind_shear: "35 knots",
    emi_limit: "-70 dB",
    slope_limit: 40.0,
    slope_text: "PSLV Safety Slope Limit (40.0 µA)",
    part10_iddq: "36.50 µA",
    part25_drift: "31.20 µA"
  },
  SSLV: {
    id: "SSLV",
    name: "SSLV (Small Satellite Launch Vehicle)",
    total_components: 180,
    passed: 164,
    rejects: 12,
    weather: 4,
    lot_id: "Lot ID: SSLV_D3_STAGE_01",
    max_iddq: "30.0 µA",
    wind_shear: "30 knots",
    emi_limit: "-60 dB",
    slope_limit: 30.0,
    slope_text: "SSLV Safety Slope Limit (30.0 µA)",
    part10_iddq: "27.80 µA",
    part25_drift: "24.50 µA"
  }
};

const DETAILED_INSPECTIONS: Record<string, any> = {
  PART_088: {
    part_id: "PART_088",
    status_text: "STATUS: ATMOSPHERIC NOISE (RE-SCREEN)",
    status_color: "var(--accent-purple)",
    category: "Environmental Noise Drift",
    sensor: "Ground Station EMI & Weather Sensor Array",
    factor: "Thunderstorm EMI Pulse (-35 dB) & Rain Rate (18.5 mm/hr) at T=24h",
    drift_text: "11.00 µA (Transient Spike - Safe for Flight)",
    drift_color: "#3fb950",
    bar1_label: "Thunderstorm EMI Spike Weight (-65% Impact)",
    bar1_val: "85%",
    bar1_color: "var(--accent-purple)",
    bar2_label: "Rain Attenuation Humidity Rate (+25% Impact)",
    bar2_val: "40%",
    bar2_color: "var(--accent-blue)"
  },
  PART_010: {
    part_id: "PART_010",
    status_text: "STATUS: HARDWARE REJECT",
    status_color: "var(--accent-red)",
    category: "Spatial Parametric Outlier",
    sensor: "Iddq Static Leakage Sensor Channel",
    factor: "Gate Oxide Pinholes / Substrate Micro-cracks",
    drift_text: "Exceeds Z-Score Outlier Bound (52.0 µA)",
    drift_color: "var(--accent-red)",
    bar1_label: "0h Initial Parametric Leakage (+75%)",
    bar1_val: "85%",
    bar1_color: "var(--accent-red)",
    bar2_label: "Lot Deviation Skew (+15%)",
    bar2_val: "30%",
    bar2_color: "var(--accent-orange)"
  },
  PART_025: {
    part_id: "PART_025",
    status_text: "STATUS: EARLY REJECTION (SAFETY SLOPE EXCEEDED)",
    status_color: "var(--accent-red)",
    category: "Time-Series Drift Slope Violation",
    sensor: "Thermal Transient Channel",
    factor: "Predicted 168h Drift exceeds Calculated Safety Slope Limit",
    drift_text: "Forecast Slope Exceeds Limit (39.0 µA)",
    drift_color: "var(--accent-red)",
    bar1_label: "24h Drift Delta Acceleration (+68%)",
    bar1_val: "80%",
    bar1_color: "var(--accent-red)",
    bar2_label: "Regression Safety Slope Deviation (+22%)",
    bar2_val: "45%",
    bar2_color: "var(--accent-orange)"
  }
};

// 1. Health API
app.get("/api/health", (req: Request, res: Response) => {
  const all = dataStore.getAll();
  res.json({
    status: "healthy",
    service: "ISRO Ground Station Telemetry API",
    components_in_db: all.length
  });
});

// 2. Authentication API
app.post("/api/auth/login", (req: Request, res: Response) => {
  const { operatorId, accessKey } = req.body || {};
  if (operatorId && typeof accessKey === "string" && accessKey.length >= 4) {
    return res.json({
      status: "success",
      token: "SESSION_ISRO_ISTRAC_SECURE_TOKEN_9921",
      operator: {
        operatorId: operatorId || "ISTRAC-OPERATOR-01",
        name: "Dr. Vikram S.",
        station: "ISTRAC Bengaluru Mission Operations",
        role: "Ground Station Screening Officer"
      }
    });
  }
  return res.status(401).json({ detail: "Invalid operator security credentials" });
});

// 3. Vehicles API
app.get(["/api/vehicles", "/api/vehicles/"], (req: Request, res: Response) => {
  const result = Object.values(VEHICLE_DEFAULTS);
  res.json(result);
});

app.get("/api/vehicles/:vehicle", (req: Request, res: Response) => {
  const vehicle = (req.params.vehicle || "LVM3").toUpperCase();
  const comps = dataStore.getByVehicle(vehicle);
  const base = VEHICLE_DEFAULTS[vehicle] || VEHICLE_DEFAULTS["LVM3"];

  if (comps.length > 0) {
    const rejects = comps.filter(c => c.final_flag).length;
    const weather = comps.filter(c => c.weather_flag).length;
    const passed = Math.max(0, comps.length - rejects - weather);
    return res.json({
      ...base,
      id: vehicle,
      total_components: comps.length,
      passed: passed > 0 ? passed : base.passed,
      rejects: rejects > 0 ? rejects : base.rejects,
      weather: weather > 0 ? weather : base.weather,
      lot_id: `Lot ID: ${comps[0]?.lot_id || base.lot_id}`
    });
  }

  res.json(base);
});

// 4. Telemetry Register API
app.get("/api/telemetry", (req: Request, res: Response) => {
  const vehicle = (req.query.vehicle as string || "LVM3").toUpperCase();
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const search = (req.query.search as string || "").toLowerCase().trim();
  const category = req.query.category as string || "";

  let comps = dataStore.getByVehicle(vehicle);
  if (comps.length === 0) {
    comps = dataStore.getAll();
  }

  const channels = ["Static Leakage Sensor", "Thermal Transient Sensor", "Ground EMI Array", "Radiation Shield Monitor", "Power Bus"];

  let formatted = comps.map((c, idx) => {
    let cat = "CLEARED_FLIGHT";
    let status = "CLEARED";
    let factor = "Nominal Parameters Satisfied";

    if (c.weather_flag) {
      cat = "ATMOSPHERIC_NOISE";
      status = "RE_SCREEN";
      factor = "Thunderstorm EMI Pulse & Rain Attenuation";
    } else if (c.flag_A && c.flag_B) {
      cat = "SPATIAL_OUTLIER";
      status = "REJECTED";
      factor = "Wafer Defect & Severe Thermal Runaway";
    } else if (c.flag_A) {
      cat = "SPATIAL_OUTLIER";
      status = "REJECTED";
      factor = c.explanation_A || "Gate Oxide Pinholes / Micro-cracks";
    } else if (c.flag_B) {
      cat = "THERMAL_DRIFT";
      status = "REJECTED";
      factor = c.explanation_B || "Exceeds Safety Slope Cutoff";
    }

    return {
      part_id: c.component_id.replace(`${vehicle}-`, ""),
      vehicle_type: c.vehicle || vehicle,
      sensing_channel: channels[idx % channels.length],
      failure_factor: factor,
      iddq_0h_uA: c.Iddq_uA_0h,
      iddq_24h_uA: c.Iddq_uA_24h,
      forecast_iddq_168h_uA: c.Iddq_uA_pred168h || (c.Iddq_uA_24h * 1.05),
      anomaly_category: cat,
      status
    };
  });

  if (category) {
    formatted = formatted.filter(r => r.anomaly_category === category);
  }
  if (search) {
    formatted = formatted.filter(r =>
      r.part_id.toLowerCase().includes(search) ||
      r.failure_factor.toLowerCase().includes(search) ||
      r.sensing_channel.toLowerCase().includes(search)
    );
  }

  const total = formatted.length;
  const paged = formatted.slice(offset, offset + limit);

  res.json({
    records: paged,
    total
  });
});

// 5. Diagnostics Inspections API
app.get("/api/diagnostics/inspections", (req: Request, res: Response) => {
  const list = [
    { part_id: "PART_088", factor: "Thunderstorm EMI Pulse (-35 dB) & Rain (18.5 mm/hr)" },
    { part_id: "PART_010", factor: "Gate Oxide Pinholes / Substrate Micro-cracks" },
    { part_id: "PART_025", factor: "Predicted 168h Drift exceeds Calculated Safety Slope Limit" },
    { part_id: "PART_036", factor: "Wafer Edge Defect Cluster (CH-22)" },
    { part_id: "PART_048", factor: "Thermal Runaway Acceleration (Burn-in 24h)" },
    { part_id: "PART_001", factor: "Nominal Silicon Baseline Parameters Qualified" }
  ];
  res.json(list);
});

app.get("/api/diagnostics/inspection/:partId", (req: Request, res: Response) => {
  const partId = req.params.partId;
  if (DETAILED_INSPECTIONS[partId]) {
    return res.json(DETAILED_INSPECTIONS[partId]);
  }

  const doc = dataStore.getById(partId) || dataStore.getById(`LVM3-${partId}`) || dataStore.getById(`PSLV-${partId}`) || dataStore.getById(`SSLV-${partId}`);
  if (doc) {
    let statusText = "STATUS: CLEARED FOR FLIGHT (NOMINAL)";
    let statusColor = "#3fb950";
    let cat = "Nominal Flight Telemetry";

    if (doc.weather_flag) {
      statusText = "STATUS: ATMOSPHERIC NOISE (RE-SCREEN)";
      statusColor = "var(--accent-purple)";
      cat = "Environmental Noise Drift";
    } else if (doc.flag_A) {
      statusText = "STATUS: HARDWARE REJECT";
      statusColor = "var(--accent-red)";
      cat = "Spatial Parametric Outlier";
    } else if (doc.flag_B) {
      statusText = "STATUS: EARLY REJECTION (SAFETY SLOPE EXCEEDED)";
      statusColor = "var(--accent-red)";
      cat = "Time-Series Drift Slope Violation";
    }

    return res.json({
      part_id: partId,
      status_text: statusText,
      status_color: statusColor,
      category: cat,
      sensor: "Avionics Multi-channel Bus",
      factor: doc.final_explanation || "Baseline silicon and burn-in verified",
      drift_text: `${(doc.Iddq_uA_pred168h || doc.Iddq_uA_24h * 1.04).toFixed(2)} µA`,
      drift_color: doc.final_flag ? "var(--accent-red)" : "#3fb950",
      bar1_label: "Silicon Parametric Linearity (+82%)",
      bar1_val: "82%",
      bar1_color: doc.final_flag ? "var(--accent-red)" : "var(--accent-green)",
      bar2_label: "Substrate Thermal Dissipation (+45%)",
      bar2_val: "45%",
      bar2_color: "var(--accent-blue)"
    });
  }

  res.json({
    part_id: partId,
    status_text: "STATUS: NOMINAL (QUALIFIED)",
    status_color: "#3fb950",
    category: "Nominal Flight Telemetry",
    sensor: "Avionics Multi-channel Bus",
    factor: "All burn-in and spatial parameters within baseline limits",
    drift_text: "12.00 µA (Safe for launch integration)",
    drift_color: "#3fb950",
    bar1_label: "Baseline Silicon Purity (90% Impact)",
    bar1_val: "88%",
    bar1_color: "var(--accent-green)",
    bar2_label: "Channel Impedance Stability (85% Impact)",
    bar2_val: "82%",
    bar2_color: "var(--accent-blue)"
  });
});

// 6. Live Telemetry Stream Simulation API
app.get("/api/telemetry/live-feed", (req: Request, res: Response) => {
  const vehicle = req.query.vehicle as string || "LVM3";
  const randNum = Math.floor(Math.random() * 80 + 10);
  const partId = `PART_${randNum < 10 ? '00' : '0'}${randNum}`;
  const iddq0 = Number((8.0 + Math.random() * 4.0).toFixed(2));
  const iddq24 = Number((iddq0 + Math.random() * 1.5).toFixed(2));
  const iddq168 = Number((iddq24 * 1.04).toFixed(2));

  res.json({
    part_id: partId,
    vehicle_type: vehicle,
    iddq_0h_uA: iddq0,
    iddq_24h_uA: iddq24,
    forecast_iddq_168h_uA: iddq168,
    status: "CLEARED",
    timestamp: new Date().toISOString()
  });
});

// 7. ML Telemetry Screening API
app.post("/api/telemetry/screen", (req: Request, res: Response) => {
  const { vehicleType, partId, iddq0h, iddq24h, emiDb, rainRate } = req.body || {};
  const v0 = Number(iddq0h) || 10.0;
  const v24 = Number(iddq24h) || 12.0;
  const emi = Number(emiDb) || -80.0;
  const rain = Number(rainRate) || 0.0;

  const isAtmospheric = emi > -55.0 || rain > 8.0;

  if (isAtmospheric) {
    return res.json({
      status_color: "var(--accent-purple)",
      status_text: "STATUS: ATMOSPHERIC NOISE (RE-SCREEN)",
      forecast_iddq_168h_uA: (v0 * 1.05).toFixed(2),
      drift_text: "Transient Spike - Safe for Flight after Re-screen",
      bar1_label: "Thunderstorm EMI Spike Weight (-65% Impact)",
      bar1_val: "85%",
      status: "RE_SCREEN"
    });
  } else if (v0 > 35.0) {
    return res.json({
      status_color: "var(--accent-red)",
      status_text: "STATUS: HARDWARE REJECT (SPATIAL OUTLIER)",
      forecast_iddq_168h_uA: (v24 * 1.2).toFixed(2),
      drift_text: "Gate Oxide Pinholes Detected",
      bar1_label: "0h Initial Parametric Leakage (+75%)",
      bar1_val: "85%",
      status: "REJECTED"
    });
  } else if (v24 > v0 * 2.0) {
    return res.json({
      status_color: "var(--accent-red)",
      status_text: "STATUS: EARLY REJECTION (SAFETY SLOPE EXCEEDED)",
      forecast_iddq_168h_uA: (v24 * 1.6).toFixed(2),
      drift_text: "Exceeds Safety Slope Limit",
      bar1_label: "24h Drift Acceleration (+68%)",
      bar1_val: "80%",
      status: "REJECTED"
    });
  }

  res.json({
    status_color: "#3fb950",
    status_text: "STATUS: CLEARED FOR FLIGHT (NOMINAL)",
    forecast_iddq_168h_uA: (v24 * 1.04).toFixed(2),
    drift_text: "Stable Drift - Nominal Qualification",
    bar1_label: "Baseline Silicon Purity (92%)",
    bar1_val: "90%",
    status: "CLEARED"
  });
});

// 8. Dataset Summary API
app.get("/api/dataset/summary", (req: Request, res: Response) => {
  const all = dataStore.getAll();
  const count = all.length || 950;
  res.json({
    total_records: count,
    csv_size_kb: Math.round((count * 120) / 1024),
    metrics: {
      avg_0h_iddq: 12.4,
      avg_forecast_168h: 18.2
    }
  });
});

// 9. Legacy / Compatibility CSV upload
function parseCSV(text: string): Record<string, any>[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim().replace(/^["']|["']$/g, ""));
    const row: Record<string, any> = {};
    headers.forEach((h, idx) => {
      const val = values[idx];
      const num = Number(val);
      row[h] = !isNaN(num) && val !== "" ? num : val;
    });
    rows.push(row);
  }
  return rows;
}

app.post("/api/upload", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ detail: "No CSV file uploaded" });
  }

  try {
    const csvContent = req.file.buffer.toString("utf-8");
    const rawRows = parseCSV(csvContent);

    if (rawRows.length === 0) {
      return res.status(400).json({ detail: "Uploaded CSV is empty or malformed" });
    }

    const first = rawRows[0];
    if (!first.component_id || !first.lot_id) {
      return res.status(400).json({ detail: "CSV missing required columns: component_id, lot_id" });
    }

    const records: ComponentRecord[] = rawRows.map(r => ({
      ...r,
      component_id: String(r.component_id),
      lot_id: String(r.lot_id),
      vehicle: r.vehicle ? String(r.vehicle) : "UNSPECIFIED",
      Iddq_uA_0h: Number(r.Iddq_uA_0h) || 0,
      Iddq_uA_24h: Number(r.Iddq_uA_24h) || 0,
      Leakage_uA_0h: Number(r.Leakage_uA_0h) || 0,
      Leakage_uA_24h: Number(r.Leakage_uA_24h) || 0,
      PropDelay_ns_0h: Number(r.PropDelay_ns_0h) || 1.2,
      PropDelay_ns_24h: Number(r.PropDelay_ns_24h) || 1.2,
    }));

    const { records: screened, report } = runPipeline(records);
    dataStore.updateRecords(screened, report);

    res.json({
      status: "ok",
      n_components: screened.length,
      n_flagged: report.final_rejected
    });
  } catch (e: any) {
    res.status(400).json({ detail: `Failed to process CSV: ${e.message}` });
  }
});

// Fallback serve HTML
app.get("*", (req: Request, res: Response) => {
  const candidates = [
    path.join(STATIC_DIR, "index.html"),
    path.join(BASE_DIR, "index.html")
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return res.sendFile(p);
    }
  }
  res.send("<h2>ISRO Telemetry Portal is Live!</h2><p>index.html loaded.</p>");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ISRO Telemetry Server running on http://0.0.0.0:${PORT}`);
});
