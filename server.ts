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
    lot_id: "Lot ID: LVM3_M4_CRYOGENIC_BUS",
    max_iddq: "55.0 µA",
    wind_shear: "45 knots",
    emi_limit: "-80 dB",
    slope_limit: 55.0,
    slope_text: "LVM3 Safety Slope Limit (55.0 µA)",
    part10_iddq: "48.00 µA",
    part25_drift: "39.00 µA",
    stages: ["S200 Solid Boosters", "L110 Vikas Liquid Core", "C25 Cryogenic Upper Stage", "Payload Fairing & Avionics"]
  },
  PSLV: {
    id: "PSLV",
    name: "PSLV (Polar Satellite Launch Vehicle)",
    total_components: 320,
    passed: 295,
    rejects: 18,
    weather: 7,
    lot_id: "Lot ID: PSLV_C58_EQUIPMENT_BAY",
    max_iddq: "40.0 µA",
    wind_shear: "35 knots",
    emi_limit: "-70 dB",
    slope_limit: 40.0,
    slope_text: "PSLV Safety Slope Limit (40.0 µA)",
    part10_iddq: "36.50 µA",
    part25_drift: "31.20 µA",
    stages: ["PS1 Solid Stage + 6 Strapons", "PS2 Vikas Liquid Engine", "PS3 Solid Rocket Motor", "PS4 Dual Liquid Stage"]
  },
  SSLV: {
    id: "SSLV",
    name: "SSLV (Small Satellite Launch Vehicle)",
    total_components: 180,
    passed: 164,
    rejects: 12,
    weather: 4,
    lot_id: "Lot ID: SSLV_D3_VTM_STAGE",
    max_iddq: "30.0 µA",
    wind_shear: "30 knots",
    emi_limit: "-60 dB",
    slope_limit: 30.0,
    slope_text: "SSLV Safety Slope Limit (30.0 µA)",
    part10_iddq: "27.80 µA",
    part25_drift: "24.50 µA",
    stages: ["SS1 Solid Motor (87s)", "SS2 Solid Motor (113s)", "SS3 Solid Motor (107s)", "Velocity Trimming Module (VTM)"]
  },
  GSLV: {
    id: "GSLV",
    name: "GSLV Mk II (Geosynchronous Launch Vehicle)",
    total_components: 350,
    passed: 318,
    rejects: 22,
    weather: 10,
    lot_id: "Lot ID: GSLV_F14_CUS_AVIONICS",
    max_iddq: "48.0 µA",
    wind_shear: "40 knots",
    emi_limit: "-75 dB",
    slope_limit: 48.0,
    slope_text: "GSLV Safety Slope Limit (48.0 µA)",
    part10_iddq: "43.20 µA",
    part25_drift: "35.80 µA",
    stages: ["GS1 Solid Stage + 4 Liquid Strapons", "GS2 High-Thrust Liquid Stage", "Cryogenic Upper Stage (CUS-12)", "Composite Payload Shroud"]
  },
  NGLV: {
    id: "NGLV",
    name: "NGLV SOORYA (Next-Gen Heavy Launcher)",
    total_components: 500,
    passed: 465,
    rejects: 25,
    weather: 10,
    lot_id: "Lot ID: NGLV_SOORYA_CORE_BUS",
    max_iddq: "50.0 µA",
    wind_shear: "50 knots",
    emi_limit: "-85 dB",
    slope_limit: 50.0,
    slope_text: "NGLV Safety Slope Limit (50.0 µA)",
    part10_iddq: "46.00 µA",
    part25_drift: "37.50 µA",
    stages: ["Reusable Booster (Methane/LOX)", "Semi-Cryogenic Core Stage", "Cryogenic Upper Stage", "Payload Interface Ring"]
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
  const vehicle = (req.query.vehicle as string || "LVM3").toUpperCase();
  const comps = dataStore.getByVehicle(vehicle);
  const list: any[] = [];

  // Add key archetype parts first
  list.push(
    { part_id: "PART_088", factor: "Thunderstorm EMI Pulse (-35 dB) & Rain (18.5 mm/hr)" },
    { part_id: "PART_010", factor: "Gate Oxide Pinholes / Substrate Micro-cracks" },
    { part_id: "PART_025", factor: "Predicted 168h Drift exceeds Calculated Safety Slope Limit" },
    { part_id: "PART_036", factor: "Wafer Edge Defect Cluster (CH-22)" },
    { part_id: "PART_048", factor: "Thermal Runaway Acceleration (Burn-in 24h)" },
    { part_id: "PART_001", factor: "Nominal Silicon Baseline Parameters Qualified" }
  );

  // Add more from current vehicle dataset
  comps.slice(0, 30).forEach(c => {
    const pId = c.component_id.replace(`${vehicle}-`, "");
    if (!list.some(x => x.part_id === pId)) {
      list.push({
        part_id: pId,
        factor: c.final_explanation || c.explanation_A || c.explanation_B || "Nominal telemetry parameters"
      });
    }
  });

  res.json(list);
});

// 5b. Spatial Wafer Map API for dynamic realistic visualization
app.get("/api/telemetry/spatial-map", (req: Request, res: Response) => {
  const vehicle = (req.query.vehicle as string || "LVM3").toUpperCase();
  let comps = dataStore.getByVehicle(vehicle);
  if (comps.length === 0) comps = dataStore.getAll().slice(0, 450);

  const dies = comps.map(c => {
    let status = "CLEARED";
    if (c.weather_flag) status = "RE_SCREEN";
    else if (c.final_flag) status = "REJECTED";

    return {
      part_id: c.component_id.replace(`${vehicle}-`, ""),
      lot_id: c.lot_id,
      die_x: c.die_x ?? 0,
      die_y: c.die_y ?? 0,
      wafer_id: c.wafer_id || "WAF-01",
      subsystem: c.subsystem || "Avionics Guidance & Navigation",
      channel: c.sensing_channel || "Static Leakage Sensor Channel",
      iddq_0h: c.Iddq_uA_0h,
      iddq_24h: c.Iddq_uA_24h,
      iddq_168h: c.Iddq_uA_pred168h || (c.Iddq_uA_24h * 1.05),
      anomaly_score: c.anomaly_score_A || 0.1,
      flag_spatial: !!c.flag_A,
      flag_drift: !!c.flag_B,
      status
    };
  });

  res.json({
    vehicle,
    total_dies: dies.length,
    dies
  });
});

// 5c. Multi-Point Time-Series Drift API for realistic curve animation
app.get("/api/telemetry/drift-series", (req: Request, res: Response) => {
  const vehicle = (req.query.vehicle as string || "LVM3").toUpperCase();
  const base = VEHICLE_DEFAULTS[vehicle] || VEHICLE_DEFAULTS["LVM3"];
  const slopeLimit = base.slope_limit || 55.0;

  // Return curves for: Selected Part (or PART_025), Outlier PART_010, Weather PART_088, Nominal Baseline, and Confidence Bands
  const selectedPart = req.query.partId as string || "PART_025";
  const doc = dataStore.getById(selectedPart) || dataStore.getById(`${vehicle}-${selectedPart}`);

  const v0 = doc ? doc.Iddq_uA_0h : 11.0;
  const v24 = doc ? doc.Iddq_uA_24h : 24.5;
  const v96 = doc?.Iddq_uA_96h || (v24 + (v24 - v0) * 2.8);
  const v168 = doc?.Iddq_uA_pred168h || (v0 + (v24 - v0) / 24 * 168 * 1.15);

  const hours = [0, 12, 24, 48, 72, 96, 120, 144, 168];

  const interp = (h0: number, h24: number, h96: number, h168: number) => {
    return hours.map(h => {
      let val = h0;
      if (h <= 24) {
        val = h0 + (h24 - h0) * (h / 24);
      } else if (h <= 96) {
        val = h24 + (h96 - h24) * ((h - 24) / 72);
      } else {
        val = h96 + (h168 - h96) * ((h - 96) / 72);
      }
      return { hour: h, iddq_uA: Number(val.toFixed(2)) };
    });
  };

  const selectedSeries = interp(v0, v24, v96, v168);
  const nominalSeries = interp(8.5, 9.2, 9.8, 10.4);
  const outlierSeries = interp(48.0, 50.2, 51.4, 53.0);
  const weatherSeries = interp(10.2, 19.5, 11.2, 11.0);

  res.json({
    vehicle,
    safety_slope_limit: slopeLimit,
    selected_part_id: selectedPart,
    selected_series: selectedSeries,
    nominal_series: nominalSeries,
    outlier_series: outlierSeries,
    weather_series: weatherSeries,
    confidence_upper: nominalSeries.map(p => ({ hour: p.hour, iddq_uA: Number((p.iddq_uA * 1.25).toFixed(2)) })),
    confidence_lower: nominalSeries.map(p => ({ hour: p.hour, iddq_uA: Number((p.iddq_uA * 0.85).toFixed(2)) })),
  });
});

// 5d. Rocket Subsystem Topology API
app.get("/api/telemetry/topology", (req: Request, res: Response) => {
  const vehicle = (req.query.vehicle as string || "LVM3").toUpperCase();
  const base = VEHICLE_DEFAULTS[vehicle] || VEHICLE_DEFAULTS["LVM3"];

  const subsystems = [
    { id: "SYS_AGNU", name: "Avionics Guidance & Navigation", status: "NOMINAL", freq_hz: "100 Hz", load_pct: 42, health: 99.4, sensor_count: 64 },
    { id: "SYS_CRYOCON", name: "Cryogenic Upper Stage Valve Controller", status: "NOMINAL", freq_hz: "50 Hz", load_pct: 38, health: 98.8, sensor_count: 48 },
    { id: "SYS_TTC", name: "S-Band Telemetry RF Transmitter", status: "NOMINAL", freq_hz: "2.2 GHz", load_pct: 65, health: 99.1, sensor_count: 32 },
    { id: "SYS_IGNITE", name: "Solid Booster Ignition Sequencer", status: "ARMED_NOMINAL", freq_hz: "1 kHz", load_pct: 28, health: 100.0, sensor_count: 24 },
    { id: "SYS_PYRO", name: "Stage Separation Pyrotechnics", status: "STANDBY_SAFE", freq_hz: "10 Hz", load_pct: 15, health: 99.9, sensor_count: 18 },
    { id: "SYS_RCS", name: "Reaction Control Thrusters", status: "ACTIVE_PULSE", freq_hz: "200 Hz", load_pct: 54, health: 97.6, sensor_count: 36 }
  ];

  res.json({
    vehicle,
    stages: base.stages || ["Stage 1", "Stage 2", "Stage 3", "Payload Bay"],
    subsystems
  });
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

app.post("/api/upload", upload.single("file") as any, (req: Request, res: Response) => {
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
    path.join(BASE_DIR, "public", "index.html"),
    path.join(BASE_DIR, "index.html")
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return res.sendFile(p);
    }
  }
  res.send("<h2>ISRO Telemetry Portal is Live!</h2><p>index.html loaded.</p>");
});

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ISRO Telemetry Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
