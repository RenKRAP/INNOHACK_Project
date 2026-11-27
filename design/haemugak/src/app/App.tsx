import { useEffect, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router";
import { HaemugakHeader } from "./components/HaemugakHeader";
import { HaemugakHero } from "./components/HaemugakHero";
import { ViewpointMap } from "./components/ViewpointMap";
import { Viewpoint3DScene } from "./components/Viewpoint3DScene";
import { HaemugakFooter } from "./components/HaemugakFooter";
import { PEAK_HOURLY_FORECAST, VIEWPOINT_SPOTS } from "./data/haemugakData";
import { MAP_VIEWPOINTS, REFERENCE_LOCATION, type MapLocation } from "./data/coastalViewpoints";

const mapLinks = [
  { to: "/map", label: "전망 지도" },
  { to: "/map/terrain", label: "3D 해무 단면" },
];

const homeTitle = "해무각 — 해운대 해무 예보";
const pageTitles = new Map(mapLinks.map(({ to, label }) => [to, `${label} — 해무각`]));

function PageNavigation({ label, links }: { label: string; links: typeof mapLinks }) {
  return (
    <nav aria-label={label} className="mx-auto flex max-w-6xl flex-wrap gap-2 px-6 py-4 sm:px-10 lg:px-12">
      {links.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          className="inline-flex min-h-10 items-center rounded-sm border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const [selectedSpotId, setSelectedSpotId] = useState<string>(VIEWPOINT_SPOTS[0].id);
  const [mapLocation, setMapLocation] = useState<MapLocation>(REFERENCE_LOCATION);
  const [selectedForecast, setSelectedForecast] = useState(PEAK_HOURLY_FORECAST);

  function selectMapLocation(location: MapLocation) {
    setMapLocation(location);
    if (VIEWPOINT_SPOTS.some(({ id }) => id === location.id)) setSelectedSpotId(location.id);
  }

  function selectTerrainSpot(id: string) {
    setSelectedSpotId(id);
    const location = MAP_VIEWPOINTS.find((spot) => spot.id === id);
    if (location) setMapLocation(location);
  }

  useEffect(() => {
    const title = pageTitles.get(pathname) ?? homeTitle;
    document.title = title;
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      mainRef.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  const isMap = pathname === "/map" || pathname.startsWith("/map/");

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground selection:bg-accent/20 selection:text-foreground">
      <HaemugakHeader />
      <main ref={mainRef} tabIndex={-1} className={`flex-1 focus:outline-none${pathname === "/" ? " flex flex-col" : ""}`}>
        {isMap && <PageNavigation label="전망 화면" links={mapLinks} />}
        <Routes>
          <Route path="/" element={<HaemugakHero />} />
          <Route
            path="/map"
            element={
              <ViewpointMap
                selected={mapLocation}
                forecast={selectedForecast}
                onSelect={selectMapLocation}
                onForecastSelect={setSelectedForecast}
              />
            }
          />
          <Route
            path="/map/terrain"
            element={
              <section className="mx-auto max-w-6xl px-6 pt-3 pb-10 sm:px-10 sm:pb-14 lg:px-12">
                <Viewpoint3DScene
                  selectedId={selectedSpotId}
                  onSelectSpot={selectTerrainSpot}
                  activeFilter="전체"
                  forecast={selectedForecast}
                  onForecastSelect={setSelectedForecast}
                />
              </section>
            }
          />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </main>
      <HaemugakFooter />
    </div>
  );
}
