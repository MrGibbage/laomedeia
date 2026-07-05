# IPTV Viewer App (Custom Windows App)

Plan for a custom-built Windows IPTV viewing app, motivated by every tested Windows
IPTV app having a dated UI and a bad EPG experience. The EPG is the #1 priority —
it's the thing all the existing apps get wrong.

**Status:** Build order step 2 complete (2026-07-05). EPG ingestion (streaming XMLTV →
SQLite + FTS5 cache), virtualized channel × time grid with day nav / now-line / detail
pane, and full search (channel name, title, AND description) all verified end-to-end —
both against the local sample file and a real provider download. Next: Live TV UX
polish (step 3: favorites, channel-name search, quick switching).
**Project home:** `C:\Users\skip\projects\iptv` on ganymede. Develop with the native
Windows Claude binary from PowerShell — not WSL; Node tooling across /mnt/c is slow. If you detect the user running claude with any linux binary, remind the user to exit and use the Windows binanry in PowerShell, started from the project directory.
This is Skip's first TypeScript project.

## Repo Setup (one-time, not done yet)

Public GitHub repo. From PowerShell in `C:\Users\skip\projects\iptv`:

```powershell
git init
# Create .gitignore BEFORE the first commit. Minimum entries:
#   node_modules/
#   dist/
#   out/
#   .env
#   *.log
git add .
git commit -m "Initial commit: project plan"
gh repo create MrGibbage/iptv --public --source . --push
```

Because the repo is PUBLIC: Xtream credentials (server URL, username, password) must
never be committed — keep them in a gitignored `.env` or in app-managed local config
from day one, and treat the provider URL itself as a secret (it embeds the account).

## Decisions Made

- **Stack: Electron** (same platform as VS Code). Chosen for fast modern-UI iteration;
  the overhead is acceptable because video decoding is offloaded to a native library.
- **Playback: libmpv** (or libVLC as fallback) embedded in the Electron app. Native
  code handles HLS/MPEG-TS decoding — playback does not run through Chromium and
  won't fight the UI thread.
- **Provider: Xtream Codes API** (`player_api.php`). Gives structured JSON for
  live/VOD/series categories, posters, ratings, and EPG (short-form JSON feed plus a
  full XMLTV link). No M3U parsing needed for v1.
- **Scope split:** v1 = live TV + VOD + great EPG. v2 = recordings (DVR).
- **Recordings architecture (v2):** recording must happen on an always-on box, not in
  the Electron client (client-side DVR breaks when the PC sleeps or the app is closed).
  A small recording service runs on docker-server (ffmpeg pulling scheduled streams to
  disk, in the spirit of Tvheadend/Threadfin); the Electron app only schedules,
  browses, and plays back recordings.

## v1 Scope

### Live TV
- Xtream login (server URL + username + password), categories, channel list, favorites.
- Channel logos from the API; quick channel switching; last-channel resume. A settings screen with the ability to enter account parameters, and a funtion to test the connection from the settings screen is a must. In fact, passing the connection test should be mandatory before being able to save the account information.
- **Favorites:** star toggle per channel in the list, persisted locally (alongside the
  Xtream config, in `userData`); favorited channels surface first / are filterable to a
  favorites-only view. Small addition — lands with build-order step 3 (Live TV UX polish).
- **Channel-name search:** quick client-side filter over the already-loaded channel list.
  No EPG dependency, so it can land whenever's convenient in step 3 — doesn't need to wait
  on EPG ingestion.
- A sample playlist.m3u file is provided in the project directory

### EPG (the priority)
- Virtualized channel × time grid (react-virtual or similar) — must stay smooth with
  hundreds of channels and days of program data.
- Now/next bar, program detail pane, jump-to-now, day navigation.
- **Search:** must match against channel name, program title, AND program description —
  not just channel name. This depends on EPG data being ingested/cached first, so it lands
  as part of build-order step 2, alongside the grid itself.
- Data source: provider XMLTV for the full grid; short-form Xtream EPG for quick
  now/next lookups. Cache locally (SQLite or similar) and refresh on a schedule.
- A sample xml file is provided.

### VOD & Series
- Netflix-style browser over Xtream VOD/series categories: posters, ratings, seasons/
  episodes. Mostly presentation work — the API already returns clean structured data.
- Resume-position tracking stored locally.

### App shell / Windows feel
- Custom title bar (VS Code style) or native chrome; taskbar/Alt-Tab, tray, native
  notifications, DPI scaling; packaged as a normal installer (.exe). Ability to view video in full screen.
- Known gap: Windows SMTC media controls (taskbar media overlay) need extra native
  wiring — nice-to-have, not v1-blocking.

## v2 Scope (Recordings)

- Docker container on docker-server: scheduler + ffmpeg capture to disk, small REST
  API for schedule CRUD and recording browsing.
- Electron app gains a "Recordings" section: schedule from the EPG grid (one click on
  a future program), manage rules, play back completed recordings.
- Storage location, retention rules, and Caddy/DNS routing to be decided when v2
  starts — deploy via the create-new-docker skill for hardening and docs.

## Known Risks / Hard Parts

- **EPG grid performance** is the main UI engineering effort; everything else in v1 is
  standard CRUD + presentation.
- **Flaky IPTV streams**: need sane buffering states, retry/failover, and clear error
  UI — this is where roll-your-own IPTV projects usually stall.
- **libmpv + Electron embedding** has some integration friction (rendering the video
  surface inside/behind the Chromium window); solved problem, but budget time for it.

## Suggested Build Order

1. Skeleton Electron app + Xtream login + raw channel list playing through libmpv
   (proves the whole pipeline end to end before any UI polish).
2. EPG ingestion + cache + virtualized grid.
3. Live TV UX polish (favorites, switching, now/next) **plus a modern visual theme** —
   cohesive colors/typography/spacing across channel list, guide, and settings (added
   2026-07-05; the dated look of existing apps is why this project exists, so it stays
   in v1 rather than v2). Also includes **EPG staging-swap** (added 2026-07-05): ingest
   into staging tables and swap atomically on commit, so the previous guide stays fully
   readable while a refresh runs (today the replace happens in-place inside the read
   connection's transaction, so mid-refresh guide browsing can see a partial grid), and
   a friendlier guide empty state while a first/stale refresh is in flight.
4. VOD/series browser.
5. Packaging/installer.
6. v2: recording service on docker-server + app integration.

## Final Notes

Build-order step 1 is done as of 2026-07-05: public repo live at `github.com/MrGibbage/iptv`,
electron-vite (React + TS) scaffold, playback via
[electron-libmpv](https://www.npmjs.com/package/electron-libmpv) (a native addon that embeds
libmpv directly into the Electron window's HWND — Windows-only, GPU-accelerated D3D11
rendering), and an Xtream Codes client (login/test-connection, live categories, live streams,
stream URL building) with a Settings screen that requires a passing connection test before
Save unlocks. All verified against a real provider account: login, channel list with logos,
and live playback all work.

Two things any future session needs to know:
- `electron-libmpv`'s build/runtime files (`C:\mpv-dev\`, `libmpv-2.dll` in the project root)
  are machine-local and gitignored — see the README's Dev Setup section to reprovision them
  on a new machine.
- Xtream HTTP calls live in the main process (`electron/xtream.ts`), not the renderer, to
  avoid CORS issues against arbitrary provider servers. Saved credentials live in
  `app.getPath('userData')/xtream-config.json`, never in the repo.

Since step 1, scope got sharpened (2026-07-05, no code written yet for this part): favorites
(star + persist + favorites-first/filter view) and channel-name search stay in step 3 as
planned; EPG search was clarified to explicitly require matching channel name, program
title, AND program description, not just channel name — that's a step 2 deliverable since
it needs the ingested EPG data. Neither got pushed to v2; both fit v1 cleanly.

Build-order step 2 is done as of 2026-07-05 — the EPG, the feature this project exists for:

- **Ingestion/cache:** the provider's full XMLTV (`xmltv.php`, ~28 MB) streams through a
  SAX parser into `better-sqlite3` at `userData/epg-cache.sqlite3` — channels, programmes
  (indexed by channel + time), an FTS5 index for search, all replaced atomically in one
  transaction. Auto-refresh on start when older than 12 h (rechecked hourly) + manual
  Refresh button. `IPTV_EPG_FILE` env var ingests a local file instead (dev).
- **Grid:** Guide tab with a `@tanstack/react-virtual` channel × time grid (rows join the
  live-stream list to XMLTV ids via `epg_channel_id`), sticky channel column + time ruler,
  now-line, jump-to-now, day navigation clamped to data bounds, programme detail pane with
  a Watch button, click-channel-to-tune. Verified smooth with ~2 k channels / ~96 k
  programmes — only visible rows hit the DOM, programme data loads on demand per visible
  channel.
- **Search:** FTS5 across channel name, title, AND description (the step-2 requirement);
  clicking a result jumps the grid to that channel + time and opens the detail pane.
- Also landed: a now/next bar above the player driven by the same cache.

Gotchas for future sessions: native/CJS modules (`electron-libmpv`, `better-sqlite3`,
`sax`) must stay in `rollupOptions.external` in `vite.config.ts` — Rollup's CJS interop
mangles `sax` at runtime ("Cannot read properties of undefined (reading 'call')") and
bundling breaks native addon path resolution. The mpv video surface is a native child
window, so the always-mounted Player is hidden by collapsing its placeholder to 0×0
(display:none + ResizeObserver) when the Guide tab is open.

Key choices unchanged from the original plan: Electron + libmpv, Xtream Codes as the only
provider format, EPG grid quality as the defining feature, recordings deferred to v2
running server-side on docker-server (never client-side). Next concrete action is build-order
step 3: Live TV UX polish — favorites (star + persist + favorites-first/filter view),
channel-name search over the loaded list, quick channel switching, a modern visual
theme (per Skip, 2026-07-05: modern colors/styling is expected in v1, not deferred),
and the EPG staging-swap so the guide stays readable during background refreshes.
