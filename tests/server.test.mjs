import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createApp } from '../local-server/index.mjs';
import { WeatherError } from '../local-server/kim-weather.mjs';
import { OpenMeteoError } from '../local-server/weather.mjs';

test('Open-Meteo rate limits expose an actionable error instead of a generic network message', async t => {
  const base = await running(t, { weatherLoader: async () => {
    throw new OpenMeteoError('OPEN_METEO_RATE_LIMIT', 'Open-Meteo 요청 한도에 도달했습니다.', 503);
  } });
  const response = await fetch(base + '/api/weather?mode=forecast');
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, 'OPEN_METEO_RATE_LIMIT'); assert.match(body.error, /Open-Meteo/);
});

async function running(t, options) {
  const server = createApp(options); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('weather failure logs contain safe provider diagnostics, never raw upstream errors', async t => {
  const events = [];
  const error = new OpenMeteoError('OPEN_METEO_HTTP', 'Provider unavailable');
  Object.assign(error, { source: 'jma_msm', upstreamStatus: 403 });
  const base = await running(t, { reportError: event => events.push(event), weatherLoader: async () => { throw error; } });
  assert.equal((await fetch(base + '/api/weather')).status, 502);
  assert.deepEqual(events[0], { event: 'weather_api_failure', code: 'OPEN_METEO_HTTP', source: 'jma_msm', upstreamStatus: 403, networkCode: undefined });
  const other = await running(t, { reportError: event => events.push(event), weatherLoader: async () => { throw new Error('https://example.test?authKey=secret'); } });
  assert.equal((await fetch(other + '/api/weather')).status, 502);
  assert.deepEqual(events[1], { event: 'weather_api_failure', code: 'WEATHER_INTERNAL' });
  assert.doesNotMatch(JSON.stringify(events), /secret|authKey/);
});
test('local static page, archive, validation, HEAD and unknown routes', async t => {
  const base = await running(t, { staticRoot: fileURLToPath(new URL('../public/', import.meta.url)) });
  const health = await (await fetch(base + '/api/health')).json(); assert.equal(health.deployment, 'local-only');
  const archive = await (await fetch(base + '/api/weather?mode=archive')).json(); assert.equal(archive.hours.length, 744);
  assert.equal((await fetch(base + '/api/weather?mode=invalid')).status, 400);
  assert.equal((await fetch(base + '/api/no')).status, 404); assert.equal((await fetch(base + '/missing')).status, 404);
  assert.equal((await fetch(base + '/api/health', { method: 'POST' })).status, 405);
  for (const route of ['/', '/haemugak', '/haemugak/']) {
    const redirect = await fetch(base + route + '?preview=1', { redirect: 'manual' });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), '/haemugak/index.html?preview=1');
  }
  const home = await fetch(base); assert.equal(home.status, 200); assert.match(await home.text(), /\.\/main\.js/);
  assert.equal(new URL(home.url).pathname, '/haemugak/index.html');
  const legacy = await fetch(base + '/index.html'); assert.equal(legacy.status, 200); assert.match(await legacy.text(), /OnSeafog/);
  for (const [file, type] of [['main.js', 'text/javascript'], ['style.css', 'text/css']]) {
    const asset = await fetch(base + '/haemugak/' + file);
    assert.equal(asset.status, 200); assert.ok(asset.headers.get('content-type').startsWith(type));
  }
  const head = await fetch(base, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
});
test('concurrent latest requests share a fetch and subsequent requests reuse cache', async t => {
  let calls = 0;
  const base = await running(t, { weatherLoader: async (start, end, forecast) => { calls++; assert.equal(forecast, true); assert.ok(end > start); await new Promise(r => setTimeout(r, 30)); return { mode: 'forecast', hours: [{ time: start + 'T00:00' }] }; } });
  const results = await Promise.all([fetch(base + '/api/weather'), fetch(base + '/api/weather?mode=forecast')]);
  for (const result of results) assert.equal(result.status, 200);
  assert.equal((await fetch(base + '/api/weather?mode=forecast')).status, 200); assert.equal(calls, 1);
});
test('upstream failure returns 502 and next request can recover', async t => {
  let calls = 0;
  const base = await running(t, { weatherLoader: async () => { if (++calls === 1) throw new Error('upstream failed'); return { hours: [] }; } });
  assert.equal((await fetch(base + '/api/weather?mode=forecast')).status, 502);
  assert.equal((await fetch(base + '/api/weather?mode=forecast')).status, 200);
});

test('missing KMA key is actionable and generic upstream errors do not disclose secrets', async t => {
  const base = await running(t, { weatherLoader: async () => { throw new WeatherError('KMA_KEY_REQUIRED', 'Set KMA_API_KEY in .env.local', 503); } });
  const response = await fetch(base + '/api/weather');
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'KMA_KEY_REQUIRED');
  const other = await running(t, { weatherLoader: async () => { throw new Error('https://example.com/?authKey=secret'); } });
  assert.doesNotMatch(await (await fetch(other + '/api/weather')).text(), /secret|authKey/);
});

test('coordinates require a valid pair before calling upstream', async t => {
  let calls = 0;
  const base = await running(t, { weatherLoader: async () => { calls++; return { hours: [] }; } });
  for (const query of ['lat=35', 'lon=129', 'lat=&lon=129', 'lat=NaN&lon=129', 'lat=Infinity&lon=129', 'lat=91&lon=129', 'lat=35&lon=-181']) {
    assert.equal((await fetch(`${base}/api/weather?${query}`)).status, 400, query);
  }
  assert.equal(calls, 0);
  assert.equal((await fetch(`${base}/api/weather?lat=0&lon=0`)).status, 200);
  assert.equal(calls, 1);
});

test('selected-coordinate queries deduplicate and cache by coordinates and mode', async t => {
  const calls = [];
  const base = await running(t, { weatherLoader: async (start, end, forecast, fetcher, location) => {
    calls.push({ start, end, forecast, location });
    await new Promise(r => setTimeout(r, 20));
    return { requestedLocation: location, hours: [{ time: start + 'T00:00' }] };
  } });
  const path = '/api/weather?mode=archive&lat=35.123456&lon=129.123456';
  const responses = await Promise.all([fetch(base + path), fetch(base + path)]);
  for (const response of responses) assert.deepEqual((await response.json()).requestedLocation, { latitude: 35.12346, longitude: 129.12346 });
  await fetch(base + path); assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { start: '2026-07-01', end: '2026-07-31', forecast: false, location: { latitude: 35.12346, longitude: 129.12346 } });
  await fetch(base + '/api/weather?mode=archive&lat=35.2&lon=129.2');
  await fetch(base + '/api/weather?mode=forecast&lat=35.123456&lon=129.123456');
  assert.equal(calls.length, 3); assert.equal(calls[2].forecast, true);
  assert.notDeepEqual(calls[0].location, calls[1].location);
});
