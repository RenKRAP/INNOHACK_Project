import { Link, NavLink } from "react-router";

export function HaemugakHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10 lg:px-12">
        <Link
          to="/"
          aria-label="해무각 홈"
          className="group flex items-baseline gap-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span className="font-display text-2xl tracking-tight text-foreground">
            해무각
          </span>
          <span className="hidden font-tabular text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
            HAEUNDAE SEA-FOG
          </span>
        </Link>

        <nav aria-label="주 메뉴" className="flex items-center gap-3 sm:gap-7">
          <NavLink
            to="/map"
            className="relative whitespace-nowrap py-1 text-sm font-medium tracking-wide text-foreground/85 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:underline aria-[current=page]:underline-offset-4"
          >
            전망 지도
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
