import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAnalysisTime } from '../public/analysis-time.js';

const hours = ['2026-11-27T21:00', '2026-11-27T22:00',
  '2026-11-28T00:00', '2026-11-28T21:00', '2026-11-28T22:00',
  '2026-11-29T00:00'].map(time => ({ time }));

test('dropdown day overrides the timeline day and keeps the clock hour, not its array index', () => {
  const selection = selectAnalysisTime(hours, '2026-11-28', '2026-11-27T22:00');
  const day = hours.filter(hour => hour.time.startsWith(selection.date));
  assert.equal(day[selection.index].time, '2026-11-28T22:00');
});

test('a day changed during refresh takes precedence over the previous timeline and current date', () => {
  const selection = selectAnalysisTime(hours, '2026-11-29', '2026-11-28T21:00', '2026-11-27T21:00');
  assert.deepEqual(selection, { date: '2026-11-29', index: 0 });
});

test('an expired forecast day falls back to the current available day', () => {
  assert.deepEqual(selectAnalysisTime(hours, '2026-11-26', '2026-11-26T22:00', '2026-11-28T21:00'),
    { date: '2026-11-28', index: 2 });
});

test('switching modes uses its recommended date instead of an unrelated selection', () => {
  const archive = [{ time: '2026-07-01T00:00' }, { time: '2026-07-18T12:00' }];
  assert.deepEqual(selectAnalysisTime(archive, null, null, '2026-07-18T12:00'),
    { date: '2026-07-18', index: 0 });
});
