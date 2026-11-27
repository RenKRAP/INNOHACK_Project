import test from 'node:test';
import assert from 'node:assert/strict';
import { bindMapInteractions, FIXED_MAP_OPTIONS } from '../public/map-interactions.js';

function send(target, type, props = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, props); target.dispatchEvent(event); return event.defaultPrevented;
}

test('fixed regional map disables all user navigation', () => {
  for (const key of ['dragging', 'scrollWheelZoom', 'doubleClickZoom', 'touchZoom', 'boxZoom', 'keyboard', 'zoomControl']) assert.equal(FIXED_MAP_OPTIONS[key], false);
});

test('map suppresses middle autoscroll and wheel while outside page retains native behavior', () => {
  const map = new EventTarget(), page = new EventTarget();
  const cleanup = bindMapInteractions(map);
  for (const [type, props] of [['mousedown', { button: 1 }], ['auxclick', { button: 1 }], ['wheel', {}]]) {
    assert.equal(send(map, type, props), true);
    assert.equal(send(page, type, props), false);
  }
  assert.equal(send(map, 'mousedown', { button: 0 }), false);
  assert.equal(send(map, 'auxclick', { button: 2 }), false);
  cleanup();
  assert.equal(send(map, 'mousedown', { button: 1 }), false);
  assert.equal(send(map, 'auxclick', { button: 1 }), false);
  assert.equal(send(map, 'wheel'), false);
});
