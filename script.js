const map = L.map('map').setView([31.5, -100.5], 6);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href=" ">OpenStreetMap</a >'
}).addTo(map);

// 17 factors
const indicators = [
    { id: '1_ST', name: 'Energy Storage', default: 0.0042 },
    { id: '1_WI', name: 'Wind Power', default: 0.0017 },
    { id: '1_SO', name: 'Solar Power', default: 0.0082 },
    { id: '1_EG', name: 'Electricity Generation', default: 0.0219 },
    { id: '1_OF', name: 'Fiber Coverage', default: 0.0152 },
    { id: '1_TA', name: 'Traffic Accessibility', default: 0.0667 },
    { id: '1_LP', name: 'Land Price', default: 0.0138 },
    { id: '1_GDP', name: 'GDP', default: 0.2677 },
    { id: '1_TT', name: 'Tech Talent', default: 0.1548 },
    { id: '1_TPM', name: 'High-Income Migration', default: 0.0121 },
    { id: '1_PF', name: 'Policy Friendliness', default: 0.0306 },
    { id: '1_CP', name: 'Civil Protest', default: 0.0079 },
    { id: '1_T', name: 'Temperature', default: 0.0077 },
    { id: '1_NR', name: 'Natural Disaster Risk', default: 0.1253 },
    { id: '1_GW', name: 'Groundwater', default: 0.0469 },
    { id: '1_SW', name: 'Surface Water', default: 0.1761 },
    { id: '1_RW', name: 'Reclaimed Water', default: 0.0392 }
];


let currentWeights = {};
let geoJsonLayer = null;

// Magma color scale (darker = higher score)
function getColor(score, minScore, maxScore) {
    let t = (score - minScore) / (maxScore - minScore + 0.0001);
    // Magma colormap: dark purple -> orange -> light yellow
    if (t < 0.2) return '#2c1a4d';
    if (t < 0.35) return '#6c2b6b';
    if (t < 0.5) return '#b03c75';
    if (t < 0.65) return '#e27c5c';
    if (t < 0.8) return '#f9ac5c';
    return '#ffdd76';
}

function getLegendColors() {
    return ['#2c1a4d', '#6c2b6b', '#b03c75', '#e27c5c', '#f9ac5c', '#ffdd76'];
}

// Create slider controls
function createSliders() {
    const container = document.getElementById('weight-sliders');
    container.innerHTML = '';
    
    indicators.forEach(ind => {
        currentWeights[ind.id] = ind.default;
        
        const div = document.createElement('div');
        div.className = 'slider-group';
        div.innerHTML = `
            <label>
                <span>${ind.name}</span>
            </label>
            <input type="range" id="slider_${ind.id}" min="0" max="0.3" step="0.002" value="${ind.default}">
            <label style="justify-content: flex-end; margin-top: 2px;">
                <span class="weight-value" id="val_${ind.id}">${ind.default.toFixed(3)}</span>
            </label>
        `;
        container.appendChild(div);
        
        const slider = document.getElementById(`slider_${ind.id}`);
        slider.addEventListener('input', (e) => {
            currentWeights[ind.id] = parseFloat(e.target.value);
            document.getElementById(`val_${ind.id}`).innerText = currentWeights[ind.id].toFixed(3);
            updateTotalAndMap();
        });
    });
}

// Normalize weights to sum to 1
function normalizeWeights() {
    let sum = 0;
    for (let ind of indicators) sum += currentWeights[ind.id];
    if (sum === 0) return;
    for (let ind of indicators) {
        currentWeights[ind.id] = currentWeights[ind.id] / sum;
        const span = document.getElementById(`val_${ind.id}`);
        if (span) span.innerText = currentWeights[ind.id].toFixed(4);
    }
}

// Update total weight display and refresh map
function updateTotalAndMap() {
    let sum = 0;
    for (let ind of indicators) sum += currentWeights[ind.id];
    document.getElementById('totalWeight').innerText = sum.toFixed(4);
    
    if (Math.abs(sum - 1) > 0.01) {
        normalizeWeights();
        document.getElementById('totalWeight').innerText = '1.0000';
    }
    
    if (geoJsonLayer) updateMapColors();
}

// Calculate composite score and update county colors
function updateMapColors() {
    if (!geoJsonLayer) return;
    
    const scores = [];
    geoJsonLayer.eachLayer(layer => {
        const props = layer.feature.properties;
        let score = 0;
        for (let ind of indicators) {
            let val = props[ind.id];
            if (val === undefined || val === null) val = 0;
            score += (currentWeights[ind.id] || 0) * parseFloat(val);
        }
        props.score = score;
        scores.push(score);
    });
    
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    
    geoJsonLayer.eachLayer(layer => {
        const score = layer.feature.properties.score || 0;
        const color = getColor(score, minScore, maxScore);
        layer.setStyle({
            fillColor: color,
            fillOpacity: 0.8,
            weight: 0.8,
            color: '#333333',
            opacity: 0.4
        });
    });
    
    updateLegend(minScore, maxScore);
}

function updateLegend(minScore, maxScore) {
    // Remove existing legend if present
    const existingLegend = document.querySelector('.leaflet-control-legend');
    if (existingLegend) {
        existingLegend.remove();
    }
    
    const LegendControl = L.Control.extend({
        onAdd: function() {
            const div = L.DomUtil.create('div', 'legend');
            const colors = getLegendColors();
            const steps = colors.length;
            
            div.innerHTML = '<h4>Composite Score</h4>';
            const colorDiv = document.createElement('div');
            colorDiv.className = 'legend-colors';
            for (let i = 0; i < steps; i++) {
                const c = document.createElement('div');
                c.className = 'legend-color';
                c.style.backgroundColor = colors[i];
                colorDiv.appendChild(c);
            }
            div.appendChild(colorDiv);
            
            const labelDiv = document.createElement('div');
            labelDiv.className = 'legend-labels';
            labelDiv.innerHTML = `<span>${minScore.toFixed(3)}</span><span>${maxScore.toFixed(3)}</span>`;
            div.appendChild(labelDiv);
            
            return div;
        }
    });
    
    map.addControl(new LegendControl({ position: 'bottomright' }));
}

// Load GeoJSON data
async function loadData() {
    try {
        const response = await fetch('data/texas_counties.geojson');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        
        console.log('GeoJSON loaded, features:', data.features?.length || 0);
        
        geoJsonLayer = L.geoJSON(data, {
            style: { fillColor: '#2c1a4d', fillOpacity: 0.7, weight: 0.8, color: '#333' },
            onEachFeature: (feature, layer) => {
                const name = feature.properties.NAME || feature.properties.county || 'Unknown';
                layer.bindTooltip(`${name}<br>Drag sliders to see score change`, { sticky: true });
            }
        }).addTo(map);
        
        map.fitBounds(geoJsonLayer.getBounds());
        updateMapColors();
        
    } catch (error) {
        console.error('Error loading GeoJSON:', error);
        document.getElementById('weight-sliders').innerHTML = 
            '<div style="color: red; padding: 10px;">Error loading county data. Please ensure data/texas_counties.geojson exists.</div>';
    }
}

// Reset to default weights
function resetWeights() {
    for (let ind of indicators) {
        currentWeights[ind.id] = ind.default;
        const slider = document.getElementById(`slider_${ind.id}`);
        if (slider) slider.value = ind.default;
        const span = document.getElementById(`val_${ind.id}`);
        if (span) span.innerText = ind.default.toFixed(3);
    }
    updateTotalAndMap();
}

// Initialize
createSliders();
document.getElementById('resetBtn').addEventListener('click', resetWeights);
loadData();
