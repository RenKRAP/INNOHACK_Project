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
  assert.match(weatherUrls('2026-11-27', '2026-11-29', true).atmosphere, /^https:\/\/api.open-meteo/);
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
