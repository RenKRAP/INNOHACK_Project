import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { HERO_IMAGE_URL, PEAK_HOURLY_FORECAST, VIEWPOINT_SPOTS } from "../data/haemugakData";

const viewpoint = VIEWPOINT_SPOTS.find((spot) => spot.status === "해무 위");

export function HaemugakHero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex w-full flex-1 items-center overflow-hidden bg-[#102a47] text-white">
      <figure className="absolute inset-0">
        <img
          src={HERO_IMAGE_URL}
          alt="푸른 해운대 앞바다 너머로 낮게 깔린 해무와 그 위로 솟은 고층 빌딩들"
          className="home-fog-photo absolute inset-0 h-full w-full object-cover object-[64%_55%] md:object-[50%_57%]"
          loading="eager"
          fetchPriority="high"
          width={1415}
          height={1111}
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(7,25,46,0.86),rgba(7,25,46,0.62)_58%,rgba(7,25,46,0.2))] md:bg-[linear-gradient(90deg,rgba(7,25,46,0.86),rgba(7,25,46,0.64)_29%,rgba(7,25,46,0.18)_57%,transparent_77%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-[#07192e]/75 to-transparent" />
        <figcaption className="absolute inset-x-0 bottom-0 mx-auto flex max-w-6xl flex-wrap gap-x-3 gap-y-1 px-6 pb-5 text-xs leading-relaxed text-white/90 sm:justify-end sm:px-10 lg:px-12">
          <span>〈해운대 해무가 걸린 풍경〉 부산광역시, 2020 · 해무 보정</span>
          <a
            href="https://www.kogl.or.kr/recommend/recommendDivView.do?division=img&recommendIdx=14737"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            공공누리 제1유형
          </a>
        </figcaption>
      </figure>
      <div className="pointer-events-none relative mx-auto w-full max-w-6xl px-6 pt-12 pb-28 sm:px-10 sm:py-20 lg:px-12">
        <div className="pointer-events-auto max-w-sm">
          <h1 id="hero-title" className="font-display text-4xl leading-[1.16] tracking-tight sm:text-5xl lg:text-[3.25rem]">
            해무에 잠긴
            <br />
            해운대
          </h1>
          <p className="mt-4 max-w-xs text-sm leading-relaxed break-keep text-white/90 sm:text-[15px]">
            바다 안개가 깔리는 시간과 그 위로 시야가 열리는 곳을 찾아보세요.
          </p>
          <aside aria-labelledby="home-briefing" className="mt-6 rounded-sm border border-white/25 bg-[#0c2843]/75 px-4 py-3.5 sm:px-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 id="home-briefing" className="text-xs font-medium">해무 예보 한눈에</h2>
              <span className="text-[11px] text-white/80">예시 데이터</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 divide-x divide-white/20 border-t border-white/20">
              <div className="pt-2.5 pr-2.5">
                <dt className="text-xs text-white/80">최고 확률 시각</dt>
                <dd className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[#d6ebff]">
                  <span className="font-tabular text-[17px] font-medium">{PEAK_HOURLY_FORECAST.time}</span>
                  <strong className="font-tabular text-[17px] font-medium">{PEAK_HOURLY_FORECAST.probability}%</strong>
                </dd>
              </div>
              {viewpoint && (
                <div className="pt-2.5 pl-3 sm:pl-4">
                  <dt className="text-xs text-white/80">해무 위 전망</dt>
                  <dd className="mt-1 text-[17px] font-medium">{viewpoint.name}</dd>
                </div>
              )}
            </dl>
          </aside>
          <div className="mt-6 flex flex-wrap gap-2.5">

            <Link
              to="/map"
              className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-white/55 bg-[#0c2843]/60 px-4 text-sm font-medium text-white transition-colors hover:border-white hover:bg-[#0c2843]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              전망 지도 보기
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
