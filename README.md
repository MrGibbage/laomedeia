# IPTV Viewer

Custom Windows IPTV client (Electron + React + TypeScript). See [PLAN.md](./PLAN.md)
for architecture, scope, and build order.

## Dev setup

Playback uses [electron-libmpv](https://www.npmjs.com/package/electron-libmpv), a native
addon that embeds libmpv directly into the Electron window (Windows only). Its build and
runtime files are gitignored (large binaries, not source) and must be set up manually:

1. Install Visual Studio Build Tools with the "Desktop development with C++" workload
   (needed by node-gyp to compile the native addon).
2. Download a libmpv dev build for Windows from the
   [mpv-player-windows SourceForge project](https://sourceforge.net/projects/mpv-player-windows/files/libmpv/)
   (an `x86_64` or `x86_64-v3` `.7z`; `v3` needs a CPU with AVX2, which any Ryzen/Core CPU
   from the last ~8 years has).
3. Extract it into `C:\mpv-dev` so it looks like:
   ```
   C:\mpv-dev\
     include\mpv\*.h
     x86_64\libmpv-2.dll.a   (rename from libmpv.dll.a)
     libmpv-2.dll
   ```
4. Copy `C:\mpv-dev\libmpv-2.dll` into this project's root directory (next to
   `package.json`) — required for the dev server / `electron .` to find it at runtime.

```powershell
npm install       # also rebuilds native addons (electron-libmpv, better-sqlite3) for Electron's ABI
npm run dev
```

## Using the app

- **Favorites:** hover a channel row and click the star; favorites sort first in the
  list, and the ★ button next to the filter box shows favorites only. Stored with the
  last-tuned channel in `%APPDATA%/iptv/prefs.json`.
- **Channel filter:** the sidebar search box filters the loaded channel list by name
  (no EPG involved).
- **Quick switching:** with the Live TV tab focused (and not typing in a field),
  `↑`/`↓` zap to the previous/next channel in the *visible* (filtered/sorted) list,
  and `Backspace` jumps back to the previously tuned channel. The last channel
  resumes automatically on next launch.

## EPG (guide) internals

The guide is cached in SQLite (`better-sqlite3`) at `%APPDATA%/iptv/epg-cache.sqlite3`,
with an FTS5 index so search matches channel name, programme title, AND description.
Ingestion streams the provider's full XMLTV feed (`xmltv.php`) through a SAX parser —
feeds are tens of MB, so they never fully materialize in memory. The cache refreshes on
app start when older than 12 hours (rechecked hourly), or on demand via the Guide tab's
Refresh button. Refreshes ingest into staging tables and swap them in atomically at
commit, so the previous guide stays fully browsable for the whole refresh.

Dev tip: set `IPTV_EPG_FILE` to a local XMLTV file path before `npm run dev` to ingest
from disk instead of hitting the provider (e.g. the gitignored sample in the project
root).

Native/CJS modules (`electron-libmpv`, `better-sqlite3`, `sax`) must stay in
`rollupOptions.external` in `vite.config.ts` — bundling them into the ESM main bundle
breaks addon path resolution (and Rollup's CJS interop mangles `sax` at runtime).
