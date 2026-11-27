export const altitudeKey = point => `onseafog.altitude.v1:${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
export function parseAltitude(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('해발고도를 입력하세요.');
  const altitude = Number(value);
  if (!Number.isFinite(altitude) || altitude < 0 || altitude > 2000) throw new Error('0–2000m 범위의 해발고도를 입력하세요.');
  return Math.round(altitude * 10) / 10;
}
export function withSavedAltitude(point, storage) {
  try {
    const value = storage.getItem(altitudeKey(point));
    if (value !== null) return { ...point, altitude: parseAltitude(value), userAltitude: true, altitudeStored: true };
  } catch { /* Storage failure must not prevent weather analysis. */ }
  return { ...point, userAltitude: false };
}
