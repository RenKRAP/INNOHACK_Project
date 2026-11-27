import type { MapLocation } from "../data/coastalViewpoints";
import { nearbyFogPhoto } from "../data/viewpointPhotos";

export function ViewpointPhoto({ location }: { location: MapLocation }) {
  const photo = nearbyFogPhoto(location);

  return (
    <figure aria-labelledby="coastal-photo-title" className="flex min-w-0 flex-col overflow-hidden rounded-sm border border-border bg-card">
      <div className="flex min-h-20 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
        <h2 id="coastal-photo-title" aria-live="polite" className="font-display text-xl leading-tight">{photo.name}</h2>
        <span className="text-xs text-muted-foreground">{photo.locationId === location.id ? "지점 해무 사진" : "인근 해무 기록 사진"}</span>
      </div>
      <a href={photo.src} target="_blank" rel="noopener noreferrer" aria-label={`${photo.name} 사진 크게 보기`} className="relative block h-[370px] shrink-0 overflow-hidden border-y border-border bg-[#dbe4e9] focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:h-[435px] lg:h-[485px]">
        <img
          src={photo.src}
          alt={photo.alt}
          className={`absolute inset-0 h-full w-full object-cover${photo.crop ? " scale-[1.12]" : ""}`}
          style={{ objectPosition: photo.position }}
        />
      </a>
      <figcaption className="flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-5">
        <span>〈{photo.title}〉 {photo.sourceId ? "부산광역시, 2020" : "제공 사진"}</span>
        {photo.sourceId && <a href={`https://www.kogl.or.kr/recommend/recommendDivView.do?division=img&recommendIdx=${photo.sourceId}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring">공공누리 제1유형</a>}
      </figcaption>
    </figure>
  );
}
