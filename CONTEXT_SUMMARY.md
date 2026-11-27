# INNOHACK project context

## Verified facts
- Root: C:/Users/wooji/orca/workspaces/INNOHACK/깃허브-업로드. This is a Git worktree for https://github.com/RenKRAP/INNOHACK_Project.git on branch RenK_RAP/깃허브-업로드.
- OnSeafog is a Korean sea-fog exploration website with a fixed Leaflet/OSM map, coordinate-specific weather, five presets, observer altitude persistence, hourly condition scores, and CSV export.
- public/ and model/ contain the UI and explainable rule model. local-server/ serves the site and weather API on 127.0.0.1:4173. Local_server/ is the separate original Express/Supabase backend, preserved unchanged.
- Node >=22 is required. Run npm.cmd ci and npm.cmd run dev; build uses scripts/build.mjs. Dependencies and dist/ are ignored.
- data/july-2026.json contains 744 hourly model-weather records. Scores are uncalibrated conditions, not measured fog probabilities. Independent fog labels and verified model accuracy remain unavailable.
- README.md, docs/requirements.md, docs/model-card.md, and docs/weather-data-audit.md describe behavior and limitations. Network access is required for OSM tiles and uncached weather requests.

## Changes and decisions (2026-11-27)
- Previous upload 5743182 renamed the original server/ to Local_server/ on remote main.
- The latest user request authorizes uploading the completed website to the same GitHub repository. This supersedes the earlier decision to keep website sources unpublished; no hosting service configuration is changed here.
- Copied the latest website from C:/Users/wooji/OneDrive/Desktop/INNOHACK, including its uncommitted UI/model/doc changes and weather-data audit. Source worktree was left unchanged.
- Preserved Local_server/ and updated the website README to reference its current name. The site's local-server/ remains distinct.
- Included source requirements, bundled data, documentation, and tests. Excluded dependencies, generated build output, and environment secrets.

## Verification
- npm.cmd ci and npm.cmd run build passed; npm.cmd test passed all 24 tests.
- All 28 files in the copied site directories matched the latest source by SHA-256, including the open Word source using shared read access.
- Built homepage, CSS, app JS, Leaflet, model JS, health API, and bundled weather API returned HTTP 200 in an ephemeral local-server check; the server was closed afterward.
- Local_server/ has no changes relative to 5743182. Delivery target is remote main; verify its commit ID after pushing.

## Remaining limitations
- No public hosting URL is configured. Original backend deployment settings are unknown; any setting referencing server/ requires Local_server/.
- Data/product resolution, sparse vertical profiles, missing observation labels, calibration, and additional provider integrations remain limitations; see docs/.
- Source worktree main at c4cb91a remains separate with its existing local edits. Continue website edits in the intended worktree and synchronize deliberately.
