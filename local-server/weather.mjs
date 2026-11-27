export const LOCATION = { latitude: 35.1595, longitude: 129.1604 };
export const LEVELS = [1000, 975, 950, 925, 900, 850];
const surfaceVariables = ['temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 'wind_speed_10m', 'wind_direction_10m'];
const profileVariables = LEVELS.flatMap(p => [`relative_humidity_${p}hPa`, `geopotential_height_${p}hPa`]);
// Shared across coordinates: preset updates must not create an upstream burst.
let active = 0;
const waiting = [];
export async function getJson(url, fetcher = fetch) {
  if (active >= 2) await new Promise(resolve => waiting.push(resolve));
  else active++;
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'OnSeafog-local/1.0' } });
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(result.reason || 'Open-Meteo error');
    return result;
  } finally {
    if (waiting.length) waiting.shift()();
    else active--;
  }
}
export function weatherUrls(start, end, forecast = false, location = LOCATION) {
  if (forecast) {
    const common = { ...location, forecast_hours: '48', timezone: 'Asia/Seoul' };
    const atmosphere = new URL('https://api.open-meteo.com/v1/forecast');
    atmosphere.search = new URLSearchParams({ ...common, models: 'jma_msm', hourly: surfaceVariables.join(','), wind_speed_unit: 'ms' });
    const supplement = new URL('https://api.open-meteo.com/v1/forecast');
    supplement.search = new URLSearchParams({ ...common, hourly: ['visibility', ...profileVariables].join(',') });
    const marine = new URL('https://marine-api.open-meteo.com/v1/marine');
    marine.search = new URLSearchParams({ ...common, hourly: 'sea_surface_temperature', cell_selection: 'sea' });
    return { atmosphere: atmosphere.href, supplement: supplement.href, marine: marine.href };
  }
  const variables = [...surfaceVariables, ...profileVariables];
  const atmosphere = new URL('https://historical-forecast-api.open-meteo.com/v1/forecast');
  atmosphere.search = new URLSearchParams({ ...location, start_date: start, end_date: end, hourly: variables.join(','), models: 'gfs_seamless', timezone: 'Asia/Seoul', wind_speed_unit: 'ms', elevation: '0' });
  const marine = new URL('https://marine-api.open-meteo.com/v1/marine');
  const seaLocation = location === LOCATION ? { latitude: 35.12, longitude: 129.16 } : location;
  marine.search = new URLSearchParams({ ...seaLocation, start_date: start, end_date: end, hourly: 'sea_surface_temperature', timezone: 'Asia/Seoul', cell_selection: 'sea' });
  return { atmosphere: atmosphere.href, marine: marine.href };
}
const number = x => typeof x === 'number' && Number.isFinite(x) ? x : null;
export function normalizeWeather(atmosphere, marine, supplement = atmosphere) {
  if (!atmosphere.hourly?.time?.length || atmosphere.timezone !== 'Asia/Seoul') throw new Error('Invalid atmosphere time series / timezone');
  const h = atmosphere.hourly;
  const sea = new Map((marine?.hourly?.time ?? []).map((t, i) => [t, number(marine.hourly.sea_surface_temperature?.[i])]));
  const extra = supplement?.hourly;
  const extraIndex = new Map((extra?.time ?? []).map((t, i) => [t, i]));
  return h.time.map((time, i) => ({
    time, temperature: number(h.temperature_2m?.[i]), humidity: number(h.relative_humidity_2m?.[i]), dewPoint: number(h.dew_point_2m?.[i]),
    windSpeed: number(h.wind_speed_10m?.[i]), windDirection: number(h.wind_direction_10m?.[i]), seaTemperature: sea.get(time) ?? null,
    visibility: number(extra?.visibility?.[extraIndex.get(time)]),
    profile: LEVELS.map(pressure => ({ pressure, height: number(extra?.[`geopotential_height_${pressure}hPa`]?.[extraIndex.get(time)]), humidity: number(extra?.[`relative_humidity_${pressure}hPa`]?.[extraIndex.get(time)]) })),
  }));
}
export async function fetchWeather(start, end, forecast = false, fetcher = fetch, location = LOCATION) {
  const urls = weatherUrls(start, end, forecast, location);
  const valid = async url => {
    const data = await getJson(url, fetcher);
    if (data.timezone !== 'Asia/Seoul' || !data.hourly?.time?.length) throw new Error('Invalid Open-Meteo time series / timezone');
    return data;
  };
  const [a, m, s] = await Promise.allSettled([getJson(urls.atmosphere, fetcher), forecast ? valid(urls.marine) : getJson(urls.marine, fetcher), ...(forecast ? [valid(urls.supplement)] : [])]);
  if (a.status === 'rejected') throw a.reason;
  const marine = m.status === 'fulfilled' ? m.value : null;
  const supplement = forecast ? (s.status === 'fulfilled' ? s.value : null) : a.value;
  const warnings = marine ? [] : ['해수면 온도 API 조회 실패: 해무 점수를 계산하지 않습니다.'];
  if (forecast) warnings.push('가시거리·고도별 습도는 Open-Meteo 기본 모델, 수온은 해양 모델입니다. 모든 자료가 5km인 것은 아닙니다.');
  if (forecast && !supplement) warnings.push('기본 모델 조회 실패: 가시거리·해무층 높이를 미확정으로 표시합니다.');
  const grid = data => data ? { latitude: data.latitude, longitude: data.longitude } : null;
  return { schemaVersion: 1, provider: 'Open-Meteo', model: forecast ? 'JMA MSM' : 'GFS', resolutionKm: forecast ? 5 : 13, profileResolutionKm: forecast ? null : 25, fetchedAt: new Date().toISOString(), mode: forecast ? 'forecast' : 'archive', timezone: 'Asia/Seoul', requestedLocation: { ...location }, sources: urls,
    grids: { atmosphere: grid(a.value), marine: grid(marine), ...(forecast ? { supplement: grid(supplement) } : {}) },
    warnings, hours: normalizeWeather(a.value, marine, supplement) };
}
