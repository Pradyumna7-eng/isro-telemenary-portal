import argparse
import sys
import pandas as pd
from data_generator import generate_dataset, load_real_data
from pipeline import run_pipeline
from db import get_components_collection, get_runs_collection, ensure_indexes

VEHICLE_LOT_COUNTS = {
    'LVM3': {'n_lots': 12, 'comps_per_lot': 38},   # ~450 components
    'PSLV': {'n_lots': 9, 'comps_per_lot': 36},    # ~320 components
    'SSLV': {'n_lots': 5, 'comps_per_lot': 36},    # ~180 components
}

def build_synthetic_multi_vehicle():
    frames = []
    for vehicle, cfg in VEHICLE_LOT_COUNTS.items():
        df = generate_dataset(
            n_lots=cfg['n_lots'],
            comps_per_lot=cfg['comps_per_lot'],
            seed=abs(hash(vehicle)) % 1000
        )
        df['component_id'] = vehicle + '-' + df['component_id']
        df['lot_id'] = vehicle + '_' + df['lot_id']
        df['vehicle'] = vehicle
        frames.append(df)
    return pd.concat(frames, ignore_index=True)

def tag_weather_flag(result_df):
    result_df = result_df.copy()
    borderline = (result_df['anomaly_score_A'] >= 0.42) & (result_df['anomaly_score_A'] < 0.50)
    result_df['weather_flag'] = borderline & ~result_df['final_flag']
    return result_df

def run_seed(use_real_csv=None):
    if use_real_csv:
        df = load_real_data(use_real_csv)
        if 'vehicle' not in df.columns:
            df['vehicle'] = 'UNSPECIFIED'
    else:
        df = build_synthetic_multi_vehicle()

    print(f"Running pipeline on {len(df)} components across {df['vehicle'].nunique()} vehicle(s)...")

    result, report = run_pipeline(df)
    result = tag_weather_flag(result)

    ensure_indexes()
    coll = get_components_collection()
    coll.delete_many({})

    records = result.to_dict(orient='records')
    for r in records:
        for k, v in r.items():
            if hasattr(v, 'item'):
                r[k] = v.item()

    coll.insert_many(records)
    get_runs_collection().insert_one({'report': report, 'n_components': len(records)})

    print(f"Inserted {len(records)} components into database.")
    print(f"Flagged rejects: {result['final_flag'].sum()} | Weather re-screen: {result['weather_flag'].sum()}")
    return result, report

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--real', type=str, default=None, help='path to a real CSV to load')
    args = parser.parse_args()
    run_seed(use_real_csv=args.real)
