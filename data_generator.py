import numpy as np
import pandas as pd

def generate_dataset(n_lots: int = 10, comps_per_lot: int = 40, seed: int = 42) -> pd.DataFrame:
    np.random.seed(seed)
    rows = []
    part_idx = 1

    for lot in range(1, n_lots + 1):
        lot_id = f"LOT_{lot:02d}"
        for _ in range(comps_per_lot):
            component_id = f"PART_{part_idx:03d}"
            part_idx += 1

            rand_type = np.random.rand()

            if rand_type < 0.07:
                # Spatial parametric defect (high 0h current)
                iddq_0 = np.random.uniform(38.0, 58.0)
                iddq_24 = iddq_0 + np.random.uniform(1.0, 4.0)
                iddq_96 = iddq_24 + np.random.uniform(2.0, 6.0)
                iddq_168 = iddq_96 + np.random.uniform(2.0, 8.0)

                leak_0 = np.random.uniform(8.0, 16.0)
                leak_24 = leak_0 + np.random.uniform(0.5, 2.0)
                leak_96 = leak_24 + np.random.uniform(1.0, 3.0)
                leak_168 = leak_96 + np.random.uniform(1.0, 4.0)

                prop_0 = np.random.uniform(1.40, 2.10)
                prop_24 = prop_0 + 0.05
                prop_96 = prop_24 + 0.08
                prop_168 = prop_96 + 0.12

                temp_0, temp_24, temp_96, temp_168 = 25.0, 85.0, 125.0, 125.0
                emi_24 = np.random.uniform(-75.0, -65.0)
                rain_24 = np.random.uniform(0.0, 4.0)

            elif rand_type < 0.13:
                # Thermal Drift Violation (Exceeds safety slope)
                iddq_0 = np.random.uniform(9.0, 14.0)
                iddq_24 = iddq_0 + np.random.uniform(14.0, 26.0)
                iddq_96 = iddq_24 + np.random.uniform(20.0, 35.0)
                iddq_168 = iddq_96 + np.random.uniform(25.0, 45.0)

                leak_0 = np.random.uniform(1.5, 3.2)
                leak_24 = leak_0 + np.random.uniform(4.0, 9.0)
                leak_96 = leak_24 + np.random.uniform(8.0, 15.0)
                leak_168 = leak_96 + np.random.uniform(10.0, 20.0)

                prop_0 = np.random.uniform(1.15, 1.35)
                prop_24 = prop_0 + np.random.uniform(0.20, 0.45)
                prop_96 = prop_24 + np.random.uniform(0.30, 0.60)
                prop_168 = prop_96 + np.random.uniform(0.40, 0.80)

                temp_0, temp_24, temp_96, temp_168 = 25.0, 85.0, 125.0, 125.0
                emi_24 = np.random.uniform(-75.0, -60.0)
                rain_24 = np.random.uniform(0.0, 5.0)

            elif rand_type < 0.18:
                # Atmospheric / Ground EMI noise trigger
                iddq_0 = np.random.uniform(10.0, 15.0)
                iddq_24 = iddq_0 + np.random.uniform(3.5, 6.0)
                iddq_96 = iddq_0 + np.random.uniform(0.5, 1.8)
                iddq_168 = iddq_0 + np.random.uniform(0.5, 2.0)

                leak_0 = np.random.uniform(1.8, 3.0)
                leak_24 = leak_0 + np.random.uniform(1.5, 3.0)
                leak_96 = leak_0 + np.random.uniform(0.2, 0.8)
                leak_168 = leak_0 + np.random.uniform(0.3, 0.9)

                prop_0 = np.random.uniform(1.18, 1.32)
                prop_24 = prop_0 + np.random.uniform(0.10, 0.25)
                prop_96 = prop_0 + 0.05
                prop_168 = prop_0 + 0.06

                temp_0, temp_24, temp_96, temp_168 = 25.0, 85.0, 125.0, 125.0
                emi_24 = np.random.uniform(-42.0, -32.0)
                rain_24 = np.random.uniform(14.0, 24.0)

            else:
                # Nominal passing component
                iddq_0 = np.random.uniform(8.0, 13.5)
                iddq_24 = iddq_0 + np.random.uniform(0.2, 1.5)
                iddq_96 = iddq_24 + np.random.uniform(0.2, 1.8)
                iddq_168 = iddq_96 + np.random.uniform(0.2, 2.0)

                leak_0 = np.random.uniform(1.2, 2.8)
                leak_24 = leak_0 + np.random.uniform(0.1, 0.5)
                leak_96 = leak_24 + np.random.uniform(0.1, 0.7)
                leak_168 = leak_96 + np.random.uniform(0.1, 0.8)

                prop_0 = np.random.uniform(1.10, 1.30)
                prop_24 = prop_0 + np.random.uniform(0.01, 0.05)
                prop_96 = prop_24 + np.random.uniform(0.01, 0.06)
                prop_168 = prop_96 + np.random.uniform(0.01, 0.07)

                temp_0, temp_24, temp_96, temp_168 = 25.0, 85.0, 125.0, 125.0
                emi_24 = np.random.uniform(-85.0, -70.0)
                rain_24 = np.random.uniform(0.0, 2.0)

            rows.append({
                "component_id": component_id,
                "lot_id": lot_id,
                "Iddq_uA_0h": round(float(iddq_0), 2),
                "Iddq_uA_24h": round(float(iddq_24), 2),
                "Iddq_uA_96h": round(float(iddq_96), 2),
                "Iddq_uA_168h": round(float(iddq_168), 2),
                "Leakage_uA_0h": round(float(leak_0), 2),
                "Leakage_uA_24h": round(float(leak_24), 2),
                "Leakage_uA_96h": round(float(leak_96), 2),
                "Leakage_uA_168h": round(float(leak_168), 2),
                "PropDelay_ns_0h": round(float(prop_0), 3),
                "PropDelay_ns_24h": round(float(prop_24), 3),
                "PropDelay_ns_96h": round(float(prop_96), 3),
                "PropDelay_ns_168h": round(float(prop_168), 3),
                "Temp_C_0h": temp_0,
                "Temp_C_24h": temp_24,
                "Temp_C_96h": temp_96,
                "Temp_C_168h": temp_168,
                "EMI_dB_24h": round(float(emi_24), 1),
                "Rain_mm_hr_24h": round(float(rain_24), 1),
            })

    return pd.DataFrame(rows)

def load_real_data(csv_path: str) -> pd.DataFrame:
    return pd.read_csv(csv_path)
