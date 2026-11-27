import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWeather, fetchWeather, weatherUrls, LEVELS } from '../local-server/weather.mjs';

const atmosphere = () => ({ timezone: 'Asia/Seoul', hourly: { time: ['2026-07-01T00:00', '2026-07-01T01:00'], temperature_2m: [24, null], relative_humidity_2m: [95, 94] } });
test('SST joins by KST timestamp instead of array position; missing values remain null', () => {
  const hours = normalizeWeather(atmosphere(), { hourly: { time: ['2026-07-01T01:00'], sea_surface_temperature: [22] } });
  assert.equal(hours[0].seaTemperature, null); assert.equal(hours[1].seaTemperature, 22);
  assert.equal(hours[1].temperature, null); assert.equal(hours[0].windSpeed, null);
  assert.equal(hours[0].profile.length, LEVELS.length); assert.equal(hours[0].profile[0].height, null);
  assert.throws(() => normalizeWeather({ ...atmosphere(), timezone: 'GMT' }, null), /timezone/);
});
test('query fixes GFS, KST, metres per second and pressure-level inputs', () => {
  const urls = weatherUrls('2026-07-01', '2026-07-31');
  const a = new URL(urls.atmosphere), m = new URL(urls.marine);
  assert.equal(a.searchParams.get('models'), 'gfs_seamless'); assert.equal(a.searchParams.get('wind_speed_unit'), 'ms');
  assert.equal(a.searchParams.get('timezone'), 'Asia/Seoul'); assert.ok(a.searchParams.get('hourly').includes('geopotential_height_850hPa'));
  assert.equal(m.searchParams.get('cell_selection'), 'sea');
});
test('marine outage preserves atmosphere and marks SST unknown with a warning', async () => {
  const fetcher = async url => url.includes('marine-api') ? { ok: false, status: 503 } : { ok: true, json: async () => atmosphere() };
  const result = await fetchWeather('2026-07-01', '2026-07-01', false, fetcher);
  assert.equal(result.hours[0].seaTemperature, null); assert.equal(result.warnings.length, 1);
  await assert.rejects(fetchWeather('2026-07-01', '2026-07-01', false, async () => ({ ok: false, status: 503 })), /HTTP 503/);
});

test('selected coordinates reach both providers and are preserved in metadata', async () => {
  const location = { latitude: 35.25, longitude: 129.25 }, seen = [];
  const fetcher = async url => {
    seen.push(new URL(url));
    return { ok: true, json: async () => url.includes('marine-api') ? { latitude: 35.3, longitude: 129.3, hourly: { time: ['2026-07-01T00:00'], sea_surface_temperature: [22] } } : { ...atmosphere(), latitude: 35.2, longitude: 129.2 } };
  };
  const result = await fetchWeather('2026-07-01', '2026-07-31', false, fetcher, location);
  for (const url of seen) {
    assert.equal(url.searchParams.get('latitude'), '35.25');
    assert.equal(url.searchParams.get('longitude'), '129.25');
  }
  assert.deepEqual(result.requestedLocation, location);
  assert.deepEqual(result.grids.atmosphere, { latitude: 35.2, longitude: 129.2 });
  assert.equal(result.hours[0].seaTemperature, 22);
});

test('forecast selects MSM surface, default visibility/profile and Marine SST for 48 KST hours', () => {
  const urls = weatherUrls(null, null, true, { latitude: 35.17, longitude: 129.12 });
  const a = new URL(urls.atmosphere), s = new URL(urls.supplement), m = new URL(urls.marine);
  for (const u of [a, s, m]) {
    assert.equal(u.searchParams.get('forecast_hours'), '48');
    assert.equal(u.searchParams.get('timezone'), 'Asia/Seoul');
    assert.equal(u.searchParams.get('latitude'), '35.17');
  }
  assert.equal(a.searchParams.get('models'), 'jma_msm');
  assert.equal(a.searchParams.get('wind_speed_unit'), 'ms');
  assert.equal(a.searchParams.get('hourly').split(',').length, 5);
  assert.equal(s.searchParams.has('models'), false);
  assert.ok(s.searchParams.get('hourly').includes('visibility'));
  for (const p of LEVELS) assert.ok(s.searchParams.get('hourly').includes(`geopotential_height_${p}hPa`));
  assert.equal(m.searchParams.get('hourly'), 'sea_surface_temperature');
  assert.equal(m.searchParams.get('cell_selection'), 'sea');
});

const forecastResponse = url => {
  const data = { ...atmosphere(), latitude: 35.15, longitude: 129.1875 };
  const params = new URL(url).searchParams;
  if (url.includes('marine-api')) data.hourly = { time: ['2026-07-01T01:00'], sea_surface_temperature: [22] };
  else if (!params.has('models')) data.hourly = {
    time: ['2026-07-01T01:00', '2026-07-01T00:00'], visibility: [1000, 2000],
    relative_humidity_1000hPa: [85, 95], geopotential_height_1000hPa: [100, 110],
  };
  return data;
};
test('three forecast sources join by timestamp and preserve provenance and missing values', async () => {
  const result = await fetchWeather(null, null, true, async url => ({ ok: true, json: async () => forecastResponse(url) }));
  assert.equal(result.model, 'JMA MSM'); assert.equal(result.resolutionKm, 5);
  assert.equal(result.profileResolutionKm, null);
  assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
  assert.equal(result.hours[0].visibility, 2000);
  assert.equal(result.hours[0].profile[0].humidity, 95);
  assert.equal(result.hours[0].profile[0].height, 110);
  assert.equal(result.hours[1].visibility, 1000);
  assert.equal(result.hours[0].seaTemperature, null);
  assert.equal(result.hours[1].seaTemperature, 22);
  assert.equal(result.hours[0].profile[1].height, null);
  assert.equal(Object.keys(result.sources).length, 3);
  assert.equal(result.grids.atmosphere.longitude, 129.1875);
});
test('forecast partial outages leave SST, visibility and profile unknown; atmosphere failure rejects', async () => {
  const result = await fetchWeather(null, null, true, async url => new URL(url).searchParams.get('models') === 'jma_msm'
    ? { ok: true, json: async () => forecastResponse(url) } : { ok: false, status: 503 });
  assert.equal(result.hours[0].temperature, 24);
  assert.equal(result.hours[0].seaTemperature, null);
  assert.equal(result.hours[0].visibility, null);
  assert.equal(result.hours[0].profile[0].height, null);
  assert.equal(result.warnings.length, 3);
  await assert.rejects(fetchWeather(null, null, true, async () => ({ ok: false, status: 503 })), /HTTP 503/);
});
test('all points share a maximum of two concurrent Open-Meteo requests', async () => {
  let active = 0, peak = 0, calls = 0;
  const fetcher = async url => {
    active++; peak = Math.max(peak, active); calls++;
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return { ok: true, json: async () => forecastResponse(url) };
  };
  await Promise.all([fetchWeather(null, null, true, fetcher), fetchWeather(null, null, true, fetcher, { latitude: 35.2, longitude: 129.1 })]);
  assert.equal(calls, 6); assert.equal(peak, 2); assert.equal(active, 0);
});
