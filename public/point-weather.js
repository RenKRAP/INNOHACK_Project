import { predictFog } from '../model/fog-model.js';

// Each point owns its dataset. Never copy selected weather to another coordinate.
export function createPointWeather(fetcher, now = Date.now) {
  const cache = new Map(), pending = new Map();
  const keyFor = (mode, point) => `${mode}:${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
  return {
    async get(mode, point, force = false) {
      const key = keyFor(mode, point), stored = cache.get(key);
      const ttl = mode === 'archive' ? 86400000 : 300000;
      if (!force && stored && now() - stored.at < ttl) return stored.data;
      if (pending.has(key)) return pending.get(key);
      const work = (async () => {
        const data = await fetcher(mode, point);
        if (!data.hours?.length) throw new Error('시간별 자료가 없습니다.');
        cache.set(key, { data, at: now() });
        if (cache.size > 32) cache.delete(cache.keys().next().value);
        return data;
      })();
      pending.set(key, work);
      try { return await work; } finally { pending.delete(key); }
    },
  };
}

export function pointPrediction(data, time, threshold) {
  const hour = data?.hours.find(hour => hour.time === time);
  return hour ? predictFog(hour, threshold) : null;
}
