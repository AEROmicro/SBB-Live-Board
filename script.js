let currentTempC = 0;
let unit = localStorage.getItem('tempUnit') || 'C';
let timeZone = localStorage.getItem('timeZone') || 'local';
let use12h = localStorage.getItem('use12h') === 'true';
let maxEntries = parseInt(localStorage.getItem('maxEntries')) || 15;
let currentCoords = { lat: 47.378177, lon: 8.540192 };
let map, marker;

// Initialize Map
function initMap() {
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([currentCoords.lat, currentCoords.lon], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    marker = L.marker([currentCoords.lat, currentCoords.lon]).addTo(map);
}

// Update Map Position
function updateMap(lat, lon, name) {
    if (!map) return;
    const newPos = [lat, lon];
    map.setView(newPos, 14);
    marker.setLatLng(newPos).bindPopup(name).openPopup();
}

// SBB Clock Logic
const markersContainer = document.getElementById('markers');
for (let i = 0; i < 60; i++) {
    const markerEl = document.createElement('div');
    markerEl.className = (i % 5 === 0) ? 'marker hour' : 'marker min';
    markerEl.style.transform = `rotate(${i * 6}deg)`;
    markersContainer.appendChild(markerEl);
}

function runClock() {
    let now = new Date();
    if (timeZone !== 'local') {
        now = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Zurich"}));
    }
    const ms = now.getMilliseconds();
    const sec = now.getSeconds();
    const min = now.getMinutes();
    const hr = now.getHours();

    const secondSmooth = ((sec * 1000) + ms) / 60000 * 360;
    const minuteSmooth = (min * 6) + (sec / 10);
    const hourSmooth = (hr % 12 * 30) + (min * 0.5);

    document.getElementById('secHand').style.transform = `translateY(-28px) rotate(${secondSmooth}deg)`;
    document.getElementById('minHand').style.transform = `translateY(-37px) rotate(${minuteSmooth}deg)`;
    document.getElementById('hourHand').style.transform = `translateY(-25px) rotate(${hourSmooth}deg)`;
    requestAnimationFrame(runClock);
}

function openSettings() { 
    document.getElementById('settingsOverlay').style.display = 'flex'; 
    renderFavorites();
}
function closeSettings() { document.getElementById('settingsOverlay').style.display = 'none'; }

function setTempUnit(u) {
    unit = u;
    localStorage.setItem('tempUnit', u);
    updateTempDisplay();
}

function setTimeFormat(is12h) {
    use12h = is12h;
    localStorage.setItem('use12h', is12h);
    fetchBoard();
}

function updateEntryCount(val) {
    let num = parseInt(val);
    if (isNaN(num) || num < 1) num = 15;
    maxEntries = num;
    localStorage.setItem('maxEntries', num);
    document.getElementById('entryInput').value = num;
    fetchBoard();
}

function setTimeZone(tz) {
    timeZone = tz;
    localStorage.setItem('timeZone', tz);
    fetchBoard(); 
}

function toggleFavorite() {
    let favs = JSON.parse(localStorage.getItem('favStations') || '[]');
    const current = document.getElementById('displayStation').innerText;
    if (!favs.includes(current)) {
        favs.push(current);
        localStorage.setItem('favStations', JSON.stringify(favs));
        alert(current + " saved");
    }
}

function removeFavorite(name) {
    let favs = JSON.parse(localStorage.getItem('favStations') || '[]');
    favs = favs.filter(f => f !== name);
    localStorage.setItem('favStations', JSON.stringify(favs));
    renderFavorites();
}

function renderFavorites() {
    let favs = JSON.parse(localStorage.getItem('favStations') || '[]');
    const container = document.getElementById('favListContainer');
    container.innerHTML = favs.length ? favs.map(f => `
        <div class="fav-item">
            <span onclick="selectStation('${f}'); closeSettings();">${f}</span>
            <div class="fav-del" onclick="removeFavorite('${f}')">x</div>
        </div>`).join('') : '<div style="padding:10px">No favorites saved</div>';
}

async function fetchWeather() {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${currentCoords.lat}&longitude=${currentCoords.lon}&current_weather=true`);
        const data = await res.json();
        currentTempC = data.current_weather.temperature;
        updateTempDisplay();
    } catch(e) {}
}

function updateTempDisplay() {
    let displayTemp = unit === 'F' ? (currentTempC * 9/5) + 32 : currentTempC;
    document.getElementById('tempDisplay').innerText = `${displayTemp.toFixed(1)}°${unit}`;
}

const input = document.getElementById('stationInput');
const list = document.getElementById('autocomplete-list');
const updateDisplay = document.getElementById('updateTime');

input.addEventListener('input', async () => {
    const val = input.value;
    if (val.length < 2) { list.innerHTML = ''; return; }
    try {
        const res = await fetch(`https://transport.opendata.ch/v1/locations?query=${encodeURIComponent(val)}`);
        const data = await res.json();
        list.innerHTML = (data.stations || []).slice(0, 5).map(s => 
            `<div class="autocomplete-item" onclick="selectStation('${s.name}')">${s.name}</div>`
        ).join('');
    } catch(e) {}
});

function selectStation(name) {
    input.value = name;
    list.innerHTML = '';
    fetchBoard();
}

async function fetchBoard() {
    const savedStation = localStorage.getItem('lastStation');
    const stationQuery = input.value || savedStation || 'Zürich HB';
    
    try {
        const res = await fetch(`https://transport.opendata.ch/v1/stationboard?station=${encodeURIComponent(stationQuery)}&limit=${maxEntries}&type=departure`);
        const data = await res.json();
        
        if (data.station) {
            document.getElementById('displayStation').innerText = data.station.name;
            localStorage.setItem('lastStation', data.station.name);
            
            if(data.station.coordinate) {
                currentCoords = { lat: data.station.coordinate.x, lon: data.station.coordinate.y };
                updateMap(currentCoords.lat, currentCoords.lon, data.station.name);
                fetchWeather();
            }
        }

        const tbody = document.getElementById('boardBody');
        let newRows = '';

        if (!data.stationboard || data.stationboard.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 40px;">Keine Abfahrten gefunden</td></tr>';
            return;
        }

        data.stationboard.forEach(train => {
            const stop = train.stop || {};
            if (!stop.departure) return;
            let depTime = new Date(stop.departure);
            const options = { hour: '2-digit', minute: '2-digit', hour12: use12h };
            if (timeZone !== 'local') options.timeZone = 'Europe/Zurich';
            
            let timeStr = depTime.toLocaleTimeString([], options);
            const delayStr = stop.delay ? `<span class="delay">+${stop.delay}′</span>` : '';
            const cat = train.category || "";
            const num = train.number || "";
            const badge = (cat + num) || "Zug";
            let dest = train.to || (train.passList?.length > 0 ? train.passList[train.passList.length - 1].station.name : badge);
            const viaList = (train.passList || []).slice(1, 4).map(p => p.station.name).filter(n => n && n !== dest);
            const viaText = viaList.length > 0 ? 'via ' + viaList.join(' - ') : '';
            let lineClass = cat === 'IR' ? 'line-IR' : (cat === 'IC' ? 'line-IC' : 'line-S');

            newRows += `
                <tr>
                    <td class="time-cell">${timeStr}${delayStr}</td>
                    <td class="dest-cell">
                        <span class="line-badge ${lineClass}">${badge}</span>
                        ${dest}
                        <div class="via-text">${viaText}</div>
                    </td>
                    <td style="text-align: right;"><span class="track-box">${stop.platform || ''}</span></td>
                </tr>`;
        });
        tbody.innerHTML = newRows;
        updateDisplay.innerText = `Zuletzt aktualisiert: ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}`;
    } catch (e) { 
        updateDisplay.innerText = "Verbindungsfehler...";
    }
}

// Startup
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    runClock();
    fetchBoard();
    document.getElementById('entryInput').value = maxEntries;
});

setInterval(fetchBoard, 30000);
setInterval(fetchWeather, 600000);
