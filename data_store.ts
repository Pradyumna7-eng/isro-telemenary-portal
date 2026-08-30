import fs from "fs";
import path from "path";
import { ComponentRecord, PipelineReport, runPipeline } from "./pipeline";

const COMPONENTS_FILE = path.join(process.cwd(), "components_store.json");
const RUNS_FILE = path.join(process.cwd(), "runs_store.json");

export class DataStore {
  private components: ComponentRecord[] = [];
  private runs: Array<{ report: PipelineReport; n_components: number }> = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(COMPONENTS_FILE)) {
        const raw = fs.readFileSync(COMPONENTS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.components = parsed;
          console.log(`[DataStore] Loaded ${this.components.length} components from ${COMPONENTS_FILE}`);
        }
      }
    } catch (e) {
      console.warn("[DataStore] Failed to load components_store.json:", e);
    }

    try {
      if (fs.existsSync(RUNS_FILE)) {
        const raw = fs.readFileSync(RUNS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.runs = parsed;
        }
      }
    } catch (e) {
      console.warn("[DataStore] Failed to load runs_store.json:", e);
    }

    if (this.components.length < 1500 || !this.components[0]?.die_x) {
      console.log("[DataStore] Initializing enriched multi-vehicle synthetic dataset with 1,800+ records...");
      this.generateSyntheticSeed();
    }
  }

  public save(): void {
    try {
      fs.writeFileSync(COMPONENTS_FILE, JSON.stringify(this.components, null, 2), "utf-8");
    } catch (e) {
      console.warn("[DataStore] Failed to save components_store.json:", e);
    }
    try {
      fs.writeFileSync(RUNS_FILE, JSON.stringify(this.runs, null, 2), "utf-8");
    } catch (e) {
      console.warn("[DataStore] Failed to save runs_store.json:", e);
    }
  }

  public getAll(): ComponentRecord[] {
    return this.components;
  }

  public getByVehicle(vehicle: string): ComponentRecord[] {
    return this.components.filter(c => (c.vehicle || "").toUpperCase() === vehicle.toUpperCase());
  }

  public getById(id: string): ComponentRecord | undefined {
    return this.components.find(c => c.component_id === id);
  }

  public getDistinctVehicles(): string[] {
    const set = new Set<string>();
    for (const c of this.components) {
      if (c.vehicle) set.add(c.vehicle);
    }
    if (set.size === 0) {
      return ["LVM3", "PSLV", "SSLV"];
    }
    return Array.from(set);
  }

  public updateRecords(records: ComponentRecord[], report: PipelineReport): void {
    this.components = records;
    this.runs.push({ report, n_components: records.length });
    this.save();
  }

  public generateSyntheticSeed(): void {
    const raw: ComponentRecord[] = [];
    const configs: Record<string, { lots: number; perLot: number; defaultLimit: number; stageName: string }> = {
      LVM3: { lots: 10, perLot: 45, defaultLimit: 55.0, stageName: "LVM3_M4_CRYOGENIC_BUS" },
      PSLV: { lots: 8, perLot: 40, defaultLimit: 40.0, stageName: "PSLV_C58_EQUIPMENT_BAY" },
      SSLV: { lots: 5, perLot: 36, defaultLimit: 30.0, stageName: "SSLV_D3_VTM_STAGE" },
      GSLV: { lots: 7, perLot: 50, defaultLimit: 48.0, stageName: "GSLV_F14_CUS_AVIONICS" },
      NGLV: { lots: 10, perLot: 50, defaultLimit: 50.0, stageName: "NGLV_SOORYA_CORE_BUS" },
    };

    const SUBSYSTEMS = [
      { name: "Avionics Guidance & Navigation (AGNU)", channel: "Inertial Laser Gyro Bus" },
      { name: "Cryogenic Upper Stage Valve Actuator", channel: "Thermal Transient Sensor" },
      { name: "S-Band Telemetry Transmitter (TTC-RF)", channel: "Static Leakage Sensor Channel" },
      { name: "Solid Booster Ignition Sequencer (HS200)", channel: "Power Bus Shunt Monitor" },
      { name: "Payload Separation Pyro Controller (PAS)", channel: "Pyro Circuit Sensor" },
      { name: "Reaction Control Thruster Driver (RCS)", channel: "Valve Driver Impedance" },
      { name: "Solar Array Drive Mechanism (SADM)", channel: "Slip-Ring Noise Sensor" },
      { name: "Power Conditioning & Distribution (PCDU)", channel: "Main Bus Rail Sensor" },
      { name: "Telemetry Multiplexer Array (TMUX-16)", channel: "Differential ADC Channel" },
      { name: "Radiation Shield Silicon Sensor (RAD)", channel: "Silicon Die Leakage Array" }
    ];

    let partIdx = 1;
    for (const [vehicle, cfg] of Object.entries(configs)) {
      for (let lot = 1; lot <= cfg.lots; lot++) {
        const lotId = `${vehicle}_LOT_${String(lot).padStart(2, "0")}`;
        for (let p = 0; p < cfg.perLot; p++) {
          const compId = `${vehicle}-PART_${String(partIdx).padStart(3, "0")}`;
          const sub = SUBSYSTEMS[(partIdx - 1) % SUBSYSTEMS.length];
          partIdx++;

          // Spatial wafer coordinates (-14 to +14 die grid)
          const angle = (p / cfg.perLot) * 2 * Math.PI + (lot * 0.45);
          const radNorm = Math.sqrt((p + 0.5) / cfg.perLot);
          const dieX = Number((radNorm * 14 * Math.cos(angle)).toFixed(1));
          const dieY = Number((radNorm * 14 * Math.sin(angle)).toFixed(1));
          const waferDist = Math.sqrt(dieX * dieX + dieY * dieY);
          const isWaferEdge = waferDist > 11.5;

          const rand = Math.random();
          let id0 = 0, id24 = 0, id96 = 0, id168 = 0;
          let lk0 = 0, lk24 = 0, lk96 = 0, lk168 = 0;
          let pd0 = 0, pd24 = 0, pd96 = 0, pd168 = 0;
          let emi = -75, rain = 1.0;

          if (compId.endsWith("PART_010") || (rand < 0.06) || (isWaferEdge && rand < 0.22)) {
            // Spatial parametric defect (wafer edge micro-cracks / gate oxide pinhole)
            id0 = 38.0 + Math.random() * 22.0;
            id24 = id0 + 1.0 + Math.random() * 3.0;
            id96 = id24 + 2.0 + Math.random() * 4.0;
            id168 = id96 + 2.0 + Math.random() * 6.0;

            lk0 = 8.0 + Math.random() * 8.0;
            lk24 = lk0 + 0.5 + Math.random() * 1.5;
            lk96 = lk24 + 1.0 + Math.random() * 2.0;
            lk168 = lk96 + 1.0 + Math.random() * 3.0;

            pd0 = 1.45 + Math.random() * 0.6;
            pd24 = pd0 + 0.05;
            pd96 = pd24 + 0.08;
            pd168 = pd96 + 0.12;
            emi = -70 + Math.random() * 10;
            rain = Math.random() * 3;
          } else if (compId.endsWith("PART_025") || (rand < 0.12)) {
            // Thermal Drift Slope Violation (rapid thermal runaway across burn-in)
            id0 = 9.0 + Math.random() * 5.0;
            id24 = id0 + 14.0 + Math.random() * 12.0;
            id96 = id24 + 20.0 + Math.random() * 15.0;
            id168 = id96 + 25.0 + Math.random() * 20.0;

            lk0 = 1.5 + Math.random() * 1.7;
            lk24 = lk0 + 4.0 + Math.random() * 5.0;
            lk96 = lk24 + 8.0 + Math.random() * 7.0;
            lk168 = lk96 + 10.0 + Math.random() * 10.0;

            pd0 = 1.15 + Math.random() * 0.2;
            pd24 = pd0 + 0.2 + Math.random() * 0.25;
            pd96 = pd24 + 0.3 + Math.random() * 0.3;
            pd168 = pd96 + 0.4 + Math.random() * 0.4;
            emi = -65 + Math.random() * 15;
            rain = Math.random() * 4;
          } else if (compId.endsWith("PART_088") || (rand < 0.17)) {
            // Atmospheric / Ground Station EMI & Precipitation Noise trigger
            id0 = 9.5 + Math.random() * 4.5;
            id24 = id0 + 3.5 + Math.random() * 2.8;
            id96 = id0 + 0.5 + Math.random() * 1.2;
            id168 = id0 + 0.5 + Math.random() * 1.4;

            lk0 = 1.6 + Math.random() * 1.2;
            lk24 = lk0 + 1.6 + Math.random() * 1.4;
            lk96 = lk0 + 0.2 + Math.random() * 0.5;
            lk168 = lk0 + 0.3 + Math.random() * 0.5;

            pd0 = 1.16 + Math.random() * 0.14;
            pd24 = pd0 + 0.1 + Math.random() * 0.15;
            pd96 = pd0 + 0.05;
            pd168 = pd0 + 0.06;
            emi = -36 + Math.random() * 7;
            rain = 15 + Math.random() * 12;
          } else {
            // Nominal Space-Grade Qualified Silicon
            id0 = 7.5 + Math.random() * 5.5;
            id24 = id0 + 0.2 + Math.random() * 1.2;
            id96 = id24 + 0.2 + Math.random() * 1.4;
            id168 = id96 + 0.2 + Math.random() * 1.5;

            lk0 = 1.1 + Math.random() * 1.5;
            lk24 = lk0 + 0.1 + Math.random() * 0.4;
            lk96 = lk24 + 0.1 + Math.random() * 0.5;
            lk168 = lk96 + 0.1 + Math.random() * 0.6;

            pd0 = 1.08 + Math.random() * 0.18;
            pd24 = pd0 + 0.01 + Math.random() * 0.03;
            pd96 = pd24 + 0.01 + Math.random() * 0.04;
            pd168 = pd96 + 0.01 + Math.random() * 0.05;
            emi = -82 + Math.random() * 10;
            rain = Math.random() * 2;
          }

          raw.push({
            component_id: compId,
            lot_id: lotId,
            vehicle,
            subsystem: sub.name,
            sensing_channel: sub.channel,
            die_x: dieX,
            die_y: dieY,
            wafer_id: `WAF-${vehicle.substring(0, 3)}-${String(lot).padStart(2, "0")}`,
            Iddq_uA_0h: Number(id0.toFixed(2)),
            Iddq_uA_24h: Number(id24.toFixed(2)),
            Iddq_uA_96h: Number(id96.toFixed(2)),
            Iddq_uA_168h: Number(id168.toFixed(2)),
            Leakage_uA_0h: Number(lk0.toFixed(2)),
            Leakage_uA_24h: Number(lk24.toFixed(2)),
            Leakage_uA_96h: Number(lk96.toFixed(2)),
            Leakage_uA_168h: Number(lk168.toFixed(2)),
            PropDelay_ns_0h: Number(pd0.toFixed(3)),
            PropDelay_ns_24h: Number(pd24.toFixed(3)),
            PropDelay_ns_96h: Number(pd96.toFixed(3)),
            PropDelay_ns_168h: Number(pd168.toFixed(3)),
            Temp_C_0h: 25.0,
            Temp_C_24h: 85.0,
            Temp_C_96h: 125.0,
            Temp_C_168h: 125.0,
            EMI_dB_24h: Number(emi.toFixed(1)),
            Rain_mm_hr_24h: Number(rain.toFixed(1)),
          });
        }
      }
    }

    const { records, report } = runPipeline(raw);
    this.updateRecords(records, report);
  }
}

export const dataStore = new DataStore();
