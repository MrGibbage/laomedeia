# IPTV Viewer App (Custom Windows App)

Plan for a custom-built Windows IPTV viewing app, motivated by every tested Windows
IPTV app having a dated UI and a bad EPG experience. The EPG is the #1 priority —
it's the thing all the existing apps get wrong.

**Status:** Build order step 3 complete (2026-07-05), plus playback error-handling
hardening (2026-07-06) added after real-world testing surfaced a channel that could
freeze mpv's core and wedge the whole app. The App shell backlog (full-screen toggle,
custom window title, sidebar hide/show, keyboard-shortcuts reference in Settings,
"stats for nerds" playback info panel) requested 2026-07-06 is now implemented and
verified against a real account — details under "App shell / Windows feel" below.
Build-order step 4 (VOD/series browser) is now fully implemented (2026-07-06): VOD
browsing/playback/resume verified against a real account; series browsing (seasons/
episodes) built the same session, pending its own manual verification pass. Next:
build-order step 5, packaging/installer — plus two small backlog items requested
2026-07-06 (a VOD/series time scrubber, and idle-based cursor show/hide instead of the
current flat hide) noted under "VOD & Series" and "App shell / Windows feel" below.
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
- **Backlog, requested 2026-07-06, wants a design look before turning on:** category
  browsing for Live TV, mirroring the VOD/series category sidebar. The API already
  supports it (`getLiveCategories` in `electron/xtream.ts` is implemented and even
  wired through IPC/preload, just never called from any UI). Skip's own read: search
  is already blazing fast for getting to a known channel, so this would mainly help
  discovery ("what do I have in Sports?"), not speed — wants to see a concrete design
  before deciding whether it's worth the added sidebar clutter next to favorites/
  search/hide controls that are already there.

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
- **VOD chunk implemented and verified against a real account 2026-07-06:** a "Movies" tab
  (`electron/xtream.ts`: `getVodCategories`/`getVodStreams`/`getVodInfo`/
  `buildVodStreamUrl`) shows a category sidebar + poster grid
  (`src/components/VodBrowser.tsx`); clicking a poster opens a detail overlay (plot,
  cast, director, genre, rating, release year) with Play/Resume buttons. Playback
  reuses the single mpv instance already used for live TV — the same "loadfile
  replace" pattern, no second player. A movie's playback position is saved every 20s
  while playing (`electron/progress-store.ts`, `progress.json` in userData, keyed
  `vod:<streamId>`) and cleared once a title has been watched to near the end, so
  finished movies fall back to a plain Play button instead of Resume. The browser
  itself stays mounted (display:none, not unmounted) while a movie plays, so category/
  scroll/filter state survives returning via "Back to Movies" — same technique already
  used to keep the Live view's mpv window alive under Settings/Guide.
- **Series chunk implemented 2026-07-06, pending manual verification:** a "TV Shows"
  tab (`electron/xtream.ts`: `getSeriesCategories`/`getSeriesList`/`getSeriesInfo`/
  `buildSeriesStreamUrl`) mirrors the Movies tab's category sidebar + poster grid
  (`src/components/SeriesBrowser.tsx`, reusing the VOD browser's CSS — series posters
  look the same as movie posters). Its detail overlay adds a season-tab strip and an
  episode list per season, each row with its own Play/Resume (progress keyed
  `ep:<episodeId>` instead of `vod:<streamId>`, same `progress-store.ts`).
  `get_series_info`'s `episodes` map is keyed by season number as a string, with a
  separate `seasons` array carrying just the display names — parsed by deriving season
  numbers from the episode map's keys and cross-referencing names from `seasons` where
  present, since some providers omit one or the other.
- **Refactor alongside the series chunk:** `App.tsx`'s `playingVod` state (and its
  build-url/play/seek/progress-saving effects) was generalized into a `PlayingMedia`
  union (`{kind:'vod'}` | `{kind:'episode'}`) shared by both Movies and TV Shows,
  rather than duplicating the same four effects a third time — theater mode, resume
  seeking, and periodic progress-saving are now implemented once for any non-live
  media instead of per-kind.
- **Backlog, requested 2026-07-06:** a time scrubber for VOD/series playback —
  seek bar with current position/duration, click/drag to seek. Not in the original
  plan (that only called for resume-position tracking, not an on-screen seek UI), but
  a natural fit now that progress data already exists — depends on the mouse-visibility
  backlog item below, since a scrubber needs the cursor available to interact with it.

### App shell / Windows feel
- Custom title bar (VS Code style) or native chrome; taskbar/Alt-Tab, tray, native
  notifications, DPI scaling; packaged as a normal installer (.exe). Ability to view video in full screen.
- Known gap: Windows SMTC media controls (taskbar media overlay) need extra native
  wiring — nice-to-have, not v1-blocking.
- **Backlog requested 2026-07-06, implemented and verified against a real account
  2026-07-06:**
  1. **Full-screen toggle** — F11 (bound in the main process) or a header button
     (`⤢`/`⤡`) call `win.setFullScreen()`. Full screen on the Live tab (and on the
     Movies tab while a title is playing) is "theater mode": the header, sidebar, and
     now/next+stats/now-playing toolbar all hide (only the video remains), with a brief
     "Press F11 or Esc to exit full screen" hint on entry since there's otherwise no
     on-screen way back. Esc also exits (bound alongside F11). `Tab` jumps to the Guide
     and back while full screen (bringing the header back with it), scoped to
     full-screen-only (and inert while a movie is playing, so it can't yank the user out
     of theater mode into Guide/Live) so it doesn't steal normal Tab focus-cycling
     elsewhere. Theater mode also hides the mouse cursor — **not** via mpv's own
     `cursor-autohide` property (tried first, turned out to be a dead end: mpv's render
     target is a bare `Static` window handed to it purely as a `wid`, nothing subclasses
     its wndproc to forward `WM_MOUSEMOVE`, so mpv never sees cursor motion over it and
     its autohide idle timer never fires — this was a silent no-op the whole time, per
     Skip's testing 2026-07-06). Fixed properly by patching `electron-libmpv` itself: a
     new native `setCursorVisible()` method calls Win32 `ShowCursor` directly (guarded
     against double-calls so the counter can't drift out of balance), exposed through
     `window.mpv.setCursorVisible`. Patch lives in
     `patches/electron-libmpv+1.1.0.patch` (regenerated via `npx patch-package
     electron-libmpv` after editing `node_modules/electron-libmpv` directly, then
     `npx electron-rebuild -f -w electron-libmpv` to rebuild the native binary).
  2. **Custom window title** — "Skip's IPTV Viewer" via `BrowserWindow({ title })` and
     `<title>` in `index.html`.
  3. **Toggle the channel sidebar** — a header button (`☰`) hides/shows the Live tab's
     channel list while windowed; keyboard zapping keeps working with it hidden.
  4. **Keyboard shortcuts reference in Settings** — collapsed-by-default `<details>`
     section listing zap/Backspace/F11/Esc/Tab. Read-only, no rebinding UI.
  5. **"Stats for nerds"** — an `ⓘ` button next to the now/next bar fetches mpv
     properties (video/audio codec, resolution, bitrate, fps, hwdec) via
     `window.mpv.getProperty` only when the panel is opened (plus a manual Refresh
     button) — never polled, per `electron/playback.ts`'s synchronous-call lesson.
  - **Bug found and fixed during this work:** opening Settings used to unmount the
    entire live view, including the mpv video's native child window — but nothing
    told mpv to shrink that window first, so it kept painting at its last on-screen
    rectangle, landing on top of the Settings screen (a native child window always
    paints over Chromium content in its rectangle regardless of CSS z-index). Fixed by
    keeping the live view mounted underneath Settings at all times (Settings now
    renders as an absolutely-positioned overlay instead of replacing the tree), reusing
    the same "collapse to 0×0 via `display:none`" technique already proven for the
    Guide tab to actually shrink the native mpv window down to nothing first.
- **Backlog, requested 2026-07-06:** theater mode currently hides the mouse cursor for
  the whole time full screen is on. Change to an idle-based show/hide instead: cursor
  reappears on mouse movement, then auto-hides again after ~5s of no movement — needed
  so a VOD/series time scrubber (see "VOD & Series" above) is actually reachable with
  the mouse while still keeping playback distraction-free when the viewer isn't
  interacting. `window.mpv.setCursorVisible` (added 2026-07-06) already does the actual
  hide/show; this just needs a movement listener + debounce timer driving it instead of
  the current flat `!theaterMode` toggle.

### Theming
- **Backlog, requested 2026-07-06, wants a design look before turning on:** Skip likes
  the current look but wants more of it — an in-app dark/light toggle (today `src/
  index.css` only follows the OS's `prefers-color-scheme`, no manual switch) and some
  variety beyond the one palette. Asked whether an open-source "theme marketplace" like
  VS Code's exists for apps like this — answer: not a drag-and-drop gallery (no shared
  schema across apps), but there's a well-established open-source ecosystem of
  hand-portable color palettes built for exactly this (Catppuccin, Nord, Dracula,
  Gruvbox, Tokyo Night, Rosé Pine, Solarized — all permissively licensed, all popular
  precisely because people copy their hex codes into whatever app they're using).
  Concrete shape discussed: since the whole look is already just ~15 CSS custom
  properties in `index.css` (`--bg-0`, `--accent`, etc.), ship 2-3 of those palettes
  translated to our variable names as built-in picks, plus a documented-schema "paste a
  small JSON of hex values" import box in Settings for anything else found externally —
  not a hosted gallery, not a bundled library of dozens of themes.

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
4. VOD/series browser — implemented 2026-07-06 (VOD verified against a real account;
   series pending its own verification pass).
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

Build-order step 3 is done as of 2026-07-05 — Live TV UX polish:

- **Favorites:** star toggle per channel row (hover to reveal), persisted with the last
  tuned channel in `userData/prefs.json` (`electron/prefs-store.ts`); favorites sort
  first in the sidebar, and a ★ toolbar toggle filters to favorites only.
- **Channel-name filter:** client-side substring filter over the loaded list, in the
  sidebar toolbar. Independent of the EPG as planned.
- **Quick switching:** `↑`/`↓` zap through the *visible* (filtered + favorites-sorted)
  list with wraparound, `Backspace` swaps to the previously tuned channel, and the
  last-tuned channel re-tunes automatically on launch. Key handling skips inputs so
  typing in search boxes never zaps.
- **Modern theme:** a CSS-variable design system in `src/index.css` (bg layers, accent,
  borders, text tiers, radii) that every surface — header with segmented tabs, channel
  sidebar, guide, settings card — styles itself from; dark by default with a light
  mapping under `prefers-color-scheme` (the app follows the Windows app theme). Settings
  became a centered card and gained a Cancel button (previously there was no way back
  out without saving).
- **EPG staging-swap:** ingest now writes to `*_staging` tables inside the write
  transaction and `commit()` atomically drops/renames them into place (the channel+time
  index is rebuilt at swap — bulk-insert-then-index is faster than maintaining it
  row-by-row). Mid-refresh reads on the same connection see the untouched live tables,
  so the guide stays fully browsable during a refresh — verified live: grid stayed
  populated with the old guide while "Indexing guide…" ran, then flipped to the new
  data. FTS5 tables rename cleanly inside a transaction (validated with a standalone
  Electron test before wiring in). The guide's no-data view is now a proper empty state:
  spinner + "first download can take a minute" while refreshing, error + retry, or a
  download call-to-action.

Playback error-handling hardening landed 2026-07-06, prompted by a real provider channel
(UK| SKY CINEMA SCI-FI) that froze playback and took the whole app down with it:

- **Root cause, in two layers.** First: `electron-libmpv` never registered mpv's wakeup
  callback and discarded every event payload, so the only way to observe playback state
  was polling `getRawProperty` — which is *synchronous* and blocks the whole Electron
  main process if mpv's core is busy, which is exactly what froze the app the first time.
  Second (found only after fixing the first): some malformed streams don't just fail —
  they hang the GPU hardware-decode session outright, a driver-level deadlock nothing
  in-process can route around, confirmed via `mpv.log` (audio+video played fine for ~30s,
  then every mpv event — including our own `stop` — just stopped arriving).
- **Fix, layer one:** `electron-libmpv` is now patched (`patches/electron-libmpv+1.1.0.patch`,
  applied via `patch-package` in `postinstall`) to register the wakeup callback and forward
  real event payloads (`playback-restart`, `end-file` with reason/error, `time-pos`
  property-change). `electron/playback.ts` is a strictly event-driven watchdog on top:
  open-timeout (25s), stall-timeout (20s via `time-pos` silence), mpv's own error string
  surfaced from `end-file`/log tail — zero synchronous mpv calls anywhere.
  `electron/logger.ts` writes `userData/logs/main.log` (app events) and mpv's own
  (quieted via `msg-level`) log to `mpv.log`.
- **Fix, layer two — the wedge:** detected by arming a timer after any command mpv should
  acknowledge (`loadfile`/`stop`) and clearing it on ANY mpv event; silence means the core
  is dead. **An automatic kill-and-relaunch was tried and abandoned** — Chromium's own GPU
  process shares the same physical device/driver mpv hung on, so even Electron's own exit
  path could block on it too, `app.relaunch()`'s spawn didn't reliably survive a dev-mode
  supervisor conflict, and getting a fully external kill+relaunch helper right cost far
  more complexity than the failure warranted (full debug trail in conversation history if
  ever revisited). Landed instead: a fixed, honest "Playback engine became unresponsive —
  restart the app to continue" message with no Retry, and the offending channel is
  auto-hidden so it can't repeat the wedge on the next launch.
- **Hidden channels (new, small feature):** any channel — auto-hidden after a wedge, or
  manually via a ⊘ button per channel row — disappears from the sidebar, guide grid, and
  EPG search (`prefs.hiddenStreamIds`). Reviewable/restorable from Settings → Hidden
  Channels, deliberately with no preview/playback there (that's exactly what could
  trigger another freeze).
- **Resume safety net:** a channel is only trusted as the next-launch resume target once
  it's played without failing for 45s (`CONFIRM_PLAYABLE_MS`, comfortably past the ~30s
  hang above) — otherwise a bad channel could boot-loop the app into itself even before
  auto-hide kicks in.
- **Incidental fix:** `vite.config.ts` had no `base: './'`, so a production (non-dev-server)
  build rendered a blank white window — asset paths were root-relative, which breaks under
  `file://`. Found and fixed while testing the wedge scenario against an unpacked build
  (dev mode's hot-reload supervisor doesn't survive an externally-killed child, which is
  *part of* why the kill-and-relaunch approach was abandoned above).

- **VOD browsing, playback, and resume tracking implemented 2026-07-06** (pending manual
  verification against a real account): see "VOD & Series" above for the full shape.
  The notable design decision was reusing the existing single mpv instance and its
  "loadfile replace" pattern rather than standing up a second player — a movie's Play
  button works exactly like tuning a live channel does, just with a VOD URL instead of
  a live one, and the same collapse-to-0×0-via-display:none technique keeps the poster
  grid's DOM alive underneath the player instead of unmounting it.

- **Series browsing implemented 2026-07-06** (pending manual verification): season/
  episode drill-down reusing the VOD browser's poster grid and the same resume-progress
  store. Prompted a small refactor — `App.tsx`'s VOD-only `playingVod` state became a
  `PlayingMedia` union covering both movies and episodes, so theater mode, resume-seek,
  and progress-saving are each implemented once instead of duplicated per media kind.

Key choices unchanged from the original plan: Electron + libmpv, Xtream Codes as the only
provider format, EPG grid quality as the defining feature, recordings deferred to v2
running server-side on docker-server (never client-side). Next concrete action is
build-order step 5: packaging/installer.
