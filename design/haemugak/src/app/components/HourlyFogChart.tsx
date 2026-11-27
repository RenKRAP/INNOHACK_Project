import { Camera } from "lucide-react";
import { canPhotograph, PHOTO_THRESHOLD } from "../data/syntheticJuly2030";
import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FORECAST_WINDOW, HOURLY_FORECAST, PEAK_HOURLY_FORECAST, type HourlyForecastPoint } from "../data/haemugakData";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: HourlyForecastPoint }>;
}

function FogTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;

  return (
    <div className="rounded-sm border border-border bg-card px-3.5 py-2.5 text-xs shadow-sm">
      <p className="font-tabular font-medium text-foreground">{item.time} · {item.probability}%</p>
      <p className="mt-1 text-muted-foreground">예상 해무층 높이 {item.fogTopMeters} m</p>
      <p className="mt-1 text-muted-foreground">{item.note}</p>
      {canPhotograph(item.probability) && <p className="mt-1 font-medium text-[#235c53]">촬영 가능 시간 · 확률 70% 이상</p>}
    </div>
  );
}

interface HourlyFogChartProps {
  selected: HourlyForecastPoint;
  compact?: boolean;
  referenceTime?: string;
  onForecastSelect?: (forecast: HourlyForecastPoint) => void;
  series?: HourlyForecastPoint[];
  date?: string;
}

export function HourlyFogChart({ selected, referenceTime, compact = false, onForecastSelect, series = HOURLY_FORECAST, date }: HourlyFogChartProps) {
  const chartId = useId();
  const titleId = `${chartId}-title`;
  const fillId = `${chartId}-fill`;
  const Heading = compact ? "h2" : "h1";
  const photoHours = series.filter(point => canPhotograph(point.probability));
  const observable = series.filter(point => point.probability >= 65);

  return (
    <section
      aria-labelledby={titleId}
      className={compact
        ? "flex min-w-0 flex-1 flex-col rounded-sm border border-border bg-card px-4 py-5 sm:px-6"
        : "mx-auto max-w-6xl px-6 py-8 sm:px-10 sm:py-10 lg:px-12"}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          {!compact && <p className="mb-2 text-xs text-muted-foreground">예시 데이터</p>}
          <Heading id={titleId} className="font-display text-xl leading-tight text-foreground sm:text-2xl">
            시간대별 해무 확률
          </Heading>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-sm text-accent">
          {onForecastSelect ? (
            <label className="inline-flex items-center gap-2 font-medium">
              예보 시각
              <select aria-label="지도 예보 시각" value={selected.time} onChange={(event) => {
                const match = series.find(({ time }) => time === event.target.value);
                if (match) onForecastSelect(match);
              }} className="font-tabular min-h-10 rounded-sm border border-border bg-card px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                {series.map(({ time }) => <option key={time} value={time}>{time}</option>)}
              </select>
            </label>
          ) : <span className="font-tabular"><time dateTime={selected.time}>{selected.time}</time> 선택</span>}
        </div>
      </div>
      {date && <p aria-live="polite" className="mt-3 text-xs leading-relaxed text-muted-foreground">{date} · 가상 데이터 · {observable.length ? `해무 관측 가능 ${observable.length}시간 (확률 65% 이상)` : "해무 관측 가능 시간 없음"}</p>}

      {referenceTime && <p aria-live="polite" className="mt-2 text-xs text-muted-foreground">지도 클릭 시각 {referenceTime} KST · 선택 날짜의 {selected.time}–{String(selected.hour + 1).padStart(2, "0")}:00 시간대 적용</p>}
      <p role="status" className={`mt-3 flex items-start gap-2 rounded-sm px-3 py-2 text-xs ${photoHours.length ? "bg-[#e1eee5] text-[#235c53]" : "bg-secondary text-muted-foreground"}`}>
        <Camera aria-hidden="true" className="size-4 shrink-0" />
        <span>{photoHours.length ? `촬영 가능 · ${photoHours.map(p => p.time).join(", ")} (70% 이상)` : "촬영 가능 시간 없음 (70% 이상 기준)"}{date && " · 가상 시나리오 기준"}</span>
      </p>
      <div className={compact ? "mt-4 flex min-h-0 flex-1 flex-col" : "mt-5 rounded-sm border border-border bg-card px-4 py-5 sm:px-6"}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-px w-4 bg-accent" />해무 확률
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-4 border border-accent/35 bg-accent/10" />
            관측 추천 시간
          </span>
        </div>

        <div className={compact ? "relative mt-4 min-h-64 flex-1" : "relative mt-4 h-[280px] sm:h-[320px]"}>
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 14, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--border)" />
                {observable.length > 0 && <ReferenceArea x1={observable[0].time} x2={observable[observable.length - 1].time} fill="var(--accent)" fillOpacity={0.08} />}
                <ReferenceLine y={PHOTO_THRESHOLD} stroke="#23675d" strokeDasharray="5 3" label={{ value: "촬영 70%", position: "insideTopRight", fill: "#235c53", fontSize: 10 }} />
                <ReferenceLine x={selected.time} stroke="var(--accent)" strokeDasharray="3 3" strokeOpacity={0.65} />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                  minTickGap={10}
                  dy={6}
                />
                <YAxis
                  width={40}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<FogTooltip />} />
                <Area
                  type="monotone"
                  dataKey="probability"
                  stroke="var(--accent)"
                  strokeWidth={2.2}
                  fill={`url(#${fillId})`}
                  isAnimationActive={false}
                  activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--card)", strokeWidth: 2 }}
                />
                {photoHours.map(point => <ReferenceDot key={point.time} x={point.time} y={point.probability} r={4} fill="#23675d" stroke="white" strokeWidth={1.5} />)}
                <ReferenceDot x={selected.time} y={selected.probability} r={5} fill="var(--accent)" stroke="var(--card)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {!compact && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3.5 text-xs text-muted-foreground">
            <span>가장 추천하는 도착 시각 <strong className="font-medium text-foreground">오전 5시 30분 ~ 6시 30분</strong></span>
            <span className="font-tabular">
              {PEAK_HOURLY_FORECAST.time} 최고 {PEAK_HOURLY_FORECAST.probability}% · {FORECAST_WINDOW.clearing} 무렵 걷힘
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
