const map = L.map('map').setView([31.5, -100.5], 6);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href=" ">OpenStreetMap</a >'
}).addTo(map);

// 17 indicators with default weights
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

const negativeIndicators = ['1_LP', '1_NR', '1_CP'];

let currentWeights = {};
let geoJsonLayer = null;

// Magma color scale (darker = higher score)
function getColor(score, minScore, maxScore) {
    let t = (score - minScore) / (maxScore - minScore + 0.0001);
    // HSL: H从黄色(60)渐变到紫色(300)
    let h;
    if (t < 0.5) {
        // 黄色 → 红色 (60 → 0)
        h = 60 - (t * 2) * 60;
    } else {
        // 红色 → 紫色 (0 → 300)
        h = (t - 0.5) * 2 * 300;
    }
    // S=80%, L=55% 颜色鲜艳且不刺眼
    return `hsl(${h}, 80%, 55%)`;
}

function getLegendColors() {
    // 图例显示6个代表性颜色
    return [
        'hsl(60, 80%, 55%)',   // 最低分 → 黄色
        'hsl(48, 80%, 55%)',
        'hsl(36, 80%, 55%)',
        'hsl(24, 80%, 55%)',
        'hsl(12, 80%, 55%)',
        'hsl(0, 80%, 55%)',    // 红色
        'hsl(60, 80%, 55%)',   // 红紫过渡
        'hsl(120, 80%, 55%)',
        'hsl(180, 80%, 55%)',
        'hsl(240, 80%, 55%)',
        'hsl(300, 80%, 55%)'   // 最高分 → 紫色
    ];
}

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

function updateMapColors() {
    if (!geoJsonLayer) return;
    
    const scores = [];
    geoJsonLayer.eachLayer(layer => {
        const props = layer.feature.properties;
        let score = 0;
        for (let ind of indicators) {
            let val = props[ind.id];
            if (val === undefined || val === null) val = 0;
            val = parseFloat(val);
            
            // 负向指标需要反转（1 - 标准化值）
            if (negativeIndicators.includes(ind.id)) {
                val = 1 - val;
            }
            score += (currentWeights[ind.id] || 0) * val;
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
    const colors = getLegendColors();
    const steps = colors.length;
    
    // 找现有图例，没有就创建
    let legendDiv = document.querySelector('.leaflet-control-legend');
    
    if (!legendDiv) {
        const LegendControl = L.Control.extend({
            onAdd: function() {
                const div = L.DomUtil.create('div', 'legend');
                div.className = 'leaflet-control-legend';
                div.style.background = 'white';
                div.style.padding = '10px 12px';
                div.style.borderRadius = '5px';
                div.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
                div.style.fontSize = '12px';
                div.style.minWidth = '120px';
                return div;
            }
        });
        map.addControl(new LegendControl({ position: 'bottomright' }));
        legendDiv = document.querySelector('.leaflet-control-legend');
    }
    
    // 更新内容
    if (legendDiv) {
        let html = '<h4 style="margin:0 0 8px 0;font-size:12px;">Composite Score</h4>';
        html += '<div class="legend-colors" style="display:flex;height:20px;margin:5px 0;border-radius:2px;overflow:hidden;">';
        for (let i = 0; i < colors.length; i++) {
            html += `<div style="flex:1;background:${colors[i]};"></div>`;
        }
        html += '</div>';
        
        // 显示最小和最大值（两端）
        html += `<div style="display:flex;justify-content:space-between;font-size:10px;margin-top:4px;">
                    <span>${minScore.toFixed(3)}</span>
                    <span>${maxScore.toFixed(3)}</span>
                 </div>`;
        
        legendDiv.innerHTML = html;
    }
}

async function loadData() {
    try {
        const response = await fetch('data/texas_counties.geojson');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
