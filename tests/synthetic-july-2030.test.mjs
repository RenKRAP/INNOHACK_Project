import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_BOUNDS, fogFootprints, isInsideFogFootprints, fogFootprint, fogPolygon, footprintLocation, syntheticFogRange, canPhotograph, fogPosition, koreaClock } from '../design/haemugak/src/app/data/syntheticJuly2030.ts';
import { MAP_VIEWPOINTS } from '../design/haemugak/src/app/data/coastalViewpoints.ts';
import { FOG_FOOTPRINT, OBSERVABLE_THRESHOLD, SYNTHETIC_DATES, SYNTHETIC_JULY_2030, footprintCoordinates, isInsideFogFootprint, syntheticForecast } from '../design/haemugak/src/app/data/syntheticJuly2030.ts';

// Inverse of the local azimuthal-equidistant projection, distances in km.
function locationAt(x, y) {
  const c = Math.hypot(x, y) / 6371.0088;
  if (!c) return FOG_FOOTPRINT;
  const phi = FOG_FOOTPRINT.lat * Math.PI / 180;
  const rho = Math.hypot(x, y);
  return {
    lat: Math.asin(Math.cos(c) * Math.sin(phi) + y * Math.sin(c) * Math.cos(phi) / rho) * 180 / Math.PI,
    lon: FOG_FOOTPRINT.lon + Math.atan2(x * Math.sin(c), rho * Math.cos(phi) * Math.cos(c) - y * Math.sin(phi) * Math.sin(c)) * 180 / Math.PI,
  };
}

test('July 2030 has 744 valid hourly synthetic records and at least twenty sustained fog days of three to eight hours', () => {
  assert.equal(SYNTHETIC_DATES.length, 31);
  let fogDays = 0, totalHours = 0;
  for (const date of SYNTHETIC_DATES) {
    const hours = SYNTHETIC_JULY_2030[date];
    assert.equal(hours.length, 24);
    totalHours += hours.length;
    let run = 0, longestRun = 0;
    for (const [hour, point] of hours.entries()) {
      assert.equal(point.hour, hour);
      assert.equal(point.time, `${String(hour).padStart(2, '0')}:00`);
      assert.ok(Number.isFinite(point.probability) && point.probability >= 0 && point.probability <= 100);
      assert.match(point.note, /가상/);
      run = point.probability >= OBSERVABLE_THRESHOLD ? run + 1 : 0;
      longestRun = Math.max(longestRun, run);
      assert.equal(point.fogTopMeters > 0, point.probability >= OBSERVABLE_THRESHOLD);
    }
    if (longestRun) {
      fogDays++;
      assert.ok(longestRun >= 3 && longestRun <= 8, `${date}: ${longestRun} hours`);
      assert.equal(hours.filter(p => p.probability >= OBSERVABLE_THRESHOLD).length, longestRun);
    }
  }
  assert.equal(totalHours, 744);
  assert.ok(fogDays >= 20);
});

test('fog footprint is a 3 × 3 km square and suppresses fog outside it', () => {
  assert.equal(FOG_FOOTPRINT.widthKm, 3);
  assert.equal(FOG_FOOTPRINT.heightKm, 3);
  for (const [x, y] of [[0, 0], [1.49, 1.49], [-1.49, -1.49], [1.49, -1.49], [-1.49, 1.49]]) {
    const location = locationAt(x, y);
    const projected = footprintCoordinates(location);
    assert.ok(Math.abs(projected.x - x) < 1e-7);
    assert.ok(Math.abs(projected.y - y) < 1e-7);
    assert.equal(isInsideFogFootprint(location), true);
    assert.ok(syntheticForecast('2030-07-02', location).some(p => p.probability >= OBSERVABLE_THRESHOLD));
  }
  for (const [x, y] of [[1.51, 0], [-1.51, 0], [0, 1.51], [0, -1.51], [1.51, 1.51]]) {
    for (const date of SYNTHETIC_DATES) {
      const footprint = fogFootprint(date);
      const location = footprintLocation(x, y, footprint);
      assert.equal(isInsideFogFootprint(location, footprint), false);
      if (!isInsideFogFootprints(location, fogFootprints(date))) {
        assert.ok(syntheticForecast(date, location).every(p => p.probability < OBSERVABLE_THRESHOLD && p.fogTopMeters === 0));
      }
    }
  }
});

test('rendered footprint corners match the classification boundary and fit within the map', () => {
  const centers = new Set();
  for (const date of SYNTHETIC_DATES) {
    const footprint = fogFootprint(date);
    assert.deepEqual(footprint, fogFootprint(date));
    centers.add(`${footprint.lat},${footprint.lon}`);
    const polygon = fogPolygon(footprint);
    assert.equal(polygon.length, 4);
    for (const corner of polygon) {
    const { x, y } = footprintCoordinates(corner, footprint);
    assert.ok(Math.abs(Math.abs(x) - 1.5) < 1e-7);
    assert.ok(Math.abs(Math.abs(y) - 1.5) < 1e-7);
    assert.equal(isInsideFogFootprint(corner, footprint), true);
    assert.ok(corner.lat > MAP_BOUNDS.south && corner.lat < MAP_BOUNDS.north);
    assert.ok(corner.lon > MAP_BOUNDS.west && corner.lon < MAP_BOUNDS.east);
    }
  }
  assert.equal(centers.size, 31);
});

test('pin classification considers area membership before height and fog activity', () => {
  const point = { probability: 80, fogTopMeters: 150 };
  assert.equal(fogPosition(FOG_FOOTPRINT, 292, point), 'above');
  assert.equal(fogPosition(FOG_FOOTPRINT, 150, point), 'edge');
  assert.equal(fogPosition(FOG_FOOTPRINT, 32, point), 'inside');
  assert.equal(fogPosition(FOG_FOOTPRINT, null, point), 'unknown');
  assert.equal(fogPosition(FOG_FOOTPRINT, 292, { ...point, probability: 20 }), 'unknown');
  assert.equal(fogPosition(locationAt(2, 0), 292, point), 'outside');
  for (const id of ['ipark', 'exllu', 'lct-observatory']) {
    assert.ok(MAP_VIEWPOINTS.find(p => p.id === id).elevation > 150);
  }
  for (const date of SYNTHETIC_DATES) {
    const footprint = fogFootprint(date);
    for (const location of MAP_VIEWPOINTS) {
      const classification = fogPosition(location, location.elevation, point, footprint);
      assert.equal(classification === 'outside', !isInsideFogFootprint(location, footprint));
    }
  }
});

test('height comparison uses the selected synthetic date, hour and location', () => {
  const date = '2030-07-02';
  const center = fogFootprint(date);
  const series = syntheticForecast(date, center);
  const active = series.filter(p => p.fogTopMeters > 0);
  assert.ok(active.length >= 1);
  for (const point of active) {
    assert.deepEqual(syntheticFogRange(point), [point.fogTopMeters - 25, point.fogTopMeters + 25]);
  }
  const second = syntheticForecast('2030-07-03', fogFootprint('2030-07-03')).filter(p => p.fogTopMeters > 0);
  assert.notDeepEqual(syntheticFogRange(active[0]), syntheticFogRange(second[0]));
  assert.equal(syntheticFogRange(series[0]), null);
  assert.ok(syntheticForecast(date, { lat: MAP_BOUNDS.south, lon: MAP_BOUNDS.west }).every(p => syntheticFogRange(p) === null));
  assert.ok(syntheticForecast('2030-07-04').every(p => syntheticFogRange(p) === null));
});

test('photography threshold includes exactly 70 percent and Korean clock retains seconds', () => {
  assert.equal(canPhotograph(69.99), false);
  assert.equal(canPhotograph(70), true);
  assert.equal(canPhotograph(100), true);
  assert.deepEqual(koreaClock(new Date('2026-11-28T16:23:45Z')), { hour: 1, time: '01:23:45' });
});

test('date selection produces distinct reproducible series and rejects unavailable dates', () => {
  assert.deepEqual(syntheticForecast('2030-07-02'), syntheticForecast('2030-07-02'));
  assert.notDeepEqual(syntheticForecast('2030-07-01'), syntheticForecast('2030-07-02'));
  assert.ok(syntheticForecast('2030-07-01').every(p => p.probability < OBSERVABLE_THRESHOLD));
  assert.throws(() => syntheticForecast('2030-06-30'), RangeError);
  assert.throws(() => syntheticForecast('2030-07-32'), RangeError);
});


test('multiple daily regions fit the map, never overlap, and all support spatial forecasts', () => {
  const counts = new Map();
  for (const date of SYNTHETIC_DATES) {
    const regions = fogFootprints(date);
    assert.deepEqual(regions, fogFootprints(date));
    counts.set(regions.length, (counts.get(regions.length) ?? 0) + 1);
    const boxes = regions.map(region => {
      assert.equal(region.widthKm, 3);
      assert.equal(region.heightKm, 3);
      const corners = fogPolygon(region);
      const box = {
        south: Math.min(...corners.map(p => p.lat)), north: Math.max(...corners.map(p => p.lat)),
        west: Math.min(...corners.map(p => p.lon)), east: Math.max(...corners.map(p => p.lon)),
      };
      assert.ok(box.south > MAP_BOUNDS.south && box.north < MAP_BOUNDS.north);
      assert.ok(box.west > MAP_BOUNDS.west && box.east < MAP_BOUNDS.east);
      // This also exercises every second/third region, not only the default center.
      const hours = syntheticForecast(date, region);
      const active = hours.filter(p => p.probability >= OBSERVABLE_THRESHOLD);
      assert.ok(active.length >= 1 && active.length <= 8);
      assert.equal(active.at(-1).hour - active[0].hour + 1, active.length);
      assert.equal(fogPosition(region, 500, active[0], regions), 'above');
      assert.ok(isInsideFogFootprints(region, regions));
      return box;
    });
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const x = boxes[a], y = boxes[b];
        // Disjoint enclosing boxes are a stronger condition than disjoint rectangles.
        assert.ok(x.north < y.south || y.north < x.south || x.east < y.west || y.east < x.west, `${date}: overlapping regions`);
      }
    }
    if (!regions.length) {
      assert.ok(syntheticForecast(date).every(p => p.probability < OBSERVABLE_THRESHOLD));
      assert.equal(fogPosition(FOG_FOOTPRINT, 500, { probability: 80, fogTopMeters: 150 }, regions), 'outside');
    }
    const outside = { lat: MAP_BOUNDS.south, lon: MAP_BOUNDS.west };
    assert.equal(isInsideFogFootprints(outside, regions), false);
    assert.ok(syntheticForecast(date, outside).every(p => p.probability < OBSERVABLE_THRESHOLD));
  }
  assert.equal(counts.get(2), 10);
  assert.equal(counts.get(3), 5);
  assert.ok((counts.get(1) ?? 0) + counts.get(2) + counts.get(3) >= 20);
  assert.throws(() => fogFootprints('2030-08-01'), RangeError);
});

test('regional appearances never overlap in time and the daily union lasts three to eight hours', () => {
  let multiRegionDays = 0;
  for (const date of SYNTHETIC_DATES) {
    const regions = fogFootprints(date);
    if (!regions.length) continue;
    const series = regions.map(region => syntheticForecast(date, region));
    const windows = series.map(hours => hours.filter(point => point.probability >= OBSERVABLE_THRESHOLD));
    const starts = windows.map(hours => hours[0].hour);
    assert.equal(new Set(starts).size, regions.length, `${date}: duplicate appearance times`);
    const allHours = windows.flatMap(hours => hours.map(point => point.hour));
    const dailyHours = new Set(allHours);
    assert.equal(dailyHours.size, allHours.length, `${date}: regional appearance times overlap`);
    const daily = syntheticForecast(date).filter(point => point.probability >= OBSERVABLE_THRESHOLD);
    assert.deepEqual(daily.map(point => point.hour), [...dailyHours].sort((a, b) => a - b));
    for (let hour = 0; hour < 24; hour++) {
      assert.ok(series.filter(points => points[hour].probability >= OBSERVABLE_THRESHOLD).length <= 1,
        `${date} ${hour}: multiple simultaneously active regions`);
    }
    assert.ok(dailyHours.size >= 3 && dailyHours.size <= 8, `${date}: ${dailyHours.size} daily hours`);
    assert.equal(Math.max(...dailyHours) - Math.min(...dailyHours) + 1, dailyHours.size);
    for (const [index, hours] of windows.entries()) {
      assert.ok(hours.length >= 1 && hours.length <= 8);
      assert.equal(hours.at(-1).hour - hours[0].hour + 1, hours.length);
      const start = starts[index];
      assert.equal(series[index][start - 1].fogTopMeters, 0);
      assert.equal(series[index][hours.at(-1).hour + 1].fogTopMeters, 0);
    }
    if (regions.length > 1) {
      multiRegionDays++;
      const earliest = Math.min(...starts);
      assert.equal(series.filter(hours => hours[earliest].probability >= OBSERVABLE_THRESHOLD).length, 1);
    }
  }
  assert.equal(multiRegionDays, 15);
});
