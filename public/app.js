import { predictFog, classifyViewpoint, VIEWPOINTS, DEFAULT_THRESHOLD } from '/model/fog-model.js';
import { bindMapInteractions, FIXED_MAP_OPTIONS } from './map-interactions.js';
import { altitudeKey, parseAltitude, withSavedAltitude } from './altitude-store.js';
import { createPointWeather, pointPrediction } from './point-weather.js';

const $ = id => document.getElementById(id);
const DEFAULT_POINT = { id: 'region', lat: 35.1595, lon: 129.1604, name: '해운대 대표 지점', altitude: null, type: '기본 분석 위치', description: '지도에서 원하는 위치를 클릭하면 그 좌표의 해무 조건 점수를 계산합니다.', note: '고도 미확인 · 점수는 기상자료로 계산합니다.' };
const state = { dataset: null, date: '', index: 3, viewpoint: DEFAULT_POINT, requestedPoint: DEFAULT_POINT, threshold: DEFAULT_THRESHOLD, mode: 'archive', requestedMode: 'archive', timer: null, request: 0 };
const fmt = (n, digits = 1) => typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits) : '—';
const hours = () => state.dataset?.hours.filter(h => h.time.startsWith(state.date)) ?? [];
const current = () => hours()[state.index];
const prediction = () => current() ? predictFog(current(), state.threshold) : null;
const compass = degree => degree == null ? '—' : ['북', '북동', '동', '남동', '남', '남서', '서', '북서'][Math.round(degree / 45) % 8];
const koreaNow = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16);
let map, selectedHalo, selectedMarker, tiles, markers = [];
let pointMode = null, pointGeneration = 0;
const pointData = new Map();
const memoryAltitudes = new Map();
const savedPoint = point => {
  const memory = memoryAltitudes.get(altitudeKey(point));
  if (memory) return { ...point, ...memory };
  try { return withSavedAltitude(point, localStorage); } catch { return { ...point }; }
};
const pointWeather = createPointWeather(async (mode, point) => {
  const query = new URLSearchParams({ mode });
  if (point.id !== 'region') { query.set('lat', point.lat); query.set('lon', point.lon); }
  const response = await fetch(`/api/weather?${query}`, { signal: AbortSignal.timeout(45000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '자료를 가져오지 못했습니다.');
  return data;
});
async function loadMapPoints(mode, force = false) {
  if (!force && pointMode === mode) return;
  pointMode = mode;
  const generation = ++pointGeneration;
  pointData.clear();
  VIEWPOINTS.forEach(point => pointData.set(point.id, { loading: true }));
  renderPoints();
  const queue = [...VIEWPOINTS];
  async function worker() {
    while (queue.length && generation === pointGeneration) {
      const point = queue.shift();
      try {
        const data = await pointWeather.get(mode, point, force);
        if (generation !== pointGeneration) return;
        pointData.set(point.id, { data });
      } catch (error) {
        if (generation !== pointGeneration) return;
        pointData.set(point.id, { error: error.message });
      }
      renderPoints();
    }
  }
  await Promise.all([worker(), worker()]);
}

function initMap() {
  if (!window.L) { $('map').textContent = '지도를 불러오지 못했습니다. npm run build 실행 후 새로고침해 주세요.'; return; }
  map = L.map('map', FIXED_MAP_OPTIONS);
  const fit = () => map.fitBounds([[35.132, 129.098], [35.170, 129.181]], { padding: [30, 45], animate: false });
  fit(); map.on('resize', fit);
  tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
  tiles.on('tileerror', () => { $('tile-error').hidden = false; });
  $('retry-map').addEventListener('click', () => { $('tile-error').hidden = true; tiles.redraw(); });
  selectedHalo = L.circleMarker([DEFAULT_POINT.lat, DEFAULT_POINT.lon], { radius: 28, color: '#287d6c', weight: 1, fillOpacity: .12, interactive: false }).addTo(map);
  selectedMarker = L.marker([DEFAULT_POINT.lat, DEFAULT_POINT.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'map-marker', iconSize: [26, 26], iconAnchor: [13, 13], html: '<span class="map-marker-inner chosen">◎</span>' }) }).addTo(map);
  bindMapInteractions($('map'));
  map.on('click', e => {
    const lat = Number(e.latlng.lat.toFixed(5));
    const lon = Number(((e.latlng.lng + 180) % 360 + 360) % 360 - 180).toFixed(5);
    load(state.requestedMode, { id: 'custom', lat, lon: Number(lon), name: '선택한 지도 위치', altitude: null, type: '직접 선택한 좌표', description: '클릭한 좌표에 해당하는 기상·해양 격자로 계산한 해무 조건 점수입니다.', note: '관찰 해발고도를 직접 입력하면 해무층과의 높이를 비교합니다.' });
  });
  markers = VIEWPOINTS.map((point, i) => {
    const marker = L.marker([point.lat, point.lon], { title: point.name, keyboard: true, icon: markerIcon(i, 'unknown') }).addTo(map);
    marker.bindTooltip(point.name, { direction: 'top', offset: [0, -10], className: 'point-tooltip' });
    marker.on('click', () => selectPoint(point.id));
    return marker;
  });
}
function markerIcon(i, key, active = false) {
  return L.divIcon({ className: 'map-marker', iconSize: [22, 22], iconAnchor: [11, 11], html: `<span class="map-marker-inner ${key} ${active ? 'fog-active' : ''} ${state.viewpoint.id === VIEWPOINTS[i].id ? 'chosen' : ''}">${i + 1}${active ? '<sup aria-hidden="true">≋</sup>' : ''}</span>` });
}
function selectPoint(id) { load(state.requestedMode, VIEWPOINTS.find(p => p.id === id)); }
function stopPlay() { clearInterval(state.timer); state.timer = null; $('play-button').textContent = '▶ 시간 재생'; $('play-button').setAttribute('aria-pressed', 'false'); }

async function load(mode, point = state.viewpoint, force = false) {
  stopPlay();
  state.requestedMode = mode; state.requestedPoint = point;
  const request = ++state.request;
  const previousTime = mode === state.mode ? current()?.time : null;
  for (const id of ['refresh-button', 'export-button', 'play-button']) $(id).disabled = true;
  $('error').hidden = true;
  $('notice').textContent = `${point.name} (${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}) · ${mode === 'archive' ? '2026년 7월' : '최신 예보'} 기상·해양 자료를 조회하고 있습니다…`;
  try {
    const data = await pointWeather.get(mode, point, force);
    if (request !== state.request) return;
    state.dataset = data; state.mode = mode; state.viewpoint = savedPoint(point);
    $('altitude-input').value = state.viewpoint.altitude ?? '';
    $('altitude-form').querySelector('fieldset').disabled = false;
    $('altitude-feedback').textContent = '';
    const dates = [...new Set(data.hours.map(h => h.time.slice(0, 10)))];
    const target = previousTime || (mode === 'archive' ? data.recommendedTime || data.hours[0].time : koreaNow());
    state.date = dates.includes(target.slice(0, 10)) ? target.slice(0, 10) : dates[0];
    const index = hours().findIndex(h => h.time.slice(11, 13) === target.slice(11, 13)); state.index = Math.max(0, index);
    $('date-select').replaceChildren(...dates.map(date => { const o = document.createElement('option'); o.value = date; o.textContent = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(date + 'T12:00:00+09:00')); return o; }));
    $('date-select').value = state.date; $('date-select').disabled = false;
    $('archive-button').classList.toggle('selected', mode === 'archive'); $('forecast-button').classList.toggle('selected', mode === 'forecast');
    $('archive-button').setAttribute('aria-pressed', String(mode === 'archive')); $('forecast-button').setAttribute('aria-pressed', String(mode === 'forecast'));
    $('map-mode').textContent = mode === 'archive' ? '과거 자료' : '최신 모델 예보';
    $('notice').textContent = `${mode === 'archive' ? 'ARCHIVE · 2026년 7월의 모델 기상자료를 활용한 과거 조건 분석입니다. 실측 해무 기록이 아닙니다.' : 'FORECAST · 최신 모델 예보입니다. 5분 동안 조회 결과를 재사용하며, 실시간 관측은 아닙니다.'}${data.warnings?.length ? ' ' + data.warnings.join(' ') : ''}`;
    $('fetched-note').textContent = `자료 수집: ${new Date(data.fetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST · 대기 격자 ${data.grids?.atmosphere?.latitude ?? '—'}, ${data.grids?.atmosphere?.longitude ?? '—'} · 해양 격자 ${data.grids?.marine?.latitude ?? '—'}, ${data.grids?.marine?.longitude ?? '—'} · 인접 좌표는 같은 기상 격자를 사용할 수 있습니다.`;
    render();
    loadMapPoints(mode, force);
  } catch (error) {
    if (request !== state.request) return;
    $('error').hidden = false; $('error').querySelector('span').textContent = error.name === 'TimeoutError' ? '조회 시간이 초과되었습니다. 다시 시도해 주세요.' : error.message;
    $('notice').textContent = state.dataset ? '조회 실패 · 아래 화면은 마지막으로 정상 조회한 자료를 유지합니다. 자료 종류와 시간을 확인하세요.' : '자료를 불러오지 못했습니다. 로컬 서버 실행 상태를 확인해 주세요.';
  } finally {
    if (request === state.request) { $('refresh-button').disabled = false; $('export-button').disabled = !state.dataset; $('play-button').disabled = !state.dataset; }
  }
}

function render() {
  const hour = current(), pred = prediction(); if (!hour || !pred) return;
  const point = state.viewpoint, status = classifyViewpoint(pred, point.altitude);
  $('map-date').textContent = state.date.replaceAll('-', '.'); $('map-hour').textContent = hour.time.slice(11);
  $('fog-pill').textContent = pred.score == null ? '자료 부족 · 해무 판단 유보' : pred.active ? `해무 조건 충족 · ${pred.score}점` : `해무 조건 ${pred.score}점 · 기준 미달`;
  $('fog-pill').classList.toggle('active', pred.active);
  if (map) {
    selectedHalo.setLatLng([point.lat, point.lon]); selectedMarker.setLatLng([point.lat, point.lon]);
    if (point.id === 'custom' || point.id === 'region') selectedMarker.addTo(map); else selectedMarker.remove();
  }
  $('viewpoint-heading').textContent = point.name; $('viewpoint-description').textContent = point.description;
  $('selected-coordinate').textContent = `위도 ${point.lat.toFixed(5)}° · 경도 ${point.lon.toFixed(5)}°`;
  $('viewpoint-type').textContent = point.type; $('viewpoint-altitude').innerHTML = point.altitude == null ? '<small>미확인</small>' : `${point.altitude}<small> m</small>`;
  const presetIndex = VIEWPOINTS.findIndex(p => p.id === point.id);
  document.querySelector('.section-label span').textContent = presetIndex >= 0 ? `0${presetIndex + 1} / 05` : 'MAP POINT';
  $('altitude-origin').textContent = point.userAltitude ? `사용자 입력 · ${point.altitudeStored === false ? '현재 화면에만 적용됨' : '이 브라우저에 저장됨'}` : point.altitude == null ? '관찰 고도를 입력하면 해무층과 비교합니다.' : '해변 대표 고도 · 실제 관찰 고도로 변경 가능';
  $('building-reference').replaceChildren();
  if (point.buildingHeight != null) {
    const a = document.createElement('a'); a.href = point.source; a.target = '_blank'; a.rel = 'noreferrer';
    a.textContent = `건축 높이 참고 ${point.buildingHeight}m ↗ · 관찰 해발고도와 다름`; $('building-reference').append(a);
  }
  $('viewpoint-status').className = `viewpoint-status ${status.key}`; $('viewpoint-status').querySelector('strong').textContent = status.label;
  $('viewpoint-reason').textContent = status.description;
  $('altitude-note').textContent = point.userAltitude ? `입력한 관찰 해발고도 ${point.altitude}m와 추정 해무층을 비교합니다.` : point.note;
  renderAltitude(pred, point);
  renderPoints();
  $('threshold-value').textContent = state.threshold;
  $('metric-score').innerHTML = `${pred.score ?? '—'}<small> / 100</small>`; $('score-fill').style.width = `${pred.score ?? 0}%`;
  $('metric-score-note').textContent = pred.score == null ? '필수 기상자료 부족 · 산정 불가' : pred.active ? `표시 기준 ${state.threshold}점 충족` : `표시 기준 ${state.threshold}점 미충족`;
  const delta = hour.temperature == null || hour.seaTemperature == null ? null : hour.temperature - hour.seaTemperature;
  $('metric-delta').innerHTML = `${delta > 0 ? '+' : ''}${fmt(delta)}<small> °C</small>`;
  $('metric-temperatures').textContent = `기온 ${fmt(hour.temperature)}° · 해수면 ${fmt(hour.seaTemperature)}°`;
  $('metric-humidity').innerHTML = `${fmt(hour.humidity, 0)}<small> %</small>`;
  $('metric-wind').textContent = `${compass(hour.windDirection)}풍 ${fmt(hour.windDirection, 0)}° · ${fmt(hour.windSpeed)}m/s`;
  $('metric-top').innerHTML = pred.top.height != null ? `${pred.top.height}<small> m</small>` : '<span style="font-size:23px">미확정</span>';
  $('metric-top-range').textContent = pred.top.range ? `추정 범위 ${pred.top.range[0]}–${pred.top.range[1]}m` : pred.top.status === 'open' ? `${pred.top.lowerBound}m까지 습윤층 지속` : pred.top.status === 'not-saturated' ? '지상 습도 90% 미만' : '유효한 연직 자료 부족';
  $('conditions-time').textContent = `${point.name} · ${state.date.replaceAll('-', '.')} ${hour.time.slice(11)} KST`;
  renderTimeline(); renderFactors(pred);
}

function renderPoints() {
  const time = current()?.time;
  if (!time) return;
  const summaries = VIEWPOINTS.map(p => {
    const point = savedPoint(p), entry = pointMode === state.mode ? pointData.get(p.id) : null;
    const pred = p.id === state.viewpoint.id ? prediction() : pointPrediction(entry?.data, time, state.threshold);
    return { point, entry, pred, status: pred ? classifyViewpoint(pred, point.altitude) : { key: 'unknown', label: entry?.error ? '조회 실패' : entry?.loading || !entry ? '자료 조회 중' : '해당 시간 자료 없음' } };
  });
  markers.forEach((marker, i) => {
    const { point, pred, status } = summaries[i];
    const detail = `${point.name} · ${pred?.score == null ? '점수 미확정' : `${pred.score}점 · ${pred.active ? '해무 조건 충족' : '기준 미달'}`} · ${status.label}`;
    marker.setIcon(markerIcon(i, status.key, pred?.active));
    marker.setTooltipContent(detail);
    marker.getElement()?.setAttribute('aria-label', detail);
  });
  const focusedId = document.activeElement?.closest('[data-point-id]')?.dataset.pointId;
  $('viewpoint-list').replaceChildren(...summaries.map(({ point, pred, status }) => {
    const button = document.createElement('button');
    button.dataset.pointId = point.id;
    button.className = `point-button ${point.id === state.viewpoint.id ? 'selected' : ''} ${pred?.active ? 'fog-active' : ''}`;
    button.setAttribute('aria-pressed', String(point.id === state.viewpoint.id));
    button.setAttribute('aria-label', `${point.name}, ${pred?.score == null ? '점수 미확정' : `${pred.score}점`}, ${status.label}`);
    button.innerHTML = `<span class="point-color ${status.key}"></span><span class="point-name">${point.name}<small>${pred?.active ? '≋ 해무 조건 충족' : status.label}</small></span><span class="point-altitude">${pred?.score ?? '—'}점<small>${point.altitude == null ? '고도 미입력' : `${point.altitude}m`}</small></span><span class="point-arrow">›</span>`;
    button.addEventListener('click', () => selectPoint(point.id)); return button;
  }));
  if (focusedId) $('viewpoint-list').querySelector(`[data-point-id="${focusedId}"]`)?.focus({ preventScroll: true });
  const pending = summaries.filter(s => !s.pred && s.entry?.loading).length;
  const failed = summaries.filter(s => !s.pred && s.entry?.error).length;
  const available = summaries.filter(s => s.pred?.score != null).length;
  $('map-points-status').textContent = `${time.slice(11)} · ${available}/5 지점 산정${pending ? ` · ${pending}개 조회 중` : ''}${failed ? ` · ${failed}개 조회 실패` : ''} · ≋ 기준 충족 지점`;
  $('retry-points').hidden = !failed;
}

function renderAltitude(pred, point) {
  const range = pred.active ? pred.top.range : null;
  const max = Math.max(750, range ? range[1] + 80 : 0, (point.altitude ?? 0) + 100);
  const y = altitude => 102 - Math.min(1, altitude / max) * 83;
  const fog = range ? `<rect x="35" y="${y(range[1])}" width="205" height="${102 - y(range[1])}" fill="#e5efec"/><rect x="35" y="${y(range[1])}" width="205" height="${y(range[0]) - y(range[1])}" fill="#d1e5df" opacity=".65"/><line x1="35" x2="240" y1="${y(pred.top.height)}" y2="${y(pred.top.height)}" stroke="#85a99c" stroke-dasharray="4 3"/><text x="238" y="${Math.max(12, y(range[1]) - 5)}" text-anchor="end" fill="#77958a" font-size="8">해무 상단 ${range[0]}–${range[1]}m</text>` : `<text x="140" y="48" text-anchor="middle" fill="#9baaa5" font-size="9">${pred.active ? '해무층 상단 미확정' : '표시할 해무층 없음'}</text>`;
  const pointGraphic = point.altitude == null ? '<text x="140" y="82" text-anchor="middle" fill="#77958a" font-size="9">선택 지점 고도 미확인</text>' : `<line x1="35" x2="240" y1="${y(point.altitude)}" y2="${y(point.altitude)}" stroke="#338575"/><circle cx="73" cy="${y(point.altitude)}" r="4" fill="#247d6e" stroke="white" stroke-width="2"/><text x="82" y="${y(point.altitude) - 5}" fill="#287c6c" font-size="9" font-weight="600">선택 지점 ${point.altitude}m</text>`;
  $('altitude-view').innerHTML = `<svg viewBox="0 0 250 115" role="img" aria-label="${point.altitude == null ? '선택 지점 고도 미확인' : `지점 ${point.altitude}m`}, ${range ? `추정 해무 상단 ${range[0]}에서 ${range[1]}m` : '해무층 높이 미확정'}"><line x1="35" x2="240" y1="102" y2="102" stroke="#d8e2dd"/><text x="2" y="105" font-size="8" fill="#a0afa9">0m</text><line x1="35" x2="35" y1="16" y2="102" stroke="#e5ece7"/>${fog}${pointGraphic}</svg>`;
}

function renderTimeline() {
  const day = hours(), predictions = day.map(h => predictFog(h, state.threshold));
  const w = 1100, h = 120, left = 26, right = 12, top = 10, bottom = 100;
  const x = i => left + (i + .5) * (w - left - right) / day.length;
  const y = score => bottom - score / 100 * (bottom - top);
  // Break paths at missing inputs rather than implying zero or bridging gaps.
  const segments = []; let segment = [];
  predictions.forEach((p, i) => { if (p.score == null) { if (segment.length) segments.push(segment); segment = []; } else segment.push([x(i), y(p.score)]); }); if (segment.length) segments.push(segment);
  const paths = segments.map(points => { const line = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join(' '); return `<path d="${line}L${points.at(-1)[0]},${bottom}L${points[0][0]},${bottom}Z" fill="url(#area)"/><path d="${line}" fill="none" stroke="#478f80" stroke-width="2"/>`; }).join('');
  const grid = [0, 50, 100].map(v => `<line x1="${left}" x2="${w}" y1="${y(v)}" y2="${y(v)}" stroke="#edf1ee"/><text x="0" y="${y(v) + 3}" font-size="8" fill="#a3b0aa">${v}</text>`).join('');
  const active = predictions[state.index];
  $('chart').innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${state.date} 시간별 해무 조건 점수. 아래 시간 버튼으로 상세 값을 확인하세요."><defs><linearGradient id="area" x2="0" y2="1"><stop stop-color="#aadbc9" stop-opacity=".5"/><stop offset="1" stop-color="#ecf6ee" stop-opacity=".2"/></linearGradient></defs>${grid}<line x1="${left}" x2="${w}" y1="${y(state.threshold)}" y2="${y(state.threshold)}" stroke="#b8c9c1" stroke-dasharray="4 4"/>${paths}<line x1="${x(state.index)}" x2="${x(state.index)}" y1="0" y2="${bottom}" stroke="#2a7567" stroke-dasharray="3 3"/>${active?.score != null ? `<circle cx="${x(state.index)}" cy="${y(active.score)}" r="4" fill="#1e7165" stroke="white" stroke-width="2"/>` : ''}</svg>`;
  const fragment = document.createDocumentFragment();
  day.forEach((hour, index) => { const button = document.createElement('button'); button.textContent = hour.time.slice(11, 13); button.className = predictions[index].active ? 'high' : ''; button.setAttribute('aria-pressed', String(index === state.index)); button.setAttribute('aria-label', `${hour.time.slice(11)}, 조건 점수 ${predictions[index].score ?? '자료 부족'}`); button.addEventListener('click', () => { stopPlay(); state.index = index; render(); $('hour-buttons').children[index].focus({ preventScroll: true }); }); fragment.append(button); });
  $('hour-buttons').replaceChildren(fragment);
  const activeHours = predictions.filter(p => p.active).length, missing = predictions.filter(p => p.score == null).length;
  $('day-summary').textContent = `기준 충족 ${activeHours}시간${missing ? ` · 결측 ${missing}시간` : ' / 24시간'}`;
}
function renderFactors(pred) {
  $('factor-list').replaceChildren(...pred.factors.map(f => { const div = document.createElement('div'); div.className = 'factor'; div.innerHTML = `<span>${f.label}</span><span class="factor-track"><i style="width:${f.points / f.weight * 100}%"></i></span><strong>${fmt(f.points)} / ${f.weight}</strong>`; return div; }));
}
function exportCSV() {
  const point = state.viewpoint;
  const rows = [['time_kst','latitude','longitude','point_name','point_altitude_m','air_temperature_c','sea_temperature_c','humidity_percent','dew_point_c','wind_speed_ms','wind_direction_deg','condition_score','threshold','fog_conditions_met','top_height_m','top_range_low_m','top_range_high_m','top_status','viewpoint_state']];
  for (const h of hours()) { const p = predictFog(h, state.threshold); rows.push([h.time,point.lat,point.lon,point.name,point.altitude,h.temperature,h.seaTemperature,h.humidity,h.dewPoint,h.windSpeed,h.windDirection,p.score,state.threshold,p.active,p.top.height,p.top.range?.[0],p.top.range?.[1],p.top.status,classifyViewpoint(p, point.altitude).key]); }
  const blob = new Blob(['\uFEFF' + rows.map(row => row.map(v => v ?? '').join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `onseafog-${state.mode}-${state.date}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('archive-button').addEventListener('click', () => load('archive'));
$('forecast-button').addEventListener('click', () => load('forecast'));
$('refresh-button').addEventListener('click', () => load(state.mode, state.viewpoint, true));
$('retry-points').addEventListener('click', () => loadMapPoints(state.mode, true));
$('altitude-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!state.dataset) return;
  try {
    const altitude = parseAltitude($('altitude-input').value);
    let altitudeStored = true;
    try { localStorage.setItem(altitudeKey(state.viewpoint), String(altitude)); } catch { altitudeStored = false; }
    const value = { altitude, userAltitude: true, altitudeStored };
    memoryAltitudes.set(altitudeKey(state.viewpoint), value);
    state.viewpoint = { ...state.viewpoint, ...value };
    $('altitude-input').value = altitude;
    $('altitude-feedback').textContent = altitudeStored ? '이 좌표의 고도를 저장했습니다.' : '브라우저 저장소를 사용할 수 없어 현재 화면에만 적용했습니다.';
    render();
  } catch (error) { $('altitude-feedback').textContent = error.message; }
});
$('clear-altitude').addEventListener('click', () => {
  if (!state.dataset) return;
  try { localStorage.removeItem(altitudeKey(state.viewpoint)); }
  catch { $('altitude-feedback').textContent = '저장소에 접근할 수 없어 저장값을 삭제하지 못했습니다.'; return; }
  memoryAltitudes.delete(altitudeKey(state.viewpoint));
  const preset = VIEWPOINTS.find(point => point.id === state.viewpoint.id);
  state.viewpoint = { ...state.viewpoint, altitude: preset?.altitude ?? null, userAltitude: false, altitudeStored: false };
  $('altitude-input').value = state.viewpoint.altitude ?? '';
  $('altitude-feedback').textContent = '저장한 고도를 삭제하고 기본값으로 되돌렸습니다.';
  render();
});
$('retry-button').addEventListener('click', () => load(state.requestedMode, state.requestedPoint));
$('default-point').addEventListener('click', () => load(state.requestedMode, DEFAULT_POINT));
$('date-select').addEventListener('change', e => { stopPlay(); state.date = e.target.value; state.index = Math.min(state.index, hours().length - 1); render(); });
$('threshold').addEventListener('input', e => { state.threshold = Number(e.target.value); render(); });
$('play-button').addEventListener('click', () => { if (state.timer) { stopPlay(); return; } $('play-button').textContent = 'Ⅱ 재생 멈춤'; $('play-button').setAttribute('aria-pressed', 'true'); state.timer = setInterval(() => { state.index = (state.index + 1) % hours().length; render(); }, 1200); });
$('export-button').addEventListener('click', exportCSV);
for (const id of ['about-button', 'method-button', 'score-info']) $(id).addEventListener('click', () => $('model-dialog').showModal());
$('close-dialog').addEventListener('click', () => $('model-dialog').close());
$('model-dialog').addEventListener('click', e => { if (e.target === $('model-dialog') && (e.clientX < e.target.getBoundingClientRect().left || e.clientX > e.target.getBoundingClientRect().right || e.clientY < e.target.getBoundingClientRect().top || e.clientY > e.target.getBoundingClientRect().bottom)) e.target.close(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlay(); });
initMap(); load('archive');
