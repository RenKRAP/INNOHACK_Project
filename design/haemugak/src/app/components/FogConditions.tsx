import { FOG_CONDITION_SAMPLES } from "../data/fogConditionSamples";
import type { HourlyForecastPoint } from "../data/haemugakData";

export function FogConditions({ forecast }: { forecast: HourlyForecastPoint }) {
  const sample = FOG_CONDITION_SAMPLES[forecast.hour];
  if (!sample) return null;

  const temperatureGap = sample.airTemp - sample.seaTemp;
  const metrics = [
    {
      title: "해무 조건 점수",
      value: sample.score,
      unit: "/ 100",
      detail: "기상 조건을 합산한 예시 점수",
    },
    {
      title: "공기와 바다의 온도차",
      value: `${temperatureGap > 0 ? "+" : ""}${temperatureGap.toFixed(1)}`,
      unit: "°C",
      detail: `기온 ${sample.airTemp.toFixed(1)}° · 해수면 ${sample.seaTemp.toFixed(1)}°`,
    },
    {
      title: "습도와 바람",
      value: sample.humidity,
      unit: "%",
      detail: `${sample.windDirection} · ${sample.windSpeed.toFixed(1)} m/s`,
    },
    {
      title: "추정 해무층 상단",
      value: forecast.fogTopMeters > 0 ? forecast.fogTopMeters : "—",
      unit: forecast.fogTopMeters > 0 ? "m" : "",
      detail: sample.topRange ? `추정 범위 ${sample.topRange.join("–")} m` : "추정 해무층 없음",
    },
  ];

  return (
    <section aria-labelledby="fog-conditions-title" className="mt-8 border-t border-border pt-6 sm:mt-10 sm:pt-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id="fog-conditions-title" className="font-display text-xl leading-tight text-foreground sm:text-2xl">
          해무를 만드는 조건
        </h2>
        <p className="font-tabular text-xs text-muted-foreground">
          <time dateTime={forecast.time}>{forecast.time}</time> KST · 예시 데이터
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed break-keep text-muted-foreground">
        따뜻하고 습한 공기가 차가운 바다 위를 지나며 식을 때, 해무가 생기기 쉬워요.
      </p>
      <dl aria-live="polite" className="mt-4 grid gap-2.5 min-[360px]:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        {metrics.map(({ title, value, unit, detail }) => (
          <div key={title} className="min-w-0 rounded-sm border border-border bg-card px-3.5 py-3.5 sm:px-4 sm:py-4">
            <dt className="text-xs font-medium break-keep text-foreground sm:text-sm">{title}</dt>
            <dd className="font-tabular mt-1.5 leading-tight">
              <strong className="text-2xl font-medium tracking-tight text-accent">{value}</strong>
              {unit && <span className="ml-1 text-xs font-medium text-muted-foreground">{unit}</span>}
            </dd>
            <dd className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
