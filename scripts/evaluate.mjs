import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { predictFog, DEFAULT_THRESHOLD, MODEL_VERSION } from '../model/fog-model.js';

export function parseLabels(csv) {
  const lines = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines.shift() !== 'time_kst,observed_fog') throw new Error('CSV header must be time_kst,observed_fog');
  const seen = new Set();
  return lines.filter(Boolean).map((line, index) => {
    const fields = line.split(',');
    const [time, label] = fields;
    if (fields.length !== 2 || !/^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(time) || !['0', '1'].includes(label)) throw new Error(`Invalid observation at row ${index + 2}`);
    if (seen.has(time)) throw new Error(`Duplicate observation: ${time}`);
    seen.add(time);
    return { time, observed: Number(label) };
  });
}

export function evaluate(hours, labels, threshold = DEFAULT_THRESHOLD) {
  if (!labels.length) throw new Error('No observation labels. Add independently verified observations first.');
  const byTime = new Map(hours.map(h => [h.time, h]));
  const counts = { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0, missingWeather: 0 };
  for (const label of labels) {
    const hour = byTime.get(label.time);
    const prediction = hour ? predictFog(hour, threshold) : null;
    if (!prediction || prediction.score === null) { counts.missingWeather++; continue; }
    const key = label.observed ? prediction.active ? 'truePositive' : 'falseNegative' : prediction.active ? 'falsePositive' : 'trueNegative';
    counts[key]++;
  }
  const { truePositive: tp, falsePositive: fp, trueNegative: tn, falseNegative: fn } = counts;
  const divided = (a, b) => b ? a / b : null;
  return { model: MODEL_VERSION, threshold, observations: labels.length, evaluated: tp + fp + tn + fn, ...counts,
    coverage: divided(tp + fp + tn + fn, labels.length), accuracy: divided(tp + tn, tp + fp + tn + fn),
    precision: divided(tp, tp + fp), recall: divided(tp, tp + fn), f1: divided(2 * tp, 2 * tp + fp + fn),
    note: 'Condition classification against supplied labels; not probability calibration or issue-time forecast skill. Independently verify label provenance and use held-out dates.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const value = key => args[args.indexOf(key) + 1];
    if (!args.includes('--labels') || !value('--labels')) throw new Error('Usage: npm run evaluate -- --labels observations.csv [--data data/july-2026.json] [--threshold 65]. No observed labels are bundled.');
    const labels = parseLabels(await readFile(resolve(value('--labels')), 'utf8'));
    const dataset = JSON.parse(await readFile(resolve(args.includes('--data') ? value('--data') : 'data/july-2026.json'), 'utf8'));
    const threshold = args.includes('--threshold') ? Number(value('--threshold')) : DEFAULT_THRESHOLD;
    console.log(JSON.stringify(evaluate(dataset.hours, labels, threshold), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
