# INNOHACK project context

## Verified facts
- Root: C:/Users/wooji/orca/workspaces/INNOHACK/깃허브-업로드; Git worktree for https://github.com/RenKRAP/INNOHACK_Project.git on branch RenK_RAP/깃허브-업로드.
- OnSeafog is a Korean sea-fog exploration website with a fixed Leaflet/OSM map, coordinate-specific weather, five presets, observer altitude persistence, hourly condition scores, and CSV export.
- public/ and model/ contain the UI and explainable rule model. local-server/ serves the site and weather API (default 127.0.0.1:4173; HOST and PORT configurable). Local_server/ is the separate original Express/Supabase backend.
- Node >=22 is required. Run npm.cmd ci and npm.cmd run dev. Build generates ignored dist/; npm.cmd start serves it. Dependencies and environment secrets are ignored.
- data/july-2026.json contains 744 hourly model-weather records. Scores are uncalibrated conditions, not measured fog probabilities. Independent fog labels and verified model accuracy remain unavailable.
- README.md and docs/ describe behavior and limitations. OSM tiles, web fonts, and uncached external weather need network access.

## Changes and decisions (2026-11-27)
- Historical: 5743182 renamed server/ to Local_server/. ee22186 uploaded the latest website, including uncommitted source-worktree changes; preserved the original backend and excluded generated files and secrets.
- Incorporated remote b971747 (HOST environment variable support) before the README update.
- Rewrote README.md in Korean based on uploaded code: features, setup, scripts, API, data/model limitations, observation evaluation, folder roles, optional DB server, and hosting environment variables.

## Verification
- Historical website upload: npm.cmd ci/build passed, all 24 tests passed, all 28 copied site files matched source hashes, and homepage/assets/health/bundled weather returned HTTP 200; temporary server stopped.
- README update: relative document links exist, documented npm scripts match package.json, code fences are balanced, bundled dataset contains the documented 744 hours, and git diff --check passed. Runtime tests were not repeated for this documentation-only change.

## Unknowns and remaining work
- Public hosting URL and original backend deployment configuration are unverified. Any old deployment path referencing server/ must use Local_server/.
- Missing observation labels, sparse vertical profiles, calibration, and additional provider integrations remain limitations; see docs/.
- Separate source worktree C:/Users/wooji/OneDrive/Desktop/INNOHACK remains untouched with its existing local edits; synchronize deliberately.
