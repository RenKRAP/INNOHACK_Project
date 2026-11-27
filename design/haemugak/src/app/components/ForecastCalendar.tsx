import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { SYNTHETIC_DATES } from "../data/syntheticJuly2030";

export function ForecastCalendar({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    current.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return (
    <div ref={root} className="relative shrink-0" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); close(); } }}>
      <button ref={trigger} type="button" aria-label={`예보 날짜 선택, ${date}`} title={`예보 날짜 선택: ${date}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)} className="grid size-10 cursor-pointer place-items-center rounded-sm border border-border bg-card text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring">
        <CalendarDays aria-hidden="true" className="size-5" />
      </button>
      {open && <div id={id} role="dialog" aria-label="예보 날짜 선택" className="absolute right-0 top-12 z-50 w-72 rounded-sm border border-border bg-card p-4 text-foreground shadow-lg">
        <div className="mb-3 flex items-center justify-between"><strong>2030년 7월</strong><button type="button" onClick={close} aria-label="달력 닫기" className="grid size-8 cursor-pointer place-items-center"><X aria-hidden="true" className="size-4" /></button></div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["일", "월", "화", "수", "목", "금", "토"].map(day => <span key={day} className="py-2 text-muted-foreground">{day}</span>)}
          <span aria-hidden="true" />
          {SYNTHETIC_DATES.map((value, i) => <button key={value} ref={date === value ? current : undefined} type="button" aria-label={`${value} 가상 데이터`} aria-pressed={date === value}
            onClick={() => { onChange(value); close(); }} className="min-h-9 cursor-pointer rounded-sm hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground">{i + 1}</button>)}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">가상 데이터 · 7월 1~31일 선택 가능</p>
      </div>}
    </div>
  );
}
