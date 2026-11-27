import test from 'node:test';
import assert from 'node:assert/strict';
import { createPointWeather, pointPrediction } from '../public/point-weather.js';
import { altitudeKey, parseAltitude, withSavedAltitude } from '../public/altitude-store.js';
import { VIEWPOINTS, coastReferenceDistance } from '../model/viewpoints.js';

const a = { lat: 35.15, lon: 129.14, altitude: null }, b = { lat: 35.16, lon: 129.15, altitude: null };
const data = value => ({ hours: [{ time: '2026-07-01T01:00', temperature: value, seaTemperature: 22, humidity: 95, dewPoint: value, windDirection: 135, windSpeed: 3, profile: [] }] });

test('point datasets stay isolated by coordinate and mode; cache expires and refresh bypasses cache', async () => {
  let time = 0; const calls = [];
  const cache = createPointWeather(async (mode, point) => { calls.push([mode, point]); return data(point.lat === a.lat ? 26 : 21); }, () => time);
  const first = await cache.get('forecast', a);
  assert.equal(await cache.get('forecast', a), first);
  const second = await cache.get('forecast', b);
  assert.equal(pointPrediction(first, '2026-07-01T01:00', 65).score, 100);
  assert.ok(pointPrediction(second, '2026-07-01T01:00', 65).score <= 39);
  assert.equal(pointPrediction(second, '2026-07-01T02:00', 65), null);
  await cache.get('archive', a); assert.equal(calls.length, 3);
  time = 300001; await cache.get('forecast', a); assert.equal(calls.length, 4);
  await cache.get('archive', a); assert.equal(calls.length, 4);
  await cache.get('archive', a, true); assert.equal(calls.length, 5);
  time = 86700002; await cache.get('archive', a); assert.equal(calls.length, 6);
});

test('concurrent point requests share work and failed requests can retry', async () => {
  let resolve, calls = 0;
  const cache = createPointWeather(() => { calls++; return new Promise(r => { resolve = r; }); });
  const first = cache.get('archive', a), second = cache.get('archive', a);
  assert.equal(calls, 1); resolve(data(26));
  assert.equal(await first, await second);
  let attempts = 0;
  const retry = createPointWeather(async () => ++attempts === 1 ? { hours: [] } : data(26));
  await assert.rejects(retry.get('archive', a), /시간별 자료/);
  assert.equal((await retry.get('archive', a)).hours.length, 1);
});

test('saved observer altitude is coordinate-specific, accepts sea level, and survives invalid storage', () => {
  const values = new Map([[altitudeKey(a), '0']]);
  const storage = { getItem: key => values.get(key) ?? null };
  assert.deepEqual(withSavedAltitude(a, storage), { ...a, altitude: 0, userAltitude: true, altitudeStored: true });
  assert.equal(withSavedAltitude(b, storage).altitude, null);
  for (const value of ['', 'bad', '-1', '2001', 'Infinity']) assert.throws(() => parseAltitude(value));
  assert.equal(parseAltitude('123.456'), 123.5);
  values.set(altitudeKey(a), 'bad'); assert.equal(withSavedAltitude(a, storage).altitude, null);
  assert.equal(withSavedAltitude(a, { getItem() { throw new Error('blocked'); } }).altitude, null);
});

test('coastal presets distinguish building height from observer altitude', () => {
  assert.equal(VIEWPOINTS.length, 5);
  for (const point of VIEWPOINTS) assert.ok(coastReferenceDistance(point) < 1000);
  for (const id of ['ipark', 'exllu', 'lct']) assert.equal(VIEWPOINTS.find(p => p.id === id).altitude, null);
  assert.equal(VIEWPOINTS.find(p => p.id === 'ipark').buildingHeight, 292);
  assert.equal(VIEWPOINTS.filter(p => p.type === '저고도 해변').length, 2);
});
