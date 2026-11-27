import React from "react";

export function HaemugakFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 px-6 py-10 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-10 lg:px-12">
        <div>
          <span className="font-display text-base text-foreground">해무각</span>
          <p className="mt-1.5 leading-relaxed">
            해운대의 여름 아침, 해무 위로 솟은 도시를 기다리는 사람들을 위한 전망 예보 서비스
          </p>
        </div>

        <div className="flex flex-col items-start gap-1 sm:items-end">
          <span>표시된 시간대별 확률·고도·시계 정보는 예시 데이터입니다.</span>
          <span className="font-tabular text-[11px] text-muted-foreground/80">
            HAEMUGAK · BUSAN SUMMER JOURNAL
          </span>
        </div>
      </div>
    </footer>
  );
}
