# Laomedeia (Custom Windows IPTV App)

Plan for a custom-built Windows IPTV viewing app, motivated by every tested Windows
IPTV app having a dated UI and a bad EPG experience. The EPG is the #1 priority —
it's the thing all the existing apps get wrong.

**Status:** Build order step 3 complete (2026-07-05), plus playback error-handling
hardening (2026-07-06) added after real-world testing surfaced a channel that could
freeze mpv's core and wedge the whole app. The App shell backlog (full-screen toggle,
custom window title, sidebar hide/show, keyboard-shortcuts reference in Settings,
"stats for nerds" playback info panel) requested 2026-07-06 is now implemented and
verified against a real account — details under "App shell / Windows feel" below.
Build-order step 4 (VOD/series browser) is now fully complete (2026-07-06): VOD and
series browsing/playback/resume all verified against a real account. A second round of
playback hardening landed 2026-07-06 after Skip reported the wedge recurring in normal
use (see the "Wedge prevention (round two)" note at the end) — the wedge was
re-diagnosed from real logs as a *switch-after-failure* sequence, not a bad channel,
and got prevention (post-failure settle + optional software decoding) plus one-click
in-app recovery, all confirmed fine by Skip in real use. The two remaining small
backlog items — the VOD/series time scrubber and idle-based cursor show/hide — are also
implemented and verified (2026-07-06); details under "VOD & Series" and "App shell /
Windows feel". Both design-gated items are now done too: **theming** (2026-07-06) and
**Live TV category browsing** (2026-07-07), each after an approved design-preview
artifact. The last backlog item, the VOD/series "search all" scope toggle, is also
done (2026-07-07, see "VOD & Series"). Build-order step 5, packaging/installer, is the
primary remaining release milestone — Skip is deferring it to a separate session
(planned for the afternoon of 2026-07-07). **Decided 2026-07-06
NOT to build** a hidden-titles section for VOD/series (parallel to live's hidden
channels): VOD/series playback already runs the same mpv watchdog, so failures get the
same Retry/Restart-player/software-decode handling as live — and unlike channel-surfing
you don't re-encounter a bad title repeatedly, so the re-encounter value didn't justify
the added UI across both browsers.
**Current update (2026-07-12):** The shared Live TV/Guide category filter is complete,
persists across restarts, and resets both channel surfaces to the first row when changed.
The new Home tab provides favorite channels, unfinished movies, and resumable recent TV
episodes with dismiss/restore controls. Settings now chooses the startup destination;
Movie and TV Show categories persist; and normal/maximized window state persists while
cinema full screen deliberately does not. The implementation is documented in
[`PRD.md`](PRD.md) and [`SDD.md`](SDD.md). Packaging/installer remains the next release
milestone.

**Packaging update (2026-07-13):** The Windows x64 `win-unpacked` build now completes,
includes `electron-libmpv`, `better-sqlite3`, `sax`, both unpacked native addons, and
places `libmpv-2.dll` beside the executable. The packaged app starts successfully on the
build machine, Live/EPG/movie/episode behavior has been manually verified, and the normal
development app still starts afterward. The zipped `win-unpacked` folder was also copied
to and fully exercised on a separate laptop with no development setup, confirming that the
runtime package is self-contained. The per-user NSIS installer was subsequently built,
installed, and exercised successfully on that laptop.

**Branding update (2026-07-13):** The product is now **Laomedeia** (pronounced
LAY-oh-muh-dee-ah), with the approved compass-and-play icon applied to the app window,
Windows executable, and NSIS installer. The stable `org.pelorus.iptv` application ID and
internal `iptv` user-data folder are intentionally unchanged so existing beta settings,
favorites, and progress survive the rename. The renamed unpacked app launches cleanly,
and `Laomedeia-Windows-0.1.0-Setup.exe` builds with the expected icon and metadata. An
installed upgrade test of the renamed installer on the separate laptop remains open.

The current product version is **BETA v0.1** (`0.1.0`). It remains beta until the gates
in `RELEASE_READINESS.md` have passed.

The packaging gate and clean-machine validation checklist live in
[`RELEASE_READINESS.md`](RELEASE_READINESS.md); use that document as the authoritative
go/no-go list before sharing any installer.

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
- **Category browsing for Live TV — implemented and verified 2026-07-07** (after a
  3-option design-preview artifact; Skip picked the "dropdown filter" over a VOD-style
  rail or a grouped list, precisely because search already handles known-channel access
  and categories are only for occasional discovery — so the least-clutter option won).
  A "Categories ▾" button in the sidebar toolbar (`src/components/ChannelList.tsx`,
  between search and the ★ filter) opens a menu of categories with live counts; picking
  one filters the list. **Purely client-side** — each channel already carries its
  `categoryId` and the full list is already loaded, so switching categories is instant
  (no re-fetch); `getLiveCategories` is now called (finally) just for the labels/counts.
  Composes with the name filter and favorites-first sorting, and ↑/↓ zapping stays within
  the selected category (they all walk the same `displayChannels`). The button doubles as
  the active-filter indicator (dropped the mockup's separate chip row to keep it compact).
  Only categories with (non-hidden) channels appear; selection is persisted in `prefs.json`
  and restored at launch so Live TV and Guide reopen in the same browsing context.

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
- **Series chunk implemented and verified 2026-07-06:** a "TV Shows"
  tab (`electron/xtream.ts`: `getSeriesCategories`/`getSeriesList`/`getSeriesInfo`/
  `buildSeriesStreamUrl`) mirrors the Movies tab's category sidebar + poster grid
  (`src/components/SeriesBrowser.tsx`, reusing the VOD browser's CSS — series posters
  look the same as movie posters). Its detail overlay adds a season-tab strip and an
  episode list per season, each row with its own Play/Resume (progress keyed
  `ep:<episodeId>` instead of `vod:<streamId>`, same `progress-store.ts`).
  `get_series_info`'s `episodes` map is keyed by season number as a string, with a
  separate `seasons` array carrying just the display names — parsed by deriving season
  numbers from the episode map's keys and cross-referencing names from `seasons` where
  present, since some providers omit one or the other. **Empty-episode titles** (some
  providers return `episodes: {}` / `seasons: []` for a series they list but have no
  files for — e.g. "V (2009)", confirmed against the provider) now show a "no episodes
  available" empty state instead of a blank detail overlay below the cast.
- **Refactor alongside the series chunk:** `App.tsx`'s `playingVod` state (and its
  build-url/play/seek/progress-saving effects) was generalized into a `PlayingMedia`
  union (`{kind:'vod'}` | `{kind:'episode'}`) shared by both Movies and TV Shows,
  rather than duplicating the same four effects a third time — theater mode, resume
  seeking, and periodic progress-saving are now implemented once for any non-live
  media instead of per-kind.
- **Time scrubber for VOD/series playback — implemented and verified 2026-07-06.**
  Seek bar under the title (`src/components/MediaScrubber.tsx`) showing position/
  duration, drag-to-seek that fires the seek on release (a local drag value drives the
  thumb mid-drag so there's no seek flood). Position comes from mpv's already-observed
  `time-pos` (forwarded to the renderer via a new `mpv:timepos` channel — no new
  blocking `getProperty` poll); duration is read once when the file starts. In theater
  mode the scrubber reveals with the cursor (see idle-cursor item below) so it's
  reachable, then hides when idle.
- **"Search all" scope toggle for Movies + TV Shows — implemented and verified
  2026-07-07.** The search box in `VodBrowser.tsx`/`SeriesBrowser.tsx` now has a
  **"This category | All"** segmented toggle next to it (only shown once there's a
  query), default "This category" (the pre-existing per-category filter behavior).
  Picking "All" lazy-fetches the whole library once per session
  (`getVodStreams(config)` / `getSeriesList(config)` with no category id — already
  returned everything, no backend change needed) and caches it in component state;
  results are tagged with their category name (looked up from the already-loaded
  categories list), GitHub-style. Clearing the search box always drops back to the
  selected category regardless of scope, since the poster grid isn't virtualized.
  Verified against the real account: 19,285 VOD titles / 8,751 series fetch and parse
  in ~2.5s / ~1.5s — a non-issue.
  - **Bug found and fixed during verification:** the lazy-fetch `useEffect` listed its
    own `allStreamsLoading`/`allStreams` state as dependencies. Since the effect's first
    line calls `setAllStreamsLoading(true)`, that state change retriggered the same
    effect, whose cleanup set `cancelled = true` on the *original* in-flight request's
    closure — so when the real fetch resolved, `if (!cancelled)` was already false and
    the result was silently dropped, leaving "Loading full library…" stuck forever. Diagnosed
    by adding temporary timing logs in `main.ts`'s IPC handler (confirmed the provider
    request actually completed in ~2.5s while the renderer stayed stuck) and by fetching
    the same endpoint from a standalone script to rule out a slow/rate-limited provider.
    Fixed by dropping those two from the effect's dependency array — it should only
    re-run on `[config, searchingAll]`, not on state it sets itself.

### App shell / Windows feel
- Custom title bar (VS Code style) or native chrome; taskbar/Alt-Tab, tray, native
  notifications, DPI scaling; packaged as a normal installer (.exe). Ability to view video in full screen.
- Known gap: Windows SMTC media controls (taskbar media overlay) need extra native
  wiring — nice-to-have, not v1-blocking.
- **Home screen implemented 2026-07-12.** The first tab is now **Home** (chosen over
  "Now Playing" and "Dashboard" because it describes a general landing place rather
  than one active stream or an administrative screen). It provides themed horizontal
  sections for favorite live channels, unfinished movies, and recently watched/
  resumable TV episodes, with direct play/resume actions and quick links into each
  browser. Every card can be removed from Home without deleting the underlying
  favorite or watch progress; dismissed cards persist in `prefs.json` and can all be
  restored from Settings.
- **Configurable startup screen implemented 2026-07-12.** Settings → Startup can open
  the app on Home, Live TV, Live TV Guide, Movie List, or TV Show List. Only a Live TV
  startup auto-resumes the remembered channel; other startup destinations do not play
  hidden live audio in the background. Entering Live TV or selecting a channel starts
  playback normally.
- **Browser category persistence implemented 2026-07-12.** Movie and TV Show category
  selections now persist across restarts, matching the shared Live TV/Guide category
  behavior.
- **Window size/state persistence implemented 2026-07-12.** First launch opens centered
  at 1280×800 (clamped to the primary display). Move/resize and maximized state are
  saved separately in `window-state.json`; maximized windows reopen maximized, while
  normal windows reopen at their last bounds. Saved bounds must overlap a currently
  connected display, preventing an off-screen launch after monitor changes. Cinema/full
  screen is deliberately never persisted, so an app exit from full screen returns to
  the last normal windowed size on the next launch.
- **Backlog requested 2026-07-06, implemented and verified against a real account
- **Native callback shutdown hardening implemented 2026-07-12.** Closing a dev session
  could produce Node `DEP0168` because a final mpv N-API event raced BrowserWindow
  destruction and attempted `webContents.send` after its target was gone. Renderer-bound
  mpv, playback, EPG, and full-screen notifications now share a guarded sender that stops
  delivery as soon as closing begins and never lets a destroyed-window exception escape
  through the native callback boundary.
- **Packaged-support logging hardened 2026-07-12.** The final logger boundary removes
  URLs and common credential fields, main logs rotate through four bounded generations,
  and raw mpv file logging is disabled because it can expose authenticated stream URLs.
  Concise logs now cover startup/runtime versions, major provider operations, EPG timing
  and counts, playback transitions/failures, renderer/GPU exits, and uncaught errors.
  Settings → Diagnostics opens the log folder or creates a second-pass-sanitized report
  with basic non-secret environment metadata for easy sharing.
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
  2. **Custom window title** — originally "Skip's IPTV Viewer," renamed to
     "Laomedeia" for BETA v0.1 via `BrowserWindow({ title })` and `<title>` in
     `index.html`.
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
- **Idle-based cursor show/hide — implemented and verified 2026-07-06.** Theater mode
  now hides the cursor (and, for movies/episodes, the toolbar+scrubber) after ~3s of no
  pointer movement (`CURSOR_IDLE_MS` in `App.tsx`, tunable), reappearing on movement,
  instead of the old flat hide. Movement is detected by polling the global cursor
  position (`screen.getCursorScreenPoint()` via a new `app:getCursorPoint` IPC, sampled
  every 250ms while in theater mode) — **not** DOM `mousemove`, which never fires over
  the video because mpv's native child window swallows those events (the same reason
  mpv's own `cursor-autohide` was a dead end). `window.mpv.setCursorVisible` does the
  actual hide/show.

### Theming
- **Implemented and verified 2026-07-06** (after a design-preview artifact Skip approved —
  "they all look GREAT"; he chose to ship every palette, not a curated 2-3). Settings gains
  an **Appearance** card: a swatch grid with **System** (default — follows the OS
  `prefers-color-scheme`, today's behavior) plus 8 built-in palettes (Default Dark/Light,
  Catppuccin Mocha, Nord, Dracula, Tokyo Night, Rosé Pine, Rosé Pine Dawn, Solarized
  Light), and a collapsible **paste-a-theme JSON** import box for anything external.
  - The in-app manual light/dark control is folded into the theme list rather than a
    separate toggle: picking any named theme overrides the OS (go dark with Dracula, light
    with Solarized); "System" is the follow-OS escape hatch. Cleaner than a global toggle,
    which wouldn't compose with fixed named palettes.
  - Architecture: all palettes live in `src/themes.ts` as the 16 design tokens each
    (single source of truth — adding more is one entry). `applyTheme()` sets the variables
    inline on `:root`, which overrides `index.css` (inline styles beat the stylesheet's
    `prefers-color-scheme` block, so a named theme wins over the OS regardless of mode);
    "system" clears the inline vars so the stylesheet's OS rules take back over. Selection
    persists in `prefs.json` (`theme`, plus `customTheme` token map for a pasted theme).
    Known minor: brief flash of the default look on launch before the saved theme applies,
    since prefs load async (same as favorites/hidden) — easily eliminated later if wanted.
  - Both design-gated items are done (theming here; Live TV category browsing on
    2026-07-07), and the VOD/series "search all" scope toggle is also complete.

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
- **Possible bug spotted 2026-07-07, not yet investigated:** on a fresh Electron launch
  straight into a playing channel (observed via the dev auto-restart after an
  `electron/main.ts` edit, and via `app:relaunch` — the same relaunch the wedge-recovery
  "Restart player" button uses), the mpv native child window briefly painted over the
  whole client area, hiding the header/tabs bar, until the OS window was resized (forcing
  a relayout). Didn't chase it since it was tangential to the session's task, but it's
  the same class of bug as the earlier Settings-overlay fix (native child window painting
  over Chromium content because nothing told it to resize first) — worth a proper look
  before/during packaging since "Restart player" is the only recovery path once a wedge
  hits and packaged builds won't have hot-reload's incidental relayouts to mask it.

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
4. VOD/series browser — complete and verified 2026-07-06 (both VOD and series checked
   against a real account), including the "search all" scope toggle (2026-07-07).
5. Packaging/installer. **← next**
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
  `electron/logger.ts` writes `userData/logs/main.log` (app events). An mpv file log
  was useful during initial diagnosis but was later disabled because it can expose the
  authenticated Xtream URL; see the 2026-07-12 logging-hardening note above.
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

Wedge prevention (round two), landed 2026-07-06 after Skip reported the "Playback engine
became unresponsive" wedge still happening in normal use — and, worse, that once it hit,
no channel would play until he Ctrl-C'd the app in the terminal and relaunched:

- **Re-diagnosis from real logs (`userData/logs/main.log`).** The wedge is NOT caused by
  the channel on screen when it freezes. Both logged incidents show the same sequence: a
  stream fails or stalls → the user switches to another channel within a few seconds →
  the next `loadfile replace` wedges the core ~8s later. The channels showing at wedge
  time (67600167, 67587900) both played fine on later launches — they were innocent. The
  trigger is stacking a fresh `loadfile` on top of a *failed* stream whose hardware-decode
  session (and the GPU driver's decode context) is still tearing down.
- **Consequence found and fixed:** the old auto-hide-on-wedge (App.tsx) hid whatever
  channel was on screen at wedge time — i.e. innocent channels, including favorites.
  Skip's `prefs.json` had accumulated several wrongly-hidden good channels (and one that
  was hidden *and* favorited). Auto-hide-on-wedge is removed entirely; those channels were
  restored in prefs.json. Manual hide (⊘) and Settings → Hidden Channels are unchanged.
- **Prevention:**
  1. *Post-failure settle* (`POST_FAIL_SETTLE_MS`, playback.ts): after any failure, the
     next `loadfile` is deferred ~1.5s to let the dead stream's decode session finish
     tearing down before a new one is stacked on it. Only the first switch after a failure
     is delayed; normal channel switching is untouched. Reduces (doesn't eliminate) the
     wedge, since the underlying hang is GPU-driver-level.
  2. *Software-decoding toggle* (Settings → Playback, "Maximum compatibility"): flips mpv
     `hwdec` from `auto-safe` to `no`. Pure-software decode can't deadlock the GPU driver,
     so this eliminates the wedge class outright at a CPU cost. Off by default; persisted
     in prefs.json (`softwareDecoding`) and re-applied on launch during `mpv:attach`, plus
     applied live via `playback:setSoftwareDecoding` when toggled.
- **Recovery without a terminal:** the wedge UI dropped the dead-end "restart the app"
  text for a **"Restart player"** button. It calls `app:relaunch`, which spawns a fresh
  detached instance and hard-`process.exit(0)`s the wedged one (mirrors exactly what Skip
  did manually with Ctrl-C — chosen over Electron's graceful `app.quit()`/`relaunch()`
  because the wedged GPU driver can block the normal exit path). The new instance
  auto-resumes the last confirmed-good channel, so recovery is ~3s and one click. This is
  also required for the packaged installer (step 5), where there's no terminal to Ctrl-C.
  Consistent with the "honest message, no fragile auto-recovery" preference: still no
  automatic relaunch, just a one-click manual one.

- **VOD browsing, playback, and resume tracking implemented and verified 2026-07-06**:
  see "VOD & Series" above for the full shape.
  The notable design decision was reusing the existing single mpv instance and its
  "loadfile replace" pattern rather than standing up a second player — a movie's Play
  button works exactly like tuning a live channel does, just with a VOD URL instead of
  a live one, and the same collapse-to-0×0-via-display:none technique keeps the poster
  grid's DOM alive underneath the player instead of unmounting it.

- **Series browsing implemented and verified 2026-07-06**: season/
  episode drill-down reusing the VOD browser's poster grid and the same resume-progress
  store. Prompted a small refactor — `App.tsx`'s VOD-only `playingVod` state became a
  `PlayingMedia` union covering both movies and episodes, so theater mode, resume-seek,
  and progress-saving are each implemented once instead of duplicated per media kind.

- **VOD/series scrubber + idle-cursor autohide implemented and verified 2026-07-06** —
  the last two feature-backlog items. See "VOD & Series" (scrubber) and "App shell /
  Windows feel" (idle cursor) above. Scrubber position rides mpv's existing `time-pos`
  observation (new `mpv:timepos` forward, no new blocking poll); cursor-idle detection
  polls `screen.getCursorScreenPoint()` because the native mpv window eats DOM mousemove.
  Also decided this session NOT to add a hidden-titles section for VOD/series (see the
  Status note at top for the rationale).

- **Live TV category browsing implemented and verified 2026-07-07** — the last
  design-gated backlog item. Dropdown "Categories ▾" filter in the channel sidebar,
  client-side off each channel's `categoryId`; see the Live TV section for the full
  shape and why the dropdown won over a rail / grouped list.

- **VOD/series "search all" scope toggle implemented and verified 2026-07-07** — the
  last feature-backlog item before packaging. See "VOD & Series" above for the full
  shape and the effect-dependency bug found and fixed during verification (main-process
  timing logs plus a standalone diagnostic script confirmed the provider itself wasn't
  slow — 19,285 VOD titles / 8,751 series fetched and parsed in a couple seconds each —
  which pointed at a renderer-side bug rather than a provider/network issue).

Key choices unchanged from the original plan: Electron + libmpv, Xtream Codes as the only
provider format, EPG grid quality as the defining feature, recordings deferred to v2
running server-side on docker-server (never client-side). Next concrete action is
build-order step 5: packaging/installer, followed by the focused validation items listed
in [PRD.md](PRD.md).
