# IPTV Viewer App (Custom Windows App)

Plan for a custom-built Windows IPTV viewing app, motivated by every tested Windows
IPTV app having a dated UI and a bad EPG experience. The EPG is the #1 priority —
it's the thing all the existing apps get wrong.

**Status:** Build order step 1 complete (2026-07-05). Repo scaffolded, libmpv embedded
and rendering (GPU-accelerated), and Xtream login + raw channel list + live playback all
verified end-to-end against a real account. Next: EPG ingestion (step 2).
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
3. Live TV UX polish (favorites, switching, now/next).
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

Key choices unchanged from the original plan: Electron + libmpv, Xtream Codes as the only
provider format, EPG grid quality as the defining feature, recordings deferred to v2
running server-side on docker-server (never client-side). Next concrete action is build-order
step 2: EPG ingestion + cache + the virtualized channel × time grid — the part of this
project that actually justifies building it instead of using an existing IPTV app.
