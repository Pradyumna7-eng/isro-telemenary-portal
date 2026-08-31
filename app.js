// ISRO Ground Station & Telemetry Diagnostics Portal - Complete Client Logic
// Full-featured Real-time Animation Engine, Realistic Multi-Vehicle Graphs, & Offline Standalone Fallback

let currentVehicle = "LVM3";
let vehicleProfiles = {};
let tablePage = 0;
const pageSize = 10;
let liveInterval = null;
let searchDebounceTimer = null;
let isStaticMode = false;

// Visualization & Animation State
let waferViewMode = "wafer"; // "wafer" or "scatter"
let driftViewMode = "fleet"; // "fleet" or "precision"
let isRadarEnabled = true;
let isOscEnabled = true;
let playbackSpeed = 1.0;
let radarAngle = 0; // degrees
let oscSweepTime = 0; // 0 to 168 hours
let lastFrameTime = performance.now();
let selectedAuditPart = "PART_025";
let spatialDiesData = [];
let driftSeriesData = null;
let topologyData = null;
let animationFrameId = null;

// Multi-vehicle Fallback Specifications
const FALLBACK_VEHICLES = {
    "LVM3": {
        "id": "LVM3",
        "name": "LVM3 (Heavy Payload Launch Vehicle)",
        "total_components": 450,
        "passed": 412,
        "rejects": 26,
        "weather": 12,
        "lot_id": "Lot ID: LVM3_M4_CRYOGENIC_BUS",
        "max_iddq": "55.0 µA",
        "wind_shear": "45 knots",
        "emi_limit": "-80 dB",
        "slope_limit": 55.0,
        "slope_text": "LVM3 Safety Slope Limit (55.0 µA)",
        "part10_iddq": "48.00 µA",
        "part25_drift": "39.00 µA",
        "stages": ["S200 Solid Boosters", "L110 Core Liquid Stage", "C25 Cryogenic Upper Stage", "Payload Fairing"]
    },
    "PSLV": {
        "id": "PSLV",
        "name": "PSLV (Polar Satellite Launch Vehicle)",
        "total_components": 320,
        "passed": 295,
        "rejects": 18,
        "weather": 7,
        "lot_id": "Lot ID: PSLV_C58_CORE_BUS",
        "max_iddq": "40.0 µA",
        "wind_shear": "35 knots",
        "emi_limit": "-70 dB",
        "slope_limit": 40.0,
        "slope_text": "PSLV Safety Slope Limit (40.0 µA)",
        "part10_iddq": "36.50 µA",
        "part25_drift": "31.20 µA",
        "stages": ["PS1 Solid Core", "PS2 Liquid Vikas Stage", "PS3 Solid Rocket Motor", "PS4 Liquid Stage"]
    },
    "SSLV": {
        "id": "SSLV",
        "name": "SSLV (Small Satellite Launch Vehicle)",
        "total_components": 180,
        "passed": 164,
        "rejects": 12,
        "weather": 4,
        "lot_id": "Lot ID: SSLV_D3_AVIONICS_BUS",
        "max_iddq": "30.0 µA",
        "wind_shear": "30 knots",
        "emi_limit": "-60 dB",
        "slope_limit": 30.0,
        "slope_text": "SSLV Safety Slope Limit (30.0 µA)",
        "part10_iddq": "27.80 µA",
        "part25_drift": "24.50 µA",
        "stages": ["SS1 Solid Motor", "SS2 Solid Stage", "SS3 Solid Stage", "VTM Trimming Module"]
    },
    "GSLV": {
        "id": "GSLV",
        "name": "GSLV Mk II (Cryogenic Stage Vehicle)",
        "total_components": 350,
        "passed": 318,
        "rejects": 22,
        "weather": 10,
        "lot_id": "Lot ID: GSLV_F14_CUS_BUS",
        "max_iddq": "48.0 µA",
        "wind_shear": "40 knots",
        "emi_limit": "-75 dB",
        "slope_limit": 48.0,
        "slope_text": "GSLV Safety Slope Limit (48.0 µA)",
        "part10_iddq": "44.00 µA",
        "part25_drift": "35.50 µA",
        "stages": ["4 Liquid Strap-ons", "GS1 Solid Core", "GS2 Liquid Vikas", "CUS Cryogenic Stage"]
    },
    "NGLV": {
        "id": "NGLV",
        "name": "NGLV SOORYA (Next-Gen Heavy Bus)",
        "total_components": 500,
        "passed": 465,
        "rejects": 25,
        "weather": 10,
        "lot_id": "Lot ID: NGLV_DEV01_AVIONICS",
        "max_iddq": "60.0 µA",
        "wind_shear": "50 knots",
        "emi_limit": "-85 dB",
        "slope_limit": 60.0,
        "slope_text": "NGLV Safety Slope Limit (60.0 µA)",
        "part10_iddq": "52.00 µA",
        "part25_drift": "42.00 µA",
        "stages": ["Reusable Booster (Methane)", "Liquid Methane Core", "Cryogenic Upper Stage", "Payload Bay"]
    }
};

const FALLBACK_INSPECTIONS = {
    "PART_088": {
        "part_id": "PART_088",
        "status_text": "STATUS: ATMOSPHERIC NOISE (RE-SCREEN)",
        "status_color": "var(--accent-purple)",
        "category": "Environmental Noise Drift",
        "sensor": "Ground Station EMI & Weather Sensor Array",
        "factor": "Thunderstorm EMI Pulse (-35 dB) & Rain Rate (18.5 mm/hr) at T=24h",
        "drift_text": "11.00 µA (Transient Spike - Safe for Flight after Re-screen)",
        "drift_color": "#3fb950",
        "bar1_label": "Thunderstorm EMI Spike Weight (-65% Impact)",
        "bar1_val": "85%",
        "bar1_color": "var(--accent-purple)",
        "bar2_label": "Rain Attenuation Humidity Rate (+25% Impact)",
        "bar2_val": "40%",
        "bar2_color": "var(--accent-blue)"
    },
    "PART_010": {
        "part_id": "PART_010",
        "status_text": "STATUS: HARDWARE REJECT (SPATIAL OUTLIER)",
        "status_color": "var(--accent-red)",
        "category": "Spatial Parametric Outlier",
        "sensor": "Iddq Static Leakage Sensor Channel",
        "factor": "Gate Oxide Pinholes / Substrate Micro-cracks",
        "drift_text": "Exceeds Z-Score Outlier Bound (48.0 µA)",
        "drift_color": "var(--accent-red)",
        "bar1_label": "0h Initial Parametric Leakage (+75%)",
        "bar1_val": "85%",
        "bar1_color": "var(--accent-red)",
        "bar2_label": "Lot Deviation Skew (+15%)",
        "bar2_val": "30%",
        "bar2_color": "var(--accent-orange)"
    },
    "PART_025": {
        "part_id": "PART_025",
        "status_text": "STATUS: EARLY REJECTION (SAFETY SLOPE EXCEEDED)",
        "status_color": "var(--accent-red)",
        "category": "Time-Series Drift Slope Violation",
        "sensor": "Thermal Transient Channel",
        "factor": "Predicted 168h Drift exceeds Calculated Safety Slope Limit",
        "drift_text": "Forecast Slope Exceeds Limit (39.0 µA)",
        "drift_color": "var(--accent-red)",
        "bar1_label": "24h Drift Delta Acceleration (+68%)",
        "bar1_val": "80%",
        "bar1_color": "var(--accent-red)",
        "bar2_label": "Regression Safety Slope Deviation (+22%)",
        "bar2_val": "45%",
        "bar2_color": "var(--accent-orange)"
    },
    "PART_036": {
        "part_id": "PART_036",
        "status_text": "STATUS: HARDWARE REJECT (WAFER EDGE DEFECT)",
        "status_color": "var(--accent-red)",
        "category": "Spatial Parametric Outlier",
        "sensor": "Edge Ring Static Leakage Channel",
        "factor": "Wafer Edge Defect Cluster (CH-22)",
        "drift_text": "Spatial Neighborhood Clustering (42.0 µA)",
        "drift_color": "var(--accent-red)",
        "bar1_label": "Radial Edge Distance Penalty (+70%)",
        "bar1_val": "75%",
        "bar1_color": "var(--accent-red)",
        "bar2_label": "Neighbor Correlation Delta (+30%)",
        "bar2_val": "40%",
        "bar2_color": "var(--accent-orange)"
    },
    "PART_048": {
        "part_id": "PART_048",
        "status_text": "STATUS: HARDWARE REJECT (THERMAL RUNAWAY)",
        "status_color": "var(--accent-orange)",
        "category": "Time-Series Drift Slope Violation",
        "sensor": "Power Amplifier Bus Sensor",
        "factor": "Thermal Runaway Acceleration (Burn-in 24h)",
        "drift_text": "Non-linear Leakage Jump (38.5 µA)",
        "drift_color": "var(--accent-orange)",
        "bar1_label": "Thermal Coefficient Acceleration (+80%)",
        "bar1_val": "82%",
        "bar1_color": "var(--accent-orange)",
        "bar2_label": "Current Spurt Velocity (+20%)",
        "bar2_val": "35%",
        "bar2_color": "var(--accent-blue)"
    },
    "PART_001": {
        "part_id": "PART_001",
        "status_text": "STATUS: CLEARED FOR FLIGHT (SPACE QUALIFIED)",
        "status_color": "#3fb950",
        "category": "Nominal Flight Telemetry",
        "sensor": "Avionics Multi-channel Bus",
        "factor": "Nominal Silicon Baseline Parameters Qualified",
        "drift_text": "10.40 µA (Flight Ready Baseline)",
        "drift_color": "#3fb950",
        "bar1_label": "Baseline Silicon Purity (92% Impact)",
        "bar1_val": "90%",
        "bar1_color": "var(--accent-green)",
        "bar2_label": "Channel Impedance Stability (88% Impact)",
        "bar2_val": "85%",
        "bar2_color": "var(--accent-blue)"
    }
};

// Generate client-side fallback telemetry records
let clientTelemetryRecords = [];
function initClientTelemetryRecords() {
    clientTelemetryRecords = [];
    const channels = [
        "Avionics Guidance Sensor (CH-01)",
        "Cryo Valve Impedance (CH-04)",
        "Thermal Transient Bus (CH-08)",
        "Ground EMI Monitor (CH-12)",
        "Radiation Shield Telemetry (CH-15)",
        "Power Amp Leakage Bus (CH-20)",
        "Pyrotechnic Ignition Line (CH-24)"
    ];
    const subsystems = [
        "Avionics Guidance & Navigation",
        "Cryogenic Upper Stage Controller",
        "S-Band Telemetry RF Bus",
        "Solid Booster Ignition Sequencer",
        "Stage Separation Pyrotechnics",
        "Reaction Control Thrusters"
    ];

    Object.keys(FALLBACK_VEHICLES).forEach(veh => {
        const count = FALLBACK_VEHICLES[veh].total_components;
        for (let i = 1; i <= count; i++) {
            const partId = `PART_${i < 10 ? '00' : (i < 100 ? '0' : '')}${i}`;
            let cat = "CLEARED_FLIGHT";
            let status = "CLEARED";
            let factor = "Nominal telemetry parameters";
            let iddq0 = Number((8.2 + (i % 7) * 0.5 + Math.sin(i) * 0.8).toFixed(2));
            let iddq24 = Number((iddq0 + (i % 4) * 0.3 + 0.2).toFixed(2));
            let iddq168 = Number((iddq24 * 1.04).toFixed(2));

            // Wafer coordinate synthesis (-12 to +12)
            const angle = (i * 137.5) * (Math.PI / 180);
            const radius = Math.sqrt(i / count) * 11.5;
            const dieX = Number((Math.cos(angle) * radius).toFixed(1));
            const dieY = Number((Math.sin(angle) * radius).toFixed(1));

            if (partId === "PART_010") {
                cat = "SPATIAL_OUTLIER";
                status = "REJECTED";
                factor = "Gate Oxide Pinholes / Substrate Micro-cracks";
                iddq0 = 48.00; iddq24 = 50.20; iddq168 = 52.00;
            } else if (partId === "PART_025") {
                cat = "THERMAL_DRIFT";
                status = "REJECTED";
                factor = "Predicted 168h Drift exceeds Calculated Safety Slope Limit";
                iddq0 = 11.00; iddq24 = 24.50; iddq168 = 39.00;
            } else if (partId === "PART_088" || i === 88) {
                cat = "ATMOSPHERIC_NOISE";
                status = "RE_SCREEN";
                factor = "Thunderstorm EMI Pulse (-35 dB) & Rain (18.5 mm/hr)";
                iddq0 = 10.20; iddq24 = 19.50; iddq168 = 11.00;
            } else if (partId === "PART_036") {
                cat = "SPATIAL_OUTLIER";
                status = "REJECTED";
                factor = "Wafer Edge Defect Cluster (CH-22)";
                iddq0 = 42.00; iddq24 = 46.00; iddq168 = 49.50;
            } else if (partId === "PART_048") {
                cat = "THERMAL_DRIFT";
                status = "REJECTED";
                factor = "Thermal Runaway Acceleration (Burn-in 24h)";
                iddq0 = 12.00; iddq24 = 26.00; iddq168 = 38.50;
            } else if (i % 18 === 0) {
                cat = "SPATIAL_OUTLIER";
                status = "REJECTED";
                factor = "Silicon Substrate Micro-defect";
                iddq0 = Number((38.0 + (i % 8)).toFixed(2));
                iddq24 = Number((iddq0 + 2.5).toFixed(2));
                iddq168 = Number((iddq24 * 1.1).toFixed(2));
            } else if (i % 23 === 0) {
                cat = "ATMOSPHERIC_NOISE";
                status = "RE_SCREEN";
                factor = "Ground Station Lightning Induced Spike";
                iddq0 = 9.5; iddq24 = 21.0; iddq168 = 10.8;
            }

            clientTelemetryRecords.push({
                part_id: partId,
                vehicle_type: veh,
                subsystem: subsystems[i % subsystems.length],
                sensing_channel: channels[i % channels.length],
                failure_factor: factor,
                iddq_0h_uA: iddq0,
                iddq_24h_uA: iddq24,
                forecast_iddq_168h_uA: iddq168,
                anomaly_category: cat,
                status: status,
                die_x: dieX,
                die_y: dieY,
                wafer_id: `WAF-${(i % 3) + 1}`
            });
        }
    });
}
initClientTelemetryRecords();

// ==========================================
// INITIALIZATION & AUTHENTICATION
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    loadVehicles();
    loadInspectionOptions();
    startAnimationLoop();
});

function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

async function handleLogin(e) {
    e.preventDefault();
    const operatorId = document.getElementById("operatorId").value.trim();
    const accessKey = document.getElementById("accessKey").value.trim();

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operatorId, accessKey })
        });

        if (response.ok) {
            const data = await response.json();
            sessionStorage.setItem("isro_token", data.token);
            sessionStorage.setItem("isro_operator", JSON.stringify(data.operator || { operatorId, name: "Ground Operator", station: "ISTRAC" }));
            loginSuccess(data.operator || { operatorId, name: "Ground Operator", station: "ISTRAC" });
            return;
        }
    } catch (err) {
        isStaticMode = true;
    }

    // Client-side authentication fallback
    if (accessKey === "password123" || accessKey === "mission2026" || accessKey.length >= 4) {
        const operator = {
            operatorId: operatorId || "ISTRAC-OPERATOR-01",
            name: "Dr. Vikram S.",
            station: "ISTRAC Bengaluru Mission Operations",
            role: "Ground Station Screening Officer"
        };
        sessionStorage.setItem("isro_token", "static_token");
        sessionStorage.setItem("isro_operator", JSON.stringify(operator));
        loginSuccess(operator);
    } else {
        alert("Invalid credentials. Use operator ID 'ISTRAC-OPERATOR-01' and password 'password123'.");
    }
}

function loginSuccess(operator) {
    document.getElementById("operatorDisplay").innerText = operator.operatorId;
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("dashboardScreen").style.display = "block";
    showToast(`Authenticated: ${operator.name} (${operator.station})`);
    changeVehicleProfile();
    loadTelemetryData();
}

function handleLogout() {
    sessionStorage.removeItem("isro_token");
    sessionStorage.removeItem("isro_operator");
    if (liveInterval) {
        clearInterval(liveInterval);
        liveInterval = null;
    }
    document.getElementById("dashboardScreen").style.display = "none";
    document.getElementById("loginScreen").style.display = "flex";
    showToast("Operator logged out safely.");
}

function checkAuth() {
    const token = sessionStorage.getItem("isro_token");
    const operatorStr = sessionStorage.getItem("isro_operator");
    if (token && operatorStr) {
        const operator = JSON.parse(operatorStr);
        loginSuccess(operator);
    }
}

// ==========================================
// VEHICLE PROFILES & METRICS
// ==========================================
async function loadVehicles() {
    try {
        const res = await fetch("/api/vehicles");
        if (res.ok) {
            const data = await res.json();
            data.forEach(v => { vehicleProfiles[v.id] = v; });
            updateVehicleView();
            return;
        }
    } catch (err) {
        isStaticMode = true;
    }
    vehicleProfiles = FALLBACK_VEHICLES;
    updateVehicleView();
}

async function changeVehicleProfile() {
    currentVehicle = document.getElementById("vehicleProfile").value;
    tablePage = 0;
    
    try {
        const res = await fetch(`/api/vehicles/${currentVehicle}`);
        if (res.ok) {
            const data = await res.json();
            vehicleProfiles[currentVehicle] = data;
            updateVehicleView();
            loadSpatialMapData();
            loadDriftSeriesData();
            loadTopologyData();
            loadTelemetryData();
            loadInspectionOptions();
            return;
        }
    } catch (err) {
        isStaticMode = true;
    }

    vehicleProfiles[currentVehicle] = FALLBACK_VEHICLES[currentVehicle] || FALLBACK_VEHICLES["LVM3"];
    updateVehicleView();
    loadSpatialMapData();
    loadDriftSeriesData();
    loadTopologyData();
    loadTelemetryData();
    loadInspectionOptions();
}

function updateVehicleView() {
    const data = vehicleProfiles[currentVehicle] || FALLBACK_VEHICLES[currentVehicle] || FALLBACK_VEHICLES["LVM3"];
    if (!data) return;

    document.getElementById("vehicleSpecsDisplay").innerHTML = 
        `Total Components: <b>${data.total_components}</b> | Max Iddq: <b>${data.max_iddq}</b> | Wind Shear: <b>${data.wind_shear}</b> | EMI Limit: <b>${data.emi_limit}</b>`;

    document.getElementById("metricTotal").innerText = data.total_components;
    document.getElementById("metricPassed").innerText = data.passed;
    document.getElementById("metricRejects").innerText = data.rejects;
    document.getElementById("metricWeather").innerText = data.weather;
    document.getElementById("metricLot").innerText = data.lot_id;
    document.getElementById("topologyVehicleLabel").innerText = `${data.name || currentVehicle} Multi-Stage Bus`;

    // Synchronize Environmental & Ground Station HUD
    const envLot = document.getElementById("envLotId");
    if (envLot) envLot.innerText = `${currentVehicle}_STAGE_02`;
    const envMax = document.getElementById("envMaxIddq");
    if (envMax) envMax.innerText = data.max_iddq || "55.0 µA";
    const envWind = document.getElementById("envWindShear");
    if (envWind) envWind.innerText = data.wind_shear || "45 knots";
    const envEmi = document.getElementById("envEmiLimit");
    if (envEmi) envEmi.innerText = data.emi_limit || "-80 dB";
    const envAtmos = document.getElementById("envAtmosphericCount");
    if (envAtmos) envAtmos.innerText = `${data.weather || 12} Spikes`;
}

// ==========================================
// ANIMATION CONTROLS & LOOP
// ==========================================
function toggleRadarAnimation() {
    isRadarEnabled = !isRadarEnabled;
    const btn = document.getElementById("btnToggleRadar");
    btn.innerText = `🌀 Radar Sweep: ${isRadarEnabled ? 'ON' : 'OFF'}`;
    btn.classList.toggle("active", isRadarEnabled);
    showToast(`Radar sweep ${isRadarEnabled ? 'resumed' : 'paused'}`);
}

function toggleOscAnimation() {
    isOscEnabled = !isOscEnabled;
    const btn = document.getElementById("btnToggleOsc");
    btn.innerText = `〰️ Waveform: ${isOscEnabled ? 'ON' : 'OFF'}`;
    btn.classList.toggle("active", isOscEnabled);
    showToast(`Oscilloscope sweep ${isOscEnabled ? 'resumed' : 'paused'}`);
}

function cyclePlaybackSpeed() {
    const speeds = [1.0, 2.0, 0.5];
    const idx = speeds.indexOf(playbackSpeed);
    playbackSpeed = speeds[(idx + 1) % speeds.length];
    document.getElementById("btnPlaybackSpeed").innerText = `⚡ ${playbackSpeed.toFixed(1)}x`;
    showToast(`Animation speed set to ${playbackSpeed.toFixed(1)}x`);
}

function setWaferViewMode(mode) {
    waferViewMode = mode;
    const btnW = document.getElementById("btnViewWafer");
    const btnS = document.getElementById("btnViewScatter");
    if (btnW) btnW.classList.toggle("active", mode === "wafer");
    if (btnS) btnS.classList.toggle("active", mode === "scatter");
    renderModuleA();
    showToast(`Switched Module A to ${mode === 'wafer' ? '300mm Silicon Wafer Disc' : 'Channel Scatter Grid'}`);
}

function setDriftViewMode(mode) {
    driftViewMode = mode;
    const btnF = document.getElementById("btnViewFleet");
    const btnP = document.getElementById("btnViewPrecision");
    if (btnF) btnF.classList.toggle("active", mode === "fleet");
    if (btnP) btnP.classList.toggle("active", mode === "precision");
    renderModuleB();
    showToast(`Switched Module B to ${mode === 'fleet' ? 'Fleet Trajectory Overlay' : 'Precision Oscilloscope Mode'}`);
}

function startAnimationLoop() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    function frame(now) {
        const dt = (now - lastFrameTime) / 1000;
        lastFrameTime = now;

        if (isRadarEnabled) {
            radarAngle = (radarAngle + 65 * dt * playbackSpeed) % 360;
            updateRadarSweepPosition();
        }

        if (isOscEnabled) {
            oscSweepTime = (oscSweepTime + 32 * dt * playbackSpeed) % 168;
            updateOscilloscopeSweep();
        }

        updateBusNoiseReadout();
        updateTopologyPulses(now);

        animationFrameId = requestAnimationFrame(frame);
    }

    lastFrameTime = performance.now();
    animationFrameId = requestAnimationFrame(frame);
}

// ==========================================
// MODULE A: DYNAMIC SILICON WAFER & DIE MAP
// ==========================================
async function loadSpatialMapData() {
    try {
        const res = await fetch(`/api/telemetry/spatial-map?vehicle=${currentVehicle}`);
        if (res.ok) {
            const data = await res.json();
            spatialDiesData = data.dies;
            renderModuleA();
            return;
        }
    } catch (err) {
        isStaticMode = true;
    }

    spatialDiesData = clientTelemetryRecords
        .filter(r => r.vehicle_type === currentVehicle)
        .map(r => ({
            part_id: r.part_id,
            die_x: r.die_x || 0,
            die_y: r.die_y || 0,
            iddq_0h: r.iddq_0h_uA,
            iddq_24h: r.iddq_24h_uA,
            iddq_168h: r.forecast_iddq_168h_uA,
            subsystem: r.subsystem,
            channel: r.sensing_channel,
            status: r.status,
            flag_spatial: r.anomaly_category === "SPATIAL_OUTLIER",
            flag_drift: r.anomaly_category === "THERMAL_DRIFT"
        }));
    renderModuleA();
}

function renderModuleA() {
    const baseLayer = document.getElementById("waferBaseLayer");
    const gridLayer = document.getElementById("waferGridLayer");
    const diesLayer = document.getElementById("waferDiesLayer");
    const laserLayer = document.getElementById("waferLaserLayer");
    const hudLayer = document.getElementById("waferHudLayer");

    if (!baseLayer || !diesLayer) return;
    baseLayer.innerHTML = "";
    gridLayer.innerHTML = "";
    diesLayer.innerHTML = "";
    laserLayer.innerHTML = "";
    hudLayer.innerHTML = "";

    const badge = document.getElementById("waferPartBadge");
    if (badge) badge.innerText = `Active: ${selectedAuditPart}`;

    const cx = 270;
    const cy = 140;
    const waferRadius = 116;

    if (waferViewMode === "wafer") {
        // Render 300mm Silicon Wafer Disc with High-Visibility ISRO Radar Aesthetics
        let degreeTicks = "";
        for (let deg = 0; deg < 360; deg += 30) {
            const rad = (deg - 90) * (Math.PI / 180);
            const x1 = cx + Math.cos(rad) * (waferRadius + 2);
            const y1 = cy + Math.sin(rad) * (waferRadius + 2);
            const x2 = cx + Math.cos(rad) * (waferRadius + 8);
            const y2 = cy + Math.sin(rad) * (waferRadius + 8);
            const textX = cx + Math.cos(rad) * (waferRadius + 15);
            const textY = cy + Math.sin(rad) * (waferRadius + 15);
            degreeTicks += `
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#58a6ff" stroke-width="1.2" opacity="0.6"/>
                <text x="${textX}" y="${textY + 3}" fill="#8b949e" font-size="7" font-family="monospace" text-anchor="middle">${deg}°</text>
            `;
        }

        baseLayer.innerHTML = `
            <!-- Wafer Shadow & Background Outer Body -->
            <circle cx="${cx}" cy="${cy}" r="${waferRadius + 10}" fill="#05080e" stroke="#21262d" stroke-width="1.5" />
            <circle cx="${cx}" cy="${cy}" r="${waferRadius}" fill="url(#waferSubstrateGrad)" stroke="#388bfd" stroke-width="2.2" opacity="0.95" />
            <circle cx="${cx}" cy="${cy}" r="${waferRadius}" fill="url(#waferBezelGrad)" stroke="none" />
            
            <!-- Alignment Flat / Notch at Bottom -->
            <path d="M ${cx - 14} ${cy + waferRadius} Q ${cx} ${cy + waferRadius - 10} ${cx + 14} ${cy + waferRadius}" fill="#05080e" stroke="#388bfd" stroke-width="2.5"/>
            
            <!-- Degree Ticks -->
            ${degreeTicks}

            <!-- Concentric Wafer Zones -->
            <circle cx="${cx}" cy="${cy}" r="${waferRadius * 0.35}" fill="none" stroke="#30363d" stroke-width="1.2" stroke-dasharray="2 3" opacity="0.75"/>
            <circle cx="${cx}" cy="${cy}" r="${waferRadius * 0.70}" fill="none" stroke="#388bfd" stroke-width="1.2" stroke-dasharray="3 4" opacity="0.5"/>
            <circle cx="${cx}" cy="${cy}" r="${waferRadius * 0.90}" fill="none" stroke="#da3633" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.65"/>
            
            <!-- Crosshairs -->
            <line x1="${cx - waferRadius + 12}" y1="${cy}" x2="${cx + waferRadius - 12}" y2="${cy}" stroke="#30363d" stroke-width="1.2" opacity="0.7"/>
            <line x1="${cx}" y1="${cy - waferRadius + 12}" x2="${cx}" y2="${cy + waferRadius - 12}" stroke="#30363d" stroke-width="1.2" opacity="0.7"/>
            
            <!-- Silicon Crystal Orientation Markers -->
            <text x="${cx}" y="20" fill="#58a6ff" font-size="9" font-weight="700" letter-spacing="0.5" text-anchor="middle">300mm &lt;100&gt; SILICON WAFER SUBSTRATE</text>
            <text x="${cx + waferRadius - 22}" y="${cy - 4}" fill="#da3633" font-size="8" font-weight="bold" text-anchor="end">3σ EDGE LIMIT</text>
            <text x="${cx + 10}" y="${cy + waferRadius - 14}" fill="#8b949e" font-size="8" text-anchor="start">NOTCH [110]</text>
        `;

        // Render Laser Scanning Beam
        laserLayer.innerHTML = `
            <g id="radarSweepGroup" transform="translate(${cx}, ${cy})">
                <line x1="0" y1="0" x2="${waferRadius}" y2="0" stroke="#58a6ff" stroke-width="2.5" filter="url(#glowEffect)" opacity="0.95"/>
                <path d="M 0 0 L ${waferRadius} 0 A ${waferRadius} ${waferRadius} 0 0 0 ${Math.cos(0.55) * waferRadius} ${-Math.sin(0.55) * waferRadius} Z" fill="url(#laserBeamGrad)" />
            </g>
        `;

        let selectedDieCoords = null;

        // Render Dies
        spatialDiesData.forEach((die) => {
            const scale = (waferRadius * 0.83) / 12.0;
            const px = cx + (die.die_x * scale);
            const py = cy + (die.die_y * scale);

            let color = "#388bfd";
            let r = 4.0;
            if (die.status === "RE_SCREEN") {
                color = "#bc8cff";
                r = 4.8;
            } else if (die.flag_spatial || die.iddq_0h > 35) {
                color = "#ff4d4d";
                r = 5.5;
            } else if (die.flag_drift || die.iddq_24h > die.iddq_0h * 1.8) {
                color = "#f0883e";
                r = 5.0;
            }

            const isSelected = (die.part_id === selectedAuditPart);
            if (isSelected) {
                selectedDieCoords = { px, py, die };
            }

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", px);
            circle.setAttribute("cy", py);
            circle.setAttribute("r", isSelected ? (r + 4) : r);
            circle.setAttribute("fill", color);
            circle.setAttribute("stroke", isSelected ? "#ffffff" : "#0d1117");
            circle.setAttribute("stroke-width", isSelected ? "2.5" : "1.2");
            if (isSelected) {
                circle.setAttribute("filter", "url(#dieGlow)");
            }
            circle.setAttribute("id", `die_${die.part_id}`);
            circle.setAttribute("class", "interactive-die" + (isSelected ? " selected-die" : ""));
            circle.style.cursor = "pointer";
            circle.style.transition = "r 0.15s ease, stroke 0.15s ease";

            circle.onmouseenter = (e) => showDieTooltip(e, die, px, py);
            circle.onmouseleave = () => hideDieTooltip();
            circle.onclick = () => selectPartForInspection(die.part_id);

            diesLayer.appendChild(circle);
        });

        // If a die is selected, draw a prominent targeting HUD reticle
        if (selectedDieCoords) {
            const die = selectedDieCoords.die;
            const px = selectedDieCoords.px;
            const py = selectedDieCoords.py;
            hudLayer.innerHTML = `
                <!-- Outer Reticle Circles -->
                <circle cx="${px}" cy="${py}" r="14" fill="none" stroke="#58a6ff" stroke-width="1.8" stroke-dasharray="3 3"/>
                <circle cx="${px}" cy="${py}" r="20" fill="none" stroke="rgba(88, 166, 255, 0.4)" stroke-width="1"/>
                
                <!-- Crosshairs -->
                <line x1="${px - 18}" y1="${py}" x2="${px - 8}" y2="${py}" stroke="#58a6ff" stroke-width="2"/>
                <line x1="${px + 8}" y1="${py}" x2="${px + 18}" y2="${py}" stroke="#58a6ff" stroke-width="2"/>
                <line x1="${px}" y1="${py - 18}" x2="${px}" y2="${py - 8}" stroke="#58a6ff" stroke-width="2"/>
                <line x1="${px}" y1="${py + 8}" x2="${px}" y2="${py + 18}" stroke="#58a6ff" stroke-width="2"/>
                
                <!-- Callout Data Tag -->
                <g transform="translate(${px}, ${Math.max(25, py - 26)})">
                    <rect x="-55" y="-12" width="110" height="20" rx="4" fill="#161b22" stroke="#58a6ff" stroke-width="1.5"/>
                    <text x="0" y="2" fill="#ffffff" font-size="9" font-weight="700" font-family="monospace" text-anchor="middle">
                        ${selectedAuditPart} | ${die.iddq_0h || 11.0}µA
                    </text>
                </g>
            `;
        }

    } else {
        // High-Definition Scatter Plot View (Iddq Current vs Die Spatial Channel)
        baseLayer.innerHTML = `
            <!-- Shaded Threshold Corridor Bands -->
            <rect x="70" y="150" width="440" height="70" fill="rgba(35, 134, 54, 0.08)" stroke="none"/>
            <rect x="70" y="90" width="440" height="60" fill="rgba(240, 136, 62, 0.08)" stroke="none"/>
            <rect x="70" y="25" width="440" height="65" fill="rgba(218, 54, 51, 0.12)" stroke="none"/>

            <!-- Grid Lines -->
            <line x1="70" y1="40" x2="510" y2="40" stroke="#30363d" stroke-dasharray="2 4" stroke-width="1"/>
            <line x1="70" y1="85" x2="510" y2="85" stroke="#30363d" stroke-dasharray="2 4" stroke-width="1"/>
            <line x1="70" y1="130" x2="510" y2="130" stroke="#30363d" stroke-dasharray="2 4" stroke-width="1"/>
            <line x1="70" y1="175" x2="510" y2="175" stroke="#30363d" stroke-dasharray="2 4" stroke-width="1"/>
            <line x1="70" y1="220" x2="510" y2="220" stroke="#8b949e" stroke-width="1.5"/>
            <line x1="70" y1="25" x2="70" y2="220" stroke="#8b949e" stroke-width="1.5"/>

            <text transform="rotate(-90)" x="-120" y="22" fill="#8b949e" font-size="10" font-weight="600" text-anchor="middle">Parametric Leakage Iddq (µA)</text>
            <text x="62" y="44" fill="#8b949e" font-size="9" text-anchor="end">60 µA</text>
            <text x="62" y="89" fill="#8b949e" font-size="9" text-anchor="end">45 µA</text>
            <text x="62" y="134" fill="#8b949e" font-size="9" text-anchor="end">30 µA</text>
            <text x="62" y="179" fill="#8b949e" font-size="9" text-anchor="end">15 µA</text>
            <text x="62" y="224" fill="#8b949e" font-size="9" text-anchor="end">0 µA</text>

            <text x="290" y="252" fill="#8b949e" font-size="11" font-weight="600" text-anchor="middle">Spatial Die Channel / Index (0 to 60)</text>
            
            <!-- Outlier Limit Line -->
            <line x1="70" y1="85" x2="510" y2="85" stroke="#da3633" stroke-width="1.8" stroke-dasharray="5 3"/>
            <text x="505" y="78" fill="#da3633" font-size="9" font-weight="bold" text-anchor="end">Spatial 3σ Limit (45 µA)</text>
        `;

        let selectedScatterPoint = null;

        spatialDiesData.forEach((die, index) => {
            const px = 70 + ((index % 60) / 60) * 430;
            const py = 220 - Math.min(195, (die.iddq_0h / 60) * 180);

            let color = "#388bfd";
            let r = 4.0;
            if (die.status === "RE_SCREEN") color = "#bc8cff";
            else if (die.flag_spatial || die.iddq_0h > 35) { color = "#ff4d4d"; r = 5.8; }
            else if (die.flag_drift) { color = "#f0883e"; r = 4.8; }

            const isSelected = (die.part_id === selectedAuditPart);
            if (isSelected) {
                selectedScatterPoint = { px, py, die };
            }

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", px);
            circle.setAttribute("cy", py);
            circle.setAttribute("r", isSelected ? (r + 4) : r);
            circle.setAttribute("fill", color);
            circle.setAttribute("stroke", isSelected ? "#ffffff" : "#0d1117");
            circle.setAttribute("stroke-width", isSelected ? "2.5" : "1.2");
            circle.style.cursor = "pointer";

            circle.onmouseenter = (e) => showDieTooltip(e, die, px, py);
            circle.onmouseleave = () => hideDieTooltip();
            circle.onclick = () => selectPartForInspection(die.part_id);

            diesLayer.appendChild(circle);
        });

        if (selectedScatterPoint) {
            hudLayer.innerHTML = `
                <!-- Drop Projection Line -->
                <line x1="${selectedScatterPoint.px}" y1="25" x2="${selectedScatterPoint.px}" y2="220" stroke="#58a6ff" stroke-width="1.5" stroke-dasharray="3 3"/>
                <circle cx="${selectedScatterPoint.px}" cy="${selectedScatterPoint.py}" r="12" fill="none" stroke="#58a6ff" stroke-width="2"/>
                <circle cx="${selectedScatterPoint.px}" cy="${selectedScatterPoint.py}" r="17" fill="none" stroke="rgba(88, 166, 255, 0.4)" stroke-width="1"/>
                
                <g transform="translate(${selectedScatterPoint.px}, ${Math.max(25, selectedScatterPoint.py - 18)})">
                    <rect x="-60" y="-12" width="120" height="18" rx="4" fill="#161b22" stroke="#58a6ff" stroke-width="1.2"/>
                    <text x="0" y="1" fill="#ffffff" font-size="9" font-weight="bold" font-family="monospace" text-anchor="middle">
                        ${selectedAuditPart}: ${selectedScatterPoint.die.iddq_0h} µA
                    </text>
                </g>
            `;
        }
    }
}

function updateRadarSweepPosition() {
    const sweep = document.getElementById("radarSweepGroup");
    if (sweep) {
        sweep.setAttribute("transform", `translate(270, 140) rotate(${radarAngle})`);
    }

    const readout = document.getElementById("waferScanReadout");
    if (readout) {
        const chNum = Math.floor((radarAngle / 360) * 32) + 1;
        readout.innerText = `Scan: Active CH-${chNum < 10 ? '0' + chNum : chNum} (${Math.round(radarAngle)}°)`;
    }
}

function showDieTooltip(e, die, px, py) {
    const tooltip = document.getElementById("waferTooltip");
    if (!tooltip) return;

    tooltip.style.display = "block";
    tooltip.innerHTML = `
        <div style="font-weight:bold; color:var(--accent-blue); margin-bottom:3px;">${die.part_id}</div>
        <div><b>Coordinates:</b> (${die.die_x}, ${die.die_y}) [${die.wafer_id || 'WAF-01'}]</div>
        <div><b>0h Baseline:</b> ${die.iddq_0h} µA</div>
        <div><b>24h Burn-in:</b> ${die.iddq_24h} µA</div>
        <div><b>Pred 168h:</b> ${die.iddq_168h} µA</div>
        <div><b>Status:</b> <span style="font-weight:600; color:${die.status === 'CLEARED' ? 'var(--accent-green-bright)' : (die.status === 'RE_SCREEN' ? 'var(--accent-purple)' : 'var(--accent-red-bright)')};">${die.status}</span></div>
        <div style="color:var(--text-muted); font-size:10px; margin-top:3px;">Click to inspect deep diagnostics</div>
    `;
}

function hideDieTooltip() {
    const tooltip = document.getElementById("waferTooltip");
    if (tooltip) tooltip.style.display = "none";
}

// ==========================================
// MODULE B: OSCILLOSCOPE TIME-SERIES DRIFT
// ==========================================
async function loadDriftSeriesData() {
    try {
        const res = await fetch(`/api/telemetry/drift-series?vehicle=${currentVehicle}&partId=${selectedAuditPart}`);
        if (res.ok) {
            driftSeriesData = await res.json();
            renderModuleB();
            return;
        }
    } catch (err) {
        isStaticMode = true;
    }

    const veh = FALLBACK_VEHICLES[currentVehicle] || FALLBACK_VEHICLES["LVM3"];
    const limit = veh.slope_limit || 55.0;

    const interp = (h0, h24, h96, h168) => {
        return [
            { hour: 0, iddq_uA: h0 },
            { hour: 12, iddq_uA: Number((h0 + (h24 - h0) * 0.5).toFixed(2)) },
            { hour: 24, iddq_uA: h24 },
            { hour: 48, iddq_uA: Number((h24 + (h96 - h24) * 0.33).toFixed(2)) },
            { hour: 96, iddq_uA: h96 },
            { hour: 120, iddq_uA: Number((h96 + (h168 - h96) * 0.33).toFixed(2)) },
            { hour: 168, iddq_uA: h168 }
        ];
    };

    let selH0 = 11.0, selH24 = 24.5, selH96 = 32.0, selH168 = 39.0;
    const dieMatch = spatialDiesData.find(d => d.part_id === selectedAuditPart) || 
                     clientTelemetryRecords.find(r => r.part_id === selectedAuditPart && r.vehicle_type === currentVehicle);
    if (dieMatch) {
        selH0 = Number(dieMatch.iddq_0h || dieMatch.iddq_0h_uA || 11.0);
        selH24 = Number(dieMatch.iddq_24h || dieMatch.iddq_24h_uA || (selH0 * 1.2));
        selH168 = Number(dieMatch.iddq_168h || dieMatch.forecast_iddq_168h_uA || (selH24 * 1.15));
        selH96 = Number((selH24 + (selH168 - selH24) * 0.55).toFixed(2));
    } else if (selectedAuditPart === "PART_088") {
        selH0 = 10.2; selH24 = 19.5; selH96 = 11.2; selH168 = 11.0;
    } else if (selectedAuditPart === "PART_010") {
        selH0 = 48.0; selH24 = 50.2; selH96 = 51.4; selH168 = 52.0;
    } else if (selectedAuditPart === "PART_001") {
        selH0 = 8.5; selH24 = 9.2; selH96 = 9.8; selH168 = 10.4;
    }

    // Synthesize fleet background curves for realistic look
    const fleetSamples = [];
    for (let i = 1; i <= 35; i++) {
        const pId = `PART_${i < 10 ? '00' + i : '0' + i}`;
        if (pId === selectedAuditPart) continue;
        const b0 = 7.5 + (i * 0.35);
        const b24 = b0 + 0.8 + (Math.random() * 0.6);
        const b96 = b24 + 0.6 + (Math.random() * 0.6);
        const b168 = b96 + 0.5 + (Math.random() * 0.5);
        fleetSamples.push({
            part_id: pId,
            exceeds_slope: false,
            is_weather: false,
            series: interp(b0, b24, b96, b168)
        });
    }

    driftSeriesData = {
        vehicle: currentVehicle,
        safety_slope_limit: limit,
        selected_part_id: selectedAuditPart,
        selected_series: interp(selH0, selH24, selH96, selH168),
        nominal_series: interp(8.5, 9.2, 9.8, 10.4),
        outlier_series: interp(48.0, 50.2, 51.4, 52.0),
        weather_series: interp(10.2, 19.5, 11.2, 11.0),
        fleet_series: fleetSamples,
        confidence_upper: interp(10.5, 11.5, 12.2, 13.0),
        confidence_lower: interp(6.5, 7.2, 7.6, 8.0)
    };

    const slopeElem = document.getElementById("driftSlopeValue");
    if (slopeElem) {
        const driftSlope = (selH168 - selH0) / 168;
        const isViolated = (selH168 > limit) || (driftSlope > 0.22);
        slopeElem.innerText = `Slope: ${driftSlope >= 0 ? '+' : ''}${driftSlope.toFixed(3)} µA/hr (${isViolated ? 'EXCEEDS LIMIT' : 'NOMINAL'})`;
        slopeElem.style.color = isViolated ? "var(--accent-red-bright)" : "var(--accent-green-bright)";
    }

    renderModuleB();
}

function renderModuleB() {
    const gridLayer = document.getElementById("driftGridLayer");
    const corridorLayer = document.getElementById("driftCorridorLayer");
    const fleetLayer = document.getElementById("driftFleetLayer");
    const curvesLayer = document.getElementById("driftCurvesLayer");
    const sweepLayer = document.getElementById("driftSweepLayer");
    const hudLayer = document.getElementById("driftHudLayer");

    if (!gridLayer || !curvesLayer || !driftSeriesData) return;
    gridLayer.innerHTML = "";
    corridorLayer.innerHTML = "";
    if (fleetLayer) fleetLayer.innerHTML = "";
    curvesLayer.innerHTML = "";
    sweepLayer.innerHTML = "";
    hudLayer.innerHTML = "";

    const x0 = 70;
    const xEnd = 450;
    const y0 = 200;
    const yMax = 30;
    const maxVal = 65.0; // µA

    const mapX = (hour) => x0 + (hour / 168.0) * (xEnd - x0);
    const mapY = (val) => y0 - (val / maxVal) * (y0 - yMax);

    // 1. Gridlines & Axes
    gridLayer.innerHTML = `
        <line x1="${x0}" y1="${mapY(60)}" x2="${xEnd}" y2="${mapY(60)}" stroke="#30363d" stroke-dasharray="2 4" stroke-width="1"/>
        <line x1="${x0}" y1="${mapY(40)}" x2="${xEnd}" y2="${mapY(40)}" stroke="#30363d" stroke-dasharray="2 4" stroke-width="1"/>
        <line x1="${x0}" y1="${mapY(20)}" x2="${xEnd}" y2="${mapY(20)}" stroke="#30363d" stroke-dasharray="2 4" stroke-width="1"/>
        <line x1="${x0}" y1="${y0}" x2="${xEnd}" y2="${y0}" stroke="#8b949e" stroke-width="1.5"/>
        <line x1="${x0}" y1="20" x2="${x0}" y2="${y0}" stroke="#8b949e" stroke-width="1.5"/>

        <!-- Y Ticks -->
        <text transform="rotate(-90)" x="-110" y="20" fill="#8b949e" font-size="10" font-weight="600" text-anchor="middle">Parametric Leakage Iddq (µA)</text>
        <text x="${x0 - 8}" y="${mapY(60) + 4}" fill="#8b949e" font-size="9" text-anchor="end">60 µA</text>
        <text x="${x0 - 8}" y="${mapY(40) + 4}" fill="#8b949e" font-size="9" text-anchor="end">40 µA</text>
        <text x="${x0 - 8}" y="${mapY(20) + 4}" fill="#8b949e" font-size="9" text-anchor="end">20 µA</text>
        <text x="${x0 - 8}" y="${y0 + 4}" fill="#8b949e" font-size="9" text-anchor="end">0 µA</text>

        <!-- X Ticks -->
        <text x="${mapX(0)}" y="${y0 + 16}" fill="#8b949e" font-size="9" text-anchor="middle">0h (T0)</text>
        <text x="${mapX(24)}" y="${y0 + 16}" fill="#8b949e" font-size="9" text-anchor="middle">24h (Burn-in)</text>
        <text x="${mapX(96)}" y="${y0 + 16}" fill="#8b949e" font-size="9" text-anchor="middle">96h</text>
        <text x="${mapX(168)}" y="${y0 + 16}" fill="#8b949e" font-size="9" text-anchor="middle">168h (Flight)</text>
    `;

    // 2. Safety Slope Limit
    const slopeVal = driftSeriesData.safety_slope_limit || 55.0;
    const slopeYStart = mapY(15.0);
    const slopeYEnd = mapY(slopeVal);
    gridLayer.innerHTML += `
        <line x1="${x0}" y1="${slopeYStart}" x2="${xEnd}" y2="${slopeYEnd}" stroke="#f0883e" stroke-width="1.5" stroke-dasharray="5 4"/>
        <text x="${xEnd - 10}" y="${slopeYEnd - 6}" fill="#f0883e" font-size="9" font-weight="bold" text-anchor="end">Safety Slope Cutoff (${slopeVal.toFixed(1)} µA)</text>
    `;

    // Helper to build SVG path from series
    const buildPath = (series) => {
        if (!series || series.length === 0) return "";
        let d = `M ${mapX(series[0].hour)} ${mapY(series[0].iddq_uA)}`;
        for (let i = 1; i < series.length; i++) {
            d += ` L ${mapX(series[i].hour)} ${mapY(series[i].iddq_uA)}`;
        }
        return d;
    };

    // 3. Flight Confidence Corridor
    if (driftSeriesData.confidence_upper && driftSeriesData.confidence_lower) {
        let pathD = `M ${mapX(driftSeriesData.confidence_upper[0].hour)} ${mapY(driftSeriesData.confidence_upper[0].iddq_uA)}`;
        driftSeriesData.confidence_upper.forEach(pt => {
            pathD += ` L ${mapX(pt.hour)} ${mapY(pt.iddq_uA)}`;
        });
        for (let i = driftSeriesData.confidence_lower.length - 1; i >= 0; i--) {
            const pt = driftSeriesData.confidence_lower[i];
            pathD += ` L ${mapX(pt.hour)} ${mapY(pt.iddq_uA)}`;
        }
        pathD += " Z";
        corridorLayer.innerHTML = `<path d="${pathD}" fill="url(#nominalCorridorGrad)" stroke="none"/>`;
    }

    // 4. In "Fleet Overlay" mode, render fleet background curves
    if (driftViewMode === "fleet" && driftSeriesData.fleet_series && fleetLayer) {
        driftSeriesData.fleet_series.forEach(item => {
            if (item.part_id === selectedAuditPart) return;
            const p = buildPath(item.series);
            let sColor = "rgba(56, 139, 253, 0.18)";
            if (item.exceeds_slope) sColor = "rgba(218, 54, 51, 0.25)";
            else if (item.is_weather) sColor = "rgba(188, 140, 255, 0.25)";
            fleetLayer.innerHTML += `<path d="${p}" stroke="${sColor}" stroke-width="1" fill="none"/>`;
        });
    }

    // Nominal Flight Baseline (Green)
    const nominalPath = buildPath(driftSeriesData.nominal_series);
    curvesLayer.innerHTML += `
        <path d="${nominalPath}" stroke="#238636" stroke-width="1.8" fill="none" opacity="0.85"/>
        <text x="${mapX(168)}" y="${mapY(10.4) + 14}" fill="#3fb950" font-size="8" text-anchor="end">Nominal Baseline</text>
    `;

    // Spatial Outlier Baseline (Red dashed)
    const outlierPath = buildPath(driftSeriesData.outlier_series);
    curvesLayer.innerHTML += `
        <path d="${outlierPath}" stroke="#da3633" stroke-width="1.5" stroke-dasharray="3 3" fill="none" opacity="0.6"/>
        <text x="${mapX(168)}" y="${mapY(52.0) - 6}" fill="#da3633" font-size="8" text-anchor="end">PART_010 Outlier</text>
    `;

    // Active Inspected Part Curve (Prominent Neon Glow)
    const selSeries = driftSeriesData.selected_series;
    if (selSeries && selSeries.length > 0) {
        const selPath = buildPath(selSeries);
        const isReject = selSeries[selSeries.length - 1].iddq_uA > slopeVal || selectedAuditPart === "PART_025" || selectedAuditPart === "PART_010";
        const isWeather = (selectedAuditPart === "PART_088");
        const strokeColor = isWeather ? "#bc8cff" : (isReject ? "#f85149" : "#58a6ff");

        curvesLayer.innerHTML += `
            <path d="${selPath}" stroke="${strokeColor}" stroke-width="3.5" fill="none" filter="url(#glowEffect)" opacity="0.95"/>
            <path d="${selPath}" stroke="${strokeColor}" stroke-width="2.5" fill="none"/>
        `;

        selSeries.forEach(pt => {
            curvesLayer.innerHTML += `
                <circle cx="${mapX(pt.hour)}" cy="${mapY(pt.iddq_uA)}" r="4.5" fill="${strokeColor}" stroke="#ffffff" stroke-width="1.5"/>
            `;
        });

        const lastPt = selSeries[selSeries.length - 1];
        curvesLayer.innerHTML += `
            <text x="${mapX(lastPt.hour) - 8}" y="${mapY(lastPt.iddq_uA) - 8}" fill="${strokeColor}" font-size="10" font-weight="bold" text-anchor="end">
                ${selectedAuditPart} (${lastPt.iddq_uA} µA)
            </text>
        `;

        const slopeElem = document.getElementById("driftSlopeValue");
        if (slopeElem) {
            const firstPt = selSeries[0];
            const driftSlope = (lastPt.iddq_uA - firstPt.iddq_uA) / (lastPt.hour || 168);
            const isViolated = (lastPt.iddq_uA > slopeVal) || isReject;
            slopeElem.innerText = `Slope: ${driftSlope >= 0 ? '+' : ''}${driftSlope.toFixed(3)} µA/hr (${isViolated ? 'EXCEEDS LIMIT' : 'NOMINAL'})`;
            slopeElem.style.color = isViolated ? "var(--accent-red-bright)" : "var(--accent-green-bright)";
        }

        // If in precision mode, show callout tags at each key timestamp
        if (driftViewMode === "precision") {
            selSeries.forEach(pt => {
                curvesLayer.innerHTML += `
                    <rect x="${mapX(pt.hour) - 16}" y="${mapY(pt.iddq_uA) - 22}" width="32" height="14" rx="3" fill="#161b22" stroke="${strokeColor}" stroke-width="1"/>
                    <text x="${mapX(pt.hour)}" y="${mapY(pt.iddq_uA) - 12}" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">${pt.iddq_uA}µA</text>
                `;
            });
        }
    }

    // 5. Sweep Playhead Line
    sweepLayer.innerHTML = `
        <g id="oscSweepGroup">
            <line id="oscSweepLine" x1="${mapX(0)}" y1="20" x2="${mapX(0)}" y2="${y0}" stroke="#58a6ff" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.85"/>
            <circle id="oscSweepHead" cx="${mapX(0)}" cy="${y0}" r="4" fill="#58a6ff" stroke="#ffffff" stroke-width="1.5"/>
        </g>
    `;

    const badge = document.getElementById("oscPartBadge");
    if (badge) badge.innerText = `Inspecting: ${selectedAuditPart} (${driftViewMode === 'fleet' ? 'Fleet Overlay' : 'Precision Oscilloscope'})`;
}

function updateOscilloscopeSweep() {
    const x0 = 70;
    const xEnd = 450;
    const y0 = 200;
    const yMax = 30;
    const maxVal = 65.0;

    const mapX = (hour) => x0 + (hour / 168.0) * (xEnd - x0);
    const mapY = (val) => y0 - (val / maxVal) * (y0 - yMax);

    const px = mapX(oscSweepTime);
    const line = document.getElementById("oscSweepLine");
    const head = document.getElementById("oscSweepHead");

    if (line && head) {
        line.setAttribute("x1", px);
        line.setAttribute("x2", px);

        // Interpolate current Iddq of selected part at oscSweepTime
        let currentIddq = 12.0;
        if (driftSeriesData && driftSeriesData.selected_series) {
            const s = driftSeriesData.selected_series;
            if (oscSweepTime <= 24) {
                currentIddq = s[0].iddq_uA + (s[1].iddq_uA - s[0].iddq_uA) * (oscSweepTime / 24.0);
            } else if (oscSweepTime <= 96) {
                currentIddq = s[1].iddq_uA + (s[2].iddq_uA - s[1].iddq_uA) * ((oscSweepTime - 24.0) / 72.0);
            } else {
                currentIddq = s[2].iddq_uA + (s[3].iddq_uA - s[2].iddq_uA) * ((oscSweepTime - 96.0) / 72.0);
            }
        }

        const py = mapY(currentIddq);
        head.setAttribute("cx", px);
        head.setAttribute("cy", py);

        // Update dynamic slope readout
        const slopeEl = document.getElementById("driftSlopeValue");
        if (slopeEl && driftSeriesData && driftSeriesData.selected_series) {
            const s = driftSeriesData.selected_series;
            const slope = (s[s.length - 1].iddq_uA - s[0].iddq_uA) / 168.0;
            slopeEl.innerText = `Slope: ${slope >= 0 ? '+' : ''}${slope.toFixed(2)} µA/hr @ T+${Math.round(oscSweepTime)}h`;
            slopeEl.style.color = (slope > 0.25) ? "var(--accent-red-bright)" : "var(--accent-green-bright)";
        }
    }
}

function updateBusNoiseReadout() {
    const el = document.getElementById("liveNoiseValue");
    if (!el) return;
    const noise = (12.4 + (Math.sin(performance.now() / 400) * 0.15) + (Math.random() * 0.08)).toFixed(2);
    const rms = (0.18 + Math.random() * 0.02).toFixed(2);
    const snr = (44.2 + Math.random() * 0.4).toFixed(1);
    el.innerText = `${noise} µA | RMS: ${rms} µA | SNR: ${snr} dB`;
}

// ==========================================
// ROCKET SUBSYSTEM & TOPOLOGY SCHEMATIC
// ==========================================
async function loadTopologyData() {
    try {
        const res = await fetch(`/api/telemetry/topology?vehicle=${currentVehicle}`);
        if (res.ok) {
            topologyData = await res.json();
            renderTopology();
            return;
        }
    } catch (err) {
        isStaticMode = true;
    }

    const veh = FALLBACK_VEHICLES[currentVehicle] || FALLBACK_VEHICLES["LVM3"];
    topologyData = {
        vehicle: currentVehicle,
        stages: veh.stages || ["Stage 1", "Stage 2", "Stage 3", "Payload Bay"],
        subsystems: [
            { id: "SYS_AGNU", name: "Avionics Guidance & Navigation", status: "NOMINAL", freq_hz: "100 Hz", load_pct: 42, health: 99.4, sensor_count: 64 },
            { id: "SYS_CRYOCON", name: "Cryogenic Upper Stage Valve Controller", status: "NOMINAL", freq_hz: "50 Hz", load_pct: 38, health: 98.8, sensor_count: 48 },
            { id: "SYS_TTC", name: "S-Band Telemetry RF Transmitter", status: "NOMINAL", freq_hz: "2.2 GHz", load_pct: 65, health: 99.1, sensor_count: 32 },
            { id: "SYS_IGNITE", name: "Solid Booster Ignition Sequencer", status: "ARMED_NOMINAL", freq_hz: "1 kHz", load_pct: 28, health: 100.0, sensor_count: 24 },
            { id: "SYS_PYRO", name: "Stage Separation Pyrotechnics", status: "STANDBY_SAFE", freq_hz: "10 Hz", load_pct: 15, health: 99.9, sensor_count: 18 },
            { id: "SYS_RCS", name: "Reaction Control Thrusters", status: "ACTIVE_PULSE", freq_hz: "200 Hz", load_pct: 54, health: 97.6, sensor_count: 36 }
        ]
    };
    renderTopology();
}

function renderTopology() {
    const stagesLayer = document.getElementById("rocketStagesLayer");
    const pulsesLayer = document.getElementById("rocketSignalPulsesLayer");
    const nodesLayer = document.getElementById("rocketNodesLayer");
    const cardsGrid = document.getElementById("subsystemCardsGrid");

    if (!stagesLayer || !topologyData) return;
    stagesLayer.innerHTML = "";
    pulsesLayer.innerHTML = "";
    nodesLayer.innerHTML = "";
    cardsGrid.innerHTML = "";

    const stages = topologyData.stages || ["Stage 1", "Stage 2", "Stage 3", "Payload"];
    const stageWidth = 760 / stages.length;

    // Draw Rocket Horizontal Profile
    stages.forEach((stageName, i) => {
        const x = 50 + (i * stageWidth);
        const y = 30;
        const w = stageWidth - 12;
        const h = 75;

        // Stage body block
        stagesLayer.innerHTML += `
            <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="url(#rocketBodyGrad)" stroke="#30363d" stroke-width="1.5" />
            <text x="${x + w/2}" y="${y + 24}" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">${stageName}</text>
            <text x="${x + w/2}" y="${y + 40}" fill="#8b949e" font-size="9" text-anchor="middle">STAGE 0${i + 1} BUS</text>
            <line x1="${x + 12}" y1="${y + 54}" x2="${x + w - 12}" y2="${y + 54}" stroke="#21262d" stroke-width="3" stroke-linecap="round"/>
        `;

        // Inter-stage telemetry bus connectors
        if (i < stages.length - 1) {
            stagesLayer.innerHTML += `
                <line x1="${x + w}" y1="${y + h/2}" x2="${x + stageWidth}" y2="${y + h/2}" stroke="#58a6ff" stroke-width="2" stroke-dasharray="3 3"/>
            `;
        }

        // Sensor Node on this stage
        nodesLayer.innerHTML += `
            <circle cx="${x + w/2}" cy="${y + 54}" r="5" fill="#238636" stroke="#ffffff" stroke-width="1.5"/>
            <circle cx="${x + w/2}" cy="${y + 54}" r="9" fill="none" stroke="#238636" stroke-width="1" opacity="0.6"/>
        `;
    });

    // Nosecone Fairing shape at the right end
    const lastX = 50 + (stages.length * stageWidth) - 12;
    stagesLayer.innerHTML += `
        <path d="M ${lastX} 30 Q ${lastX + 45} 67, ${lastX} 105 Z" fill="url(#rocketBodyGrad)" stroke="#ff9933" stroke-width="1.5"/>
        <text x="${lastX + 18}" y="71" fill="#ff9933" font-size="9" font-weight="bold">PAYLOAD</text>
    `;

    // Render Subsystem Cards
    topologyData.subsystems.forEach(sys => {
        const card = document.createElement("div");
        card.className = "subsystem-card";
        card.onclick = () => {
            document.getElementById("searchInput").value = sys.name.split(" ")[0];
            debounceSearch();
            showToast(`Filtered diagnostics by ${sys.name}`);
        };
        card.innerHTML = `
            <h4>
                <span>${sys.name}</span>
                <span class="badge-tag tag-cleared">${sys.status}</span>
            </h4>
            <div class="meta">
                <span>Health: <b style="color:var(--accent-green-bright);">${sys.health}%</b></span>
                <span>Bus Load: <b>${sys.load_pct}%</b></span>
            </div>
            <div class="meta">
                <span>Telemetry Freq: <b>${sys.freq_hz}</b></span>
                <span>Sensors: <b>${sys.sensor_count}</b></span>
            </div>
        `;
        cardsGrid.appendChild(card);
    });
}

function updateTopologyPulses(now) {
    const pulsesLayer = document.getElementById("rocketSignalPulsesLayer");
    if (!pulsesLayer || !topologyData) return;
    pulsesLayer.innerHTML = "";

    const stages = topologyData.stages || ["Stage 1", "Stage 2", "Stage 3", "Payload"];
    const stageWidth = 760 / stages.length;
    const totalW = stages.length * stageWidth;
    const t = (now / 15) % totalW;

    const x = 50 + t;
    const y = 67;

    pulsesLayer.innerHTML = `
        <circle cx="${x}" cy="${y}" r="4" fill="#58a6ff" filter="url(#glowEffect)" />
        <circle cx="${(x + 180) % totalW + 50}" cy="${y}" r="3.5" fill="#bc8cff" filter="url(#glowEffect)" />
    `;
}

// ==========================================
// REGISTER & DATA TABLE
// ==========================================
function debounceSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        tablePage = 0;
        loadTelemetryData();
    }, 300);
}

async function loadTelemetryData() {
    const search = document.getElementById("searchInput").value.trim().toLowerCase();
    const category = document.getElementById("filterCategory").value;
    const offset = tablePage * pageSize;

    let url = `/api/telemetry?vehicle=${currentVehicle}&limit=${pageSize}&offset=${offset}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;

    try {
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            renderTableRows(data.records, data.total);
            return;
        }
    } catch (err) {
        isStaticMode = true;
    }

    // Client-side fallback rendering
    let filtered = clientTelemetryRecords.filter(r => r.vehicle_type === currentVehicle);
    if (category) {
        filtered = filtered.filter(r => r.anomaly_category === category);
    }
    if (search) {
        filtered = filtered.filter(r => 
            r.part_id.toLowerCase().includes(search) || 
            r.failure_factor.toLowerCase().includes(search) ||
            r.sensing_channel.toLowerCase().includes(search) ||
            (r.subsystem && r.subsystem.toLowerCase().includes(search))
        );
    }

    const paged = filtered.slice(offset, offset + pageSize);
    renderTableRows(paged, filtered.length);
}

function renderTableRows(records, total) {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    if (!records || records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:20px;">No telemetry records matching criteria.</td></tr>`;
        document.getElementById("tableRecordCount").innerText = `0 of 0 records`;
        return;
    }

    records.forEach(r => {
        let tagClass = "tag-cleared";
        let tagLabel = "Cleared";
        if (r.anomaly_category === "SPATIAL_OUTLIER") {
            tagClass = "tag-spatial";
            tagLabel = "Spatial Outlier";
        } else if (r.anomaly_category === "THERMAL_DRIFT") {
            tagClass = "tag-drift";
            tagLabel = "Thermal Drift";
        } else if (r.anomaly_category === "ATMOSPHERIC_NOISE") {
            tagClass = "tag-weather";
            tagLabel = "Atmospheric Noise";
        }

        const isSelected = (r.part_id === selectedAuditPart);
        const tr = document.createElement("tr");
        if (isSelected) {
            tr.className = "table-row-selected";
        }
        tr.style.cursor = "pointer";
        tr.onclick = () => selectPartForInspection(r.part_id);
        tr.innerHTML = `
            <td><b>${r.part_id}</b></td>
            <td><span class="badge-tag ${tagClass}">${tagLabel}</span></td>
            <td>${r.sensing_channel || 'Sensor Channel'}</td>
            <td style="color:${r.status === 'CLEARED' ? 'var(--text-muted)' : '#f85149'};">${r.failure_factor || 'Nominal'}</td>
            <td>${Number(r.iddq_0h_uA).toFixed(2)} µA</td>
            <td>${Number(r.forecast_iddq_168h_uA).toFixed(2)} µA</td>
            <td><span style="font-weight:600; color:${r.status === 'CLEARED' ? 'var(--accent-green-bright)' : (r.status === 'RE_SCREEN' ? 'var(--accent-purple)' : 'var(--accent-red-bright)')};">${r.status}</span></td>
        `;
        tbody.appendChild(tr);
    });

    const start = (tablePage * pageSize) + 1;
    const end = Math.min((tablePage + 1) * pageSize, total);
    document.getElementById("tableRecordCount").innerText = `Showing ${start}-${end} of ${total} records`;
    
    document.getElementById("btnPrevPage").disabled = (tablePage === 0);
    document.getElementById("btnNextPage").disabled = (end >= total);
}

function prevPage() {
    if (tablePage > 0) {
        tablePage--;
        loadTelemetryData();
    }
}

function nextPage() {
    tablePage++;
    loadTelemetryData();
}

// ==========================================
// DEEP AUDIT, COMPONENT SPOTLIGHT & TREESHAP INSPECTION
// ==========================================
let currentSpotlightFilter = "ALL";

function populateComponentDropdowns(targetPartId) {
    const graphSel = document.getElementById("graphPartSelect") || document.getElementById("globalPartSelect");
    const panelSel = document.getElementById("partSelect");
    
    // Gather all unique part records for the current vehicle
    let records = clientTelemetryRecords.filter(r => r.vehicle_type === currentVehicle);
    if (records.length === 0) {
        // Fallback to synthetic dies if telemetry records not yet loaded
        records = spatialDiesData.map(d => ({
            part_id: d.part_id,
            status: d.status,
            anomaly_category: d.status === "CLEARED" ? "NOMINAL" : (d.flag_drift ? "THERMAL_DRIFT" : (d.status === "RE_SCREEN" ? "ATMOSPHERIC_NOISE" : "SPATIAL_OUTLIER")),
            sensing_channel: `Channel ${d.die_x},${d.die_y}`,
            failure_factor: d.status === "CLEARED" ? "Nominal Silicon Baseline" : (d.status === "RE_SCREEN" ? "Atmospheric Transient Spike" : "Burn-in Parametric Shift"),
            iddq_0h: d.iddq_0h,
            iddq_24h: d.iddq_24h,
            iddq_168h: d.iddq_168h
        }));
    }

    // Apply spotlight filter if active
    let filtered = records;
    if (currentSpotlightFilter === "CLEARED") {
        filtered = records.filter(r => r.status === "CLEARED");
    } else if (currentSpotlightFilter === "REJECT") {
        filtered = records.filter(r => r.status === "REJECT" || r.status === "REJECTED" || r.anomaly_category === "SPATIAL_OUTLIER" || r.anomaly_category === "THERMAL_DRIFT");
    } else if (currentSpotlightFilter === "ATMOSPHERIC") {
        filtered = records.filter(r => r.status === "RE_SCREEN" || r.anomaly_category === "ATMOSPHERIC_NOISE");
    }

    const currentSelected = targetPartId || selectedAuditPart;

    const buildOptions = (selElem, list) => {
        if (!selElem) return;
        selElem.innerHTML = "";
        list.forEach(r => {
            const opt = document.createElement("option");
            opt.value = r.part_id;
            const factorSnippet = r.failure_factor ? r.failure_factor.substring(0, 36) : 'Nominal';
            const statusTag = r.status === "CLEARED" ? "PASS" : (r.status === "RE_SCREEN" ? "WEATHER" : "REJECT");
            const valTag = (r.iddq_0h || r.iddq_0h_uA) ? ` (${r.iddq_0h || r.iddq_0h_uA}µA)` : '';
            opt.innerText = `${r.part_id} — [${statusTag}] ${factorSnippet}${valTag}`;
            if (r.part_id === currentSelected) opt.selected = true;
            selElem.appendChild(opt);
        });
    };

    buildOptions(graphSel, filtered);
    buildOptions(panelSel, records);
}

function filterSpotlightList(filterType, btnElem) {
    currentSpotlightFilter = filterType;
    const filterBtns = document.querySelectorAll(".spotlight-filter-btn");
    filterBtns.forEach(btn => btn.classList.remove("active"));
    if (btnElem) btnElem.classList.add("active");

    populateComponentDropdowns();
    
    // If the currently selected part is not in the filtered list, select the first available item
    const graphSel = document.getElementById("graphPartSelect") || document.getElementById("globalPartSelect");
    if (graphSel && graphSel.options.length > 0) {
        let isPresent = false;
        for (let opt of graphSel.options) {
            if (opt.value === selectedAuditPart) {
                isPresent = true;
                break;
            }
        }
        if (!isPresent && graphSel.options[0]) {
            selectPartForInspection(graphSel.options[0].value);
        }
    }
}

function stepComponent(direction) {
    const graphSel = document.getElementById("graphPartSelect") || document.getElementById("globalPartSelect");
    if (!graphSel || graphSel.options.length === 0) return;

    let currentIndex = graphSel.selectedIndex;
    if (currentIndex === -1) currentIndex = 0;

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = graphSel.options.length - 1;
    if (nextIndex >= graphSel.options.length) nextIndex = 0;

    graphSel.selectedIndex = nextIndex;
    selectPartForInspection(graphSel.options[nextIndex].value);
}

async function loadInspectionOptions() {
    try {
        const res = await fetch(`/api/diagnostics/inspections?vehicle=${currentVehicle}`);
        if (res.ok) {
            const data = await res.json();
            populateComponentDropdowns(selectedAuditPart);
            updateAuditCard();
            return;
        }
    } catch (err) {
        isStaticMode = true;
    }

    populateComponentDropdowns(selectedAuditPart);
    updateAuditCard();
}

function selectPartForInspection(partId) {
    selectedAuditPart = partId;

    // 1. Sync Graph Selector
    const graphSel = document.getElementById("graphPartSelect") || document.getElementById("globalPartSelect");
    if (graphSel) {
        let found = false;
        for (let opt of graphSel.options) {
            if (opt.value === partId) {
                opt.selected = true;
                found = true;
                break;
            }
        }
        if (!found) {
            const opt = document.createElement("option");
            opt.value = partId;
            opt.innerText = `${partId} — Selected Component`;
            graphSel.prepend(opt);
            opt.selected = true;
        }
    }

    // 2. Sync Diagnostics Panel Select
    const panelSel = document.getElementById("partSelect");
    if (panelSel) {
        let found = false;
        for (let opt of panelSel.options) {
            if (opt.value === partId) {
                opt.selected = true;
                found = true;
                break;
            }
        }
        if (!found) {
            const opt = document.createElement("option");
            opt.value = partId;
            opt.innerText = `${partId} (Selected from telemetry)`;
            panelSel.prepend(opt);
            opt.selected = true;
        }
    }

    // 3. Update Badges across all panels simultaneously
    const waferBadge = document.getElementById("waferPartBadge");
    if (waferBadge) waferBadge.innerText = `Active: ${partId}`;

    const oscBadge = document.getElementById("oscPartBadge");
    if (oscBadge) oscBadge.innerText = `Active: ${partId} (${driftViewMode === 'fleet' ? 'Fleet Overlay' : 'Precision Oscilloscope'})`;

    const spotlightPill = document.getElementById("spotlightStatusPill");
    if (spotlightPill) {
        const record = clientTelemetryRecords.find(r => r.part_id === partId && r.vehicle_type === currentVehicle) ||
                       spatialDiesData.find(d => d.part_id === partId);
        const status = record ? (record.status || "QUALIFIED") : "QUALIFIED";
        spotlightPill.innerText = `${partId} — ${status}`;
        spotlightPill.className = "spotlight-pill " + (status === "CLEARED" || status === "QUALIFIED" ? "pill-cleared" : (status === "RE_SCREEN" ? "pill-weather" : "pill-reject"));
    }

    // 4. Update Synchronized Visual Modules & Diagnostics
    updateAuditCard();
    loadDriftSeriesData();
    renderModuleA();
    
    // 5. Highlight selected row in telemetry table
    const rows = document.querySelectorAll("#tableBody tr");
    rows.forEach(row => {
        const firstCell = row.querySelector("td b");
        if (firstCell && firstCell.innerText.trim() === partId) {
            row.classList.add("table-row-selected");
        } else {
            row.classList.remove("table-row-selected");
        }
    });

    showToast(`Inspecting Component ${partId} across Modules A, B & Ground Station`);
}

async function updateAuditCard() {
    const selected = selectedAuditPart || (document.getElementById("partSelect") ? document.getElementById("partSelect").value : "PART_088");
    selectedAuditPart = selected;

    try {
        const res = await fetch(`/api/diagnostics/inspection/${selected}`);
        if (res.ok) {
            const data = await res.json();
            applyAuditCardData(data);
            return;
        }
    } catch (err) {
        isStaticMode = true;
    }

    // Dynamic fallback generation based on part telemetry record
    const record = clientTelemetryRecords.find(r => r.part_id === selected && r.vehicle_type === currentVehicle) ||
                   spatialDiesData.find(d => d.part_id === selected);

    let h0 = 11.2, h24 = 19.5, h168 = 24.8, maxLim = 45.0;
    if (record) {
        h0 = Number(record.iddq_0h || record.iddq_0h_uA || 11.2);
        h24 = Number(record.iddq_24h || record.iddq_24h_uA || 19.5);
        h168 = Number(record.iddq_168h || record.forecast_iddq_168h_uA || 24.8);
    }
    const maxVal = Math.max(h0, h24, h168);
    const leakagePct = Math.min(100, Math.round((maxVal / maxLim) * 100));

    const fallback = FALLBACK_INSPECTIONS[selected] || {
        status_text: (record && record.status === "REJECT") ? "STATUS: REJECT / DISQUALIFIED" : ((record && record.status === "RE_SCREEN") ? "STATUS: RE-SCREEN (ATMOSPHERIC TRANSIENT)" : "STATUS: NOMINAL (SPACE QUALIFIED)"),
        status_color: (record && record.status === "REJECT") ? "#da3633" : ((record && record.status === "RE_SCREEN") ? "#bc8cff" : "#3fb950"),
        category: record ? record.anomaly_category : "Nominal Flight Telemetry",
        sensor: record ? record.sensing_channel : "Avionics Multi-channel Bus",
        factor: record ? record.failure_factor : "All burn-in and spatial parameters within baseline limits",
        drift_text: `${h168.toFixed(2)} µA (Verified against launch limits)`,
        drift_color: (h168 > maxLim) ? "#da3633" : ((h168 > 25.0) ? "#f0883e" : "#3fb950"),
        iddq_0h: h0,
        iddq_24h: h24,
        iddq_168h: h168,
        max_limit: maxLim,
        leakage_pct: leakagePct,
        factor_weights: [
            { feature: "Baseline Silicon Purity", impact_pct: 54, color: "var(--accent-green)", description: "Crystal lattice uniformity across central 300mm wafer zone" },
            { feature: "Channel Impedance Stability", impact_pct: 32, color: "var(--accent-green)", description: "Differential impedance margin under thermal burn-in stress" },
            { feature: "Burn-in Thermal Gradient", impact_pct: (h24 > h0 * 1.5 ? 28 : 12), color: "var(--accent-blue)", description: "Junction temperature dissipation coefficient during 24h bake" },
            { feature: "Ground Station EMI Noise", impact_pct: (selected === "PART_088" ? -35 : -8), color: "var(--accent-cyan)", description: "Atmospheric coupling & launch pad umbilical noise attenuation" }
        ]
    };
    fallback.part_id = selected;
    applyAuditCardData(fallback);
}

function renderTreeSHAP(weights) {
    const container = document.getElementById("treeshapBarsContainer");
    if (!container) return;
    container.innerHTML = "";

    const list = (weights && weights.length > 0) ? weights : [
        { feature: "Baseline Silicon Purity", impact_pct: 50, color: "var(--accent-green)", description: "Crystal lattice integrity and spatial homogeneity" },
        { feature: "Thermal Dissipation Margin", impact_pct: 28, color: "var(--accent-green)", description: "Thermal conductivity across avionics chassis" },
        { feature: "Atmospheric Noise Rejection", impact_pct: 16, color: "var(--accent-blue)", description: "High-frequency RF transient rejection" },
        { feature: "Ground Station EMI Exposure", impact_pct: -12, color: "var(--accent-cyan)", description: "Ground pad umbilical cable electromagnetic coupling" }
    ];

    list.forEach(item => {
        const isNeg = item.impact_pct < 0;
        const absVal = Math.abs(item.impact_pct);
        const sign = isNeg ? "−" : "+";
        const badgeClass = isNeg ? "impact-negative" : "impact-positive";

        const row = document.createElement("div");
        row.className = "treeshap-row";
        row.innerHTML = `
            <div class="treeshap-header">
                <span class="treeshap-name">${item.feature}</span>
                <span class="treeshap-badge ${badgeClass}">${sign}${absVal}% Impact</span>
            </div>
            <div class="treeshap-bar-bg">
                <div class="treeshap-bar-fill" style="width: 0%; background-color: ${item.color || (isNeg ? 'var(--accent-cyan)' : 'var(--accent-green)')};"></div>
            </div>
            ${item.description ? `<div class="treeshap-desc" style="font-size:10px; color:var(--text-muted); margin-top:2px;">${item.description}</div>` : ''}
        `;
        container.appendChild(row);

        // Smooth entry animation for the fill width
        setTimeout(() => {
            const fill = row.querySelector(".treeshap-bar-fill");
            if (fill) fill.style.width = `${Math.min(100, Math.max(12, absVal))}%`;
        }, 40);
    });
}

function applyAuditCardData(data) {
    const statusElem = document.getElementById("auditStatus");
    if (statusElem) {
        statusElem.innerText = data.status_text || "STATUS: NOMINAL";
        statusElem.style.color = data.status_color || "#3fb950";
    }

    const partIdElem = document.getElementById("auditPartId");
    if (partIdElem) partIdElem.innerText = data.part_id || selectedAuditPart;

    const catElem = document.getElementById("auditCategory");
    if (catElem) {
        catElem.innerText = data.category || "Nominal Flight Telemetry";
        catElem.style.color = data.status_color || "#3fb950";
    }

    const sensElem = document.getElementById("auditSensor");
    if (sensElem) sensElem.innerText = data.sensor || "Avionics Multi-channel Bus";

    const factElem = document.getElementById("auditFactor");
    if (factElem) factElem.innerText = data.factor || "All parameters nominal";

    const driftElem = document.getElementById("auditDrift");
    if (driftElem) {
        driftElem.innerText = data.drift_text || "Nominal";
        driftElem.style.color = data.drift_color || "#3fb950";
    }

    // ==========================================
    // UPDATE GROUND STATION LEAKAGE GAUGE
    // ==========================================
    const h0 = Number(data.iddq_0h || 11.2);
    const h24 = Number(data.iddq_24h || 19.5);
    const h168 = Number(data.iddq_168h || 24.8);
    const maxLimit = Number(data.max_limit || 45.0);
    const leakagePct = Number(data.leakage_pct || Math.min(100, Math.round((Math.max(h0, h24, h168) / maxLimit) * 100)));

    const p0 = document.getElementById("leakagePhase0h");
    if (p0) p0.innerText = `${h0.toFixed(2)} µA`;

    const p24 = document.getElementById("leakagePhase24h");
    if (p24) p24.innerText = `${h24.toFixed(2)} µA`;

    const p168 = document.getElementById("leakagePhase168h");
    if (p168) p168.innerText = `${h168.toFixed(2)} µA`;

    const pCap = document.getElementById("leakagePhaseCap");
    if (pCap) pCap.innerText = `Limit: ${maxLimit.toFixed(1)} µA`;

    const pPeak = document.getElementById("leakagePeakVal");
    if (pPeak) pPeak.innerText = `Peak: ${Math.max(h0, h24, h168).toFixed(2)} µA`;

    const pLimit = document.getElementById("leakageLimitVal");
    if (pLimit) pLimit.innerText = `Limit: ${maxLimit.toFixed(1)} µA`;

    const pPct = document.getElementById("leakagePctVal");
    if (pPct) pPct.innerText = `${leakagePct}%`;

    const pBar = document.getElementById("leakageProgressBar");
    if (pBar) {
        pBar.style.width = `${leakagePct}%`;
        if (leakagePct >= 90) {
            pBar.style.backgroundColor = "#da3633"; // Critical Red
        } else if (leakagePct >= 65) {
            pBar.style.backgroundColor = "#f0883e"; // Caution Amber
        } else {
            pBar.style.backgroundColor = "#238636"; // Nominal Green
        }
    }

    const badge = document.getElementById("leakageStatusBadge");
    if (badge) {
        if (leakagePct >= 90) {
            badge.innerText = "CRITICAL EXCEEDANCE";
            badge.className = "leakage-status-badge badge-critical";
        } else if (leakagePct >= 65) {
            badge.innerText = "MARGINAL / ELEVATED";
            badge.className = "leakage-status-badge badge-warning";
        } else {
            badge.innerText = "SAFE / PASS";
            badge.className = "leakage-status-badge badge-safe";
        }
    }

    // Render TreeSHAP Factor Weights with EMI Coupling details
    renderTreeSHAP(data.factor_weights);
}

// ==========================================
// LIVE TELEMETRY SIMULATION STREAM
// ==========================================
function toggleLiveFeed() {
    const btn = document.getElementById("btnLiveToggle");
    const hud = document.getElementById("liveTickerHUD");

    if (liveInterval) {
        clearInterval(liveInterval);
        liveInterval = null;
        btn.classList.remove("active");
        btn.innerText = "▶ Start Live Stream";
        hud.style.display = "none";
        showToast("Live telemetry stream paused.");
    } else {
        btn.classList.add("active");
        btn.innerText = "⏹ Stop Live Stream";
        hud.style.display = "flex";
        showToast("Live Ground Station telemetry ingestion activated!");
        fetchLivePacket();
        liveInterval = setInterval(fetchLivePacket, 2500);
    }
}

async function fetchLivePacket() {
    try {
        const res = await fetch(`/api/telemetry/live-feed?vehicle=${currentVehicle}`);
        if (res.ok) {
            const packet = await res.json();
            displayLivePacket(packet);
            return;
        }
    } catch (err) {
        isStaticMode = true;
    }

    const randPart = `PART_${Math.floor(Math.random() * 80 + 10)}`;
    const iddq0 = (8.0 + Math.random() * 4).toFixed(2);
    const iddq24 = (Number(iddq0) + Math.random() * 2).toFixed(2);
    const iddq168 = (Number(iddq24) * 1.05).toFixed(2);
    displayLivePacket({
        part_id: randPart,
        iddq_0h_uA: iddq0,
        iddq_24h_uA: iddq24,
        forecast_iddq_168h_uA: iddq168,
        status: "CLEARED",
        timestamp: new Date().toISOString()
    });
}

function displayLivePacket(packet) {
    const summary = `Ingested Part ${packet.part_id} | 0h: ${packet.iddq_0h_uA}µA | 24h: ${packet.iddq_24h_uA}µA | Pred 168h: ${packet.forecast_iddq_168h_uA}µA | Status: ${packet.status}`;
    document.getElementById("livePacketSummary").innerText = summary;
    document.getElementById("livePacketTime").innerText = new Date(packet.timestamp || Date.now()).toLocaleTimeString();
}

// ==========================================
// ML TELEMETRY SCREENING MODAL
// ==========================================
function openScreenModal() {
    document.getElementById("screenModal").style.display = "flex";
}

function closeScreenModal() {
    document.getElementById("screenModal").style.display = "none";
}

async function handleScreenComponent(e) {
    e.preventDefault();
    const vehicleType = document.getElementById("screenVehicle").value;
    const partId = document.getElementById("screenPartId").value.trim() || "CUSTOM_PART";
    const iddq0h = parseFloat(document.getElementById("screenIddq0").value);
    const iddq24h = parseFloat(document.getElementById("screenIddq24").value);
    const emiDb = parseFloat(document.getElementById("screenEmi").value);
    const rainRate = parseFloat(document.getElementById("screenRain").value);

    try {
        const res = await fetch("/api/telemetry/screen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vehicleType, partId, iddq0h, iddq24h, emiDb, rainRate })
        });

        if (res.ok) {
            const data = await res.json();
            renderScreenResult(data, partId);
            return;
        }
    } catch (err) {
        isStaticMode = true;
    }

    const result = clientSideScreenML(vehicleType, iddq0h, iddq24h, emiDb, rainRate);
    renderScreenResult(result, partId);
}

function clientSideScreenML(vehicle, iddq0, iddq24, emi, rain) {
    const isAtmospheric = emi > -55.0 || rain > 8.0;
    if (isAtmospheric) {
        return {
            status_color: "var(--accent-purple)",
            status_text: "STATUS: ATMOSPHERIC NOISE (RE-SCREEN)",
            forecast_iddq_168h_uA: (iddq0 * 1.05).toFixed(2),
            drift_text: "Transient Spike - Safe for Flight after Re-screen",
            bar1_label: "Thunderstorm EMI Spike Weight (-65% Impact)",
            bar1_val: "85%",
            status: "RE_SCREEN"
        };
    } else if (iddq0 > 35.0) {
        return {
            status_color: "var(--accent-red)",
            status_text: "STATUS: HARDWARE REJECT (SPATIAL OUTLIER)",
            forecast_iddq_168h_uA: (iddq24 * 1.2).toFixed(2),
            drift_text: "Gate Oxide Pinholes Detected",
            bar1_label: "0h Initial Parametric Leakage (+75%)",
            bar1_val: "85%",
            status: "REJECTED"
        };
    } else if (iddq24 > iddq0 * 2.0) {
        return {
            status_color: "var(--accent-red)",
            status_text: "STATUS: EARLY REJECTION (SAFETY SLOPE EXCEEDED)",
            forecast_iddq_168h_uA: (iddq24 * 1.6).toFixed(2),
            drift_text: "Exceeds Safety Slope Limit",
            bar1_label: "24h Drift Acceleration (+68%)",
            bar1_val: "80%",
            status: "REJECTED"
        };
    }
    return {
        status_color: "#3fb950",
        status_text: "STATUS: CLEARED FOR FLIGHT (SPACE QUALIFIED)",
        forecast_iddq_168h_uA: (iddq24 * 1.04).toFixed(2),
        drift_text: "Stable Drift - Nominal Qualification",
        bar1_label: "Baseline Silicon Purity (92%)",
        bar1_val: "90%",
        status: "CLEARED"
    };
}

function renderScreenResult(data, partId) {
    const box = document.getElementById("screenResultBox");
    box.style.display = "block";
    box.innerHTML = `
        <div style="font-weight:bold; color:${data.status_color}; margin-bottom:6px;">
            ${data.status_text}
        </div>
        <div style="font-size:13px; color:var(--text-main); margin-bottom:4px;">
            <b>Forecast 168h Drift:</b> ${data.forecast_iddq_168h_uA} µA (${data.drift_text})
        </div>
        <div style="font-size:12px; color:var(--text-muted);">
            <b>Primary TreeSHAP Attribution:</b> ${data.bar1_label} (${data.bar1_val})
        </div>
    `;

    showToast(`Screened ${partId}: ${data.status}`);
    selectPartForInspection(partId);
}

// ==========================================
// DATASET MANAGEMENT & EXPORTS
// ==========================================
async function openDatasetModal() {
    document.getElementById("datasetModal").style.display = "flex";
    try {
        const res = await fetch("/api/dataset/summary");
        if (res.ok) {
            const data = await res.json();
            document.getElementById("datasetStatsBox").innerHTML = `
                <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; font-size:13px;">
                    <div><b>Total Records:</b> ${data.total_records}</div>
                    <div><b>Dataset Size:</b> ${data.csv_size_kb} KB</div>
                    <div><b>Avg 0h Iddq:</b> ${data.metrics ? data.metrics.avg_0h_iddq : '12.4'} µA</div>
                    <div><b>Avg Forecast 168h:</b> ${data.metrics ? data.metrics.avg_forecast_168h : '18.2'} µA</div>
                </div>
            `;
            return;
        }
    } catch (err) {
        isStaticMode = true;
    }

    document.getElementById("datasetStatsBox").innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; font-size:13px;">
            <div><b>Total Records:</b> ${clientTelemetryRecords.length} Qualification Records</div>
            <div><b>Vehicles:</b> 5 (LVM3, PSLV, SSLV, GSLV, NGLV)</div>
            <div><b>Status:</b> Ready for Export / Download</div>
            <div><b>TreeSHAP Weights:</b> Included</div>
        </div>
    `;
}

function closeDatasetModal() {
    document.getElementById("datasetModal").style.display = "none";
}

function downloadClientCSV() {
    let csvContent = "data:text/csv;charset=utf-8,part_id,vehicle_type,subsystem,sensing_channel,failure_factor,die_x,die_y,iddq_0h_uA,iddq_24h_uA,forecast_iddq_168h_uA,anomaly_category,status\n";
    clientTelemetryRecords.forEach(r => {
        csvContent += `${r.part_id},${r.vehicle_type},"${r.subsystem || 'Avionics'}","${r.sensing_channel}","${r.failure_factor}",${r.die_x || 0},${r.die_y || 0},${r.iddq_0h_uA},${r.iddq_24h_uA},${r.forecast_iddq_168h_uA},${r.anomaly_category},${r.status}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "isro_telemetry_l168_dataset.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloaded isro_telemetry_l168_dataset.csv");
}

function downloadClientJSON() {
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(clientTelemetryRecords, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", jsonStr);
    link.setAttribute("download", "isro_telemetry_l168_dataset.json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloaded isro_telemetry_l168_dataset.json");
}

function handleRegenerateDataset() {
    initClientTelemetryRecords();
    showToast(`Dataset re-synthesized with ${clientTelemetryRecords.length} records!`);
    loadTelemetryData();
    loadSpatialMapData();
    loadDriftSeriesData();
}
