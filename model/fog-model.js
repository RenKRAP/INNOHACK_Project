/** Explainable research baseline. Scores are NOT calibrated probabilities. */
export const MODEL_VERSION = 'onseafog-rules-1.0';
export const DEFAULT_THRESHOLD = 65;
export { VIEWPOINTS } from './viewpoints.js';
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const valid = n => typeof n === 'number' && Number.isFinite(n);
export const angleDistance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

/** Track the contiguous >=90% RH layer connected to a humid surface. */
export function estimateFogTop(hour) {
  if (!valid(hour.humidity) || hour.humidity < 90) return { status: 'not-saturated', height: null, range: null, reason: '지상 습도가 포화층 기준(90%)에 못 미칩니다.' };
  const raw = hour.profile ?? [];
  const points = raw.filter(p => valid(p.height) && p.height > 2 && valid(p.humidity)).sort((a, b) => a.height - b.height);
  if (points.length < 2 || points[0].height > 400) return { status: 'missing', height: null, range: null, reason: '해수면 부근의 연속된 고층 자료가 부족합니다.' };
  // Missing pressure levels must not be bridged into an invented layer.
  if (raw.some(p => !valid(p.humidity) || !valid(p.height))) return { status: 'missing', height: null, range: null, reason: '고층 자료에 결측이 있어 해무층 상단을 계산하지 않습니다.' };
  let previous = { height: 2, humidity: hour.humidity };
  for (const point of points) {
    if (point.height - previous.height > 650) return { status: 'missing', height: null, range: null, reason: '수직 자료 간격이 너무 넓어 상단을 특정할 수 없습니다.' };
    if (point.humidity < 90) {
      const ratio = (previous.humidity - 90) / (previous.humidity - point.humidity);
      const height = Math.round(previous.height + ratio * (point.height - previous.height));
      return { status: 'bounded', height, range: [Math.max(0, Math.floor(previous.height - 50)), Math.ceil(point.height + 50)], reason: '지상에 연결된 습윤층이 상대습도 70% 아래로 내려가는 고도를 보간했습니다.' };
    }
    previous = point;
  }
  return { status: 'open', height: null, range: null, lowerBound: Math.round(previous.height), reason: '조회한 고층까지 습윤층이 이어져 상단을 특정할 수 없습니다.' };
}

export function predictFog(hour, threshold = DEFAULT_THRESHOLD) {
  if (!valid(threshold) || threshold < 0 || threshold > 100) throw new RangeError('Threshold must be 0–100');
  const missing = ['temperature', 'seaTemperature', 'humidity', 'dewPoint', 'windSpeed', 'windDirection'].filter(k => !valid(hour[k]));
  if (missing.length || hour.humidity < 0 || hour.humidity > 100 || hour.windSpeed < 0) return { version: MODEL_VERSION, score: null, active: false, level: 'unknown', missing, factors: [], top: { status: 'missing', height: null, range: null, reason: '필수 기상자료가 부족하거나 유효하지 않습니다.' } };
  const delta = hour.temperature - hour.seaTemperature;
  const spread = Math.max(0, hour.temperature - hour.dewPoint);
  const components = [
    { key: 'humidity', label: '높은 상대습도', value: hour.humidity, unit: '%', weight: 30, strength: clamp((hour.humidity - 70) / 25) },
    { key: 'seaContrast', label: '따뜻한 공기 · 차가운 바다', value: Math.round(delta * 10) / 10, unit: '°C', weight: 25, strength: clamp(delta / 4) },
    { key: 'dewSpread', label: '기온과 이슬점의 근접', value: Math.round(spread * 10) / 10, unit: '°C', weight: 20, strength: clamp(1 - spread / 5) },
    { key: 'onshoreWind', label: '남동 계열 바람', value: hour.windDirection, unit: '°', weight: 15, strength: clamp(1 - angleDistance(hour.windDirection, 135) / 90) },
    { key: 'windSpeed', label: '완만한 바람', value: hour.windSpeed, unit: 'm/s', weight: 10, strength: hour.windSpeed < 1 ? hour.windSpeed : clamp((10 - hour.windSpeed) / 6) },
  ].map(c => ({ ...c, points: Math.round(c.weight * c.strength * 10) / 10 }));
  // Moisture and an air/sea contrast are necessary gates for this advection-fog baseline.
  let score = Math.round(components.reduce((s, c) => s + c.points, 0));
  if (delta <= 0 || hour.humidity < 80) score = Math.min(score, 39);
  const active = score >= threshold && delta > 0 && hour.humidity >= 80;
  return { version: MODEL_VERSION, score, active, level: active ? 'favorable' : score >= 40 ? 'watch' : 'low', missing: [], factors: components, top: estimateFogTop(hour) };
}

export function classifyViewpoint(prediction, altitude) {
  if (!valid(altitude)) return { key: 'unknown', label: '고도 정보 없음', description: '지점의 해발고도를 확인해 주세요.' };
  if (prediction.score === null) return { key: 'unknown', label: '판단 자료 부족', description: '필수 기상자료가 없어 비교할 수 없습니다.' };
  if (!prediction.active) return { key: 'clear', label: '해무 조건 약함', description: '선택한 기준에 미달합니다. 실제 맑은 시야를 보장하지 않습니다.' };
  const top = prediction.top;
  if (!top.range) return { key: 'unknown', label: '해무층 높이 미확정', description: top.reason };
  if (altitude > top.range[1]) return { key: 'above', label: '해무 위 가능', description: '지점 고도가 추정 해무층의 상단 범위보다 높습니다.' };
  if (altitude < top.range[0]) return { key: 'inside', label: '해무 속', description: '지점 고도가 추정 해무층의 상단 범위보다 낮습니다.' };
  return { key: 'inside', label: '해무 속', description: '고도가 추정 오차 범위 안에 있어 시야가 달라질 수 있습니다.' };
}
