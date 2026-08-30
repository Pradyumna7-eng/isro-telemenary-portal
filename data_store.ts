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

    if (this.components.length === 0) {
      console.log("[DataStore] Initializing synthetic seed dataset...");
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
    const configs: Record<string, { lots: number; perLot: number }> = {
      LVM3: { lots: 12, perLot: 38 },
      PSLV: { lots: 9, perLot: 36 },
      SSLV: { lots: 5, perLot: 36 },
    };

    let partIdx = 1;
    for (const [vehicle, cfg] of Object.entries(configs)) {
      for (let lot = 1; lot <= cfg.lots; lot++) {
        const lotId = `${vehicle}_LOT_${String(lot).padStart(2, "0")}`;
        for (let p = 0; p < cfg.perLot; p++) {
          const compId = `${vehicle}-PART_${String(partIdx).padStart(3, "0")}`;
          partIdx++;

          const rand = Math.random();
          let id0 = 0, id24 = 0, id96 = 0, id168 = 0;
          let lk0 = 0, lk24 = 0, lk96 = 0, lk168 = 0;
          let pd0 = 0, pd24 = 0, pd96 = 0, pd168 = 0;
          let emi = -75, rain = 1.0;

          if (rand < 0.07) {
            // Spatial parametric defect
            id0 = 38.0 + Math.random() * 20.0;
            id24 = id0 + 1.0 + Math.random() * 3.0;
            id96 = id24 + 2.0 + Math.random() * 4.0;
            id168 = id96 + 2.0 + Math.random() * 6.0;

            lk0 = 8.0 + Math.random() * 8.0;
            lk24 = lk0 + 0.5 + Math.random() * 1.5;
            lk96 = lk24 + 1.0 + Math.random() * 2.0;
            lk168 = lk96 + 1.0 + Math.random() * 3.0;

            pd0 = 1.4 + Math.random() * 0.7;
            pd24 = pd0 + 0.05;
            pd96 = pd24 + 0.08;
            pd168 = pd96 + 0.12;
            emi = -70 + Math.random() * 10;
            rain = Math.random() * 4;
          } else if (rand < 0.13) {
            // Thermal Drift Violation
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
            rain = Math.random() * 5;
          } else if (rand < 0.18) {
            // Atmospheric / EMI noise trigger
            id0 = 10.0 + Math.random() * 5.0;
            id24 = id0 + 3.5 + Math.random() * 2.5;
            id96 = id0 + 0.5 + Math.random() * 1.3;
            id168 = id0 + 0.5 + Math.random() * 1.5;

            lk0 = 1.8 + Math.random() * 1.2;
            lk24 = lk0 + 1.5 + Math.random() * 1.5;
            lk96 = lk0 + 0.2 + Math.random() * 0.6;
            lk168 = lk0 + 0.3 + Math.random() * 0.6;

            pd0 = 1.18 + Math.random() * 0.14;
            pd24 = pd0 + 0.1 + Math.random() * 0.15;
            pd96 = pd0 + 0.05;
            pd168 = pd0 + 0.06;
            emi = -38 + Math.random() * 6;
            rain = 14 + Math.random() * 10;
          } else {
            // Nominal
            id0 = 8.0 + Math.random() * 5.5;
            id24 = id0 + 0.2 + Math.random() * 1.3;
            id96 = id24 + 0.2 + Math.random() * 1.6;
            id168 = id96 + 0.2 + Math.random() * 1.8;

            lk0 = 1.2 + Math.random() * 1.6;
            lk24 = lk0 + 0.1 + Math.random() * 0.4;
            lk96 = lk24 + 0.1 + Math.random() * 0.6;
            lk168 = lk96 + 0.1 + Math.random() * 0.7;

            pd0 = 1.1 + Math.random() * 0.2;
            pd24 = pd0 + 0.01 + Math.random() * 0.04;
            pd96 = pd24 + 0.01 + Math.random() * 0.05;
            pd168 = pd96 + 0.01 + Math.random() * 0.06;
            emi = -80 + Math.random() * 10;
            rain = Math.random() * 2;
          }

          raw.push({
            component_id: compId,
            lot_id: lotId,
            vehicle,
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
