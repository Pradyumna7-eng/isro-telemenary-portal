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
    document.getElementById("btnViewWafer").classList.toggle("active", mode === "wafer");
    document.getElementById("btnViewScatter").classList.toggle("active", mode === "scatter");
    renderModuleA();
    showToast(`Switched Module A to ${mode === 'wafer' ? 'Silicon Wafer Disc' : 'Scatter Grid'}`);
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

    const cx = 240;
    const cy = 130;
    const waferRadius = 105;

    if (waferViewMode === "wafer") {
        // Render 300mm Silicon Wafer Disc
        baseLayer.innerHTML = `
            <!-- Wafer Shadow & Background Outer Body -->
            <circle cx="${cx}" cy="${cy}" r="${waferRadius + 4}" fill="#080b10" stroke="#30363d" stroke-width="1.5" />
            <circle cx="${cx}" cy="${cy}" r="${waferRadius}" fill="url(#waferGrad)" stroke="#58a6ff" stroke-width="2" opacity="0.9" />
            
            <!-- Alignment Notch at Bottom -->
            <path d="M ${cx - 10} ${cy + waferRadius} Q ${cx} ${cy + waferRadius - 8} ${cx + 10} ${cy + waferRadius}" fill="#080b10" stroke="#58a6ff" stroke-width="2"/>
            
            <!-- Concentric Wafer Zones -->
            <circle cx="${cx}" cy="${cy}" r="${waferRadius * 0.35}" fill="none" stroke="#30363d" stroke-width="1" stroke-dasharray="2 3" opacity="0.6"/>
            <circle cx="${cx}" cy="${cy}" r="${waferRadius * 0.70}" fill="none" stroke="#30363d" stroke-width="1" stroke-dasharray="3 4" opacity="0.6"/>
            <circle cx="${cx}" cy="${cy}" r="${waferRadius * 0.90}" fill="none" stroke="#da3633" stroke-width="1" stroke-dasharray="4 4" opacity="0.45"/>
            
            <!-- Crosshairs -->
            <line x1="${cx - waferRadius + 10}" y1="${cy}" x2="${cx + waferRadius - 10}" y2="${cy}" stroke="#30363d" stroke-width="1" opacity="0.5"/>
            <line x1="${cx}" y1="${cy - waferRadius + 10}" x2="${cx}" y2="${cy + waferRadius - 10}" stroke="#30363d" stroke-width="1" opacity="0.5"/>
            
            <!-- Silicon Crystal Orientation Markers -->
            <text x="${cx}" y="22" fill="#8b949e" font-size="9" text-anchor="middle" font-weight="600">300mm &lt;100&gt; SILICON WAFER</text>
            <text x="${cx}" y="${cy + waferRadius - 12}" fill="#8b949e" font-size="8" text-anchor="middle">PRIMARY FLAT NOTCH</text>
            <text x="${cx + waferRadius - 18}" y="${cy + 4}" fill="#da3633" font-size="7" font-weight="bold" text-anchor="end">3σ EDGE LIMIT</text>
        `;

        // Render Laser Scanning Beam
        laserLayer.innerHTML = `
            <g id="radarSweepGroup" transform="translate(${cx}, ${cy})">
                <line x1="0" y1="0" x2="${waferRadius}" y2="0" stroke="#58a6ff" stroke-width="2" filter="url(#glowEffect)" opacity="0.9"/>
                <path d="M 0 0 L ${waferRadius} 0 A ${waferRadius} ${waferRadius} 0 0 0 ${Math.cos(0.55) * waferRadius} ${-Math.sin(0.55) * waferRadius} Z" fill="url(#laserBeamGrad)" />
            </g>
        `;

        // Render Dies
        spatialDiesData.forEach((die, index) => {
            const scale = (waferRadius * 0.82) / 12.0;
            const px = cx + (die.die_x * scale);
            const py = cy + (die.die_y * scale);

            let color = "#58a6ff";
            let r = 3.5;
            if (die.status === "RE_SCREEN") {
                color = "#bc8cff";
                r = 4.2;
            } else if (die.flag_spatial || die.iddq_0h > 35) {
                color = "#f85149";
                r = 5.2;
            } else if (die.flag_drift || die.iddq_24h > die.iddq_0h * 1.8) {
                color = "#f0883e";
                r = 4.8;
            }

            const isSelected = (die.part_id === selectedAuditPart);
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", px);
            circle.setAttribute("cy", py);
            circle.setAttribute("r", isSelected ? (r + 3) : r);
            circle.setAttribute("fill", color);
            circle.setAttribute("stroke", isSelected ? "#ffffff" : (r > 4 ? "rgba(255,255,255,0.7)" : "#161b22"));
            circle.setAttribute("stroke-width", isSelected ? "2" : "1");
            circle.setAttribute("id", `die_${die.part_id}`);
            circle.setAttribute("class", "interactive-die");
            circle.style.cursor = "pointer";
            circle.style.transition = "r 0.15s ease, stroke 0.15s ease";

            circle.onmouseenter = (e) => showDieTooltip(e, die, px, py);
            circle.onmouseleave = () => hideDieTooltip();
            circle.onclick = () => selectPartForInspection(die.part_id);

            diesLayer.appendChild(circle);
        });

    } else {
        // Scatter Plot View (Iddq vs Spatial Channel)
        baseLayer.innerHTML = `
            <line x1="60" y1="35" x2="450" y2="35" stroke="#30363d" stroke-dasharray="2 4" stroke-width="1"/>
            <line x1="60" y1="90" x2="450" y2="90" stroke="#30363d" stroke-dasharray="2 4" stroke-width="1"/>
            <line x1="60" y1="145" x2="450" y2="145" stroke="#30363d" stroke-dasharray="2 4" stroke-width="1"/>
            <line x1="60" y1="200" x2="450" y2="200" stroke="#8b949e" stroke-width="1.5"/>
            <line x1="60" y1="20" x2="60" y2="200" stroke="#8b949e" stroke-width="1.5"/>

            <text transform="rotate(-90)" x="-110" y="18" fill="#8b949e" font-size="10" font-weight="600" text-anchor="middle">Iddq Current (µA)</text>
            <text x="52" y="39" fill="#8b949e" font-size="9" text-anchor="end">60 µA</text>
            <text x="52" y="94" fill="#8b949e" font-size="9" text-anchor="end">40 µA</text>
            <text x="52" y="149" fill="#8b949e" font-size="9" text-anchor="end">20 µA</text>
            <text x="52" y="204" fill="#8b949e" font-size="9" text-anchor="end">0 µA</text>

            <text x="255" y="235" fill="#8b949e" font-size="11" font-weight="600" text-anchor="middle">Spatial Die Channel / Index</text>
            
            <!-- Outlier Limit Line -->
            <line x1="60" y1="75" x2="450" y2="75" stroke="#da3633" stroke-width="1.5" stroke-dasharray="4"/>
            <text x="445" y="68" fill="#da3633" font-size="9" font-weight="bold" text-anchor="end">Spatial 3σ Limit (45 µA)</text>
        `;

        spatialDiesData.forEach((die, index) => {
            const px = 60 + ((index % 60) / 60) * 380;
            const py = 200 - Math.min(180, (die.iddq_0h / 65) * 180);

            let color = "#58a6ff";
            let r = 3.5;
            if (die.status === "RE_SCREEN") color = "#bc8cff";
            else if (die.flag_spatial || die.iddq_0h > 35) { color = "#f85149"; r = 5.5; }
            else if (die.flag_drift) { color = "#f0883e"; r = 4.5; }

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", px);
            circle.setAttribute("cy", py);
            circle.setAttribute("r", r);
            circle.setAttribute("fill", color);
            circle.setAttribute("stroke", "#161b22");
            circle.style.cursor = "pointer";

            circle.onmouseenter = (e) => showDieTooltip(e, die, px, py);
            circle.onmouseleave = () => hideDieTooltip();
            circle.onclick = () => selectPartForInspection(die.part_id);

            diesLayer.appendChild(circle);
        });
    }
}

function updateRadarSweepPosition() {
    const sweep = document.getElementById("radarSweepGroup");
    if (sweep) {
        sweep.setAttribute("transform", `translate(240, 130) rotate(${radarAngle})`);
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

    const interp = (h0, h24, h168) => {
        return [
            { hour: 0, iddq_uA: h0 },
            { hour: 24, iddq_uA: h24 },
            { hour: 96, iddq_uA: Number((h24 + (h168 - h24) * 0.6).toFixed(2)) },
            { hour: 168, iddq_uA: h168 }
        ];
    };

    let selH0 = 11.0, selH24 = 24.5, selH168 = 39.0;
    if (selectedAuditPart === "PART_088") {
        selH0 = 10.2; selH24 = 19.5; selH168 = 11.0;
    } else if (selectedAuditPart === "PART_010") {
        selH0 = 48.0; selH24 = 50.2; selH168 = 52.0;
    } else if (selectedAuditPart === "PART_001") {
        selH0 = 8.5; selH24 = 9.2; selH168 = 10.4;
    }

    driftSeriesData = {
        vehicle: currentVehicle,
        safety_slope_limit: limit,
        selected_part_id: selectedAuditPart,
        selected_series: interp(selH0, selH24, selH168),
        nominal_series: interp(8.5, 9.2, 10.4),
        outlier_series: interp(48.0, 50.2, 52.0),
        weather_series: interp(10.2, 19.5, 11.0),
        confidence_upper: interp(10.5, 11.5, 13.0),
        confidence_lower: interp(6.5, 7.2, 8.0)
    };
    renderModuleB();
}

function renderModuleB() {
    const gridLayer = document.getElementById("driftGridLayer");
    const corridorLayer = document.getElementById("driftCorridorLayer");
    const curvesLayer = document.getElementById("driftCurvesLayer");
    const sweepLayer = document.getElementById("driftSweepLayer");
    const hudLayer = document.getElementById("driftHudLayer");

    if (!gridLayer || !curvesLayer || !driftSeriesData) return;
    gridLayer.innerHTML = "";
    corridorLayer.innerHTML = "";
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

    // 3. Shaded Flight Confidence Corridor
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

    // 4. Trajectory Curves Helper
    const buildPath = (series) => {
        if (!series || series.length === 0) return "";
        let d = `M ${mapX(series[0].hour)} ${mapY(series[0].iddq_uA)}`;
        for (let i = 1; i < series.length; i++) {
            d += ` L ${mapX(series[i].hour)} ${mapY(series[i].iddq_uA)}`;
        }
        return d;
    };

    // Nominal Flight Baseline (Green)
    const nominalPath = buildPath(driftSeriesData.nominal_series);
    curvesLayer.innerHTML += `
        <path d="${nominalPath}" stroke="#238636" stroke-width="2" fill="none" opacity="0.85"/>
        <text x="${mapX(168)}" y="${mapY(10.4) + 14}" fill="#3fb950" font-size="8" text-anchor="end">Nominal Baseline</text>
    `;

    // Spatial Outlier Baseline (Red dashed)
    const outlierPath = buildPath(driftSeriesData.outlier_series);
    curvesLayer.innerHTML += `
        <path d="${outlierPath}" stroke="#da3633" stroke-width="1.5" stroke-dasharray="3 3" fill="none" opacity="0.6"/>
        <text x="${mapX(168)}" y="${mapY(52.0) - 6}" fill="#da3633" font-size="8" text-anchor="end">PART_010 Outlier</text>
    `;

    // Active Inspected Part Curve (Prominent Glow)
    const selSeries = driftSeriesData.selected_series;
    if (selSeries && selSeries.length > 0) {
        const selPath = buildPath(selSeries);
        const isReject = selSeries[selSeries.length - 1].iddq_uA > slopeVal || selectedAuditPart === "PART_025" || selectedAuditPart === "PART_010";
        const isWeather = (selectedAuditPart === "PART_088");
        const strokeColor = isWeather ? "#bc8cff" : (isReject ? "#f85149" : "#3fb950");

        curvesLayer.innerHTML += `
            <path d="${selPath}" stroke="${strokeColor}" stroke-width="3" fill="none" filter="url(#glowEffect)" opacity="0.95"/>
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
    }

    // 5. Sweep Playhead Line
    sweepLayer.innerHTML = `
        <g id="oscSweepGroup">
            <line id="oscSweepLine" x1="${mapX(0)}" y1="20" x2="${mapX(0)}" y2="${y0}" stroke="#58a6ff" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.85"/>
            <circle id="oscSweepHead" cx="${mapX(0)}" cy="${y0}" r="4" fill="#58a6ff" stroke="#ffffff" stroke-width="1.5"/>
        </g>
    `;

    document.getElementById("oscPartBadge").innerText = `Inspecting: ${selectedAuditPart}`;
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

        const tr = document.createElement("tr");
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
// DEEP AUDIT & TREESHAP INSPECTION
// ==========================================
async function loadInspectionOptions() {
    try {
        const res = await fetch(`/api/diagnostics/inspections?vehicle=${currentVehicle}`);
        if (res.ok) {
            const data = await res.json();
            const sel = document.getElementById("partSelect");
            sel.innerHTML = "";
            data.forEach(item => {
                const opt = document.createElement("option");
                opt.value = item.part_id;
                opt.innerText = `${item.part_id} (${item.factor.substring(0, 38)}...)`;
                sel.appendChild(opt);
            });
            updateAuditCard();
            return;
        }
    } catch (err) {
        isStaticMode = true;
    }

    const sel = document.getElementById("partSelect");
    sel.innerHTML = "";
    Object.keys(FALLBACK_INSPECTIONS).forEach(partId => {
        const item = FALLBACK_INSPECTIONS[partId];
        const opt = document.createElement("option");
        opt.value = partId;
        opt.innerText = `${partId} (${item.factor.substring(0, 38)}...)`;
        sel.appendChild(opt);
    });
    updateAuditCard();
}

function selectPartForInspection(partId) {
    selectedAuditPart = partId;
    const sel = document.getElementById("partSelect");
    let found = false;
    for (let opt of sel.options) {
        if (opt.value === partId) {
            opt.selected = true;
            found = true;
            break;
        }
    }
    if (!found) {
        const newOpt = document.createElement("option");
        newOpt.value = partId;
        newOpt.innerText = `${partId} (Selected from telemetry)`;
        sel.prepend(newOpt);
        newOpt.selected = true;
    }

    updateAuditCard();
    loadDriftSeriesData();
    renderModuleA(); // Refresh selected die glow in Module A
    showToast(`Loaded Diagnostic Audit for ${partId}`);
}

async function updateAuditCard() {
    const selected = document.getElementById("partSelect").value;
    selectedAuditPart = selected;

    try {
        const res = await fetch(`/api/diagnostics/inspection/${selected}`);
        if (res.ok) {
            const data = await res.json();
            applyAuditCardData(data);
            loadDriftSeriesData();
            return;
        }
    } catch (err) {
        isStaticMode = true;
    }

    const fallback = FALLBACK_INSPECTIONS[selected] || {
        status_text: "STATUS: NOMINAL (SPACE QUALIFIED)",
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
    };
    fallback.part_id = selected;
    applyAuditCardData(fallback);
    loadDriftSeriesData();
}

function applyAuditCardData(data) {
    document.getElementById("auditStatus").innerText = data.status_text;
    document.getElementById("auditStatus").style.color = data.status_color;
    document.getElementById("auditPartId").innerText = data.part_id || document.getElementById("partSelect").value;
    document.getElementById("auditCategory").innerText = data.category;
    document.getElementById("auditCategory").style.color = data.status_color;
    document.getElementById("auditSensor").innerText = data.sensor;
    document.getElementById("auditFactor").innerText = data.factor;
    document.getElementById("auditDrift").innerText = data.drift_text;
    document.getElementById("auditDrift").style.color = data.drift_color;

    document.getElementById("bar1Label").innerText = data.bar1_label;
    document.getElementById("bar1").style.width = data.bar1_val;
    document.getElementById("bar1").style.backgroundColor = data.bar1_color;

    document.getElementById("bar2Label").innerText = data.bar2_label;
    document.getElementById("bar2").style.width = data.bar2_val;
    document.getElementById("bar2").style.backgroundColor = data.bar2_color;
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
