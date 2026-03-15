let globalBoardData = [];
let currentTempC = 0;
let unit = localStorage.getItem('tempUnit') || 'C';
let timeZone = localStorage.getItem('timeZone') || 'local';
let use12h = localStorage.getItem('use12h') === 'true';
let maxEntries = parseInt(localStorage.getItem('maxEntries')) || 15;
let notifsEnabled = localStorage.getItem('notifsEnabled') === 'true';
let currentCoords = { lat: 47.378177, lon: 8.540192 };
let map, marker, routePolyline;
let notifiedTrains = new Set(); // Prevent spamming notifications

// --- NEW: TRANSLATION ENGINE ---
const translations = {
    de: { departure: "ABFAHRT", destination: "LINIE / ZIEL", track: "GLEIS", language: "Sprache", settings: "Einstellungen", favs: "Favoriten", noFavs: "Keine Favoriten", noDeps: "Keine Abfahrten", searchMsg: "Zuletzt aktualisiert", inMin: "in", minText: "Min", maxEntries: "Anzahl Einträge:", tempUnit: "Temperatureinheit:", timeZoneLabel: "Zeitzone:", alerts: "Alarme (Favoriten):", favoritesLabel: "Favoriten:", on: "An", off: "Aus", local: "Lokal", swiss: "Schweiz" },
    en: { departure: "DEPARTURE", destination: "LINE / DESTINATION", track: "TRACK", language: "Language", settings: "Settings", favs: "Favorites", noFavs: "No favorites", noDeps: "No departures", searchMsg: "Last updated", inMin: "in", minText: "min", maxEntries: "Max Entries:", tempUnit: "Temperature Unit:", timeZoneLabel: "Timezone:", alerts: "Alerts (Favorites):", favoritesLabel: "Favorites:", on: "On", off: "Off", local: "Local", swiss: "Swiss" },
    fr: { departure: "DÉPART", destination: "VOIE / DEST", track: "QUAI", language: "Langue", settings: "Paramètres", favs: "Favoris", noFavs: "Aucun favori", noDeps: "Aucun départ", searchMsg: "Dernière mise à jour", inMin: "dans", minText: "min", maxEntries: "Nombre d'entrées:", tempUnit: "Unité de température:", timeZoneLabel: "Fuseau horaire:", alerts: "Alertes (Favoris):", favoritesLabel: "Favoris:", on: "On", off: "Off", local: "Locale", swiss: "Suisse" },
    it: { departure: "PARTENZA", destination: "LINEA / DEST", track: "BINARIO", language: "Lingua", settings: "Impostazioni", favs: "Preferiti", noFavs: "Nessun preferito", noDeps: "Nessuna partenza", searchMsg: "Ultimo aggiornamento", inMin: "tra", minText: "min", maxEntries: "Numero di voci:", tempUnit: "Unità di temperatura:", timeZoneLabel: "Fuso orario:", alerts: "Avvisi (Preferiti):", favoritesLabel: "Preferiti:", on: "On", off: "Off", local: "Locale", swiss: "Svizzera" },
    rm: { departure: "PARTENZA", destination: "LINGIA / DEST", track: "BINARI", language: "Lingua", settings: "Configuraziun", favs: "Favurits", noFavs: "Nagin favurits", noDeps: "Naginas partenzas", searchMsg: "Actualisà il", inMin: "en", minText: "min", maxEntries: "Dumber d'entradas:", tempUnit: "Unitad da temperatura:", timeZoneLabel: "Zona d'urari:", alerts: "Alarms (Favurits):", favoritesLabel: "Favurits:", on: "En", off: "Davent", local: "Local", swiss: "Svizra" }
};

let currentLang = localStorage.getItem('appLang') || 'de';

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('appLang', lang);
    applyTranslations();
    fetchBoard(); // Re-fetch to update dynamic train text
}

function applyTranslations() {
    document.getElementById('langSelect').value = currentLang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            el.innerText = translations[currentLang][key];
        }
    });
}

function initMap() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([currentCoords.lat, currentCoords.lon], 13);

    // NEW: CartoDB Dark Matter Map (Fixes the OSM block and looks way better)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    marker = L.marker([currentCoords.lat, currentCoords.lon]).addTo(map);
}

function updateMap(lat, lon, name) {
    if (!map) return;
    map.setView([lat, lon], 14);
    marker.setLatLng([lat, lon]).bindPopup(name).openPopup();
}

const markersContainer = document.getElementById('markers');
for (let i = 0; i < 60; i++) {
    const markerEl = document.createElement('div');
    markerEl.className = (i % 5 === 0) ? 'marker hour' : 'marker min';
    markerEl.style.transform = `rotate(${i * 6}deg)`;
    markersContainer.appendChild(markerEl);
}

function runClock() {
    let now = new Date();
    if (timeZone !== 'local') now = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Zurich"}));
    const ms = now.getMilliseconds(), sec = now.getSeconds(), min = now.getMinutes(), hr = now.getHours();
    document.getElementById('secHand').style.transform = `translateY(-28px) rotate(${((sec * 1000) + ms) / 60000 * 360}deg)`;
    document.getElementById('minHand').style.transform = `translateY(-37px) rotate(${(min * 6) + (sec / 10)}deg)`;
    document.getElementById('hourHand').style.transform = `translateY(-25px) rotate(${(hr % 12 * 30) + (min * 0.5)}deg)`;
    requestAnimationFrame(runClock);
}

// UI Settings
function openSettings() {
    document.getElementById('settingsOverlay').style.display = 'flex';
    renderFavorites();
    updateNotifButtons();
}
function closeSettings() { document.getElementById('settingsOverlay').style.display = 'none'; }
function setTempUnit(u) { unit = u; localStorage.setItem('tempUnit', u); updateTempDisplay(); }
function setTimeFormat(is12h) { use12h = is12h; localStorage.setItem('use12h', is12h); fetchBoard(); }
function updateEntryCount(val) { maxEntries = parseInt(val) || 15; localStorage.setItem('maxEntries', maxEntries); fetchBoard(); }
function setTimeZone(tz) { timeZone = tz; localStorage.setItem('timeZone', tz); fetchBoard(); }

// Push Notifications Control
function setNotifications(isOn) {
    if (isOn) {
        if (!("Notification" in window)) {
            alert("This browser does not support desktop notification");
            return;
        }
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                notifsEnabled = true;
                localStorage.setItem('notifsEnabled', 'true');
                updateNotifButtons();
            } else {
                alert("Please allow notifications in your browser settings first.");
            }
        });
    } else {
        notifsEnabled = false;
        localStorage.setItem('notifsEnabled', 'false');
        updateNotifButtons();
    }
}

function updateNotifButtons() {
    document.getElementById('notifBtnOn').classList.toggle('btn-active', notifsEnabled);
    document.getElementById('notifBtnOff').classList.toggle('btn-active', !notifsEnabled);
}

// Favorites Logic
function toggleFavorite() {
    let favs = JSON.parse(localStorage.getItem('favStations') || '[]');
    const current = document.getElementById('displayStation').innerText;
    if (!favs.includes(current)) { favs.push(current); localStorage.setItem('favStations', JSON.stringify(favs)); alert(current + " saved"); }
}

function removeFavorite(name) {
    let favs = JSON.parse(localStorage.getItem('favStations') || '[]').filter(f => f !== name);
    localStorage.setItem('favStations', JSON.stringify(favs)); renderFavorites();
}

function renderFavorites() {
    let favs = JSON.parse(localStorage.getItem('favStations') || '[]');
    document.getElementById('favListContainer').innerHTML = favs.length ? favs.map(f => `
    <div class="fav-item"><span onclick="selectStation('${f}'); closeSettings();">${f}</span>
    <div class="fav-del" onclick="removeFavorite('${f}')">x</div></div>`).join('') : '<div style="padding:10px">No favorites</div>';
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
input.addEventListener('input', async () => {
    if (input.value.length < 2) { list.innerHTML = ''; return; }
    const res = await fetch(`https://transport.opendata.ch/v1/locations?query=${encodeURIComponent(input.value)}`);
    const data = await res.json();
    list.innerHTML = (data.stations || []).slice(0, 5).map(s => `<div class="autocomplete-item" onclick="selectStation('${s.name}')">${s.name}</div>`).join('');
});

function selectStation(name) { input.value = name; list.innerHTML = ''; fetchBoard(); }

async function fetchBoard() {
    const stationQuery = input.value || localStorage.getItem('lastStation') || 'Zürich HB';
    try {
        const res = await fetch(`https://transport.opendata.ch/v1/stationboard?station=${encodeURIComponent(stationQuery)}&limit=${maxEntries}&type=departure`);
        const data = await res.json();

        globalBoardData = data.stationboard || [];

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
        if (!data.stationboard || data.stationboard.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 40px;">Keine Abfahrten</td></tr>'; return;
        }

        let newRows = '';
        let nowMs = new Date().getTime(); // Used for countdown

        data.stationboard.forEach((train, index) => {
            if (!train.stop || !train.stop.departure) return;
            let depTime = new Date(train.stop.departure);
            let timeStr = depTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: use12h, timeZone: timeZone !== 'local' ? 'Europe/Zurich' : undefined });

            // NEW: Calculate minutes until departure
            let diffMin = Math.round((depTime.getTime() - nowMs) / 60000);
            let countdownHtml = '';
            // Only show countdown if train is departing in the next 60 mins
            if (diffMin >= 0 && diffMin <= 60) {
                countdownHtml = `<div style="font-size: 0.85rem; color: #aaa; font-weight: normal; margin-top: 2px;">${translations[currentLang].inMin} ${diffMin} ${translations[currentLang].minText}</div>`;
            }

            const badge = (train.category + (train.number !== null ? train.number : "")) || "Zug";
            let dest = train.to || badge;
            const viaList = (train.passList || []).slice(1, 4).map(p => p.station.name).filter(n => n && n !== dest);
            const lineClass = train.category === 'IR' ? 'line-IR' : (train.category === 'IC' ? 'line-IC' : 'line-S');

            newRows += `
            <tr onclick="window.showTrainDetails(${index})">
            <td class="time-cell">
            ${timeStr}${train.stop.delay ? `<span class="delay">+${train.stop.delay}′</span>` : ''}
            ${countdownHtml}
            </td>
            <td class="dest-cell"><span class="line-badge ${lineClass}">${badge}</span>${dest}<div class="via-text">${viaList.length > 0 ? 'via ' + viaList.join(' - ') : ''}</div></td>
            <td style="text-align: right;"><span class="track-box">${train.stop.platform || ''}</span></td>
            </tr>`;
        });
        tbody.innerHTML = newRows;
        document.getElementById('updateTime').innerText = `${translations[currentLang].searchMsg}: ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}`;
        tbody.innerHTML = newRows;
        document.getElementById('updateTime').innerText = `Zuletzt aktualisiert: ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}`;

    } catch (e) { document.getElementById('updateTime').innerText = "Verbindungsfehler..."; }
}

// --- NEW HELPER FUNCTION FOR OCCUPANCY ICONS ---
function getOccupancyIcon(level) {
    if (level === 1) return "👤";       // Low
    if (level === 2) return "👤👤";     // Medium
    if (level === 3) return "👤👤👤";   // High
    return "-";
}

window.showTrainDetails = function(index) {
    // --- NEW: HAPTIC FEEDBACK ---
    if (navigator.vibrate) navigator.vibrate(20);

    const train = globalBoardData[index];
    if (!train) return;

    const currentViewedStation = document.getElementById('displayStation').innerText.toLowerCase();

    // 1. Create the Badge (Fixing the 'null' issue and adding SBB styling)
    const badgeText = (train.category + (train.number !== null ? train.number : "")).trim();
    const lineClass = train.category === 'IR' ? 'line-IR' : (train.category === 'IC' ? 'line-IC' : 'line-S');

    // 2. Update Header with the Badge and Larger Text (Arrow Removed)
    document.getElementById('modalTrainName').innerHTML = `
    <span class="line-badge ${lineClass}">${badgeText}</span>
    <span style="vertical-align: middle; margin-left: 10px;">${train.to}</span>
    `;

    // --- NEW STUFF: Extract Stats & Specs Grid ---
    let statsHTML = '<div class="train-specs-grid">';
    statsHTML += `<div class="spec-item"><span class="spec-label">Linie</span><span class="spec-val">${train.name || "Zug"}</span></div>`;
    statsHTML += `<div class="spec-item"><span class="spec-label">Betreiber</span><span class="spec-val">${train.operator || "SBB CFF FFS"}</span></div>`;
    statsHTML += `<div class="spec-item"><span class="spec-label">Typ</span><span class="spec-val">${train.category || "N/A"}</span></div>`;
    statsHTML += `<div class="spec-item"><span class="spec-label">Endstation</span><span class="spec-val">${train.to}</span></div>`;
    statsHTML += '</div>';

    // Status logic (Delays and Track Changes) with new Badge styling
    let statusTextHTML = '';
    const stop = train.stop || {};
    if (stop.delay) {
        statusTextHTML += `<div class="status-badge delay-bg">Verspätung: +${stop.delay} Min.</div>`;
    } else {
        statusTextHTML += `<div class="status-badge ontime-bg">Pünktlich</div>`;
    }

    if (stop.prognosis && stop.prognosis.platform && stop.platform && stop.prognosis.platform !== stop.platform) {
        statusTextHTML += `<div class="status-badge track-bg">Gleisänderung: Gl. ${stop.prognosis.platform}</div>`;
    }

    // Extract Extra Info (Dauer calculation)
    let extraInfo = [];
    let routeHTML = '';
    let hasReachedCurrent = false;
    let mapCoords = [];
    let startTime = null;

    (train.passList || []).forEach((pass, i) => {
        if (!pass.station || !pass.station.name) return;

        let isCurrent = pass.station.name.toLowerCase().includes(currentViewedStation) || currentViewedStation.includes(pass.station.name.toLowerCase());

        if (isCurrent) {
            hasReachedCurrent = true;
            startTime = new Date(pass.departure || pass.arrival);
        }

        if (hasReachedCurrent) {
            if (pass.station.coordinate && pass.station.coordinate.x) {
                mapCoords.push([pass.station.coordinate.x, pass.station.coordinate.y]);
            }

            const rawTime = pass.departure || pass.arrival;
            const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: use12h };
            if (timeZone !== 'local') timeOptions.timeZone = 'Europe/Zurich';

            const timeStr = rawTime ? new Date(rawTime).toLocaleTimeString([], timeOptions) : '--:--';

            routeHTML += `
            <div class="horiz-step ${isCurrent ? 'current-stop' : ''}">
            <div class="horiz-time">${timeStr}${pass.delay ? `<br><span class="horiz-delay">+${pass.delay}'</span>` : ''}</div>
            <div class="horiz-node"></div>
            <div class="horiz-station">${pass.station.name}</div>
            <div class="horiz-plat">${pass.platform ? `Gl. ${pass.platform}` : ''}</div>
            </div>`;

            if (i === train.passList.length - 1 && startTime && rawTime) {
                let durationMins = Math.round((new Date(rawTime) - startTime) / 60000);
                if (durationMins > 0) extraInfo.push(`Dauer: <strong>${durationMins} Min.</strong>`);
            }
        }
    });

    document.querySelector('.route-list-wrapper').innerHTML = routeHTML;

    // --- NEW: Add Occupancy Info (if available from API) ---
    if (train.capacity1st || train.capacity2nd) {
        let cap1 = train.capacity1st ? getOccupancyIcon(train.capacity1st) : '-';
        let cap2 = train.capacity2nd ? getOccupancyIcon(train.capacity2nd) : '-';
        extraInfo.push(`Auslastung: 1. Kl. <strong>${cap1}</strong> / 2. Kl. <strong>${cap2}</strong>`);
    }

    // --- NEW: Add Total Number of Stops Info ---
    if (train.passList && train.passList.length > 0) {
        let stopsCount = train.passList.length - 1;
        extraInfo.push(`Haltestellen: <strong>${stopsCount}</strong>`);
    }

    // Prepend the Duration (Dauer) to the status line if it exists
    let durationLine = extraInfo.length > 0 ? `<div style="margin-bottom:10px; color:#ccc; font-size: 0.9rem;">${extraInfo.join(' | ')}</div>` : '';

    // Final assembly of the info section
    document.getElementById('modalTrainStatus').innerHTML = statsHTML + durationLine + statusTextHTML;

    document.getElementById('trainDetailsModal').style.display = 'flex';
};

// BACKGROUND POLLING FOR FAVORITE STATION ALERTS
async function checkFavoriteAlerts() {
    if (!notifsEnabled || Notification.permission !== 'granted') return;
    let favs = JSON.parse(localStorage.getItem('favStations') || '[]');
    if (favs.length === 0) return;

    for (const station of favs) {
        try {
            const res = await fetch(`https://transport.opendata.ch/v1/stationboard?station=${encodeURIComponent(station)}&limit=5&type=departure`);
            const data = await res.json();
            if (!data.stationboard) continue;

            data.stationboard.forEach(train => {
                const stop = train.stop || {};
                const trainId = train.name + train.to + stop.departure;

                if (notifiedTrains.has(trainId)) return;

                let alertMsg = null;
                if (stop.delay > 0) {
                    alertMsg = `${train.name} nach ${train.to} hat +${stop.delay} Min. Verspätung.`;
                }
                if (stop.prognosis && stop.prognosis.platform && stop.platform && stop.prognosis.platform !== stop.platform) {
                    alertMsg = (alertMsg ? alertMsg + "\n" : "") + `Gleisänderung: Neu Gl. ${stop.prognosis.platform} (statt ${stop.platform}).`;
                }

                if (alertMsg) {
                    new Notification(`SBB Alarm: ${station}`, { body: alertMsg, icon: 'image.png' });
                    notifiedTrains.add(trainId);
                    if(notifiedTrains.size > 100) notifiedTrains.clear();
                }
            });
        } catch(e) {}
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initMap(); runClock(); fetchBoard();
    document.getElementById('entryInput').value = maxEntries;
});

setInterval(fetchBoard, 30000);
setInterval(fetchWeather, 600000);
setInterval(checkFavoriteAlerts, 120000);

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => console.log("Service Worker Registered"));
}
