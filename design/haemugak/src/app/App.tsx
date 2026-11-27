import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { HaemugakHeader } from "./components/HaemugakHeader";
import { HaemugakHero } from "./components/HaemugakHero";
import { ViewpointMap } from "./components/ViewpointMap";
import { HaemugakFooter } from "./components/HaemugakFooter";
import { PEAK_HOURLY_FORECAST } from "./data/haemugakData";
import { REFERENCE_LOCATION, type MapLocation } from "./data/coastalViewpoints";

const homeTitle = "해무각 — 해운대 해무 예보";

export default function App() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const [mapLocation, setMapLocation] = useState<MapLocation>(REFERENCE_LOCATION);
  const [selectedForecast, setSelectedForecast] = useState(PEAK_HOURLY_FORECAST);

  useEffect(() => {
    const title = pathname === "/map" ? "전망 지도 — 해무각" : homeTitle;
    document.title = title;
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      mainRef.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground selection:bg-accent/20 selection:text-foreground">
      <HaemugakHeader />
      <main ref={mainRef} tabIndex={-1} className={`flex-1 focus:outline-none${pathname === "/" ? " flex flex-col" : ""}`}>
        <Routes>
          <Route path="/" element={<HaemugakHero />} />
          <Route
            path="/map"
            element={
              <ViewpointMap
                selected={mapLocation}
                forecast={selectedForecast}
                onSelect={setMapLocation}
                onForecastSelect={setSelectedForecast}
              />
            }
          />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </main>
      <HaemugakFooter />
    </div>
  );
}
