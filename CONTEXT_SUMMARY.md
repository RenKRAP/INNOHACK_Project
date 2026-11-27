# INNOHACK project context

## Verified state (2026-11-28)
- Root: C:/Users/wooji/OneDrive/Desktop/INNOHACK. Origin: https://github.com/RenKRAP/INNOHACK_Project.git. Active branch main; HEAD ce4fd0a4399a00ac562befa610c747234da0ed8a, published to origin/main in the previous task.
- User authorized committing and publishing the map legend explanation to origin/main. Remote main matched ce4fd0a before publication; no separate deployment operation requested. Preserve Local_server/, ignored .env/.env.local secrets, and untracked seafog_example/.
- Haemugak source: design/haemugak (React/Vite); production files: public/haemugak. Build with npm.cmd run build --prefix design/haemugak. Stable main.js/style.css, embedded fonts and third-party licenses are generated/preserved by the build. Root serves Haemugak; original app remains available at /index.html.

## UI state and current local change
- Removed the home hero's example forecast summary card (peak time/probability and recommended viewpoint), retaining the hero image, title and CTA.
- Moved the forecast-hour dropdown from the hourly chart into the map header, immediately left of the calendar. Calendar remains at the right beside the coastal-area title. Chart header now displays the selected reference time.
- Removed the duplicate map/3D navigation, /map/terrain route and Viewpoint3DScene component. Home and map routes remain.
- Matched map and nearby-photo header, viewport and footer heights at responsive sizes. Legend labels are now compact 11px text: 해무 위 / 눈높이 / 해무 속 / 영역 밖 / 미확인. Detailed status wording remains in location information.
- Added a bordered white swatch with "해무 출현 예상 영역" (removed the requested white-area prefix) to the compact map legend. Production build and git diff --check passed for this text-only addition; no new browser preview or tests run. Existing bundle-size warning remains.
- Other-viewpoints sidebar shows single-line names only. Hourly chart is below the map on the left; selected location and altitude controls are on the right. Height comparison appears above altitude saving.

## Synthetic forecast behavior retained
- July 2030 scenarios are example data, not live or calibrated forecasts: 31 days / 744 hours, 15 fog days (even dates), each with 4–6 consecutive hours scoring >=65.
- One date-seeded random 3 x 3 km polygon per day, white fill opacity 0.3; all corners fit within fixed bounds 35.128–35.198 N, 129.075–129.190 E (about 10.45 x 7.78 km).
- Polygon displays if any regional hour on the selected date scores >=65, independent of clicked location or selected hour. No-fog dates hide it. Location probabilities and height comparisons remain hourly and spatially constrained.
- Map/location clicks preserve the selected date and capture current KST HH:mm:ss, selecting that hour without subhour interpolation. Manual hour selection clears this reference time. Date/hour/location changes update related panels; altitude persists per coordinate.
- Photography indicators mark hours >=70%. Pins compare recorded elevation to synthetic fog height with a 25 m margin. Buildings use maximum heights: Ipark 292 m, Exllu 153.23 m, LCT 411.6 m; natural elevations: Hwangnyeong 427 m, Jangsan 634 m, Dongbaek 32 m. Dalmaji remains unknown. Building heights are a user convention, not surveyed rooftop elevations.

## Verification
- Current changes: npm.cmd test passed 59/59; production build passed; git diff --check passed. Existing Vite bundle-size warning remains.
- Chrome local preview verified the removed home summary/3D navigation, dropdown/calendar order, aligned map/photo heights, compact legend, and functioning map/chart rendering.
- Temporary Python preview server on 4178 stopped and its Chrome tab closed. Pre-existing server on 4173 preserved.

## Historical backend context and limits
- No backend changes or remote health checks this turn. Original Node app uses Open-Meteo JMA MSM 5 km temperature/dewpoint/RH/wind, default-model visibility/profiles, and Marine SST for 48 hours in Asia/Seoul; these are separate grids, not universal 1 km data.
- Shared concurrency 2, 20-second timeout, forecast/archive caches of 5 minutes/24 hours, max 32 entries, in-flight deduplication, and two retries with 500/1000 ms delays. KIM adapter is inactive. See docs/open-meteo-forecast.md and docs/1km-forecast.md.
- July 2026 archive contains 744 hourly historical forecasts, not observed fog labels. Score >=65 flags July 8/9/14/15/17/20/23. seafog_example/ contains six sourced images; only July 20 Gwangalli has a verified target-area/date match. See its README and docs/weather-data-audit.md.
- Live-data integration/calibration, terrain/sightlines/access and full-district coverage remain future work. Read this project summary before new tasks; keep it concise, English and secret-free.
