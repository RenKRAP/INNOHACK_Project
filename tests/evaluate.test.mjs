import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLabels, evaluate } from '../scripts/evaluate.mjs';

// Artificial unit-test fixtures only. These are not observations or claimed performance.
const positive = { temperature: 26, seaTemperature: 22, humidity: 95, dewPoint: 26, windSpeed: 3, windDirection: 135 };
test('evaluation counts mistakes, excludes missing weather, and reports coverage', () => {
  const hours = [1,2,3,4,5].map(n => ({ ...positive, time: `2026-07-01T0${n}:00`, ...(n > 2 ? { humidity: 40 } : {}), ...(n === 5 ? { seaTemperature: null } : {}) }));
  const labels = parseLabels('time_kst,observed_fog\n2026-07-01T01:00,1\n2026-07-01T02:00,0\n2026-07-01T03:00,1\n2026-07-01T04:00,0\n2026-07-01T05:00,1');
  const result = evaluate(hours, labels);
  for (const key of ['truePositive','falsePositive','trueNegative','falseNegative','missingWeather']) assert.equal(result[key], 1);
  assert.equal(result.accuracy, .5); assert.equal(result.f1, .5); assert.equal(result.coverage, .8);
});
test('empty observations never yield accuracy; duplicate and invalid labels fail loudly', () => {
  assert.throws(() => evaluate([], []), /No observation/);
  assert.throws(() => parseLabels('time_kst,observed_fog\n2026-07-01T00:00,2'), /Invalid/);
  assert.throws(() => parseLabels('time_kst,observed_fog\n2026-07-01T00:00,1\n2026-07-01T00:00,0'), /Duplicate/);
  const result = evaluate([], [{ time: '2026-07-01T00:00', observed: 1 }]);
  assert.equal(result.accuracy, null); assert.equal(result.precision, null); assert.equal(result.coverage, 0);
});
