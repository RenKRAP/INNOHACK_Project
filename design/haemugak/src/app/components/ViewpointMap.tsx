import { useState, type FormEvent } from "react";
import { ChevronRight, LocateFixed, MapPin } from "lucide-react";
import { COASTAL_VIEWPOINTS, coordinateKey, INLAND_VIEWPOINTS, MAP_VIEWPOINTS, REFERENCE_LOCATION, type MapLocation } from "../data/coastalViewpoints";
import { FOG_CONDITION_SAMPLES } from "../data/fogConditionSamples";
import { HOURLY_FORECAST, type HourlyForecastPoint, type ViewpointFilter } from "../data/haemugakData";
import { CoastalMap, type MapTone } from "./CoastalMap";
import { ViewpointPhoto } from "./ViewpointPhoto";

type FogRange = readonly [number, number];
const filters: ViewpointFilter[] = ["전체", "해무 위", "경계", "해무 속"];
const statusStyles: Record<MapTone, string> = {
  above: "bg-[#e1eee5] text-[#235c53]",
  edge: "bg-[#dfecf5] text-[#274f70]",
  inside: "bg-[#f5e9d1] text-[#714b20]",
  unknown: "bg-secondary text-muted-foreground",
};
const pinDots: Record<MapTone, string> = {
  above: "bg-[#23675d]", edge: "bg-[#315c82]", inside: "bg-[#89591f]", unknown: "bg-[#536a79]",
};

function viewpointStatus(elevation: number | null, range: FogRange | null) {
  if (elevation == null) return { tone: "unknown" as const, label: "고도 미확인", hint: "관찰 고도를 입력하면 해무층과 비교할 수 있어요." };
  if (!range) return { tone: "unknown" as const, label: "해무 조건 약함", hint: "이 예시 시각에는 비교할 해무층이 표시되지 않아요." };
  if (elevation > range[1]) return { tone: "above" as const, label: "해무 위", hint: "관찰 고도가 추정 해무 상단 범위보다 높아요." };
  if (elevation < range[0]) return { tone: "inside" as const, label: "해무 속", hint: "관찰 고도가 추정 해무 상단 범위보다 낮아요." };
  return { tone: "edge" as const, label: "경계", hint: "관찰 고도가 추정 해무 상단 범위 안에 있어 시야가 달라질 수 있어요." };
}

function readAltitude(key: string) {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null && saved.trim()) {
      const value = Number(saved);
      if (Number.isFinite(value) && value >= 0 && value <= 2000) return value;
    }
  } catch { /* Continue with the representative elevation if storage is unavailable. */ }
  return null;
}

function AltitudeForm({ elevation, fallback, hasOverride, onChange }: {
  elevation: number | null;
  fallback: number | null;
  hasOverride: boolean;
  onChange: (value: number | null) => boolean;
}) {
  const [value, setValue] = useState(elevation?.toString() ?? "");
  const [message, setMessage] = useState("");
  const [invalid, setInvalid] = useState(false);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const altitude = Number(value);
    if (!value.trim() || !Number.isFinite(altitude) || altitude < 0 || altitude > 2000) {
      setMessage("0–2000 m 사이의 관찰 고도를 입력해 주세요.");
      setInvalid(true);
      return;
    }
    const rounded = Math.round(altitude * 10) / 10;
    setValue(String(rounded));
    setInvalid(false);
    setMessage(onChange(rounded) ? "이 위치의 고도를 저장했어요." : "이 화면에 관찰 고도를 적용했어요.");
  }

  return (
    <form noValidate onSubmit={save} className="mt-4 border-t border-border pt-4">
      <label htmlFor="coastal-altitude" className="text-sm font-medium">관찰 해발고도</label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id="coastal-altitude" type="number" min="0" max="2000" step="0.1" inputMode="decimal" placeholder="예: 120"
          value={value} aria-invalid={invalid} aria-describedby="coastal-altitude-help coastal-altitude-feedback"
          className="font-tabular min-h-11 w-0 flex-1 rounded-sm border border-border bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          onChange={(event) => { setValue(event.target.value); setMessage(""); setInvalid(false); }}
        />
        <span className="text-xs text-muted-foreground">m</span>
        <button type="submit" className="min-h-11 shrink-0 cursor-pointer rounded-sm bg-primary px-3.5 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">고도 저장</button>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p id="coastal-altitude-help" className="text-xs leading-relaxed text-muted-foreground">지반 고도에 관찰하는 층의 높이를 더한 값이에요.</p>
        {hasOverride && <button type="button" className="min-h-8 cursor-pointer text-xs text-muted-foreground underline underline-offset-2" onClick={() => {
          const stored = onChange(null);
          setValue(fallback?.toString() ?? "");
          setMessage(stored ? "저장한 고도를 삭제했어요." : "이 화면의 입력 고도를 초기화했어요.");
          setInvalid(false);
        }}>저장값 삭제</button>}
      </div>
      <p id="coastal-altitude-feedback" role="status" className={invalid ? "text-xs text-red-800" : "text-xs text-[#235c53]"}>{message}</p>
    </form>
  );
}

function AltitudeComparison({ elevation, range }: { elevation: number | null; range: FogRange | null }) {
  const heightLimit = Math.max(250, (elevation ?? 0) + 45, (range?.[1] ?? 0) + 40);
  const y = (meters: number) => 88 - meters / heightLimit * 65;
  return (
    <section aria-label="관찰 고도와 해무층 비교" className="mt-4 rounded-sm border border-border bg-background p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-medium">해무층과 높이 비교</h3>
        <span className="font-tabular text-xs text-muted-foreground">{range ? `추정 상단 ${range.join("–")} m` : "해무층 미표시"}</span>
      </div>
      <svg className="mt-1 block w-full max-h-36" viewBox="0 0 320 101" role="img" aria-label={`${elevation == null ? "관찰 고도 미확인" : `관찰 고도 ${elevation} m`}, ${range ? `해무 상단 추정 범위 ${range.join("–")} m` : "해무층 없음"}`}>
        <path d="M31 14 V88 H305" fill="none" stroke="#c4bcac" />
        {range && <>
          <rect x="32" y={y(range[0])} width="273" height={88 - y(range[0])} fill="#dbe8ef" />
          <rect x="32" y={y(range[1])} width="273" height={y(range[0]) - y(range[1])} fill="#bcd5e3" fillOpacity="0.7" />
          <path d={`M32 ${y(range[1])} H305`} stroke="#315c82" strokeDasharray="4 4" />
        </>}
        {elevation != null && <>
          <path d={`M32 ${y(elevation)} H305`} stroke="#23675d" />
          <circle cx="59" cy={y(elevation)} r="4" fill="#23675d" stroke="white" strokeWidth="1.5" />
          <text x="68" y={y(elevation) - 6} fill="#235c53" fontSize="11" fontWeight="600">관찰 위치 {elevation} m</text>
        </>}
        <text x="7" y="92" fill="#625b51" fontSize="10">0 m</text>
      </svg>
    </section>
  );
}

interface ViewpointMapProps {
  selected: MapLocation;
  activeFilter: ViewpointFilter;
  forecast: HourlyForecastPoint;
  onSelect: (location: MapLocation) => void;
  onFilterChange: (filter: ViewpointFilter) => void;
  onForecastSelect: (forecast: HourlyForecastPoint) => void;
}

export function ViewpointMap({ selected, activeFilter, forecast, onSelect, onFilterChange, onForecastSelect }: ViewpointMapProps) {
  const [localOverrides, setLocalOverrides] = useState<Record<string, number | null>>({});
  const locationKey = (point: MapLocation) => `haemugak.altitude.v1:${coordinateKey(point)}`;
  const overrideFor = (point: MapLocation) => {
    const key = locationKey(point);
    return Object.hasOwn(localOverrides, key) ? localOverrides[key] : readAltitude(key);
  };
  const sample = FOG_CONDITION_SAMPLES[forecast.hour];
  const active = (sample?.score ?? 0) >= 65;
  const range = active ? sample?.topRange ?? null : null;
  const override = overrideFor(selected);
  const elevation = override ?? selected.elevation;
  const status = viewpointStatus(elevation, range);
  const [latitude, longitude] = coordinateKey(selected).split(",");

  function saveAltitude(value: number | null) {
    const key = locationKey(selected);
    setLocalOverrides((previous) => ({ ...previous, [key]: value }));
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
      return true;
    } catch { return false; }
  }

  const allPins = MAP_VIEWPOINTS.map((location, index) => {
    const height = overrideFor(location) ?? location.elevation;
    const condition = viewpointStatus(height, range);
    return { location, elevation: height, label: String(index + 1), status: condition.label, tone: condition.tone };
  });
  const shownPins = allPins.filter((pin) => activeFilter === "전체" || pin.status === activeFilter || pin.location.id === selected.id);

  function renderPoints(locations: MapLocation[]) {
    return allPins.filter(({ location }) => locations.includes(location)).map((pin) => (
      <button type="button" key={pin.location.id} aria-pressed={selected.id === pin.location.id} onClick={() => onSelect(pin.location)} className="flex min-h-12 w-full cursor-pointer items-center gap-2.5 border-t border-border px-2 py-2 text-left hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-secondary">
        <span aria-hidden="true" className={`font-tabular grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-medium text-white ${pinDots[pin.tone]}`}>{pin.label}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{pin.location.name}</span>
          <span className="block text-xs text-muted-foreground">{pin.status}</span>
        </span>
        <span className="font-tabular shrink-0 text-xs text-muted-foreground">{pin.elevation == null ? "고도 미입력" : `${pin.elevation} m`}</span>
        <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
    ));
  }

  return (
    <section aria-labelledby="coastal-title" className="border-t border-border bg-card/35">
      <div className="mx-auto max-w-6xl px-6 py-7 sm:px-10 sm:py-9 lg:px-12">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h1 id="coastal-title" className="font-display text-3xl leading-tight sm:text-4xl">해운대·수영 전망 지도</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">지도를 누르면 인근의 해무 사진과 관찰 고도 정보를 볼 수 있어요.</p>
          </div>
          <label className="inline-flex items-center gap-2.5 text-sm font-medium">
            예보 시각
            <select aria-label="지도 예보 시각" value={forecast.time} onChange={(event) => {
              const match = HOURLY_FORECAST.find(({ time }) => time === event.target.value);
              if (match) onForecastSelect(match);
            }} className="font-tabular min-h-10 rounded-sm border border-border bg-card px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring">
              {HOURLY_FORECAST.map(({ time }) => <option key={time}>{time}</option>)}
            </select>
          </label>
        </header>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(315px,0.7fr)] lg:gap-5">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-sm border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 sm:px-5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-accent"><MapPin aria-hidden="true" className="size-3.5" />해운대·수영 연안</span>
                <div role="group" aria-label="해무 상태 필터" className="flex flex-wrap gap-1">
                  {filters.map((filter) => <button key={filter} type="button" aria-pressed={activeFilter === filter} onClick={() => onFilterChange(filter)} className="min-h-8 cursor-pointer rounded-sm border border-border px-2.5 text-xs text-muted-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground">{filter}</button>)}
                </div>
              </div>
              <div className="relative isolate min-h-[370px] border-y border-border sm:min-h-[435px] lg:min-h-[485px]">
                <CoastalMap pins={shownPins} selected={selected} onSelect={onSelect} onPick={(lat, lon) => onSelect({
                  id: "custom", name: "선택한 지도 위치", lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)), elevation: null, kind: "직접 선택한 좌표",
                })} />
                <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2">
                  <div className="rounded-sm border border-white/70 bg-card/95 px-3 py-2 shadow-sm">
                    <span className="block text-[10px] text-muted-foreground">예시 예보 · KST</span>
                    <time dateTime={forecast.time} className="font-tabular text-xl font-medium">{forecast.time}</time>
                  </div>
                  <p className={`rounded-full px-3 py-1.5 text-xs font-medium shadow-sm ${active ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>
                    {active ? "해무 조건 충족" : "해무 조건 약함"}{sample && ` · ${sample.score}점`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
                <div className="flex flex-wrap gap-3.5">
                  {([["above", "해무 위"], ["edge", "경계"], ["inside", "해무 속"], ["unknown", "미확인"]] as const).map(([tone, label]) => (
                    <span key={tone} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`size-2 rounded-full ${pinDots[tone]}`} />{label}</span>
                  ))}
                </div>
                <span>지도 클릭 · 위치 선택</span>
              </div>
            </div>
          </div>

          <ViewpointPhoto location={selected} />

          <aside aria-labelledby="coastal-selected" className="min-w-0 rounded-sm border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="coastal-selected" className="font-display text-2xl leading-tight">{selected.name}</h2>
              <span className="text-xs text-muted-foreground">{selected.kind}</span>
            </div>
            <p className="font-tabular mt-2 text-xs text-accent">위도 {latitude}° · 경도 {longitude}°</p>
            <dl className="mt-3 flex items-center justify-between gap-2 rounded-sm bg-secondary px-3 py-2">
              <dt className="text-xs text-muted-foreground">관찰 해발고도</dt>
              <dd className="font-tabular text-xl font-medium" aria-live="polite">{elevation == null ? <span className="text-sm text-muted-foreground">미확인</span> : `${elevation} m`}</dd>
            </dl>
            <AltitudeForm key={coordinateKey(selected)} elevation={elevation} fallback={selected.elevation} hasOverride={override !== null} onChange={saveAltitude} />

            <div aria-live="polite" className={`mt-4 rounded-sm px-3 py-2 text-sm font-medium ${statusStyles[status.tone]}`}>{status.label}{status.tone === "above" ? " 가능" : ""}</div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{status.hint}</p>
            <AltitudeComparison elevation={elevation} range={range} />
          </aside>

          <section aria-labelledby="coastal-other-points" className="min-w-0 rounded-sm border border-border bg-card p-4 sm:p-5">
            <h2 id="coastal-other-points" className="font-display mb-3 text-xl leading-tight">다른 전망 지점</h2>
            {renderPoints(COASTAL_VIEWPOINTS)}
            <details className="border-t border-border">
              <summary className="min-h-10 cursor-pointer px-2 py-2.5 text-xs font-medium text-muted-foreground">산·섬 전망 지점 3곳</summary>
              {renderPoints(INLAND_VIEWPOINTS)}
            </details>
            <button type="button" onClick={() => { onFilterChange("전체"); onSelect(REFERENCE_LOCATION); }} className="mt-3 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-sm border border-border px-2 text-xs font-medium hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring">
              <LocateFixed aria-hidden="true" className="size-4" />해운대 대표 지점으로 돌아가기
            </button>
          </section>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">지점별 고도 비교에는 같은 해운대 연안 예시 데이터를 사용해요.</p>
      </div>
    </section>
  );
}
