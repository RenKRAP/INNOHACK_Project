import { useEffect, useRef, useState } from "react";
import { divIcon, latLngBounds, map, marker, polygon, tileLayer, type Map as LeafletMap, type Marker, type Polygon } from "leaflet";
import "leaflet/dist/leaflet.css";
import "../../styles/coastal-map.css";
import type { MapLocation } from "../data/coastalViewpoints";

import { MAP_BOUNDS } from "../data/syntheticJuly2030";

export type MapTone = "above" | "edge" | "inside" | "unknown" | "outside";

interface MapPin {
  location: MapLocation;
  label: string;
  status: string;
  tone: MapTone;
  elevation: number | null;
}

interface CoastalMapProps {
  fogPolygon: { lat: number; lon: number }[] | null;
  pins: MapPin[];
  selected: MapLocation;
  onPick: (lat: number, lon: number) => void;
  onSelect: (location: MapLocation) => void;
}

const bounds = latLngBounds([MAP_BOUNDS.south, MAP_BOUNDS.west], [MAP_BOUNDS.north, MAP_BOUNDS.east]);

function pinIcon(label: string, tone: MapTone, selected: boolean) {
  return divIcon({
    className: `coastal-pin coastal-pin--${tone}${selected ? " coastal-pin--selected" : ""}`,
    html: label,
    iconSize: [25, 25],
    iconAnchor: [12.5, 12.5],
    tooltipAnchor: [0, -12],
  });
}

export function CoastalMap({ pins, selected, onPick, onSelect, fogPolygon }: CoastalMapProps) {
  const target = useRef<HTMLDivElement>(null);
  const instance = useRef<LeafletMap | null>(null);
  const pinLayers = useRef(new Map<string, Marker>());
  const chosenLayer = useRef<Marker | null>(null);
  const fogLayer = useRef<Polygon | null>(null);
  const handlers = useRef({ onPick, onSelect });
  const [tilesUnavailable, setTilesUnavailable] = useState(false);

  useEffect(() => { handlers.current = { onPick, onSelect }; }, [onPick, onSelect]);

  useEffect(() => {
    if (!target.current) return;
    const leaflet = map(target.current, {
      zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
      touchZoom: false, boxZoom: false, keyboard: false, zoomSnap: 0.25,
    });
    instance.current = leaflet;

    const fit = () => leaflet.fitBounds(bounds, { padding: [24, 26], animate: false });
    fit();
    const tiles = tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(leaflet);
    // Partial tile failure can occur at the map edge. Keep usable tiles in view.
    let loaded = false;
    tiles.on("tileload", () => { loaded = true; setTilesUnavailable(false); });
    tiles.on("tileerror", () => { if (!loaded) setTilesUnavailable(true); });
    leaflet.on("click", ({ latlng }) => handlers.current.onPick(latlng.lat, latlng.lng));
    const resize = new ResizeObserver(() => {
      leaflet.invalidateSize({ pan: false });
      fit();
    });
    resize.observe(target.current);
    return () => {
      resize.disconnect();
      leaflet.remove();
      instance.current = null;
      chosenLayer.current = null;
      fogLayer.current = null;
      pinLayers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!instance.current) return;
    if (!fogPolygon) {
      fogLayer.current?.remove();
      fogLayer.current = null;
      return;
    }
    const corners = fogPolygon.map(({ lat, lon }) => [lat, lon] as [number, number]);
    if (fogLayer.current) fogLayer.current.setLatLngs(corners);
    else fogLayer.current = polygon(corners, {
      color: "#ffffff", weight: 1.5, opacity: 0.8, fillColor: "#ffffff", fillOpacity: 0.3,
      interactive: false,
    }).addTo(instance.current);
  }, [fogPolygon]);

  useEffect(() => {
    const leaflet = instance.current;
    if (!leaflet) return;
    const visible = new Set(pins.map(({ location }) => location.id));
    for (const [id, layer] of pinLayers.current) {
      if (visible.has(id)) continue;
      layer.remove();
      pinLayers.current.delete(id);
    }
    for (const { location, label, status, tone, elevation } of pins) {
      const icon = pinIcon(label, tone, location.id === selected.id);
      let layer = pinLayers.current.get(location.id);
      if (!layer) {
        layer = marker([location.lat, location.lon], { icon, keyboard: true, autoPanOnFocus: false }).addTo(leaflet);
        layer.on("click", () => handlers.current.onSelect(location));
        layer.bindTooltip(location.name, { direction: "top" });
        pinLayers.current.set(location.id, layer);
      } else {
        layer.setIcon(icon);
      }
      const height = elevation == null ? "고도 미입력" : `해발 ${elevation}m`;
      layer.getElement()?.setAttribute("aria-label", `${location.name} (${status}, ${height})`);
      layer.getElement()?.setAttribute("aria-pressed", String(location.id === selected.id));
    }

    chosenLayer.current?.remove();
    chosenLayer.current = visible.has(selected.id) ? null : marker([selected.lat, selected.lon], {
      icon: divIcon({ className: "coastal-target", html: "", iconSize: [30, 30], iconAnchor: [15, 15] }),
      interactive: false, keyboard: false,
    }).addTo(leaflet);
  }, [pins, selected]);

  return (
    <>
      <div ref={target} className="coastal-leaflet absolute inset-0 z-0" role="group" aria-label="해운대와 수영 고정 지도. 원하는 위치나 지점 핀을 선택하세요." />
      {tilesUnavailable && (
        <p role="status" className="pointer-events-none absolute top-20 right-3 left-3 z-10 max-w-xs rounded-sm border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          지도 배경을 불러오지 못했어요. 지점 선택과 고도 비교는 사용할 수 있어요.
        </p>
      )}
    </>
  );
}
