import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { FORECAST_WINDOW, HOURLY_FORECAST, PEAK_HOURLY_FORECAST, type HourlyForecastPoint } from "../data/haemugakData";
import { FogConditions } from "./FogConditions";
import { HourlyFogChart } from "./HourlyFogChart";

const stageLabels: Record<string, string> = {
  [FORECAST_WINDOW.start]: "짙어지기 시작",
  [PEAK_HOURLY_FORECAST.time]: "가장 짙음",
  [FORECAST_WINDOW.clearing]: "걷힐 무렵",
};
const stages = HOURLY_FORECAST.filter(({ time }) => time in stageLabels);

interface ForecastSummaryProps {
  selected: HourlyForecastPoint;
  onSelect: (forecast: HourlyForecastPoint) => void;
}

export function ForecastSummary({ selected, onSelect }: ForecastSummaryProps) {
  return (
    <section id="forecast" aria-labelledby="forecast-title" className="border-t border-border bg-card/55">
      <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
        <header>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>부산 해운대 연안</span>
            <span className="border-l border-border pl-3">예시 데이터</span>
          </div>
          <h1 id="forecast-title" className="font-display mt-2 text-3xl leading-tight text-foreground sm:text-4xl">
            해무 예보
          </h1>
        </header>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-5">
          <section aria-labelledby="visit-window-title" className="flex min-w-0 flex-col items-start rounded-sm border border-border bg-secondary px-5 py-4 text-foreground sm:px-6 sm:py-5">
            <h2 id="visit-window-title" className="text-sm font-medium">해무 관측 추천 시간</h2>
            <p className="font-tabular mt-3 text-[clamp(1.65rem,5.75vw,2.5rem)] leading-tight whitespace-nowrap tracking-[-0.055em]">
              <time dateTime={FORECAST_WINDOW.start}>{FORECAST_WINDOW.start}</time>
              <span className="mx-1.5 text-accent">–</span>
              <time dateTime={FORECAST_WINDOW.end}>{FORECAST_WINDOW.end}</time>
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed break-keep text-muted-foreground">
              해무 위로 빌딩이 드러나는 풍경을 기다리기 좋은 아침 시간대입니다.
            </p>
            <Link to="/map" className="mt-2 inline-flex min-h-9 items-center gap-2 border-b border-accent/45 text-sm font-medium text-accent hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              전망 지도 보기 <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </section>

          <section aria-labelledby="morning-stages-title" className="min-w-0 rounded-sm border border-border bg-card px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="morning-stages-title" className="font-display text-xl leading-tight text-foreground">아침 해무 흐름</h2>
              <time dateTime={selected.time} className="font-tabular text-xs text-accent">{selected.time} 예보</time>
            </div>
            <div role="group" aria-label="아침 예보 시각 선택" className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
              {stages.map((stage) => (
                <button key={stage.hour} type="button" onClick={() => onSelect(stage)} aria-pressed={selected.hour === stage.hour} className="flex min-h-16 cursor-pointer flex-col justify-center rounded-sm border border-border px-1.5 text-left transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:border-accent aria-pressed:bg-secondary sm:px-3">
                  <time dateTime={stage.time} className="font-tabular text-sm font-medium text-foreground sm:text-base">{stage.time}</time>
                  <span className="mt-0.5 text-xs break-keep text-muted-foreground">{stageLabels[stage.time]}</span>
                </button>
              ))}
            </div>
            <div aria-live="polite" className="mt-3 border-t border-border pt-3">
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-muted-foreground">해무 확률</dt>
                  <dd className="font-tabular mt-1 text-xl font-medium text-[#24567d]">{selected.probability}%</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">예상 해무층 높이</dt>
                  <dd className="font-tabular mt-1 text-xl font-medium text-foreground">{selected.fogTopMeters} m</dd>
                </div>
              </dl>
              <p className="mt-2.5 text-xs leading-relaxed break-keep text-muted-foreground">{selected.note}</p>
            </div>
            <Link to="/map" className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              전망 지도 보기 <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </section>

          <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col">
            <HourlyFogChart selected={selected} compact />
          </div>
        </div>
        <FogConditions forecast={selected} />
      </div>
    </section>
  );
}
