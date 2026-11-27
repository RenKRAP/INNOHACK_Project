import test from 'node:test';
import assert from 'node:assert/strict';
import { KIM_ENDPOINT, kimUrl, kimRun, parseKimSeries, fetchKimWeather } from '../local-server/kim-weather.mjs';
import { predictFog } from '../model/fog-model.js';

// Synthetic contract fixtures unless explicitly labeled as a live-response layout.
const location = { latitude: 35.16, longitude: 129.16 };
const now = new Date('2026-11-27T12:30:00Z'), run = Date.parse('2026-11-27T06:00:00Z');
const values = { T2: 297.15, SST: 294.15, RH2: 95, U10: -3, V10: 4, RH: 93, GPH: 250 };
const csv = (variable, value = values[variable]) => `HF,${variable}\n` + Array.from({ length: 49 }, (_, h) => `${h},${value}`).join('\n');
const response = (text, status = 200) => new Response(text, { status });
const fixture = async url => response(csv(new URL(url).searchParams.get('vars')));
const options = extra => ({ key: 'test-only-key', now, fetcher: fixture, ...extra });

test('KIM native-grid URL selects single surface/pressure fields, UTC run and hourly 0–48 h', () => {
  assert.equal(kimRun(now), run);
  const url = kimUrl('RH', 975, run, location, 'test-only-key');
  assert.equal(url.origin + url.pathname, KIM_ENDPOINT);
  for (const [key, value] of Object.entries({ group: 'KIML', nwp: 'l010', data: 'P', vars: 'RH', lvl_lst: '975', tmfc: '2026112706', hf1: '0', hf2: '48', hf_int: '1', dataType: 'TEXT', lat: '35.16', lon: '129.16' })) assert.equal(url.searchParams.get(key), value);
  const surface = kimUrl('T2', null, run, location, 'test-only-key');
  assert.equal(surface.searchParams.get('data'), 'U'); assert.equal(surface.searchParams.has('lvl_lst'), false);
});

test('parser accepts headed rows, UTC times and transposed data; retains missing values', () => {
  assert.deepEqual([...parseKimSeries('\uFEFF# metadata\n# HF,T2\n0,297.15\n1,-9999\n2,NaN\n3,\n4,1e30', 'T2', run)], [[0, 297.15], [1, null], [2, null], [3, null], [4, null]]);
  assert.deepEqual([...parseKimSeries('valid_time,T2\n202611270600,297.15\n2026-11-27T07:00:00Z,298.15', 'T2', run)], [[0, 297.15], [1, 298.15]]);
  assert.deepEqual([...parseKimSeries('VAR 0 1 2\nT2 297.15 298.15 299.15', 'T2', run)], [[0, 297.15], [1, 298.15], [2, 299.15]]);
  for (const text of ['HF,T2\n0,2\n0,3', 'HF,T2\n49,2', 'HF,T2\n,2', 'HF,T2\n0,nope', 'HF,T2\n0,2,3', 'time,T2\n2026-02-30T06:00,2', '<html>failure</html>', '# 오류: 처리 실패']) assert.throws(() => parseKimSeries(text, 'T2', run), { code: 'KMA_FORMAT' });
  assert.throws(() => parseKimSeries('# ERROR: invalid authKey', 'T2', run), { code: 'KMA_AUTH' });
});

test('native 1 km response converts units and wind, joins 49 KST hours, and keeps safe provenance', async () => {
  const seen = [];
  const data = await fetchKimWeather(location, options({ fetcher: async url => { seen.push(new URL(url)); return fixture(url); } }));
  assert.equal(seen.length, 17); assert.equal(data.hours.length, 49);
  assert.equal(data.provider, 'KMA'); assert.equal(data.resolutionKm, 1); assert.equal(data.forecastHours, 48);
  assert.equal(data.runAt, '2026-11-27T06:00:00.000Z');
  assert.equal(data.hours[0].time, '2026-11-27T15:00'); assert.equal(data.hours[48].time, '2026-11-29T15:00');
  const h = data.hours[0];
  assert.equal(h.temperature, 24); assert.equal(h.seaTemperature, 21); assert.equal(h.windSpeed, 5);
  assert.ok(Math.abs(h.windDirection - 143.130102354156) < 1e-9);
  assert.ok(h.dewPoint < h.temperature && h.dewPoint > 23);
  assert.deepEqual(h.profile.map(p => p.pressure), [1000, 975, 950, 925, 900, 850]);
  assert.equal(h.profile[0].height, 250); assert.equal(h.profile[0].humidity, 93);
  assert.deepEqual(data.requestedLocation, location); assert.equal(data.grids.atmosphere, null);
  assert.doesNotMatch(JSON.stringify(data), /test-only-key|authKey/);
});

test('real KIM CSV column layout parses scientific notation without treating metadata as values', () => {
  const text = 'tmfc,hf,tmef,ix,iy,lon,lat,value\n2026112706,0,2026112706,869,464,129.156860,35.156166,2.889000e+02\n2026112706,1,2026112707,869,464,129.156860,35.156166,2.905600e+02';
  assert.deepEqual([...parseKimSeries(text, 'T2', run)], [[0, 288.9], [1, 290.56]]);
});

test('live KIM TEXT layouts accept metadata, commented headers and surface/pressure scientific values', () => {
  const rows = '#     tmfc   hf            tm        lon        lat        value\n';
  const surface = '# vars=T2  group=KIML  data=U\n# tmfc=2026112706  hf1=0  hf2=48  hf_int=1\n# lon=129.1604  lat=35.1595\n' + rows
    + '2026112706    0   2026112706  129.15686   35.15617  2.88900e+02\n2026112706    1   2026112707  129.15686   35.15617  2.90560e+02';
  const pressure = '# vars=RH  group=KIML  data=P\n# tmfc=2026112706  hf1=0  hf2=48  hf_int=1\n# lvl_lst=975.0 hPa\n# lon=129.1604  lat=35.1595\n' + rows
    + '2026112706    0   2026112706  129.15686   35.15617  7.13400e+01\n2026112706    1   2026112707  129.15686   35.15617  7.71200e+01';
  assert.deepEqual([...parseKimSeries(surface, 'T2', run)], [[0, 288.9], [1, 290.56]]);
  assert.deepEqual([...parseKimSeries(pressure, 'RH', run)], [[0, 71.34], [1, 77.12]]);
});

test('valid-time aliases and issue times must agree with the requested run and forecast lead', () => {
  assert.deepEqual([...parseKimSeries('tmef,value\n2026112707,290.56', 'T2', run)], [[1, 290.56]]);
  for (const row of ['2026112700,1,2026112707,290.56', '2026112706,1,2026112708,290.56', '2026112706,1,invalid,290.56']) {
    assert.throws(() => parseKimSeries('tmfc,hf,tmef,value\n' + row, 'T2', run), { code: 'KMA_FORMAT' });
  }
});

test('TEXT downloads decode the declared EUC-KR charset and preserve authentication errors', async () => {
  const body = Buffer.from('2320c0cec1f520bfc0b7f9', 'hex'); // # 인증 오류, EUC-KR
  let calls = 0;
  await assert.rejects(fetchKimWeather(location, options({ fetcher: async () => {
    calls++; return new Response(body, { headers: { 'content-type': 'text/plain; charset=EUC-KR' } });
  } })), { code: 'KMA_AUTH', status: 503 });
  assert.equal(calls, 1);
});

test('49-hour TEXT series converts all fields into finite model predictions', async () => {
  const data = await fetchKimWeather(location, options({ fetcher: async url => {
    const u = new URL(url), variable = u.searchParams.get('vars');
    const text = '# vars=' + variable + '\n# tmfc hf tm lon lat value\n' + Array.from({ length: 49 }, (_, h) => {
      const valid = new Date(run + h * 3600000).toISOString().replace(/\D/g, '').slice(0, 10);
      return `2026112706 ${h} ${valid} 129.15686 35.15617 ${values[variable].toExponential(5)}`;
    }).join('\n');
    return new Response(text, { headers: { 'content-type': 'text/plain; charset=EUC-KR' } });
  } }));
  assert.equal(data.hours.length, 49);
  assert.ok(data.hours.every(h => Number.isFinite(predictFog(h).score)));
  assert.equal(data.hours[48].temperature, 24);
});

test('HTTP 200 CGI failures retry the same field/run and recover, including pressure fields', async () => {
  const seen = new Map();
  const data = await fetchKimWeather(location, options({ fetcher: async url => {
    const u = new URL(url), field = `${u.searchParams.get('vars')}/${u.searchParams.get('lvl_lst')}`;
    const calls = (seen.get(field) || 0) + 1; seen.set(field, calls);
    assert.equal(u.searchParams.get('tmfc'), '2026112706');
    return ['T2/null', 'RH/975'].includes(field) && calls === 1 ? response('# ERROR: CGI processing failed') : fixture(url);
  } }));
  assert.equal(data.hours.length, 49);
  assert.equal(seen.get('T2/null'), 2); assert.equal(seen.get('RH/975'), 2);
  assert.equal([...seen.values()].reduce((a, b) => a + b), 19);
});

test('persistent CGI failures stop after three attempts and malformed CSV is not retried', async () => {
  for (const [body, code, expected] of [['# ERROR: CGI test-only-key', 'KMA_TEMPORARY', 3], ['HF,T2\n0,broken', 'KMA_FORMAT', 1], ['# ERROR: CGI invalid authKey', 'KMA_AUTH', 1]]) {
    let calls = 0;
    await assert.rejects(fetchKimWeather(location, options({ fetcher: async () => { calls++; return response(body); } })), error => error.code === code && !error.message.includes('test-only-key'));
    assert.equal(calls, expected);
  }
});

test('missing key makes no request; auth/network/404 errors are safe and do not select older runs', async () => {
  let calls = 0;
  await assert.rejects(fetchKimWeather(location, options({ key: '', fetcher: async () => { calls++; } })), { code: 'KMA_KEY_REQUIRED', status: 503 });
  assert.equal(calls, 0);
  for (const [status, code] of [[403, 'KMA_AUTH'], [404, 'KMA_UPSTREAM']]) {
    calls = 0;
    await assert.rejects(fetchKimWeather(location, options({ fetcher: async () => { calls++; return response('', status); } })), { code });
    assert.equal(calls, 1);
  }
  await assert.rejects(fetchKimWeather(location, options({ fetcher: async () => { throw new Error('secret URL authKey=test-only-key'); } })), error => error.code === 'KMA_NETWORK' && !error.message.includes('test-only-key'));
});

test('only explicit absent-cycle data retries the preceding six-hour run', async () => {
  const seen = [];
  const data = await fetchKimWeather(location, options({ fetcher: async url => {
    const u = new URL(url); seen.push(u);
    return u.searchParams.get('tmfc') === '2026112706' ? response('# No data') : fixture(url);
  } }));
  assert.equal(data.runAt, '2026-11-27T00:00:00.000Z'); assert.equal(seen.length, 18);
  assert.equal(seen.filter(u => u.searchParams.get('tmfc') === '2026112706').length, 1);
});

test('land SST uses disclosed same-run offshore reference; missing profiles remain unknown', async () => {
  const data = await fetchKimWeather(location, options({ fetcher: async url => {
    const u = new URL(url), variable = u.searchParams.get('vars');
    if (variable === 'RH') return response('# No data');
    if (variable === 'SST' && u.searchParams.get('lat') === '35.16') return response(csv('SST', -9999));
    return fixture(url);
  } }));
  assert.deepEqual(data.seaRequestedLocation, { latitude: 35.148, longitude: 129.165 });
  assert.equal(data.hours[0].seaTemperature, 21); assert.equal(data.hours[0].profile[0].humidity, null);
  assert.ok(data.warnings.some(w => w.includes('SST')));
  const missing = await fetchKimWeather(location, options({ fetcher: async url => new URL(url).searchParams.get('vars') === 'SST' ? response('# No data') : fixture(url) }));
  assert.equal(missing.hours[0].seaTemperature, null);
  assert.equal(predictFog(missing.hours[0]).score, null);
});

test('rejects incompatible Kelvin units and bounds shared download concurrency across points', async () => {
  await assert.rejects(fetchKimWeather(location, options({ fetcher: async url => response(csv(new URL(url).searchParams.get('vars'), 24)) })), { code: 'KMA_UNITS' });
  let active = 0, maximum = 0;
  const fetcher = async url => { active++; maximum = Math.max(maximum, active); await new Promise(r => setTimeout(r, 2)); active--; return fixture(url); };
  const datasets = await Promise.all([location, { ...location, longitude: 129.17 }].map(p => fetchKimWeather(p, options({ fetcher }))));
  assert.equal(maximum, 2); assert.equal(datasets.length, 2);
});

