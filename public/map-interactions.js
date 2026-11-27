// The revised source requires a fixed viewport. Click selection stays available.
export const FIXED_MAP_OPTIONS = Object.freeze({
  zoomControl: false, dragging: false, scrollWheelZoom: false,
  doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false,
  zoomSnap: 0.1,
});

export function bindMapInteractions(container) {
  const middle = event => {
    if (event.button !== 1) return;
    event.preventDefault(); event.stopPropagation();
  };
  const wheel = event => { event.preventDefault(); event.stopPropagation(); };
  container.addEventListener('mousedown', middle, { capture: true });
  container.addEventListener('auxclick', middle);
  container.addEventListener('wheel', wheel, { passive: false });
  return () => {
    container.removeEventListener('mousedown', middle, { capture: true });
    container.removeEventListener('auxclick', middle);
    container.removeEventListener('wheel', wheel);
  };
}
