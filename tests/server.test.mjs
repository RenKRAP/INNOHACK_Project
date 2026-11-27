import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createApp } from '../local-server/index.mjs';

async function running(t, options) {
  const server = createApp(options); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
test('local static page, archive, validation, HEAD and unknown routes', async t => {
  const base = await running(t, { staticRoot: fileURLToPath(new URL('../public/', import.meta.url)) });
  const health = await (await fetch(base + '/api/health')).json(); assert.equal(health.deployment, 'local-only');
  const archive = await (await fetch(base + '/api/weather')).json(); assert.equal(archive.hours.length, 744);
  assert.equal((await fetch(base + '/api/weather?mode=invalid')).status, 400);
  assert.equal((await fetch(base + '/api/no')).status, 404); assert.equal((await fetch(base + '/missing')).status, 404);
  assert.equal((await fetch(base + '/api/health', { method: 'POST' })).status, 405);
  const home = await fetch(base); assert.equal(home.status, 200); assert.match(await home.text(), /OnSeafog/);
  const head = await fetch(base, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
});
test('concurrent latest requests share a fetch and subsequent requests reuse cache', async t => {
  let calls = 0;
  const base = await running(t, { weatherLoader: async (start, end, forecast) => { calls++; assert.equal(forecast, true); assert.ok(end > start); await new Promise(r => setTimeout(r, 30)); return { mode: 'forecast', hours: [{ time: start + 'T00:00' }] }; } });
  const results = await Promise.all([fetch(base + '/api/weather?mode=forecast'), fetch(base + '/api/weather?mode=forecast')]);
  for (const result of results) assert.equal(result.status, 200);
  assert.equal((await fetch(base + '/api/weather?mode=forecast')).status, 200); assert.equal(calls, 1);
});
test('upstream failure returns 502 and next request can recover', async t => {
  let calls = 0;
  const base = await running(t, { weatherLoader: async () => { if (++calls === 1) throw new Error('upstream failed'); return { hours: [] }; } });
  assert.equal((await fetch(base + '/api/weather?mode=forecast')).status, 502);
  assert.equal((await fetch(base + '/api/weather?mode=forecast')).status, 200);
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
