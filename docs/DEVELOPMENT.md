# Development

[← Back to README](../README.md)

## Stack

- Electron
- React and TypeScript
- libmpv through a patched `electron-libmpv` native addon
- better-sqlite3 and FTS5 for Guide storage/search
- sax for streaming XMLTV ingestion
- TanStack Virtual for Guide rows

## Native Development Setup

Playback requires a Windows libmpv development build and Visual Studio Build Tools with
the **Desktop development with C++** workload.

Extract libmpv into:

```text
C:\mpv-dev\
  include\mpv\*.h
  x86_64\libmpv-2.dll.a
  libmpv-2.dll
```

Copy `libmpv-2.dll` to the repository root for development runtime discovery.

Then run:

```powershell
npm install
npm run dev
```

`postinstall` applies `patches/electron-libmpv+1.1.0.patch` and rebuilds native addons for
Electron. When upgrading Electron or `electron-libmpv`, rebuild both `electron-libmpv`
and `better-sqlite3`, then repeat the playback-resilience test matrix.

## Development Guide Data

Set `IPTV_EPG_FILE` to a local XMLTV file before `npm run dev` to ingest from disk instead
of downloading the provider feed.

## Verification

```powershell
npx tsc --noEmit
npm run lint
npx vite build
```

Release builds must also pass the clean-machine checklist in
[RELEASE_READINESS.md](../RELEASE_READINESS.md).
