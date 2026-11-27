import { writeFile, mkdir } from 'node:fs/promises';
import { fetchWeather } from '../local-server/weather.mjs';
import { predictFog, VIEWPOINTS } from '../model/fog-model.js';
const data = await fetchWeather('2026-07-01', '2026-07-31');
if (data.hours.length !== 744) throw new Error(`Expected 744 hours, got ${data.hours.length}`);
if (!data.hours.some(h => h.seaTemperature !== null)) throw new Error('No SST returned; keep the previous snapshot');
const best = data.hours.map(h => ({ hour: h, p: predictFog(h) })).sort((a, b) => (b.p.score ?? -1) - (a.p.score ?? -1));
// Prefer a real hour that illustrates comparison above the layer, then the highest score.
const recommended = best.find(x => x.p.active && x.p.top.range?.[1] < Math.max(...VIEWPOINTS.map(p => p.altitude)))
  ?? best.find(x => x.p.top.status === 'bounded') ?? best[0];
data.recommendedTime = recommended.hour.time;
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/july-2026.json', import.meta.url), JSON.stringify(data));
console.log(`Saved ${data.hours.length} real model-weather hours; recommended ${data.recommendedTime}; score ${recommended.p.score}/100. No observed fog labels.`);
