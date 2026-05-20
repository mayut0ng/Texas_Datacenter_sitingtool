const map = L.map('map').setView([31.5, -100.5], 6);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href=" ">OpenStreetMap</a >'
}).addTo(map);

// 17 factors
const indicators = [
    { id: 'ST', name: 'Energy Storage', default: 0.0042 },
    { id: 'WI', name: 'Wind Power', default: 0.0017 },
    { id: 'SO', name: 'Solar Power', default: 0.0082 },
    { id: 'EG', name: 'Electricity Generation', default: 0.0219 },
    { id: 'OF', name: 'Fiber Coverage', default: 0.0152 },
    { id: 'TA', name: 'Traffic Accessibility', default: 0.0667 },
    { id: 'LP', name: 'Land Price', default: 0.0138 },
    { id: 'GDP', name: 'GDP', default: 0.2677 },
    { id: 'TT', name: 'Tech Talent', default: 0.1548 },
    { id: 'TPM', name: 'High-Income Migration', default: 0.0121 },
    { id: 'PF', name: 'Policy Friendliness', default: 0.0306 },
    { id: 'CP', name: 'Civil Protest', default: 0.0079 },
    { id: 'T', name: 'Temperature', default: 0.0077 },
    { id: 'NR', name: 'Natural Disaster Risk', default: 0.1253 },
    { id: 'GW', name: 'Groundwater', default: 0.0469 },
    { id: 'SW', name: 'Surface Water', default: 0.1761 },
    { id: 'RW', name: 'Reclaimed Water', default: 0.0392 }
];

let currentWeights = {};
let geoJsonLayer = null;

function createSliders() {
    const container = document.getElementById('weight-sliders');
    container.innerHTML = '';
    indicators.forEach(ind => {
        currentWeights[ind.id] = ind.default;
        const div = document.createElement('div');
        div.className = 'slider-group';
        div.innerHTML = `
            <label><span>${ind.name}</span><span class="weight-value" id="val_${ind.id}">${ind.default.toFixed(3)}</span></label>
            <input type="range" id="slider_${ind.id}" min="0" max="0.3" step="0.002" value="${ind.default}">
        `;
        container.appendChild(div);
        document.getElementById(`slider_${ind.id}`).addEventListener('input', (e) => {
            currentWeights[ind.id] = parseFloat(e.target.value);
            document.getElementById(`val_${ind.id}`).innerText = currentWeights[ind.id].toFixed(3);
            updateTotalAndMap();
        });
    });
}

function normalizeWeights() {
    let sum = 0;
    for (let ind of indicators) sum += currentWeights[ind.id];
    if (sum === 0) return;
    for (let ind of indicators) {
        currentWeights[ind.id] /= sum;
        const span = document.getElementById(`val_${ind.id}`);
        if (span) span.innerText = currentWeights[ind.id].toFixed(4);
    }
}

function updateTotalAndMap() {
    let sum = 0;
    for (let ind of indicators) sum += currentWeights[ind.id];
    document.getElementById('totalWeight').innerText = sum.toFixed(4);
    if (Math.abs(sum - 1) > 0.01) normalizeWeights();
    if (geoJsonLayer) updateMapColors();
}

function updateMapColors() {
    if (!geoJsonLayer) return;
    const scores = [];
    geoJsonLayer.eachLayer(layer => {
        const props = layer.feature.properties;
        let score = 0;
        for (let ind of indicators) score += (currentWeights[ind.id] || 0) * (props[ind.id] || 0);
        scores.push(score);
        props.score = score;
    });
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    geoJsonLayer.eachLayer(layer => {
        const score = layer.feature.properties.score || 0;
        const intensity = (score - minScore) / (maxScore - minScore + 0.001);
        layer.setStyle({ fillColor: getColor(intensity), fillOpacity: 0.7, weight: 0.5, color: '#333' });
    });
    updateLegend(minScore, maxScore);
}

function getColor(i) {
    if (i > 0.8) return '#800026';
    if (i > 0.6) return '#BD0026';
    if (i > 0.4) return '#E31A23';
    if (i > 0.2) return '#FC4E2A';
    if (i > 0.1) return '#FD8D3C';
    return '#FEB24C';
}

function updateLegend(minScore, maxScore) {
    let legend = document.querySelector('.leaflet-control-legend');
    if (!legend) {
        const LegendControl = L.Control.extend({
            onAdd: () => {
                const div = L.DomUtil.create('div', 'legend');
                div.innerHTML = `<h4>Composite Score</h4><div class="legend-colors"><div class="legend-color" style="background:#FEB24C"></div><div class="legend-color" style="background:#FD8D3C"></div><div class="legend-color" style="background:#FC4E2A"></div><div class="legend-color" style="background:#E31A23"></div><div class="legend-color" style="background:#BD0026"></div><div class="legend-color" style="background:#800026"></div></div><div>${minScore.toFixed(3)} → ${maxScore.toFixed(3)}</div>`;
                return div;
            }
        });
        map.addControl(new LegendControl({ position: 'bottomright' }));
    } else {
        const div = legend.getContainer();
        if (div) div.innerHTML = `<h4>Composite Score</h4><div class="legend-colors"><div class="legend-color" style="background:#FEB24C"></div><div class="legend-color" style="background:#FD8D3C"></div><div class="legend-color" style="background:#FC4E2A"></div><div class="legend-color" style="background:#E31A23"></div><div class="legend-color" style="background:#BD0026"></div><div class="legend-color" style="background:#800026"></div></div><div>${minScore.toFixed(3)} → ${maxScore.toFixed(3)}</div>`;
    }
}

async function loadData() {
    try {
        const response = await fetch('data/texas_counties.geojson');
        const data = await response.json();
        geoJsonLayer = L.geoJSON(data, {
            style: { fillColor: '#FEB24C', fillOpacity: 0.6, weight: 0.5, color: '#333' },
            onEachFeature: (f, l) => l.bindTooltip(`${f.properties.NAME || 'Unknown'}`, { sticky: true })
        }).addTo(map);
        map.fitBounds(geoJsonLayer.getBounds());
        updateMapColors();
    } catch(e) { console.log('Waiting for GeoJSON data...'); }
}

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

createSliders();
document.getElementById('resetBtn').addEventListener('click', resetWeights);
loadData();
