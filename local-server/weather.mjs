export const LOCATION = { latitude: 35.1595, longitude: 129.1604 };
export const LEVELS = [1000, 975, 950, 925, 900, 850];
export async function getJson(url, fetcher = fetch) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'OnSeafog-local/1.0' } });
  if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
  const result = await response.json();
  if (result.error) throw new Error(result.reason || 'Open-Meteo error');
  return result;
}
export function weatherUrls(start, end, forecast = false, location = LOCATION) {
  const variables = ['temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 'wind_speed_10m', 'wind_direction_10m', ...LEVELS.flatMap(p => [`relative_humidity_${p}hPa`, `geopotential_height_${p}hPa`])];
  const atmosphere = new URL(forecast ? 'https://api.open-meteo.com/v1/forecast' : 'https://historical-forecast-api.open-meteo.com/v1/forecast');
  atmosphere.search = new URLSearchParams({ ...location, start_date: start, end_date: end, hourly: variables.join(','), models: 'gfs_seamless', timezone: 'Asia/Seoul', wind_speed_unit: 'ms', elevation: '0' });
  const marine = new URL('https://marine-api.open-meteo.com/v1/marine');
  const seaLocation = location === LOCATION ? { latitude: 35.12, longitude: 129.16 } : location;
  marine.search = new URLSearchParams({ ...seaLocation, start_date: start, end_date: end, hourly: 'sea_surface_temperature', timezone: 'Asia/Seoul', cell_selection: 'sea' });
  return { atmosphere: atmosphere.href, marine: marine.href };
}
const number = x => typeof x === 'number' && Number.isFinite(x) ? x : null;
export function normalizeWeather(atmosphere, marine) {
  if (!atmosphere.hourly?.time?.length || atmosphere.timezone !== 'Asia/Seoul') throw new Error('Invalid atmosphere time series / timezone');
  const h = atmosphere.hourly;
  const sea = new Map((marine?.hourly?.time ?? []).map((t, i) => [t, number(marine.hourly.sea_surface_temperature?.[i])]));
  return h.time.map((time, i) => ({
    time, temperature: number(h.temperature_2m?.[i]), humidity: number(h.relative_humidity_2m?.[i]), dewPoint: number(h.dew_point_2m?.[i]),
    windSpeed: number(h.wind_speed_10m?.[i]), windDirection: number(h.wind_direction_10m?.[i]), seaTemperature: sea.get(time) ?? null,
    profile: LEVELS.map(pressure => ({ pressure, height: number(h[`geopotential_height_${pressure}hPa`]?.[i]), humidity: number(h[`relative_humidity_${pressure}hPa`]?.[i]) })),
  }));
}
export async function fetchWeather(start, end, forecast = false, fetcher = fetch, location = LOCATION) {
  const urls = weatherUrls(start, end, forecast, location);
  const [a, m] = await Promise.allSettled([getJson(urls.atmosphere, fetcher), getJson(urls.marine, fetcher)]);
  if (a.status === 'rejected') throw a.reason;
  const marine = m.status === 'fulfilled' ? m.value : null;
  return { schemaVersion: 1, fetchedAt: new Date().toISOString(), mode: forecast ? 'forecast' : 'archive', timezone: 'Asia/Seoul', requestedLocation: { ...location }, sources: urls,
    grids: { atmosphere: { latitude: a.value.latitude, longitude: a.value.longitude }, marine: marine ? { latitude: marine.latitude, longitude: marine.longitude } : null },
    warnings: marine ? [] : ['해수면 온도 API 조회 실패: 해무 점수를 계산하지 않습니다.'], hours: normalizeWeather(a.value, marine) };
}
