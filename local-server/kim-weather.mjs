// KMA API Hub KIM-LDAPS: native 1 km, hourly output, 48-hour forecasts.
// Authentication stays on the local server. Never persist a keyed request URL.
export const KIM_ENDPOINT = 'https://apihub.kma.go.kr/api/typ06/url/nwp_nc_tser_down.php';
const LEVELS = [1000, 975, 950, 925, 900, 850];
const HOUR = 3600000;
export class WeatherError extends Error {
  constructor(code, message, status = 502) { super(message); this.code = code; this.status = status; }
}
const failure = (code, message, status) => new WeatherError(code, message, status);
const formatError = () => failure('KMA_FORMAT', '기상청 응답 형식을 해석할 수 없습니다. 자료 열 이름·시간·변수 단위를 확인해야 합니다.');
const normalize = s => s.toLowerCase().replace(/[\s_()[\]°%-]/g, '');
const aliases = {
  lead: ['hf', 'ft', 'lead', 'leadhour', 'forecastHour', '예측시간', '예보시간'],
  time: ['time', 'tm', 'tmf', 'tmef', 'validtime', 'datetime', '예측시각', '예보시각', '일시'],
  value: ['value', 'val', 'data', '값', '자료값'],
};
// CSV splitting preserves quoted fields; whitespace-delimited TEXT is also accepted.
function fields(line) {
  if (!line.includes(',')) return line.trim().split(/\s+/);
  const result = []; let field = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (quoted && line[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { result.push(field.trim()); field = ''; }
    else field += c;
  }
  if (quoted) throw formatError();
  result.push(field.trim()); return result;
}
function utcTime(value) {
  const match = /^(\d{4})-?(\d{2})-?(\d{2})[T ]?(\d{2})(?::?(\d{2}))?(?::?(\d{2}))?Z?$/.exec(value);
  if (!match) return NaN;
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5] || '00'}:${match[6] || '00'}Z`;
  const time = Date.parse(iso);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 19) === iso.slice(0, 19) ? time : NaN;
}
function numerical(value) {
  if (value == null || /^(?:|nan|null|na|n\/a|--|\/|\*)$/i.test(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw formatError();
  return n <= -999 || Math.abs(n) >= 1e20 ? null : n;
}
/** Strict, header-based parser. Units come from the official KIM variable table:
 * T2/SST K, RH/RH2 %, GPH m, U10/V10 m/s. Unrecognized layouts fail closed.
 * Supports time rows (HF,T2) and transposed rows (VAR,0,1,...).
 */
export function parseKimSeries(text, variable, runTime) {
  if (/(?:no\s*data|자료\s*없|자료가\s*없|파일.*없|데이터.*없)/i.test(text)) throw failure('KMA_NO_DATA', '해당 기상청 예보 발행 자료가 아직 없습니다.');
  if (/(?:auth|인증|권한|승인|구독)/i.test(text) && /(?:error|오류|실패|없|invalid|denied)/i.test(text)) throw failure('KMA_AUTH', '기상청 API 인증 또는 자료 이용 권한을 확인하세요.', 503);
  // API Hub sometimes returns a CGI failure with HTTP 200 instead of CSV.
  if (/^\s*#\s*(?:오류|error)\s*:\s*CGI\b/im.test(text)) throw failure('KMA_TEMPORARY', '기상청 자료 처리 중 일시적인 오류가 발생했습니다. 잠시 후 다시 조회해 주세요.');
  if (/^\s*#\s*(?:오류|error)\s*:/im.test(text)) throw formatError();
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const result = new Map(); let header, leadCol = -1, timeCol = -1, runCol = -1, valueCol = -1, wide = false;
  const match = (cols, list) => cols.findIndex(c => list.map(normalize).includes(normalize(c)));
  for (const line of lines) {
    const cols = fields(line.replace(/^#\s*/, ''));
    if (!header) {
      leadCol = match(cols, aliases.lead); timeCol = match(cols, aliases.time);
      runCol = match(cols, ['tmfc']);
      valueCol = match(cols, [variable, ...aliases.value]);
      if ((leadCol >= 0 || timeCol >= 0) && valueCol >= 0) { header = cols; continue; }
      if (cols.length > 2 && cols.slice(1).every(c => /^\d{1,2}$/.test(c))) { header = cols; wide = true; continue; }
      continue;
    }
    if (line.startsWith('#')) continue;
    if (wide) {
      if (normalize(cols[0]) !== normalize(variable)) continue;
      if (cols.length !== header.length) throw formatError();
      for (let i = 1; i < cols.length; i++) {
        const lead = Number(header[i]);
        if (result.has(lead)) throw formatError();
        result.set(lead, numerical(cols[i]));
      }
      continue;
    }
    if (cols.length !== header.length) throw formatError();
    const lead = leadCol >= 0 ? Number(cols[leadCol]) : (utcTime(cols[timeCol]) - runTime) / HOUR;
    if (!Number.isInteger(lead) || lead < 0 || lead > 48 || (leadCol >= 0 && !cols[leadCol])) throw formatError();
    // Never combine a different issue cycle or mismatched valid time with this run.
    if (runCol >= 0 && utcTime(cols[runCol]) !== runTime) throw formatError();
    if (timeCol >= 0 && utcTime(cols[timeCol]) !== runTime + lead * HOUR) throw formatError();
    if (result.has(lead)) throw formatError();
    result.set(lead, numerical(cols[valueCol]));
  }
  if (!result.size || [...result.keys()].some(h => h < 0 || h > 48)) throw formatError();
  return result;
}
// A conservative 3-hour publication allowance, not a provider latency guarantee.
export function kimRun(now = new Date()) { return Math.floor((now.getTime() - 3 * HOUR) / (6 * HOUR)) * 6 * HOUR; }
const runStamp = ms => new Date(ms).toISOString().replace(/\D/g, '').slice(0, 10);
export function kimUrl(variable, pressure, runTime, location, key) {
  const url = new URL(KIM_ENDPOINT);
  // Explicit native model + TEXT matches the verified API Hub response contract.
  url.search = new URLSearchParams({ group: 'KIML', nwp: 'l010', data: pressure ? 'P' : 'U', vars: variable,
    tmfc: runStamp(runTime), hf1: '0', hf2: '48', hf_int: '1', lat: String(location.latitude), lon: String(location.longitude), dataType: 'TEXT', authKey: key,
    ...(pressure ? { lvl_lst: String(pressure) } : {}) });
  return url;
}
// Shared bound across concurrent selected/preset point requests.
let active = 0; const waiting = [];
async function limited(task) {
  if (active >= 2) await new Promise(resolve => waiting.push(resolve)); else active++;
  try { return await task(); }
  finally { const next = waiting.shift(); if (next) next(); else active--; }
}
async function download(variable, pressure, runTime, location, key, fetcher) {
  return limited(async () => {
    // Retry recognized CGI failures at the same point/run/field, at most twice.
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      // Live KIM responses can take about 31 seconds even with valid authorization.
      try { response = await fetcher(kimUrl(variable, pressure, runTime, location, key), { signal: AbortSignal.timeout(45000) }); }
      catch { throw failure('KMA_NETWORK', '기상청 1km 자료 연결이 지연되거나 실패했습니다. 다시 시도해 주세요.'); }
      if ([401, 403].includes(response.status)) throw failure('KMA_AUTH', '기상청 API 인증키와 KIM 자료 이용 신청 상태를 확인하세요.', 503);
      // API Hub documents HTTP 404 as an invalid API URL, not an absent cycle.
      if (!response.ok) throw failure('KMA_UPSTREAM', '기상청 1km 자료 서버가 오류를 반환했습니다. 잠시 후 다시 시도해 주세요.');
      let bytes;
      try { bytes = await response.arrayBuffer(); } catch { throw failure('KMA_NETWORK', '기상청 응답을 수신하지 못했습니다. 다시 시도해 주세요.'); }
      if (bytes.byteLength > 2000000) throw formatError();
      // Response.text() always uses UTF-8; API Hub declares EUC-KR for TEXT.
      const charset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(response.headers.get('content-type') || '')?.[1] || 'utf-8';
      let text;
      try { text = new TextDecoder(charset, { fatal: true }).decode(bytes); } catch { throw formatError(); }
      try { return parseKimSeries(text, variable, runTime); }
      catch (error) {
        if (error.code !== 'KMA_TEMPORARY' || attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  });
}
function convert(value, variable) {
  if (value == null) return null;
  const valid = ['T2', 'SST'].includes(variable) ? value >= 180 && value <= 340
    : ['RH', 'RH2'].includes(variable) ? value >= 0 && value <= 100
      : variable === 'GPH' ? value >= -1000 && value <= 10000 : Math.abs(value) <= 150;
  if (!valid) throw failure('KMA_UNITS', '기상청 변수의 단위 또는 값 범위가 예상과 다릅니다. 자료 변환을 확인해야 합니다.');
  return ['T2', 'SST'].includes(variable) ? value - 273.15 : value;
}
export function dewPoint(temperature, humidity) {
  if (temperature == null || humidity == null || humidity <= 0) return null;
  const gamma = Math.log(humidity / 100) + 17.625 * temperature / (243.04 + temperature);
  return 243.04 * gamma / (17.625 - gamma);
}
export async function fetchKimWeather(location, { fetcher = fetch, key = process.env.KMA_API_KEY, now = new Date() } = {}) {
  if (!key?.trim()) throw failure('KMA_KEY_REQUIRED', '1km 예보를 사용하려면 .env 또는 .env.local에 KMA_API_KEY를 설정하고 로컬 서버를 재시작하세요. 기상청 API허브에서 KIM 자료 이용 신청도 필요합니다. 7월 과거 분석은 키 없이 이용할 수 있습니다.', 503);
  key = key.trim();
  const requests = [['T2'], ['RH2'], ['U10'], ['V10'], ['SST'], ...LEVELS.flatMap(p => [['RH', p], ['GPH', p]])];
  let runTime = kimRun(now), series;
  // Probe one variable before spending the remaining point quota. Only absent runs fall back.
  for (let attempt = 0; attempt < 2; attempt++) {
    try { series = [await download('T2', undefined, runTime, location, key, fetcher)]; break; }
    catch (error) { if (error.code !== 'KMA_NO_DATA' || attempt === 1) throw error; runTime -= 6 * HOUR; }
  }
  const remaining = await Promise.allSettled(requests.slice(1).map(([v, p]) => download(v, p, runTime, location, key, fetcher)));
  // SST/profile omissions remain missing; authentication, format, and connectivity errors remain visible.
  const warnings = [];
  for (let i = 0; i < remaining.length; i++) {
    const item = remaining[i];
    if (item.status === 'fulfilled') series.push(item.value);
    else if (item.reason.code === 'KMA_NO_DATA' && i >= 3) { series.push(new Map()); warnings.push(`${requests[i + 1].join('/')} 자료 없음`); }
    else throw item.reason;
  }
  // Land cells can have no SST. Use an explicitly disclosed offshore KIM cell,
  // without substituting coarse GFS or interpolating missing temperatures.
  let seaRequestedLocation = { ...location }, offshoreSeries;
  if (Array.from({ length: 49 }, (_, h) => series[4].get(h)).some(v => v == null)) {
    seaRequestedLocation = location.longitude < 129.14
      ? { latitude: 35.14, longitude: 129.125 } : { latitude: 35.148, longitude: 129.165 };
    try { offshoreSeries = await download('SST', undefined, runTime, seaRequestedLocation, key, fetcher); }
    catch (error) { if (error.code !== 'KMA_NO_DATA') throw error; }
    if (offshoreSeries) {
      for (const [lead, value] of offshoreSeries) if (series[4].get(lead) == null) series[4].set(lead, value);
      warnings.push(`선택 격자 SST 결측은 연안 해상 참조점(${seaRequestedLocation.latitude}, ${seaRequestedLocation.longitude})의 동일 발행 KIM SST를 사용합니다.`);
    }
  }
  const at = (index, lead) => convert(series[index].get(lead), requests[index][0]);
  const hours = Array.from({ length: 49 }, (_, lead) => {
    const temperature = at(0, lead), humidity = at(1, lead), u = at(2, lead), v = at(3, lead);
    return { time: new Date(runTime + (lead + 9) * HOUR).toISOString().slice(0, 16), temperature, humidity,
      dewPoint: dewPoint(temperature, humidity), windSpeed: u == null || v == null ? null : Math.hypot(u, v),
      windDirection: u == null || v == null ? null : (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360,
      seaTemperature: at(4, lead), profile: LEVELS.map((pressure, i) => ({ pressure, humidity: at(5 + i * 2, lead), height: at(6 + i * 2, lead) })) };
  });
  const missingSea = hours.filter(h => h.seaTemperature == null).length;
  if (missingSea) warnings.push(`해수면 온도 결측 ${missingSea}시간: 육지 격자에서는 SST가 없을 수 있으며 해당 시간은 점수를 산정하지 않습니다.`);
  if (hours.some(h => h.temperature == null || h.humidity == null || h.windSpeed == null)) warnings.push('일부 시간의 필수 대기자료가 없습니다. 결측은 보간하지 않습니다.');
  return { schemaVersion: 2, mode: 'forecast', provider: 'KMA', model: 'KIM-LDAPS', resolutionKm: 1,
    fetchedAt: new Date().toISOString(), runAt: new Date(runTime).toISOString(), forecastHours: 48, timezone: 'Asia/Seoul',
    requestedLocation: { ...location }, seaRequestedLocation, sources: { atmosphere: KIM_ENDPOINT, marine: KIM_ENDPOINT },
    grids: { atmosphere: null, marine: null },
    gridSelection: 'nearest', warnings, hours,
    notes: ['위경도에 가장 가까운 KIM 1km 격자를 요청합니다. 실제 격자 중심 좌표는 응답에서 확인되지 않았습니다.', 'SST는 KIM 경계장으로, 1km 해수면 실측을 뜻하지 않습니다.', '기온·SST K→°C, U/V→풍속·기상학적 풍향, 기온·습도→Magnus 이슬점 변환.'] };
}
