# Software Design Document

## Document Status

- System: Laomedeia
- Status: BETA v0.1 living design document reflecting implementation on 2026-07-12
- Platform: Windows, Electron 30, React 18, TypeScript
- Related: [PRD.md](PRD.md), [PLAN.md](PLAN.md), [README.md](README.md)

This SDD records the architecture that emerged through iterative development. It calls
out intentional workarounds and known limitations rather than presenting the system as
if it were designed all at once.

## System Overview

The app has three runtime layers:

1. A React renderer for navigation, browsing, Guide presentation, and interaction.
2. The Electron main process for provider I/O, persistence, EPG ingestion, window
   management, and playback orchestration.
3. A native libmpv child window for video rendering and decoding.

There is no application server or cloud account. The client connects directly to one
Xtream provider and stores all durable state under Electron's `userData` directory.

## Technology Stack

- Electron 30 and electron-vite
- React 18 and TypeScript
- libmpv through `electron-libmpv`
- better-sqlite3 for EPG storage and FTS5
- sax for streaming XMLTV parsing
- `@tanstack/react-virtual` for Guide rows
- CSS custom properties for design tokens
- electron-builder for packaging

## Repository Layout

```text
electron/
  main.ts                 Lifecycle, IPC, BrowserWindow, mpv setup
  preload.ts              Renderer bridge
  xtream.ts               Xtream client and stream URL builders
  playback.ts             Event-driven playback state/watchdogs
  epg.ts / xmltv.ts       Refresh policy, download, streaming parse
  epg-db.ts               SQLite schema, staging swap, queries, FTS
  settings-store.ts       Account persistence
  prefs-store.ts          User preferences
  progress-store.ts       Movie/episode progress
  window-state-store.ts   Window bounds/maximized state
  logger.ts               Diagnostic logs
src/
  App.tsx                 Shared state and navigation orchestration
  themes.ts               Theme definitions/application
  index.css / app.css     Tokens and application styles
  components/             Home, Live, Guide, VOD, Series, player UI
patches/
  electron-libmpv+1.1.0.patch
```

## Process Responsibilities

### Renderer

`App.tsx` owns cross-screen state:

- Active and startup views
- Live streams/categories and the shared Live/Guide category
- Movie and TV Show category preferences
- Favorites and hidden channels
- Selected/previous live stream
- Current non-live `PlayingMedia`
- Playback UI state and resume map
- Home dismissals, theme, and full-screen state

Components retain screen-specific state. Guide owns day/search/programme caches and
scroll. Movie/Series browsers own filter text, details, and session search caches.

### Preload

`preload.ts` exposes narrow namespaces including `xtream`, `epg`, `playback`, `mpv`,
`settings`, `prefs`, `progress`, and `app`. The renderer does not import Node or Electron
APIs directly. `electron-env.d.ts` defines the bridge contract.

### Main Process

The main process owns functionality requiring Node, native modules, OS integration, or
freedom from browser CORS:

- BrowserWindow lifecycle and state
- Xtream HTTP calls and authenticated URL construction
- XMLTV download and SQLite ingestion
- Native mpv commands, events, and recovery
- File-backed local stores
- Full-screen shortcuts and global cursor position

## Navigation and Native Player Lifetime

The `View` union is `home | live | guide | vod | series`.

The native mpv surface can paint above Chromium regardless of CSS z-index. Therefore:

- `Player` stays mounted for the app lifetime.
- Hiding its placeholder with `display:none` lets `ResizeObserver` collapse the native
  child window to zero size.
- Settings overlays the still-mounted application tree.
- Movie and Series browsers remain mounted during playback to retain context.

This lifetime pattern is an architectural constraint, not just an optimization.

## Xtream Integration

`electron/xtream.ts` implements account validation and Live, VOD, and Series API calls.
Requests use a ten-second abort timeout. Provider access remains in the main process to
avoid CORS failures against arbitrary servers.

The provider URL and generated stream URLs are secrets because credentials are embedded
in query parameters or paths.

## Playback Architecture

### Shared libmpv Instance

One player handles Live, Movies, and Episodes through `loadfile replace`. Non-live media
uses a discriminated `PlayingMedia` union so URL construction, resume seeking, progress,
scrubbing, and cinema behavior are implemented once.

### Native Addon Patch

The upstream addon did not register mpv's wakeup callback or forward useful events. The
repository patch adds event forwarding and native Win32 cursor visibility. `postinstall`
applies the patch and rebuilds the addon for Electron.

### Event-Driven Monitoring

`playback.ts` avoids synchronous mpv reads in watchdog paths. Forwarded events drive:

- Open timeout
- Playback-restart detection
- Time-position stall timeout
- End-file/error reporting
- Command acknowledgement and wedge detection
- Post-failure settle before the next load
- Confirmed-good timing for last-channel resume

This design follows observed provider failures where malformed streams or switching too
quickly after failure can wedge a GPU decode session.

### Recovery

Recoverable failures offer Retry. A dead mpv core offers Restart Player. Restart spawns
a detached replacement and hard-exits because graceful shutdown can block behind wedged
native/GPU threads. Persisted software decoding (`hwdec=no`) avoids that GPU failure
class at additional CPU cost.

All main/native callbacks deliver renderer notifications through a guarded sender. Window
closing disables delivery before Chromium teardown; destroyed BrowserWindow/webContents
targets are rejected and send failures are contained. This prevents final mpv N-API
events from surfacing Node `DEP0168` during normal application shutdown.

### Progress

Movie keys are `vod:<streamId>`; episode keys are `ep:<episodeId>`. Progress saves every
20 seconds and on cleanup, including available display metadata for Home. Entries below
ten seconds or within thirty seconds of completion are deleted.

## EPG Architecture

### Ingestion

EPG uses the provider XMLTV URL or `IPTV_EPG_FILE` during development. It refreshes on
startup when stale, checks hourly, and supports manual refresh. XML is streamed through
sax rather than loaded into a DOM.

### Storage and Atomic Refresh

better-sqlite3 stores channels, programmes, channel/time indexes, and FTS5. Refresh writes
staging tables inside a transaction, builds indexes, then swaps tables atomically. Guide
readers see the previous complete dataset until commit.

### Queries and Rendering

- Bounds restrict date navigation.
- Programme queries accept visible EPG IDs and a time range.
- FTS covers channel name, programme title, and description.
- Renderer filtering removes hidden channels and applies the shared category.
- TanStack Virtual renders only visible and overscanned rows.
- Programme data is fetched lazily per visible channel and cached for the active day.
- Category changes reset vertical scroll without moving horizontal time.

## Home Architecture

Home derives its sections from existing local state:

- Favorites combine loaded Live streams with favorite IDs.
- Unfinished Movies come from progress; older entries can be resolved through one lazy
  full-library VOD request.
- Recent Shows use episode metadata saved with resumable progress.
- Dismissed keys come from `prefs.dismissedHomeItems`.

Dismissal is presentation-only. It does not unfavorite a channel or delete progress.
Settings clears all dismissal keys. Completed progress is currently deleted, so Recent
Shows is resumable history rather than durable completed-watch history.

Favorite preference records need only the stream ID because the loaded `LiveStream`
already contains its provider category. Tuning a favorite from Home first applies and
persists that `categoryId`, then tunes the stream, keeping the channel visible in Live TV.

## Persistence

### Files

- `xtream-config.json`: provider configuration
- `prefs.json`: favorites, hidden channels, last channel, categories, startup view,
  Home dismissals, compatibility mode, and theme
- `progress.json`: resume positions and media metadata
- `window-state.json`: normal bounds and maximized state
- `epg-cache.sqlite3`: Guide cache and FTS
- `logs/main.log` plus bounded rotated generations: sanitized diagnostics

Stores defensively default missing fields so older files remain compatible.

### Preferences

The renderer normally writes `prefs.json`. Refs mirror React state so a save triggered
by one setting does not overwrite another with a stale render value.

### Window State

Window state is separate to avoid competing writers. Saved bounds must be numeric, meet
minimum dimensions, and overlap a connected display by at least 100 by 100 pixels.
Otherwise the app opens centered at 1280 by 800, clamped to the primary work area.

Move, resize, maximize, and unmaximize saves are debounced. `getNormalBounds()` preserves
the restored window size while maximized. Full-screen events and bounds are never saved.

## Startup Sequence

1. Electron becomes ready and validates window state.
2. BrowserWindow is created and maximized when required.
3. Renderer loads account configuration, preferences, and progress.
4. The startup view is applied before UI rendering.
5. Live channels/categories load and EPG refresh checks its TTL.
6. The remembered channel is selected once preferences and streams are ready.
7. Playback is armed automatically only for a Live TV startup.

This prevents invisible live audio on Home, Guide, Movies, or TV Shows.

## Theming

`themes.ts` defines named palettes through sixteen semantic tokens. Named/custom themes
set inline root variables; System clears them so CSS `prefers-color-scheme` takes over.
New UI must use semantic variables rather than fixed palette colors except for preview
swatches.

## Full Screen and Pointer Handling

F11 toggles BrowserWindow full screen and Escape exits. Cinema mode hides application
chrome around video.

The native video child consumes pointer events, so DOM `mousemove` is insufficient. The
renderer polls `screen.getCursorScreenPoint()` through IPC every 250 ms in cinema mode.
After three seconds idle, the patched addon hides the Win32 cursor and the media toolbar.

## Security

- Renderer has no direct Node integration.
- Provider and filesystem operations use typed IPC.
- Credentials remain under per-user application data.
- Logs must not intentionally contain credentials or full authenticated URLs.
- Public Git must exclude configuration, logs, builds, native runtimes, and secrets.
- Custom themes are token data and are never evaluated as code.

The logger sanitizes every message at its final write boundary, retains four rotated
2 MB generations, and sanitizes again when exporting a diagnostic report. Raw mpv file
logging is disabled because its lifecycle output may contain authenticated stream URLs.
Settings can open the log folder or create a report containing only sanitized logs and
basic application/runtime versions.

## Performance Decisions

- Virtualize Guide rows and scope queries to the viewport.
- Filter loaded Live streams client-side.
- Lazy-load and cache full-library VOD/Series searches.
- Forward mpv's observed time position instead of polling it.
- Query player statistics only when the panel is opened/refreshed.
- Keep native/CJS dependencies external in Vite/Rollup.

## Build and Verification

`electron-libmpv`, `better-sqlite3`, and `sax` remain external because bundling breaks
native resolution or CJS interop. Machine-local libmpv provisioning is documented in
README.

Primary checks are:

```powershell
npx tsc --noEmit
npm run lint
npx vite build
```

Packaging must additionally be verified through electron-builder on a clean Windows
installation.

## Risks and Technical Debt

1. The native mpv child may briefly cover Chromium during some fresh/relaunch playback
   paths until a resize occurs.
2. Provider media quality and compliance vary widely.
3. A patched native addon increases upgrade and rebuild cost.
4. Home does not yet retain completed episode history.
5. Progress read-modify-write assumes one app instance.
6. Async theme loading may briefly show the default palette.

## Extension Rules

- Put provider/OS/native capabilities in main and expose narrow IPC.
- Keep playback monitoring event-driven.
- Preserve the mounted/collapsed Player pattern around overlays.
- Share state when multiple screens must retain one browsing context.
- Add persisted fields with backward-compatible defaults.
- Use atomic replacement for large caches visible to readers.
- Record meaningful decisions and real failure modes in this SDD and PLAN.md.

## v2 Recording Architecture

DVR belongs on an always-on service on docker-server. That service will schedule ffmpeg,
store recordings, and expose a small API. The desktop app will schedule from Guide,
browse recordings, and play them. This prevents Windows sleep or app closure from
interrupting recording jobs.
