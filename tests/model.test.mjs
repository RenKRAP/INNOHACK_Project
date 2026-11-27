import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { predictFog, estimateFogTop, classifyViewpoint, angleDistance } from '../model/fog-model.js';

const humid = () => ({ temperature: 26, seaTemperature: 22, humidity: 95, dewPoint: 26, windSpeed: 3, windDirection: 135,
  profile: [{ height: 100, humidity: 95 }, { height: 300, humidity: 85 }, { height: 600, humidity: 99 }] });

test('favorable conditions reach 100; humidity and cold-air gates override a low threshold', () => {
  assert.equal(predictFog(humid()).score, 100);
  assert.equal(predictFog(humid(), 100).active, true);
  for (const change of [{ humidity: 79 }, { seaTemperature: 27 }]) {
    const p = predictFog({ ...humid(), ...change }, 0);
    assert.ok(p.score <= 39);
    assert.equal(p.active, false);
  }
  assert.throws(() => predictFog(humid(), 101), RangeError);
});
test('opposite wind reduces the score and direction wraps across north', () => {
  assert.equal(angleDistance(359, 1), 2);
  assert.equal(angleDistance(135, 315), 180);
  assert.equal(predictFog({ ...humid(), windDirection: 315 }).score, 85);
});
test('missing critical inputs are unknown, including null SST and invalid numbers', () => {
  for (const field of ['temperature','seaTemperature','humidity','dewPoint','windSpeed','windDirection']) {
    const p = predictFog({ ...humid(), [field]: null });
    assert.equal(p.score, null); assert.equal(p.active, false); assert.ok(p.missing.includes(field));
    assert.equal(classifyViewpoint(p, 427).key, 'unknown');
  }
  assert.equal(predictFog({ ...humid(), humidity: 101 }).score, null);
  assert.equal(predictFog({ ...humid(), windSpeed: -1 }).score, null);
  assert.equal(predictFog({ ...humid(), temperature: NaN }).score, null);
});
test('layer top is interpolated at the FIRST crossing, ignoring detached humid layers', () => {
  const top = estimateFogTop(humid());
  assert.deepEqual(top.range, [50, 350]); assert.equal(top.height, 200);
  assert.equal(estimateFogTop({ ...humid(), profile: [...humid().profile].reverse() }).height, 200);
  assert.equal(estimateFogTop({ ...humid(), humidity: 89 }).status, 'not-saturated');
});
test('unbounded, missing and widely spaced profiles never invent a fog top', () => {
  for (const profile of [[], [{ height: 500, humidity: 95 }, { height: 700, humidity: 85 }],
    [{ height: 100, humidity: 95 }, { height: 900, humidity: 85 }], [{ height: 100, humidity: 95 }, { height: null, humidity: 85 }]]) {
    assert.equal(estimateFogTop({ ...humid(), profile }).status, 'missing');
  }
  const p = predictFog({ ...humid(), profile: [{ height: 100, humidity: 95 }, { height: 300, humidity: 92 }] });
  assert.equal(p.top.status, 'open'); assert.equal(p.top.lowerBound, 300); assert.equal(p.top.height, null);
  assert.equal(classifyViewpoint(p, 427).key, 'unknown');
});
test('viewpoint classifications merge lower and uncertain altitudes into inside, including endpoints', () => {
  const p = predictFog(humid());
  assert.equal(classifyViewpoint(p, 351).key, 'above');
  for (const height of [0, 49, 50, 200, 350]) {
    const result = classifyViewpoint(p, height);
    assert.equal(result.key, 'inside');
    assert.equal(result.label, '해무 속');
  }
  assert.match(classifyViewpoint(p, 49).description, /상단 범위보다 낮습니다/);
  assert.match(classifyViewpoint(p, 200).description, /추정 오차 범위/);
  assert.equal(classifyViewpoint(p, null).key, 'unknown');
  assert.equal(classifyViewpoint(predictFog({ ...humid(), humidity: 60 }), 427).key, 'clear');
});
test('bundled real July weather is complete, unique, ordered, and produces bounded scores', async () => {
  const data = JSON.parse(await readFile(new URL('../data/july-2026.json', import.meta.url), 'utf8'));
  assert.equal(data.hours.length, 744); assert.equal(new Set(data.hours.map(h => h.time)).size, 744);
  assert.equal(data.hours[0].time, '2026-07-01T00:00'); assert.equal(data.hours.at(-1).time, '2026-07-31T23:00');
  assert.equal(data.timezone, 'Asia/Seoul'); assert.match(data.sources.atmosphere, /historical-forecast-api/);
  data.hours.forEach((h, i) => {
    if (i) assert.equal(Date.parse(h.time + '+09:00') - Date.parse(data.hours[i - 1].time + '+09:00'), 3600000);
    const p = predictFog(h); assert.ok(p.score >= 0 && p.score <= 100); assert.ok(Number.isFinite(h.seaTemperature));
    if (p.top.range) assert.ok(p.top.range[0] <= p.top.height && p.top.height <= p.top.range[1]);
  });
});
