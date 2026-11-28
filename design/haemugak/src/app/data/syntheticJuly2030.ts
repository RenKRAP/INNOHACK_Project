import type { HourlyForecastPoint } from "./haemugakData";

// Reproducible demonstration scenarios, not observations or a real 2030 forecast.
export const SYNTHETIC_DATES = Array.from({ length: 31 }, (_, i) => `2030-07-${String(i + 1).padStart(2, "0")}`);
export const SYNTHETIC_FOG_DAYS = Array.from({ length: 31 }, (_, i) => i + 1).filter(day => day % 3 !== 1);
export const SYNTHETIC_DEFAULT_DATE = "2030-07-02";
export const OBSERVABLE_THRESHOLD = 65;
export const MAP_BOUNDS = { south: 35.128, west: 129.075, north: 35.198, east: 129.190 } as const;
export interface FogFootprint { lat: number; lon: number; widthKm: number; heightKm: number }

// Date-seeded randomness keeps each scenario stable while selecting hours or points.
function footprintCandidates(date: string): FogFootprint[] {
  if (!SYNTHETIC_DATES.includes(date)) throw new RangeError("Synthetic data is available only for July 2030.");
  let seed = Number(date.replaceAll("-", ""));
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let value = Math.imul(seed ^ (seed >>> 15), seed | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  // Shuffle four disjoint slots. Conservative margins keep each projected square
  // inside its slot, leaving a gap even after geographic projection.
  const slots = [0, 1, 2, 3];
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const latSpan = (MAP_BOUNDS.north - MAP_BOUNDS.south) / 2;
  const lonSpan = (MAP_BOUNDS.east - MAP_BOUNDS.west) / 2;
  return slots.map(slot => ({
    lat: MAP_BOUNDS.south + Math.floor(slot / 2) * latSpan + 0.015 + random() * (latSpan - 0.030),
    lon: MAP_BOUNDS.west + (slot % 2) * lonSpan + 0.019 + random() * (lonSpan - 0.038),
    widthKm: 3, heightKm: 3,
  }));
}
// Compatibility reference for projection helpers; inactive days have no displayed regions.
export function fogFootprint(date: string) { return footprintCandidates(date)[0]; }
export function fogFootprints(date: string): FogFootprint[] {
  const candidates = footprintCandidates(date);
  const index = SYNTHETIC_FOG_DAYS.indexOf(Number(date.slice(-2)));
  if (index < 0) return [];
  // Five cycles: five single-region, ten double-region and five triple-region days.
  const count = [3, 2, 2, 1][index % 4];
  return candidates.slice(0, count);
}
export const FOG_FOOTPRINT = fogFootprint(SYNTHETIC_DEFAULT_DATE);
const EARTH_RADIUS_KM = 6371.0088;
const radians = (degrees: number) => degrees * Math.PI / 180;

// Local azimuthal-equidistant coordinates for a single 3 × 3 km square.
export function footprintCoordinates({ lat, lon }: { lat: number; lon: number }, footprint = FOG_FOOTPRINT) {
  const phi = radians(lat), phi0 = radians(footprint.lat);
  const delta = radians(lon - footprint.lon);
  const cosC = Math.max(-1, Math.min(1, Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(delta)));
  const c = Math.acos(cosC);
  const k = c < 1e-12 ? 1 : c / Math.sin(c);
  return {
    x: EARTH_RADIUS_KM * k * Math.cos(phi) * Math.sin(delta),
    y: EARTH_RADIUS_KM * k * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(delta)),
  };
}

export function isInsideFogFootprint(location: { lat: number; lon: number }, footprint = FOG_FOOTPRINT) {
  const { x, y } = footprintCoordinates(location, footprint);
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= footprint.widthKm / 2 + 1e-9 && Math.abs(y) <= footprint.heightKm / 2 + 1e-9;
}
export function isInsideFogFootprints(location: { lat: number; lon: number }, footprints: readonly FogFootprint[]) {
  return footprints.some(footprint => isInsideFogFootprint(location, footprint));
}

export function syntheticForecast(date: string, location?: { lat: number; lon: number }): HourlyForecastPoint[] {
  const footprints = fogFootprints(date);
  const day = Number(date.slice(-2));
  const regionIndex = location
    ? footprints.findIndex(footprint => isInsideFogFootprint(location, footprint)) : -1;
  // Split the DAILY 3-8-hour observation budget into adjacent, disjoint windows.
  // A region may last less than three hours; the duration constraint is per day.
  const dailyStart = 3 + day % 3;
  const dailyDuration = 3 + day % 6;
  const windows = footprints.map((_, index) => ({
    start: dailyStart + Math.floor(index * dailyDuration / footprints.length),
    end: dailyStart + Math.floor((index + 1) * dailyDuration / footprints.length),
  }));
  return Array.from({ length: 24 }, (_, hour) => {
    // Without a location, return the daily regional union for the calendar data.
    const observable = windows.some((window, index) =>
      (!location || index === regionIndex) && hour >= window.start && hour < window.end);
    const probability = observable ? 70 + (day * 7 + hour * 3) % 24 : 8 + (day * 3 + hour * 5) % 30;
    return {
      time: `${String(hour).padStart(2, "0")}:00`, hour, probability,
      fogTopMeters: observable ? 110 + (day * 3 + hour * 7) % 80 : 0,
      note: observable ? "가상 시나리오 · 해무 관측 가능" : "가상 시나리오 · 해무 조건 약함",
    };
  });
}

export const SYNTHETIC_JULY_2030 = Object.fromEntries(SYNTHETIC_DATES.map(date => [date, syntheticForecast(date)]));

// Same local equidistant projection is used for rendering and point classification.
export function footprintLocation(x: number, y: number, footprint = FOG_FOOTPRINT) {
  const rho = Math.hypot(x, y);
  if (!rho) return { lat: footprint.lat, lon: footprint.lon };
  const c = rho / EARTH_RADIUS_KM, phi = radians(footprint.lat);
  return {
    lat: Math.asin(Math.cos(c) * Math.sin(phi) + y * Math.sin(c) * Math.cos(phi) / rho) * 180 / Math.PI,
    lon: footprint.lon + Math.atan2(x * Math.sin(c), rho * Math.cos(phi) * Math.cos(c) - y * Math.sin(phi) * Math.sin(c)) * 180 / Math.PI,
  };
}
export function fogPolygon(footprint = FOG_FOOTPRINT) {
  return [[-1, -1], [-1, 1], [1, 1], [1, -1]].map(([x, y]) =>
    footprintLocation(x * footprint.widthKm / 2, y * footprint.heightKm / 2, footprint));
}
export const FOG_POLYGON = fogPolygon();

export function syntheticFogRange(point: HourlyForecastPoint): readonly [number, number] | null {
  return point.probability >= OBSERVABLE_THRESHOLD && point.fogTopMeters > 0
    ? [point.fogTopMeters - 25, point.fogTopMeters + 25] : null;
}

export const PHOTO_THRESHOLD = 70;
export function canPhotograph(probability: number) { return probability >= PHOTO_THRESHOLD; }
export function koreaClock(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return { hour: kst.getUTCHours(), time: [kst.getUTCHours(), kst.getUTCMinutes(), kst.getUTCSeconds()].map(v => String(v).padStart(2, "0")).join(":") };
}
export function fogPosition(location: { lat: number; lon: number }, elevation: number | null, point: HourlyForecastPoint, footprint: FogFootprint | readonly FogFootprint[] = FOG_FOOTPRINT) {
  const footprints = Array.isArray(footprint) ? footprint : [footprint as FogFootprint];
  if (!isInsideFogFootprints(location, footprints)) return "outside" as const;
  if (point.probability < OBSERVABLE_THRESHOLD || elevation == null) return "unknown" as const;
  if (elevation > point.fogTopMeters + 25) return "above" as const;
  if (elevation < point.fogTopMeters - 25) return "inside" as const;
  return "edge" as const;
}
