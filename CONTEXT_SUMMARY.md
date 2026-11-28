# INNOHACK project context

## Verified state (2026-11-28)
- Root: C:/Users/wooji/OneDrive/Desktop/INNOHACK. Origin: https://github.com/RenKRAP/INNOHACK_Project.git. Active branch main. Font/header changes follow 1312b0f (regional schedules/UI), previously pushed to origin/main.
- Current request: commit and push the verified font/header changes to GitHub. No deployment requested. Preserve Local_server/, ignored .env/.env.local secrets, and untracked seafog_example/.
- Haemugak source: design/haemugak (React/Vite); production files: public/haemugak. Build with npm.cmd run build --prefix design/haemugak. Stable main.js/style.css, embedded fonts and third-party licenses are generated/preserved by the build. Root serves Haemugak; original app remains available at /index.html.

## UI state and current local change
- Unified headings, body, tabular text and map tooltip/popup text with the shared Noto Sans KR font stack. Removed the unused serif font-face from CSS. Removed the top-bar 홈으로 button; the brand link and map link remain. Rebuilt production assets.
- Removed the home hero's example forecast summary card (peak time/probability and recommended viewpoint), retaining the hero image, title and CTA.
- Moved the forecast-hour dropdown from the hourly chart into the map header, immediately left of the calendar. Calendar remains at the right beside the coastal-area title. Chart header now displays the selected reference time.
- Removed the duplicate map/3D navigation, /map/terrain route and Viewpoint3DScene component. Home and map routes remain.
- Matched map and nearby-photo header, viewport and footer heights at responsive sizes. Legend labels are now compact 11px text: 해무 위 / 눈높이 / 해무 속 / 영역 밖 / 미확인. Detailed status wording remains in location information.
- Compact map legend labels the region "해무 출현 예상 영역" with a CloudFog icon.
- Fog presentation now uses a scalloped SVG cloud with three mist lines, white fill opacity 0.3 and a 4px white outline. Its outline stays inside the original rectangle with at most 20px inset per axis (corners under 30px). It redraws for map resize/movement, allows clicks through, and leaves all geographic classification data rectangular.
- Other-viewpoints sidebar shows single-line names in equal-height rows; Hwangnyeong, Jangsan and Dongbaek appear directly after coastal points without a dropdown. Map/photo headers, viewports and desktop footers have matching heights; hour/calendar controls are 40px tall and paired chart/location cards share padding. Hourly chart is below the map on the left; selected location and altitude controls are on the right. Height comparison appears above altitude saving.
- Removed the map's long July 2030 scenario explanation and the footer's example probability/elevation/visibility notice, as requested. Production assets rebuilt; revised synthetic behavior is documented below.

## Synthetic forecast behavior
- July 2030 scenarios are example data, not live or calibrated forecasts: 31 days / 744 default hourly records, 20 fog days (5 single-region, 10 double-region, 5 triple-region). Each day's total 3-8 observable hours scoring >=65 is partitioned into consecutive, nonoverlapping regional windows (individual regions can last 1-8 hours). At most one region is active per hour. No-location forecasts report the daily union; location forecasts report only their region.
- Date-seeded random 3 x 3 km rectangles occupy separate shuffled slots, with no overlap. All corners fit within fixed bounds 35.128-35.198 N, 129.075-129.190 E (about 10.45 x 7.78 km). Each location uses its own region schedule. The cloud SVG is presentation only.
- All daily regions display if any regional hour on the selected date scores >=65, independent of clicked location or selected hour. No-fog dates hide them. Map clicks and pin classification check membership in any daily rectangle; probabilities and height comparisons remain hourly and spatially constrained.
- Map/location clicks preserve the selected date and capture current KST HH:mm:ss, selecting that hour without subhour interpolation. Manual hour selection clears this reference time. Date/hour/location changes update related panels; altitude persists per coordinate.
- Photography indicators mark hours >=70%. Pins compare recorded elevation to synthetic fog height with a 25 m margin. Buildings use maximum heights: Ipark 292 m, Exllu 153.23 m, LCT 411.6 m; natural elevations: Hwangnyeong 427 m, Jangsan 634 m, Dongbaek 32 m. Dalmaji remains unknown. Building heights are a user convention, not surveyed rooftop elevations.

## Verification
- Font/header changes: production build and npm.cmd test (61/61) passed. Source checks confirm no remaining serif family or top-bar 홈으로 button. Tests cover July counts, daily union of consecutive 3-8 active hours, regional temporal non-overlap, spatial forecast differences, map bounds, 3 x 3 km dimensions, spatial non-overlap and deterministic behavior. git diff --check passed. Existing Vite bundle-size warning remains.
- Current browser visual verification could not complete: browser access host unavailable. Cloud appearance and click-through behavior still need a manual visual check. Historical Chrome preview verified the prior UI layout and functioning map/chart rendering.
- No temporary server started for the current changes. Historical temporary Python server on 4178 was stopped; pre-existing server on 4173 is preserved.

## Historical backend context and limits
- No backend changes or remote health checks this turn. Original Node app uses Open-Meteo JMA MSM 5 km temperature/dewpoint/RH/wind, default-model visibility/profiles, and Marine SST for 48 hours in Asia/Seoul; these are separate grids, not universal 1 km data.
- Shared concurrency 2, 20-second timeout, forecast/archive caches of 5 minutes/24 hours, max 32 entries, in-flight deduplication, and two retries with 500/1000 ms delays. KIM adapter is inactive. See docs/open-meteo-forecast.md and docs/1km-forecast.md.
- July 2026 archive contains 744 hourly historical forecasts, not observed fog labels. Score >=65 flags July 8/9/14/15/17/20/23. seafog_example/ contains six sourced images; only July 20 Gwangalli has a verified target-area/date match. See its README and docs/weather-data-audit.md.
- Live-data integration/calibration, terrain/sightlines/access and full-district coverage remain future work. Read this project summary before new tasks; keep it concise, English and secret-free.
