// ════════════════════════════════════════
//  CONSTANTS
// ════════════════════════════════════════

const TOTAL_DAYS = 11;
const TRIP_START = new Date(2025, 6, 1); // July 1 2025

const DAY_COLORS = [
  '#E57373','#FF8A65','#FFB74D','#FFCA28',
  '#66BB6A','#26A69A','#26C6DA',
  '#42A5F5','#7986CB','#AB47BC','#EC407A'
];

const KO_WD = ['일','월','화','수','목','금','토'];

function dayDate(day) {
  const d = new Date(TRIP_START);
  d.setDate(d.getDate() + day - 1);
  return d;
}

function fmtDay(day) {
  const d = dayDate(day);
  return `7/${d.getDate()} (${KO_WD[d.getDay()]})`;
}

const HOTELS = [
  {
    id: 'istanbul',
    name: 'Elysium Taksim Hotel',
    aliases: ['엘리시움', '엘리시움 탁심', 'elysium'],
    city: '이스탄불',
    emoji: '🕌',
    lat: 41.0370, lng: 28.9856,
    checkIn: 1, checkOut: 5,
  },
  {
    id: 'cappadocia',
    name: 'Lord of Cappadocia',
    aliases: ['로드 오브 카파도키아', '카파도키아 호텔', 'lord cappadocia'],
    city: '카파도키아',
    emoji: '🎈',
    lat: 38.6381, lng: 34.7977,
    checkIn: 5, checkOut: 7,
  },
  {
    id: 'antalya',
    name: 'Megasaray Westbeach Antalya',
    aliases: ['메가사라이', '웨스트비치', 'megasaray', 'westbeach'],
    city: '안탈리아',
    emoji: '🏖️',
    lat: 36.8750, lng: 30.6500,
    checkIn: 7, checkOut: 11,
  },
];

const FLIGHTS = [
  { day: 5,  from: 'istanbul',   to: 'cappadocia', label: '이스탄불 → 카파도키아' },
  { day: 7,  from: 'cappadocia', to: 'antalya',    label: '카파도키아 → 안탈리아' },
  { day: 11, from: 'antalya',    to: 'istanbul',   label: '안탈리아 → 이스탄불' },
];

const AIRPORT_OPTIONS = {
  istanbul: [
    { code: 'IST', name: '이스탄불 신공항' },
    { code: 'SAW', name: '사비하 외즈산 공항' },
  ],
  cappadocia: [
    { code: 'ASR', name: '카이세리 공항' },
    { code: 'NAV', name: '네브셰히르 공항' },
  ],
};

// 확정된 전체 항공편 (국제선 포함)
const BOOKED_FLIGHTS = [
  { date: '7/1',  depDay: 1,  dep: 'ICN', arr: 'IST', depTime: '10:25', arrTime: null,  flightNo: 'OZ0551', tag: '출국' },
  { date: '7/5',  depDay: 5,  dep: 'IST', arr: 'NAV', depTime: '13:45', arrTime: '15:05', flightNo: 'TK2006', tag: null  },
  { date: '7/7',  depDay: 7,  dep: 'ASR', arr: 'AYT', depTime: '21:20', arrTime: '22:40', flightNo: 'XQ7033', tag: null  },
  { date: '7/11', depDay: 11, dep: 'AYT', arr: 'IST', depTime: '12:55', arrTime: '14:30', flightNo: 'TK2417', tag: null  },
  { date: '7/11', depDay: 11, dep: 'IST', arr: 'ICN', depTime: '17:30', arrTime: null,  flightNo: 'OZ0552', tag: '귀국' },
];

function hotelOfDay(day) {
  if (day <= 4) return HOTELS[0];
  if (day <= 6) return HOTELS[1];
  return HOTELS[2];
}

function flightOfDay(day) {
  return FLIGHTS.find(f => f.day === day) || null;
}

// ════════════════════════════════════════
//  STATE
// ════════════════════════════════════════

// 공유용 저장 시 이 줄에 데이터가 삽입됩니다
const SHARED_DATA = null;

const state = {
  day: 1,
  itin: Object.fromEntries(
    Array.from({ length: TOTAL_DAYS }, (_, i) => [i + 1, []])
  ),
  flights: {
    5:  { dep: 'IST', arr: 'NAV', depTime: '', arrTime: '' },
    7:  { dep: 'ASR', depTime: '', arrTime: '' },
    11: { arr: 'IST', depTime: '', arrTime: '' },
  },
};

function ensureHotelInDay(day) {
  const h = hotelOfDay(day);
  const hotelItemId = `hotel_${h.id}`;
  const arr = state.itin[day] || [];
  if (arr.some(p => p.id === hotelItemId)) return;
  const others = arr.filter(p => p.type !== 'hotel');
  state.itin[day] = [{
    id: hotelItemId,
    name: h.name,
    lat: h.lat,
    lng: h.lng,
    addr: h.city,
    type: 'hotel',
    emoji: h.emoji,
  }, ...others];
}

function applyParsed(p) {
  const itin = p.itin || p;
  for (let d = 1; d <= TOTAL_DAYS; d++) {
    if (Array.isArray(itin[d])) state.itin[d] = itin[d];
  }
  if (p.flights) {
    if (p.flights[5])  Object.assign(state.flights[5],  p.flights[5]);
    if (p.flights[7])  Object.assign(state.flights[7],  p.flights[7]);
    if (p.flights[11]) Object.assign(state.flights[11], p.flights[11]);
  }
}

async function loadState() {
  if (SHARED_DATA) {
    applyParsed(SHARED_DATA);
    for (let d = 1; d <= TOTAL_DAYS; d++) ensureHotelInDay(d);
    return;
  }

  // QR 스캔으로 들어온 경우: ?script=URL 파라미터로 자동 등록
  const urlScript = new URLSearchParams(location.search).get('script');
  if (urlScript) {
    setScriptUrl(decodeURIComponent(urlScript));
    history.replaceState(null, '', location.pathname);
  }

  // 1순위: 클라우드 (Apps Script URL이 있으면 자동 로드)
  const cloud = await cloudLoad();
  if (cloud) {
    applyParsed(cloud);
    for (let d = 1; d <= TOTAL_DAYS; d++) ensureHotelInDay(d);
    // 로컬에도 캐시
    localStorage.setItem('honeymoon-turkey-2025', JSON.stringify(cloud));
    return;
  }

  // 3순위: localStorage (오프라인 폴백)
  try {
    const s = localStorage.getItem('honeymoon-turkey-2025');
    if (s) applyParsed(JSON.parse(s));
  } catch (_) {}

  for (let d = 1; d <= TOTAL_DAYS; d++) ensureHotelInDay(d);
}

function encodeData(json) {
  // LZString으로 압축 후 URL 해시에 안전한 base64로 인코딩
  if (typeof LZString !== 'undefined') {
    return 'z' + LZString.compressToEncodedURIComponent(json);
  }
  return btoa(unescape(encodeURIComponent(json)));
}

function decodeData(hash) {
  if (hash.startsWith('z') && typeof LZString !== 'undefined') {
    return LZString.decompressFromEncodedURIComponent(hash.slice(1));
  }
  // 구버전 호환 (압축 없이 저장된 데이터)
  return decodeURIComponent(escape(atob(hash)));
}

// ════════════════════════════════════════
//  CLOUD SYNC (Google Apps Script)
// ════════════════════════════════════════

const SCRIPT_URL_KEY  = 'honeymoon-script-url';
const GOOGLE_KEY_KEY  = 'honeymoon-google-key';

function getScriptUrl()  { return localStorage.getItem(SCRIPT_URL_KEY) || ''; }
function setScriptUrl(u) { localStorage.setItem(SCRIPT_URL_KEY, u); }
function getGoogleKey()  { return localStorage.getItem(GOOGLE_KEY_KEY) || ''; }
function setGoogleKey(k) { localStorage.setItem(GOOGLE_KEY_KEY, k); }

// ════════════════════════════════════════
//  GOOGLE PLACES SEARCH (별점·리뷰 포함)
// ════════════════════════════════════════

const PLACES_API = 'https://places.googleapis.com/v1/places:searchText';
const PLACE_FIELD_MASK = [
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.primaryTypeDisplayName',
].join(',');

// Google Places 타입 → 한국어 카테고리
function googleTypeToKo(types = []) {
  if (types.some(t => ['restaurant','food','meal_delivery','meal_takeaway','cafe','bakery','bar'].includes(t)))
    return types.includes('cafe') || types.includes('bakery') ? '카페·디저트' : '식당';
  if (types.some(t => ['tourist_attraction','museum','historic','church','mosque','place_of_worship','amusement_park','aquarium','zoo'].includes(t)))
    return '관광지';
  if (types.some(t => ['shopping_mall','clothing_store','jewelry_store','store','supermarket','market'].includes(t)))
    return '쇼핑';
  if (types.some(t => ['park','natural_feature','beach','campground'].includes(t)))
    return '자연';
  if (types.some(t => ['lodging','hotel'].includes(t))) return '호텔';
  return null;
}

// 별점 → 별 이모지
function starStr(rating) {
  if (!rating) return '';
  const full  = Math.floor(rating);
  const half  = (rating - full) >= 0.5 ? '½' : '';
  return '⭐'.repeat(full) + half + ` ${rating.toFixed(1)}`;
}

async function googlePlacesSearch(q) {
  const key = getGoogleKey();
  if (!key) return null;

  const cityCenter = {
    istanbul:   { lat: 41.013, lng: 28.979 },
    cappadocia: { lat: 38.643, lng: 34.830 },
    antalya:    { lat: 36.886, lng: 30.705 },
  }[cityOfDay(state.day)];

  const body = {
    textQuery: q,
    locationBias: {
      circle: {
        center: { latitude: cityCenter.lat, longitude: cityCenter.lng },
        radius: 80000,
      },
    },
    languageCode: 'ko',
    maxResultCount: 10,
  };

  try {
    const res = await fetch(`${PLACES_API}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': PLACE_FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.places || [];
  } catch (_) { return null; }
}

async function cloudSave(json) {
  const url = getScriptUrl();
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // GAS는 text/plain으로 받음
      body: json,
    });
  } catch (_) {}
}

async function cloudLoad() {
  const url = getScriptUrl();
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    // 빈 객체면 null 반환
    if (!data || Object.keys(data).length === 0) return null;
    return data;
  } catch (_) { return null; }
}

function saveState() {
  const data = { itin: state.itin, flights: state.flights };
  const json = JSON.stringify(data);
  localStorage.setItem('honeymoon-turkey-2025', json);
  cloudSave(json); // 클라우드에 비동기 저장
}

function copyShareURL() {
  const btn = document.getElementById('shareBtn');
  try {
    const json = JSON.stringify({ itin: state.itin, flights: state.flights });
    const hash = btoa(encodeURIComponent(json));
    const url  = location.origin + location.pathname + '#' + hash;
    navigator.clipboard.writeText(url).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✅ 복사됨!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    });
  } catch (_) {
    alert('URL 복사에 실패했어요. 주소창 URL을 직접 복사해주세요.');
  }
}

async function exportHTML() {
  const data = JSON.stringify({ itin: state.itin, flights: state.flights });

  let cssText = '';
  let jsText = '';
  try {
    const [cssRes, jsRes] = await Promise.all([
      fetch('style.css'),
      fetch('script.js'),
    ]);
    [cssText, jsText] = await Promise.all([cssRes.text(), jsRes.text()]);
  } catch (_) {
    alert('내보내기 실패: style.css / script.js 파일을 같은 폴더에서 실행해주세요.');
    return;
  }

  const modifiedJs = jsText.replace(
    'const SHARED_DATA = null;',
    `const SHARED_DATA = ${data};`
  );

  const bodyHTML = `
<header>
  <div class="hd-left">
    <div class="hd-logo">💑</div>
    <div class="hd-title">
      <h1>신혼여행 튀르키예 플래너</h1>
      <p>ISTANBUL · CAPPADOCIA · ANTALYA &nbsp;·&nbsp; JULY 2025</p>
    </div>
  </div>
  <div class="hd-hotels">
    <div class="hotel-chip">
      <strong>🕌 Elysium Taksim</strong>
      7/1–7/5 · 이스탄불
    </div>
    <div class="hotel-chip">
      <strong>🎈 Lord of Cappadocia</strong>
      7/5–7/7 · 카파도키아
    </div>
    <div class="hotel-chip">
      <strong>🏖️ Megasaray Westbeach</strong>
      7/7–7/11 · 안탈리아
    </div>
  </div>
  <button class="export-btn" onclick="exportHTML()" title="현재 일정이 담긴 HTML 파일 다운로드">
    💾 공유용 저장
  </button>
</header>

<div class="main">
  <div class="sidebar">
    <div class="tabs-wrap">
      <div class="tabs-label">날짜 선택</div>
      <div class="tabs-scroller">
        <button class="tabs-arrow" id="tabsLeft" title="이전">&#8249;</button>
        <div class="tabs-row" id="dayTabs"></div>
        <button class="tabs-arrow" id="tabsRight" title="다음">&#8250;</button>
      </div>
    </div>
    <div class="search-wrap" id="searchWrap">
      <div class="search-header">
        <span class="search-header-label">📍 장소 검색 (튀르키예)</span>
        <span class="search-day-tag" id="searchDayTag">Day 1에 추가</span>
      </div>
      <div class="search-row">
        <input id="searchInput" type="text" class="search-input"
          placeholder="예: Hagia Sophia, Göreme, Topkapi..."
          autocomplete="off" spellcheck="false" />
        <button class="search-clear" id="searchClear" title="지우기">✕</button>
      </div>
      <div class="search-dropdown" id="searchDropdown"></div>
    </div>
    <div class="itin-wrap" id="itinWrap"></div>
  </div>
  <div class="map-wrap">
    <div id="map"></div>
    <div class="map-btns">
      <button class="map-btn" id="overviewBtn">🗺️ 전체 여행 경로</button>
      <button class="map-btn" id="fitDayBtn">📍 오늘 일정 보기</button>
    </div>
  </div>
</div>`;

  const out = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>💑 신혼여행 튀르키예 플래너</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/fonts-archive/MaruBuri/MaruBuri.css" />
  <style>${cssText}</style>
</head>
<body>
${bodyHTML}
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script>${modifiedJs}<\/script>
</body>
</html>`;

  const blob = new Blob([out], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '신혼여행_튀르키예_플래너.html';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ════════════════════════════════════════
//  DISTANCE
// ════════════════════════════════════════

function dist(la1, lo1, la2, lo2) {
  const R = 6371, dLa = (la2-la1)*Math.PI/180, dLo = (lo2-lo1)*Math.PI/180;
  const a = Math.sin(dLa/2)**2 +
            Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ════════════════════════════════════════
//  MAP
// ════════════════════════════════════════

let map, hotelLg, flightLg, routeLg, placeLg;

function initMap() {
  map = L.map('map', { center: [38.5, 33], zoom: 6 });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  hotelLg  = L.layerGroup().addTo(map);
  flightLg = L.layerGroup().addTo(map);
  routeLg  = L.layerGroup().addTo(map);
  placeLg  = L.layerGroup().addTo(map);

  HOTELS.forEach(h => {
    const ico = L.divIcon({
      html: `<div style="
        background:linear-gradient(135deg,#c9935a,#e8b96a);
        color:white;padding:6px 11px;border-radius:16px;
        font-size:11px;font-weight:800;white-space:nowrap;
        box-shadow:0 3px 10px rgba(0,0,0,0.32);border:2.5px solid white;
        display:flex;align-items:center;gap:4px;
        font-family:'Pretendard Variable',Pretendard,sans-serif;
      ">${h.emoji} ${h.city}</div>`,
      className: '',
      iconAnchor: [0, 14],
    });

    L.marker([h.lat, h.lng], { icon: ico })
      .addTo(hotelLg)
      .bindPopup(`
        <div class="pop-name">${h.emoji} ${h.name}</div>
        <div class="pop-addr">
          체크인: ${fmtDay(h.checkIn)}<br>
          체크아웃: ${fmtDay(h.checkOut)}
        </div>
      `);
  });

  FLIGHTS.forEach(fl => {
    const fh = HOTELS.find(h => h.id === fl.from);
    const th = HOTELS.find(h => h.id === fl.to);
    const pts = bezierArc([fh.lat, fh.lng], [th.lat, th.lng]);

    L.polyline(pts, {
      color: '#7B68EE', weight: 2.5,
      dashArray: '7 5', opacity: 0.75,
    }).addTo(flightLg);

    const mid = pts[Math.floor(pts.length / 2)];
    L.marker(mid, {
      icon: L.divIcon({
        html: `<div style="
          background:#7B68EE;color:white;
          padding:3px 9px;border-radius:10px;
          font-size:10px;font-weight:700;white-space:nowrap;
          box-shadow:0 2px 7px rgba(0,0,0,0.22);
          font-family:'Pretendard Variable',Pretendard,sans-serif;
        ">✈️ ${fl.label}</div>`,
        className: '',
        iconAnchor: [50, 10],
      }),
    }).addTo(flightLg);
  });
}

function bezierArc(from, to, steps = 22) {
  const mx = (from[0] + to[0]) / 2 + 1.2;
  const my = (from[1] + to[1]) / 2;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([
      (1-t)**2 * from[0] + 2*(1-t)*t * mx + t**2 * to[0],
      (1-t)**2 * from[1] + 2*(1-t)*t * my + t**2 * to[1],
    ]);
  }
  return pts;
}

// ════════════════════════════════════════
//  RENDER MAP ROUTE FOR A DAY
// ════════════════════════════════════════

function renderRoute(day) {
  routeLg.clearLayers();
  placeLg.clearLayers();

  const places   = state.itin[day] || [];
  const color    = DAY_COLORS[day - 1];
  const nonHotel = places.filter(p => p.type !== 'hotel');

  if (nonHotel.length === 0) {
    const h = hotelOfDay(day);
    map.setView([h.lat, h.lng], 12, { animate: true });
    return;
  }

  const lls = places.map(p => [p.lat, p.lng]);
  L.polyline(lls, {
    color, weight: 3.5, opacity: 0.88,
    lineJoin: 'round', lineCap: 'round',
  }).addTo(routeLg);

  let num = 0;
  nonHotel.forEach(pl => {
    num++;
    const ico = L.divIcon({
      html: `<div style="
        background:${color};color:white;
        width:28px;height:28px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:12px;font-weight:800;
        box-shadow:0 2px 9px rgba(0,0,0,0.32);border:2.5px solid white;
        font-family:'Pretendard Variable',Pretendard,sans-serif;
      ">${num}</div>`,
      className: '',
      iconAnchor: [14, 14],
    });
    L.marker([pl.lat, pl.lng], { icon: ico })
      .addTo(placeLg)
      .bindPopup(`
        <div class="pop-name">${num}. ${esc(pl.name)}</div>
        ${pl.addr ? `<div class="pop-addr">${esc(pl.addr)}</div>` : ''}
        <button class="pop-del" onclick="popRemove('${pl.id}',${day})">🗑️ 삭제</button>
      `);
  });

  map.fitBounds(L.latLngBounds(lls).pad(0.22), { animate: true, maxZoom: 14 });
}

window.popRemove = function(id, day) {
  removePlace(id, day);
  map.closePopup();
};

function showOverview() {
  routeLg.clearLayers();
  placeLg.clearLayers();

  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const places   = state.itin[day] || [];
    const nonHotel = places.filter(p => p.type !== 'hotel');
    if (!nonHotel.length) continue;

    const color = DAY_COLORS[day - 1];
    const lls   = places.map(p => [p.lat, p.lng]);
    L.polyline(lls, { color, weight: 2.5, opacity: 0.65 }).addTo(routeLg);

    let num = 0;
    nonHotel.forEach(pl => {
      num++;
      const ico = L.divIcon({
        html: `<div style="
          background:${color};color:white;
          width:20px;height:20px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          font-size:9px;font-weight:800;
          box-shadow:0 1px 5px rgba(0,0,0,0.28);border:2px solid white;
        ">${num}</div>`,
        className: '',
        iconAnchor: [10, 10],
      });
      L.marker([pl.lat, pl.lng], { icon: ico })
        .addTo(routeLg)
        .bindTooltip(`Day ${day} · ${pl.name}`, { direction: 'top', offset: [0, -12] });
    });
  }

  map.setView([38.5, 33], 6, { animate: true });
}

// ════════════════════════════════════════
//  PLACE MANAGEMENT
// ════════════════════════════════════════

function addPlace(data) {
  const day = state.day;
  state.itin[day].push({
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: data.name,
    lat: parseFloat(data.lat),
    lng: parseFloat(data.lng),
    addr: data.addr || '',
    osmKey:   data.osmKey   || '',
    osmValue: data.osmValue || '',
  });
  saveState();
  renderTabs();
  renderItin();
  renderRoute(day);
  closeDropdown();
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('visible');
}

function removePlace(id, day) {
  const item = state.itin[day]?.find(p => p.id === id);
  if (item?.type === 'hotel') return;
  state.itin[day] = state.itin[day].filter(p => p.id !== id);
  saveState();
  renderTabs();
  renderItin();
  renderRoute(day);
}

// ════════════════════════════════════════
//  DRAG & DROP
// ════════════════════════════════════════

let dDay = null, dIdx = null;

function setupDnD(el, day, idx) {
  el.draggable = true;

  el.addEventListener('dragstart', e => {
    dDay = day; dIdx = idx;
    e.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => el.classList.add('dragging'));
  });

  el.addEventListener('dragend', () => {
    document.querySelectorAll('.place-item').forEach(x => {
      x.classList.remove('dragging', 'drag-over');
    });
    dDay = dIdx = null;
  });

  el.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('drag-over');
  });

  el.addEventListener('dragleave', e => {
    if (!el.contains(e.relatedTarget)) {
      el.classList.remove('drag-over');
    }
  });

  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('drag-over');
    if (dDay === day && dIdx !== idx) {
      const arr = state.itin[day];
      const [moved] = arr.splice(dIdx, 1);
      arr.splice(idx, 0, moved);
      saveState();
      renderItin();
      renderRoute(day);
    }
  });
}

// ════════════════════════════════════════
//  TOUCH DRAG & DROP (mobile)
// ════════════════════════════════════════

let touchDragActive = false;
let touchClone = null;
let touchOffX = 0, touchOffY = 0;

function getTabDayFromEl(tabEl) {
  const txt = tabEl.querySelector('.tab-num')?.textContent || '';
  const m = txt.match(/\d+/);
  return m ? parseInt(m[0]) : null;
}

function setupTouchDnD(el, day, idx) {
  let pressTimer = null;
  let startX = 0, startY = 0;

  el.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;

    pressTimer = setTimeout(() => {
      touchDragActive = true;
      dDay = day; dIdx = idx;

      if (navigator.vibrate) navigator.vibrate(40);

      el.classList.add('touch-dragging');

      const rect = el.getBoundingClientRect();
      touchOffX = t.clientX - rect.left;
      touchOffY = t.clientY - rect.top;

      touchClone = el.cloneNode(true);
      Object.assign(touchClone.style, {
        position: 'fixed',
        width: rect.width + 'px',
        top: (t.clientY - touchOffY) + 'px',
        left: (t.clientX - touchOffX) + 'px',
        zIndex: '9999',
        opacity: '0.9',
        pointerEvents: 'none',
        boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
        transform: 'scale(1.04)',
        transition: 'none',
        borderRadius: '10px',
      });
      document.body.appendChild(touchClone);
    }, 420);
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (!touchDragActive) {
      const t = e.touches[0];
      if (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8) {
        clearTimeout(pressTimer);
      }
      return;
    }
    e.preventDefault();

    const t = e.touches[0];
    if (touchClone) {
      touchClone.style.top  = (t.clientY - touchOffY) + 'px';
      touchClone.style.left = (t.clientX - touchOffX) + 'px';
    }

    if (touchClone) touchClone.style.display = 'none';
    const hit = document.elementFromPoint(t.clientX, t.clientY);
    if (touchClone) touchClone.style.display = '';

    document.querySelectorAll('.place-item').forEach(x => x.classList.remove('drag-over'));
    const tItem = hit?.closest('.place-item');
    if (tItem && tItem !== el) tItem.classList.add('drag-over');

    document.querySelectorAll('.day-tab').forEach(x => x.classList.remove('tab-drop-target'));
    const tTab = hit?.closest('.day-tab');
    if (tTab) {
      const src    = state.itin[dDay]?.[dIdx];
      const tabDay = getTabDayFromEl(tTab);
      if (src && src.type !== 'hotel' && tabDay && tabDay !== dDay) {
        tTab.classList.add('tab-drop-target');
      }
    }
  }, { passive: false });

  const endTouch = e => {
    clearTimeout(pressTimer);
    if (!touchDragActive) return;
    touchDragActive = false;

    if (touchClone) { touchClone.remove(); touchClone = null; }
    el.classList.remove('touch-dragging');
    document.querySelectorAll('.place-item').forEach(x => x.classList.remove('drag-over', 'touch-dragging'));
    document.querySelectorAll('.day-tab').forEach(x => x.classList.remove('tab-drop-target'));

    const t    = e.changedTouches[0];
    const hit  = document.elementFromPoint(t.clientX, t.clientY);

    const tTab = hit?.closest('.day-tab');
    if (tTab) {
      const tabDay = getTabDayFromEl(tTab);
      if (tabDay && tabDay !== dDay) {
        const src = state.itin[dDay]?.[dIdx];
        if (src && src.type !== 'hotel') {
          state.itin[dDay].splice(dIdx, 1);
          state.itin[tabDay].push(src);
          dDay = dIdx = null;
          saveState();
          state.day = tabDay;
          document.getElementById('searchDayTag').textContent = `Day ${tabDay}에 추가`;
          renderTabs(); renderItin(); renderRoute(tabDay);
          return;
        }
      }
    }

    const tItem = hit?.closest('.place-item');
    if (tItem && tItem !== el) {
      const tIdx = parseInt(tItem.dataset.idx);
      const tDay = parseInt(tItem.dataset.day);
      if (tDay === dDay && tIdx !== dIdx) {
        const arr = state.itin[dDay];
        const [moved] = arr.splice(dIdx, 1);
        arr.splice(tIdx, 0, moved);
        saveState(); renderItin(); renderRoute(dDay);
      }
    }

    dDay = dIdx = null;
  };

  el.addEventListener('touchend',   endTouch);
  el.addEventListener('touchcancel', endTouch);
}

// ════════════════════════════════════════
//  SEARCH (NOMINATIM)
// ════════════════════════════════════════

let searchTid = null;

function initTabsNav() {
  const row   = document.getElementById('dayTabs');
  const btnL  = document.getElementById('tabsLeft');
  const btnR  = document.getElementById('tabsRight');
  const STEP  = 160;

  function updateArrows() {
    btnL.disabled = row.scrollLeft <= 0;
    btnR.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 1;
  }

  btnL.addEventListener('click', () => {
    row.scrollBy({ left: -STEP, behavior: 'smooth' });
  });
  btnR.addEventListener('click', () => {
    row.scrollBy({ left: STEP, behavior: 'smooth' });
  });
  row.addEventListener('scroll', updateArrows);
  updateArrows();

  let isDown = false, startX, scrollStart;
  row.addEventListener('mousedown', e => {
    isDown = true;
    startX = e.pageX - row.offsetLeft;
    scrollStart = row.scrollLeft;
    row.classList.add('grabbing');
  });
  row.addEventListener('mouseleave', () => { isDown = false; row.classList.remove('grabbing'); });
  row.addEventListener('mouseup',    () => { isDown = false; row.classList.remove('grabbing'); });
  row.addEventListener('mousemove',  e => {
    if (!isDown) return;
    e.preventDefault();
    row.scrollLeft = scrollStart - (e.pageX - row.offsetLeft - startX);
    updateArrows();
  });
}

// ════════════════════════════════════════
//  POPULAR PLACES (도시별 추천 장소)
// ════════════════════════════════════════

const POPULAR = {
  istanbul: [
    // 볼거리
    { name: '아야소피아',           en: 'Hagia Sophia',              lat: 41.0086, lng: 28.9802, cat: '관광지' },
    { name: '블루 모스크',          en: 'Blue Mosque',               lat: 41.0054, lng: 28.9768, cat: '관광지' },
    { name: '톱카프 궁전',          en: 'Topkapi Palace',            lat: 41.0115, lng: 28.9833, cat: '관광지' },
    { name: '갈라타 탑',            en: 'Galata Tower',              lat: 41.0256, lng: 28.9742, cat: '관광지' },
    { name: '바실리카 시스턴',      en: 'Basilica Cistern',          lat: 41.0082, lng: 28.9779, cat: '관광지' },
    { name: '돌마바흐체 궁전',      en: 'Dolmabahce Palace',         lat: 41.0391, lng: 29.0007, cat: '관광지' },
    { name: '피에르 로티 언덕',     en: 'Pierre Loti Hill Istanbul', lat: 41.0348, lng: 28.9390, cat: '관광지' },
    // 쇼핑
    { name: '그랜드 바자르',        en: 'Kapalı Çarşı',              lat: 41.0108, lng: 28.9680, cat: '쇼핑' },
    { name: '스파이스 바자르',      en: 'Spice Bazaar',              lat: 41.0163, lng: 28.9706, cat: '쇼핑' },
    { name: '이스티클랄 거리',      en: 'Istiklal Avenue',           lat: 41.0331, lng: 28.9772, cat: '쇼핑' },
    { name: '니샨타쉬',             en: 'Nişantaşı Istanbul',        lat: 41.0478, lng: 28.9940, cat: '쇼핑' },
    { name: '아라스타 바자르',      en: 'Arasta Bazaar Istanbul',    lat: 41.0054, lng: 28.9782, cat: '쇼핑' },
    // 식당·카페
    { name: '술탄아흐메트 쾨프테치시', en: 'Sultanahmet Köftecisi', lat: 41.0077, lng: 28.9770, cat: '식당' },
    { name: '카라쾨이 귀뤼올루',    en: 'Karaköy Güllüoğlu',        lat: 41.0238, lng: 28.9742, cat: '카페·디저트' },
    { name: '하피즈 무스타파',      en: 'Hafız Mustafa 1864',        lat: 41.0109, lng: 28.9783, cat: '카페·디저트' },
    { name: '갈라타 다리 발릭 에크멕', en: 'Galata Bridge Istanbul', lat: 41.0175, lng: 28.9724, cat: '식당' },
    { name: '만다바트마즈 커피',    en: 'Mandabatmaz Coffee Istanbul',lat: 41.0336, lng: 28.9740, cat: '카페·디저트' },
    { name: '카드쾨이 시장',        en: 'Kadıköy Market Istanbul',   lat: 40.9910, lng: 29.0275, cat: '식당' },
    // 자연·전망
    { name: '보스포러스 해협',      en: 'Bosphorus Strait Istanbul', lat: 41.0823, lng: 29.0544, cat: '자연' },
    { name: '귈하네 공원',          en: 'Gülhane Park Istanbul',     lat: 41.0133, lng: 28.9844, cat: '자연' },
  ],
  cappadocia: [
    // 볼거리
    { name: '괴레메 야외박물관',    en: 'Göreme Open Air Museum',    lat: 38.6431, lng: 34.8295, cat: '관광지' },
    { name: '우치히사르 성',        en: 'Uchisar Castle',            lat: 38.6263, lng: 34.7964, cat: '관광지' },
    { name: '데린쿠유 지하도시',    en: 'Derinkuyu Underground City',lat: 38.3742, lng: 34.7347, cat: '관광지' },
    { name: '카이마클리 지하도시',  en: 'Kaymaklı Underground City', lat: 38.2530, lng: 34.7226, cat: '관광지' },
    { name: '아바노스',             en: 'Avanos Cappadocia',         lat: 38.7167, lng: 34.8519, cat: '관광지' },
    { name: '위르귀프',             en: 'Ürgüp Cappadocia',          lat: 38.6300, lng: 34.9167, cat: '관광지' },
    // 자연
    { name: '러브밸리',             en: 'Love Valley Cappadocia',    lat: 38.6617, lng: 34.8256, cat: '자연' },
    { name: '파샤바그 버섯바위',    en: 'Pasabag Monks Valley',      lat: 38.6814, lng: 34.8197, cat: '자연' },
    { name: '데블렌트 상상의 계곡', en: 'Devrent Valley Cappadocia', lat: 38.6826, lng: 34.8610, cat: '자연' },
    { name: '레드밸리 선셋 포인트', en: 'Red Valley Cappadocia',     lat: 38.6526, lng: 34.8680, cat: '자연' },
    // 체험
    { name: '열기구 투어',          en: 'Hot Air Balloon Göreme',    lat: 38.6453, lng: 34.8317, cat: '체험' },
    { name: '아바노스 도자기 체험', en: 'Avanos Pottery Workshop',   lat: 38.7167, lng: 34.8519, cat: '체험' },
    // 식당·카페
    { name: '디벡 레스토랑',        en: 'Dibek Restaurant Göreme',   lat: 38.6433, lng: 34.8280, cat: '식당' },
    { name: '로컬 케밥 (괴레메)',   en: 'Pita Kebab Göreme',         lat: 38.6440, lng: 34.8295, cat: '식당' },
    { name: '동굴 카페 (위르귀프)', en: 'Cave Wine Bar Ürgüp',       lat: 38.6295, lng: 34.9160, cat: '카페·디저트' },
    // 쇼핑
    { name: '도자기·기념품 거리',   en: 'Souvenir Street Göreme',    lat: 38.6435, lng: 34.8290, cat: '쇼핑' },
  ],
  antalya: [
    // 볼거리
    { name: '칼레이치 구시가지',    en: 'Kaleiçi Old Town Antalya',  lat: 36.8856, lng: 30.7056, cat: '관광지' },
    { name: '하드리아누스 문',      en: 'Hadrian\'s Gate Antalya',   lat: 36.8860, lng: 30.7064, cat: '관광지' },
    { name: '아스펜도스',           en: 'Aspendos Ancient Theatre',  lat: 36.9413, lng: 31.1720, cat: '관광지' },
    { name: '페르게 유적',          en: 'Perge Ancient City',        lat: 36.9605, lng: 30.8540, cat: '관광지' },
    { name: '테르미소스',           en: 'Termessos Ancient City',    lat: 37.0444, lng: 30.4639, cat: '관광지' },
    { name: '안탈리아 박물관',      en: 'Antalya Museum',            lat: 36.8800, lng: 30.6868, cat: '관광지' },
    // 자연·해변
    { name: '두든 폭포',            en: 'Düden Waterfalls Antalya',  lat: 36.9022, lng: 30.7408, cat: '자연' },
    { name: '코냐알트 해변',        en: 'Konyaaltı Beach Antalya',   lat: 36.8700, lng: 30.6600, cat: '자연' },
    { name: '라라 해변',            en: 'Lara Beach Antalya',        lat: 36.8600, lng: 30.8200, cat: '자연' },
    { name: '카라알리오을루 공원',  en: 'Karaalioglu Park Antalya',  lat: 36.8806, lng: 30.7108, cat: '자연' },
    // 식당·카페
    { name: '메르메를리 레스토랑',  en: 'Mermerli Restaurant Antalya',lat: 36.8834, lng: 30.7074, cat: '식당' },
    { name: '반 레스토랑',          en: 'Van Restaurant Antalya',    lat: 36.8858, lng: 30.7052, cat: '식당' },
    { name: '올드 타운 카페거리',   en: 'Kaleiçi Cafe Street',       lat: 36.8850, lng: 30.7060, cat: '카페·디저트' },
    { name: '안탈리아 마리나',      en: 'Antalya Old Harbour Marina', lat: 36.8830, lng: 30.6980, cat: '식당' },
    // 쇼핑
    { name: '올드 바자르',          en: 'Old Bazaar Antalya',        lat: 36.8861, lng: 30.7046, cat: '쇼핑' },
    { name: '마크 안탈리아 (쇼핑몰)', en: 'Mark Antalya Mall',       lat: 36.8953, lng: 30.6875, cat: '쇼핑' },
  ],
};

const CAT_COLOR = {
  '관광지': '#1a6e8a', '쇼핑': '#6a1b9a',
  '자연': '#2e7d32',  '식당': '#e05a00',
  '카페·디저트': '#a0522d', '체험': '#c0392b',
};
const CAT_ICON = {
  '관광지': '🗺️', '쇼핑': '🛍️',
  '자연': '🌿',  '식당': '🍽️',
  '카페·디저트': '☕', '체험': '🎈',
};

function cityOfDay(day) {
  if (day <= 4)  return 'istanbul';
  if (day <= 6)  return 'cappadocia';
  return 'antalya';
}

function showPopular() {
  const drop     = document.getElementById('searchDropdown');
  const city     = cityOfDay(state.day);
  const list     = POPULAR[city] || [];
  const cityName = { istanbul: '이스탄불', cappadocia: '카파도키아', antalya: '안탈리아' }[city];

  drop.innerHTML = `<div class="sr-popular-header">✨ ${cityName} 추천 장소</div>`;

  // 카테고리별로 그루핑해서 표시
  const groups = {};
  list.forEach(pl => {
    if (!groups[pl.cat]) groups[pl.cat] = [];
    groups[pl.cat].push(pl);
  });

  Object.entries(groups).forEach(([cat, places]) => {
    const color = CAT_COLOR[cat] || '#8a7a72';
    const icon  = CAT_ICON[cat]  || '📍';

    // 카테고리 소제목
    const sec = document.createElement('div');
    sec.className = 'sr-section-label';
    sec.innerHTML = `<span class="sr-badge" style="background:${color}">${icon} ${cat}</span>`;
    drop.appendChild(sec);

    places.forEach(pl => {
      const div = document.createElement('div');
      div.className = 'sr-item';
      div.innerHTML = `
        <span class="sr-icon">${icon}</span>
        <div class="sr-text">
          <div class="sr-name">${pl.name}</div>
          <div class="sr-meta"><span class="sr-addr">${pl.en}</span></div>
        </div>`;
      div.addEventListener('click', () =>
        addPlace({ name: pl.name, lat: pl.lat, lng: pl.lng, addr: pl.en })
      );
      drop.appendChild(div);
    });
  });

  drop.classList.add('open');
}

function initSearch() {
  const inp   = document.getElementById('searchInput');
  const clr   = document.getElementById('searchClear');
  const drop  = document.getElementById('searchDropdown');

  // 입력창 포커스 시 인기 장소 표시 (빈 상태일 때)
  inp.addEventListener('focus', () => {
    if (!inp.value.trim()) showPopular();
  });

  inp.addEventListener('input', () => {
    const q = inp.value.trim();
    clr.classList.toggle('visible', q.length > 0);
    clearTimeout(searchTid);
    if (!q) { showPopular(); return; }  // 입력 지우면 다시 인기 장소
    if (q.length < 2) { closeDropdown(); return; }

    drop.innerHTML = '<div class="sr-status">🔍 검색 중...</div>';
    drop.classList.add('open');

    searchTid = setTimeout(() => doSearch(q), 500);
  });

  clr.addEventListener('click', () => {
    inp.value = '';
    clr.classList.remove('visible');
    closeDropdown();
    inp.focus();
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#searchWrap')) closeDropdown();
  });
}

function closeDropdown() {
  const d = document.getElementById('searchDropdown');
  d.classList.remove('open');
  d.innerHTML = '';
}

// Photon bbox: west,south,east,north (Turkey)
const TR_BBOX = '25.9,35.8,44.8,42.1';

// 한국어 관광지명 → 영어/터키어 변환 사전
const KO_TRANSLATE = {
  '그랜드 바자르': 'Kapalı Çarşı', '그랜드바자르': 'Kapalı Çarşı',
  '카팔르차르슈': 'Kapalı Çarşı',
  '스파이스 바자르': 'Spice Bazaar', '향신료 시장': 'Spice Bazaar',
  '아야소피아': 'Hagia Sophia', '성소피아': 'Hagia Sophia', '하기아소피아': 'Hagia Sophia',
  '블루모스크': 'Blue Mosque', '블루 모스크': 'Blue Mosque', '술탄아흐메트 모스크': 'Sultan Ahmed Mosque',
  '톱카프 궁전': 'Topkapi Palace', '돌마바흐체 궁전': 'Dolmabahce Palace', '돌마바체 궁전': 'Dolmabahce Palace',
  '갈라타 탑': 'Galata Tower', '갈라타탑': 'Galata Tower',
  '탁심 광장': 'Taksim Square', '이스티클랄 거리': 'Istiklal Avenue',
  '보스포러스': 'Bosphorus', '보스포루스': 'Bosphorus',
  '괴레메': 'Göreme', '카파도키아': 'Cappadocia',
  '우치히사르': 'Uchisar', '위르귀프': 'Ürgüp', '아바노스': 'Avanos',
  '파묵칼레': 'Pamukkale', '히에라폴리스': 'Hierapolis',
  '에페수스': 'Ephesus', '에페소스': 'Ephesus',
  '베르가마': 'Pergamon', '아스펜도스': 'Aspendos',
  '쿠샤다시': 'Kuşadası', '마르마리스': 'Marmaris', '보드룸': 'Bodrum',
  '페티예': 'Fethiye', '외뤼데니즈': 'Ölüdeniz', '알라냐': 'Alanya',
  '시데': 'Side', '아스펜도스': 'Aspendos',
  '안탈리아 구시가지': 'Antalya Old Town', '칼레이치': 'Kaleiçi',
  '이스탄불': 'Istanbul', '안탈리아': 'Antalya',
};

function translateQuery(q) {
  const lower = q.trim().toLowerCase();
  for (const [ko, en] of Object.entries(KO_TRANSLATE)) {
    if (lower.includes(ko.toLowerCase())) return en;
  }
  return q;
}

async function photonFetch(q) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&bbox=${TR_BBOX}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('fetch failed');
  return res.json();
}

// 카테고리 한국어 레이블
function categoryLabel(key, value) {
  const map = {
    tourism:  { museum:'박물관', attraction:'관광지', hotel:'호텔', hostel:'호스텔',
                gallery:'갤러리', viewpoint:'전망대', ruins:'유적', monument:'기념물',
                theme_park:'테마파크', zoo:'동물원', artwork:'예술작품' },
    amenity:  { restaurant:'식당', cafe:'카페', fast_food:'패스트푸드', bar:'바',
                mosque:'모스크', place_of_worship:'종교시설',
                market:'시장', marketplace:'시장',
                hospital:'병원', pharmacy:'약국' },
    historic: { ruins:'유적지', castle:'성', monument:'기념물',
                archaeological_site:'고고학유적', fort:'요새' },
    natural:  { beach:'해변', peak:'산봉우리', cave_entrance:'동굴',
                hot_spring:'온천', waterfall:'폭포', cliff:'절벽' },
    leisure:  { park:'공원', beach_resort:'리조트', water_park:'워터파크' },
    shop:     { mall:'쇼핑몰', market:'시장', supermarket:'슈퍼마켓',
                clothes:'의류', jewelry:'보석' },
  };
  return map[key]?.[value] || null;
}

// 카테고리별 뱃지 색상
function categoryColor(key) {
  const colors = {
    tourism: '#1a6e8a', historic: '#1a6e8a',
    amenity: '#e05a00',
    natural: '#2e7d32', leisure: '#2e7d32',
    shop: '#6a1b9a',
  };
  return colors[key] || '#8a7a72';
}

function matchedHotels(q) {
  const lower = q.toLowerCase();
  return HOTELS.filter(h =>
    h.name.toLowerCase().includes(lower) ||
    h.city.toLowerCase().includes(lower) ||
    (h.aliases || []).some(a => a.toLowerCase().includes(lower))
  );
}

async function doSearch(q) {
  const drop = document.getElementById('searchDropdown');
  drop.innerHTML = '<div class="sr-status">🔍 검색 중...</div>';
  drop.classList.add('open');

  try {
    // ── 구글 API 키가 있으면 Google Places 우선 ──
    const gPlaces = await googlePlacesSearch(q);
    if (gPlaces !== null) {
      renderGoogleResults(drop, q, gPlaces);
      return;
    }

    // ── 폴백: Photon ──
    const translated = translateQuery(q);
    const geojson    = await photonFetch(translated);
    const features   = geojson.features || [];

    matchedHotels(q).forEach(h => {
      features.unshift({
        properties: { name: h.name, city: h.city, country: '튀르키예', osm_key: 'tourism', osm_value: 'hotel' },
        geometry: { coordinates: [h.lng, h.lat] },
      });
    });

    if (!features.length) {
      drop.innerHTML = `<div class="sr-status">검색 결과가 없어요 😔<br><small>예: 그랜드 바자르, 아야소피아, Göreme</small></div>`;
      return;
    }

    drop.innerHTML = '';
    features.forEach(feat => {
      const p     = feat.properties;
      const name  = p.name || p.street || '';
      const addr  = fmtAddr(p);
      const ico   = placeIcon(p.osm_key, p.osm_value);
      const label = categoryLabel(p.osm_key, p.osm_value);
      const color = categoryColor(p.osm_key);
      const [lng, lat] = feat.geometry.coordinates;

      const div = document.createElement('div');
      div.className = 'sr-item';
      div.innerHTML = `
        <span class="sr-icon">${ico}</span>
        <div class="sr-text">
          <div class="sr-name">${esc(name)}</div>
          <div class="sr-meta">
            ${label ? `<span class="sr-badge" style="background:${color}">${label}</span>` : ''}
            <span class="sr-addr">${esc(addr)}</span>
          </div>
        </div>`;
      div.addEventListener('click', () =>
        addPlace({ name, lat, lng, addr, osmKey: p.osm_key, osmValue: p.osm_value })
      );
      drop.appendChild(div);
    });
  } catch (_) {
    drop.innerHTML = '<div class="sr-status">검색 오류가 발생했어요 😢<br><small>인터넷 연결을 확인해주세요</small></div>';
  }
}

function renderGoogleResults(drop, q, places) {
  if (!places.length) {
    drop.innerHTML = `<div class="sr-status">검색 결과가 없어요 😔<br><small>다른 검색어로 시도해보세요</small></div>`;
    return;
  }

  drop.innerHTML = '<div class="sr-popular-header">🔍 Google Places 검색 결과</div>';

  // 호텔 매칭 먼저 표시
  matchedHotels(q).forEach(h => {
    const div = document.createElement('div');
    div.className = 'sr-item';
    div.innerHTML = `
      <span class="sr-icon">🏨</span>
      <div class="sr-text">
        <div class="sr-name">${esc(h.name)}</div>
        <div class="sr-meta">
          <span class="sr-badge" style="background:#c9935a">호텔</span>
          <span class="sr-addr">${h.city}, 튀르키예</span>
        </div>
      </div>`;
    div.addEventListener('click', () => addPlace({ name: h.name, lat: h.lat, lng: h.lng, addr: h.city }));
    drop.appendChild(div);
  });

  places.forEach(pl => {
    const name    = pl.displayName?.text || '';
    const addr    = pl.formattedAddress || '';
    const lat     = pl.location?.latitude;
    const lng     = pl.location?.longitude;
    const rating  = pl.rating;
    const reviews = pl.userRatingCount;
    const types   = pl.types || [];
    const cat     = googleTypeToKo(types);
    const color   = CAT_COLOR[cat] || '#8a7a72';
    const icon    = CAT_ICON[cat]  || '📍';

    const ratingHtml = rating
      ? `<span class="sr-rating">⭐ ${rating.toFixed(1)} <span class="sr-review-count">(${reviews?.toLocaleString()})</span></span>`
      : '';

    const div = document.createElement('div');
    div.className = 'sr-item';
    div.innerHTML = `
      <span class="sr-icon">${icon}</span>
      <div class="sr-text">
        <div class="sr-name">${esc(name)}</div>
        <div class="sr-meta">
          ${cat ? `<span class="sr-badge" style="background:${color}">${cat}</span>` : ''}
          ${ratingHtml}
        </div>
        <div class="sr-addr">${esc(addr)}</div>
      </div>`;
    div.addEventListener('click', () =>
      addPlace({ name, lat, lng, addr, osmKey: '_google', osmValue: cat || '' })
    );
    drop.appendChild(div);
  });
}

function fmtAddr(p) {
  const parts = [];
  const city = p.city || p.town || p.village || p.county;
  if (city) parts.push(city);
  if (p.state && p.state !== city) parts.push(p.state);
  if (p.country) parts.push(p.country);
  return parts.join(', ');
}

function placeIcon(cat, type) {
  const m = {
    tourism:  { museum:'🏛️', attraction:'🗺️', hotel:'🏨', hostel:'🏨',
                gallery:'🎨', viewpoint:'🌅', ruins:'🏺', monument:'🗿',
                theme_park:'🎡', zoo:'🦁' },
    amenity:  { restaurant:'🍽️', cafe:'☕', fast_food:'🍔',
                mosque:'🕌', place_of_worship:'🕌',
                market:'🛍️', marketplace:'🛍️',
                hospital:'🏥', pharmacy:'💊', bar:'🍹' },
    historic: { ruins:'🏺', castle:'🏰', monument:'🗿',
                archaeological_site:'⛏️', fort:'🏰' },
    natural:  { beach:'🏖️', peak:'⛰️', cave_entrance:'🕳️',
                hot_spring:'♨️', waterfall:'💧', cliff:'🪨' },
    leisure:  { park:'🌳', beach_resort:'🏖️', water_park:'💦' },
    shop:     { mall:'🛍️', market:'🛒' },
  };
  return m[cat]?.[type] || '📍';
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════
//  RENDER TABS
// ════════════════════════════════════════

function renderTabs() {
  const con = document.getElementById('dayTabs');
  con.innerHTML = '';

  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const isFlight = BOOKED_FLIGHTS.some(f => f.depDay === day);
    const count    = state.itin[day].filter(p => p.type !== 'hotel').length;
    const color    = DAY_COLORS[day - 1];
    const active   = day === state.day;

    const btn = document.createElement('button');
    btn.className = `day-tab${active ? ' active' : ''}`;
    btn.innerHTML = `
      <span class="tab-num" style="color:${active ? 'white' : color}">Day ${day}</span>
      <span class="tab-date">${fmtDay(day)}</span>
      ${isFlight ? '<span class="tab-badge">✈️</span>' : ''}
    `;

    btn.addEventListener('click', () => {
      state.day = day;
      document.getElementById('searchDayTag').textContent = `Day ${day}에 추가`;
      renderTabs();
      renderItin();
      renderRoute(day);
    });

    btn.addEventListener('dragover', e => {
      if (dIdx === null || dDay === null) return;
      const src = state.itin[dDay]?.[dIdx];
      if (!src || src.type === 'hotel' || dDay === day) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      btn.classList.add('tab-drop-target');
    });

    btn.addEventListener('dragleave', e => {
      if (!btn.contains(e.relatedTarget)) btn.classList.remove('tab-drop-target');
    });

    btn.addEventListener('drop', e => {
      e.preventDefault();
      btn.classList.remove('tab-drop-target');
      if (dIdx === null || dDay === null || dDay === day) return;

      const src = state.itin[dDay]?.[dIdx];
      if (!src || src.type === 'hotel') return;

      state.itin[dDay].splice(dIdx, 1);
      state.itin[day].push(src);
      dDay = dIdx = null;

      saveState();
      state.day = day;
      document.getElementById('searchDayTag').textContent = `Day ${day}에 추가`;
      renderTabs();
      renderItin();
      renderRoute(day);
    });

    con.appendChild(btn);
    if (active) {
      requestAnimationFrame(() =>
        btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
      );
    }
  }
}

// ════════════════════════════════════════
//  RENDER ITINERARY (SIDEBAR)
// ════════════════════════════════════════

function renderItin() {
  const wrap   = document.getElementById('itinWrap');
  const day    = state.day;
  const hotel  = hotelOfDay(day);
  const places = state.itin[day] || [];
  const color  = DAY_COLORS[day - 1];
  const nonHotel = places.filter(p => p.type !== 'hotel');

  let totalKm = 0;
  for (let i = 1; i < places.length; i++) {
    totalKm += dist(places[i-1].lat, places[i-1].lng, places[i].lat, places[i].lng);
  }

  let html = `
    <div class="day-heading">
      <div class="day-heading-left">
        <div class="day-color-stripe" style="background:${color}"></div>
        <h3>Day ${day}</h3>
      </div>
      <span class="day-full-date">${fmtDay(day)}</span>
    </div>`;

  BOOKED_FLIGHTS.filter(f => f.depDay === day).forEach(bf => {
    html += `
      <div class="flight-card">
        <span class="flight-card-ico">✈️</span>
        <div style="flex:1;min-width:0">
          <div class="flight-card-route">
            ${bf.dep} → ${bf.arr}
            <span class="flight-no-badge">${bf.flightNo}</span>
            ${bf.tag ? `<span class="fs-tag" style="margin-left:4px">${bf.tag}</span>` : ''}
          </div>
          <div class="flight-card-sub">출발 ${bf.depTime}${bf.arrTime ? ` · 도착 ${bf.arrTime}` : ''}</div>
        </div>
      </div>`;
  });

  html += `<div class="places-list" id="placesList">`;
  let placeNum = 0;

  // 각 인덱스별 번호 미리 계산 (호텔 제외)
  const numMap = {};
  let n = 0;
  places.forEach((pl, i) => { if (pl.type !== 'hotel') numMap[i] = ++n; });

  places.forEach((pl, i) => {
    const isHotel = pl.type === 'hotel';
    if (!isHotel) placeNum++;
    const prev = places[i - 1];
    const km   = prev ? dist(prev.lat, prev.lng, pl.lat, pl.lng) : 0;
    const fromLbl = prev
      ? (prev.type === 'hotel' ? `${prev.emoji} 호텔에서` : `${numMap[i - 1]}번에서`)
      : '';
    const badge = isHotel
      ? `<span style="font-size:1.1rem">${pl.emoji}</span>`
      : `<span class="place-num" style="background:${color}">${placeNum}</span>`;
    const subLabel = isHotel
      ? (day === hotel.checkIn ? '체크인 ✅' : day === hotel.checkOut ? '체크아웃 🧳' : '숙박 🌙')
      : '';

    const catLabel = (!isHotel && pl.osmKey) ? categoryLabel(pl.osmKey, pl.osmValue) : null;
    const catColor = (!isHotel && pl.osmKey) ? categoryColor(pl.osmKey) : null;

    html += `
      <div class="place-item${isHotel ? ' is-hotel' : ''}" data-day="${day}" data-idx="${i}">
        <span class="drag-handle" title="드래그해서 순서 변경">⠿</span>
        ${badge}
        <div class="place-content">
          <div class="place-name-row">
            <span class="place-name">${esc(pl.name)}</span>
            ${catLabel ? `<span class="place-cat-badge" style="background:${catColor}">${catLabel}</span>` : ''}
            ${!isHotel ? `<button class="place-copy" data-name="${esc(pl.name)}" title="이름 복사">⎘</button>` : ''}
          </div>
          ${isHotel && subLabel ? `<div class="place-addr">${subLabel}</div>` :
            pl.addr ? `<div class="place-addr">${esc(pl.addr)}</div>` : ''}
          ${prev ? `<div class="place-dist">📍 ${fromLbl} ${km.toFixed(1)}km</div>` : ''}
        </div>
        ${isHotel ? '' : `<button class="place-del" data-id="${pl.id}" data-day="${day}">✕</button>`}
      </div>`;
  });

  html += `</div>`;

  if (nonHotel.length === 0) {
    html += `
      <div class="empty-day" style="margin-top:8px">
        <div class="empty-ico">🗺️</div>
        <p>위 검색창에서 가고 싶은 곳을<br>찾아서 추가해보세요 💕</p>
      </div>`;
  } else {
    html += `
      <div class="day-summary">
        <span>📏 총 이동거리</span>
        <strong>${totalKm.toFixed(1)} km</strong>
        <span style="color:#ccc">·</span>
        <span>${nonHotel.length}곳</span>
      </div>
      <p class="day-hint">⠿ 드래그로 호텔·장소 순서 변경</p>`;
  }

  wrap.innerHTML = html;

  wrap.querySelectorAll('.place-copy').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const name = btn.dataset.name;
      navigator.clipboard.writeText(name).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✓';
        btn.style.color = '#26a69a';
        setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1500);
      });
    });
  });

  wrap.querySelectorAll('.place-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removePlace(btn.dataset.id, parseInt(btn.dataset.day));
    });
  });

  wrap.querySelectorAll('.place-item').forEach(el => {
    const d = parseInt(el.dataset.day), i = parseInt(el.dataset.idx);
    setupDnD(el, d, i);
    setupTouchDnD(el, d, i);
  });

}

// ════════════════════════════════════════
//  FLIGHT EDIT
// ════════════════════════════════════════

function toggleFlightEdit(day) {
  const form = document.getElementById(`flightEditForm${day}`);
  if (!form) return;
  if (form.classList.contains('open')) {
    form.classList.remove('open');
    form.innerHTML = '';
    return;
  }

  const f5 = state.flights[5];
  const f7 = state.flights[7];
  let formHtml = '';

  if (day === 5) {
    const depOpts = AIRPORT_OPTIONS.istanbul.map(a => `
      <button class="airport-opt${f5.dep === a.code ? ' selected' : ''}" data-field="dep" data-code="${a.code}" data-fday="5">
        <div class="airport-opt-code">${a.code}</div>
        <div class="airport-opt-name">${a.name}</div>
      </button>`).join('');
    const arrOpts = AIRPORT_OPTIONS.cappadocia.map(a => `
      <button class="airport-opt${f5.arr === a.code ? ' selected' : ''}" data-field="arr" data-code="${a.code}" data-fday="5">
        <div class="airport-opt-code">${a.code}</div>
        <div class="airport-opt-name">${a.name}</div>
      </button>`).join('');
    formHtml = `
      <div class="flight-edit-section">
        <div class="flight-edit-label">출발 공항</div>
        <div class="airport-opts">${depOpts}</div>
      </div>
      <div class="flight-edit-section">
        <div class="flight-edit-label">도착 공항</div>
        <div class="airport-opts">${arrOpts}</div>
      </div>
      <div class="flight-edit-section">
        <div class="flight-time-row">
          <div class="flight-time-col">
            <div class="flight-time-lbl">출발 시각</div>
            <input type="time" class="flight-time-input" data-field="depTime" data-fday="5" value="${f5.depTime}">
          </div>
          <div class="flight-time-col">
            <div class="flight-time-lbl">도착 시각</div>
            <input type="time" class="flight-time-input" data-field="arrTime" data-fday="5" value="${f5.arrTime}">
          </div>
        </div>
      </div>`;
  } else if (day === 7) {
    const depCode = f7.dep || f5.arr;
    const depName = AIRPORT_OPTIONS.cappadocia.find(a => a.code === depCode)?.name || '';
    formHtml = `
      <div class="flight-edit-section">
        <div class="flight-edit-label">출발 공항</div>
        <div class="airport-fixed-badge">${depCode} <span style="font-weight:400;font-size:0.68rem;opacity:0.8">${depName}</span></div>
        <div style="font-size:0.6rem;color:var(--text-light);margin-top:4px">Day 5 도착 공항과 동일하게 자동 설정</div>
      </div>
      <div class="flight-edit-section">
        <div class="flight-edit-label">도착 공항</div>
        <div class="airport-fixed-badge">AYT <span style="font-weight:400;font-size:0.68rem;opacity:0.8">안탈리아 공항</span></div>
      </div>
      <div class="flight-edit-section">
        <div class="flight-time-row">
          <div class="flight-time-col">
            <div class="flight-time-lbl">출발 시각</div>
            <input type="time" class="flight-time-input" data-field="depTime" data-fday="7" value="${f7.depTime}">
          </div>
          <div class="flight-time-col">
            <div class="flight-time-lbl">도착 시각</div>
            <input type="time" class="flight-time-input" data-field="arrTime" data-fday="7" value="${f7.arrTime}">
          </div>
        </div>
      </div>`;
  } else {
    const f11 = state.flights[11];
    const arrOpts = AIRPORT_OPTIONS.istanbul.map(a => `
      <button class="airport-opt${f11.arr === a.code ? ' selected' : ''}" data-field="arr" data-code="${a.code}" data-fday="11">
        <div class="airport-opt-code">${a.code}</div>
        <div class="airport-opt-name">${a.name}</div>
      </button>`).join('');
    formHtml = `
      <div class="flight-edit-section">
        <div class="flight-edit-label">출발 공항</div>
        <div class="airport-fixed-badge">AYT <span style="font-weight:400;font-size:0.68rem;opacity:0.8">안탈리아 공항</span></div>
      </div>
      <div class="flight-edit-section">
        <div class="flight-edit-label">도착 공항</div>
        <div class="airport-opts">${arrOpts}</div>
      </div>
      <div class="flight-edit-section">
        <div class="flight-time-row">
          <div class="flight-time-col">
            <div class="flight-time-lbl">출발 시각</div>
            <input type="time" class="flight-time-input" data-field="depTime" data-fday="11" value="${f11.depTime}">
          </div>
          <div class="flight-time-col">
            <div class="flight-time-lbl">도착 시각</div>
            <input type="time" class="flight-time-input" data-field="arrTime" data-fday="11" value="${f11.arrTime}">
          </div>
        </div>
      </div>`;
  }

  form.innerHTML = formHtml;
  form.classList.add('open');

  form.querySelectorAll('.airport-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const { field, code, fday } = btn.dataset;
      const fd = parseInt(fday);
      state.flights[fd][field] = code;
      saveState();
      btn.closest('.airport-opts').querySelectorAll('.airport-opt').forEach(b => {
        b.classList.toggle('selected', b.dataset.code === code);
      });
      updateFlightCardDisplay(day);
      if (fd === 5 && field === 'arr') updateFlightCardDisplay(7);
    });
  });

  form.querySelectorAll('.flight-time-input').forEach(input => {
    input.addEventListener('change', () => {
      const { field, fday } = input.dataset;
      state.flights[parseInt(fday)][field] = input.value;
      saveState();
      updateFlightCardDisplay(day);
    });
  });
}

function updateFlightCardDisplay(day) {
  const subEl = document.getElementById(`flightCardSub${day}`);
  if (!subEl) return;
  const f5 = state.flights[5];
  const f7 = state.flights[7];
  let depCode, arrCode, depName, arrName, depTime, arrTime;
  if (day === 5) {
    depCode = f5.dep; arrCode = f5.arr;
    depTime = f5.depTime; arrTime = f5.arrTime;
    depName = AIRPORT_OPTIONS.istanbul.find(a => a.code === depCode)?.name || '';
    arrName = AIRPORT_OPTIONS.cappadocia.find(a => a.code === arrCode)?.name || '';
  } else if (day === 7) {
    depCode = f7.dep || f5.arr; arrCode = 'AYT';
    depTime = f7.depTime; arrTime = f7.arrTime;
    depName = AIRPORT_OPTIONS.cappadocia.find(a => a.code === depCode)?.name || '';
    arrName = '안탈리아 공항';
  } else {
    const f11 = state.flights[11];
    depCode = 'AYT'; arrCode = f11.arr;
    depTime = f11.depTime; arrTime = f11.arrTime;
    depName = '안탈리아 공항';
    arrName = AIRPORT_OPTIONS.istanbul.find(a => a.code === arrCode)?.name || '';
  }
  const bf = BOOKED_FLIGHTS.find(f => f.depDay === day);
  const finalDepTime = bf?.depTime || depTime;
  const finalArrTime = bf?.arrTime || arrTime;
  const timeInfo = [finalDepTime ? `출발 ${finalDepTime}` : '', finalArrTime ? `도착 ${finalArrTime}` : ''].filter(Boolean).join(' · ');
  subEl.innerHTML = `${depCode} (${depName}) → ${arrCode} (${arrName})${timeInfo ? '&nbsp;&nbsp;·&nbsp;&nbsp;' + timeInfo : ''}`;
}

// ════════════════════════════════════════
//  INIT
// ════════════════════════════════════════

async function init() {
  await loadState();
  initMap();
  renderTabs();
  renderItin();
  renderRoute(1);
  initSearch();
  initTabsNav();

  document.getElementById('overviewBtn').addEventListener('click', showOverview);
  document.getElementById('fitDayBtn').addEventListener('click', () => renderRoute(state.day));

  // 설정 모달
  const settingsBtn    = document.getElementById('settingsBtn');
  const settingsModal  = document.getElementById('settingsModal');
  const settingsClose  = document.getElementById('settingsModalClose');
  const scriptInput    = document.getElementById('scriptUrlInput');
  const scriptSave     = document.getElementById('scriptUrlSave');
  const scriptClear    = document.getElementById('scriptUrlClear');
  const syncStatus     = document.getElementById('syncStatus');
  const googleKeyInput = document.getElementById('googleKeyInput');
  const googleKeySave  = document.getElementById('googleKeySave');
  const googleKeyClear = document.getElementById('googleKeyClear');
  const googleKeyStatus = document.getElementById('googleKeyStatus');

  settingsBtn.addEventListener('click', () => {
    scriptInput.value    = getScriptUrl();
    googleKeyInput.value = getGoogleKey();
    syncStatus.textContent      = getScriptUrl()  ? '✅ 연결됨' : '미설정';
    syncStatus.style.color      = getScriptUrl()  ? '#26a69a' : 'var(--text-light)';
    googleKeyStatus.textContent = getGoogleKey()  ? '✅ 등록됨 — Google Places 검색 활성화' : '미설정 (기본 검색 사용)';
    googleKeyStatus.style.color = getGoogleKey()  ? '#26a69a' : 'var(--text-light)';
    settingsModal.classList.add('open');
  });

  // Google API 키 저장
  googleKeySave.addEventListener('click', async () => {
    const key = googleKeyInput.value.trim();
    if (!key.startsWith('AIza')) {
      googleKeyStatus.textContent = '⚠️ 올바른 API 키를 입력해주세요 (AIza로 시작)';
      googleKeyStatus.style.color = '#e05555';
      return;
    }
    setGoogleKey(key);
    googleKeyStatus.textContent = '🔄 키 확인 중...';
    googleKeyStatus.style.color = 'var(--text-light)';
    // 테스트 검색 — 실제 에러 메시지 표시
    try {
      const testRes = await fetch(
        `https://places.googleapis.com/v1/places:searchText?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'places.displayName' },
          body: JSON.stringify({ textQuery: 'Hagia Sophia Istanbul', languageCode: 'ko', maxResultCount: 1 }),
        }
      );
      if (testRes.ok) {
        const data = await testRes.json();
        if (data.places?.length > 0) {
          googleKeyStatus.textContent = '✅ 연결 성공! 이제 별점·리뷰 검색이 가능해요';
          googleKeyStatus.style.color = '#26a69a';
        } else {
          googleKeyStatus.textContent = '✅ API 연결됨 (검색 결과 없음 — 정상 작동)';
          googleKeyStatus.style.color = '#26a69a';
        }
      } else {
        const errData = await testRes.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `HTTP ${testRes.status}`;
        googleKeyStatus.textContent = `⚠️ API 오류: ${errMsg}`;
        googleKeyStatus.style.color = '#e05555';
      }
    } catch (e) {
      googleKeyStatus.textContent = `⚠️ 네트워크/CORS 오류: ${e.message}`;
      googleKeyStatus.style.color = '#e05555';
    }
  });

  googleKeyClear.addEventListener('click', () => {
    setGoogleKey('');
    googleKeyInput.value = '';
    googleKeyStatus.textContent = '초기화됨';
    googleKeyStatus.style.color = 'var(--text-light)';
  });
  settingsClose.addEventListener('click', () => settingsModal.classList.remove('open'));
  settingsModal.addEventListener('click', e => { if (e.target === settingsModal) settingsModal.classList.remove('open'); });

  scriptSave.addEventListener('click', async () => {
    const url = scriptInput.value.trim();
    if (!url.startsWith('https://script.google.com')) {
      syncStatus.textContent = '⚠️ 올바른 Apps Script URL을 입력해주세요';
      syncStatus.style.color = '#e05555';
      return;
    }
    setScriptUrl(url);
    syncStatus.textContent = '🔄 연결 확인 중...';
    syncStatus.style.color = 'var(--text-light)';
    const result = await cloudLoad();
    if (result) {
      syncStatus.textContent = '✅ 연결 성공! 클라우드 데이터를 불러왔어요';
      syncStatus.style.color = '#26a69a';
      applyParsed(result);
      for (let d = 1; d <= TOTAL_DAYS; d++) ensureHotelInDay(d);
      renderTabs(); renderItin(); renderRoute(state.day);
    } else {
      syncStatus.textContent = '✅ 연결됨 (저장된 데이터 없음 - 첫 사용)';
      syncStatus.style.color = '#26a69a';
    }
  });

  scriptClear.addEventListener('click', () => {
    setScriptUrl('');
    scriptInput.value = '';
    syncStatus.textContent = '초기화됨';
    syncStatus.style.color = 'var(--text-light)';
  });


  // 모바일 사이드바 드래그 리사이즈
  // Pointer Events + setPointerCapture: 손가락이 핸들 밖으로 나가도 추적 유지
  const handle  = document.getElementById('sidebarToggle');
  const sidebar = document.querySelector('.sidebar');
  if (handle && sidebar) {
    let active = false, startY = 0, startH = 0;
    const MIN_H  = 84;
    const getMaxH = () => window.innerHeight * 0.80;

    handle.addEventListener('pointerdown', e => {
      active  = true;
      startY  = e.clientY;
      startH  = sidebar.offsetHeight;
      handle.setPointerCapture(e.pointerId); // 핸들 밖으로 이동해도 이벤트 계속 수신
      e.preventDefault();
    });

    handle.addEventListener('pointermove', e => {
      if (!active) return;
      const dy   = e.clientY - startY;
      const newH = Math.min(Math.max(startH + dy, MIN_H), getMaxH());
      sidebar.style.height = newH + 'px';
    });

    handle.addEventListener('pointerup',     () => { if (active) { active = false; map.invalidateSize(); } });
    handle.addEventListener('pointercancel', () => { active = false; });
  }
}

document.addEventListener('DOMContentLoaded', init);
