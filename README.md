<p align="center">
  <img src="assets/branding/laomedeia-icon.png" width="120" alt="Laomedeia icon">
</p>

<h1 align="center">Laomedeia</h1>

<p align="center">
  <b>A modern Windows IPTV viewer for Xtream-compatible providers.</b><br>
  Fast Live TV, a virtualized programme guide, movies, and TV series — without the dated interface.
</p>

<p align="center">
  <a href="https://github.com/MrGibbage/laomedeia/releases"><img alt="Release" src="https://img.shields.io/github/v/release/MrGibbage/laomedeia?include_prereleases&label=release&color=7c3aed"></a>
  <img alt="Status" src="https://img.shields.io/badge/status-beta-orange">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-0078D6?logo=windows&logoColor=white">
  <img alt="Built with Electron" src="https://img.shields.io/badge/Electron-30-47848F?logo=electron&logoColor=white">
</p>

> [!IMPORTANT]
> **BETA v0.1** — core viewing features work, but this release is still completing
> release-readiness and clean-machine validation. The app can generate a sanitized
> diagnostic report from Settings if something goes wrong.

Pronounced **LAY-oh-muh-dee-ah** — named after one of Neptune's moons; the compass-and-play
icon nods to navigating a media universe.

## Screenshots

| Home | Live TV | Guide |
|---|---|---|
| <img src="docs/screenshots/home.png" width="270" alt="Home screen with favorite channels and continue watching"> | <img src="docs/screenshots/live-tv.png" width="270" alt="Live TV with channel sidebar"> | <img src="docs/screenshots/guide.png" width="270" alt="Full programme guide"> |

## Highlights

- ⚡ Fast, virtualized TV Guide built for thousands of channels
- 🔍 Search across channels, programme titles, and descriptions
- ⭐ Favorites, hidden channels, and keyboard zapping
- 🎬 Movie & TV Show browsers with posters, details, and resume playback
- 🏠 Home screen with your favorites and unfinished shows front and center
- 🎨 8 built-in themes (Catppuccin, Nord, Dracula, Tokyo Night, and more) plus custom JSON themes
- 🖥️ Full-screen cinema mode with auto-hiding controls
- 🛠️ Playback watchdog with automatic retry and recovery
- 🔒 Privacy-safe logs — credentials and stream URLs are never written to disk

## Getting Started

1. Download the latest Windows installer from [Releases](https://github.com/MrGibbage/laomedeia/releases)
2. Run `Laomedeia-Windows-<version>-Setup.exe`
3. Launch **Laomedeia** and enter your Xtream-compatible provider's URL, username, and
   password in Settings

You'll need your own lawful Xtream-compatible IPTV account — Laomedeia doesn't provide
channels, movies, or subscriptions.

📖 **[Full user guide](docs/USER_GUIDE.md)** — first-time setup, Live TV, Guide, Movies &
TV Shows, themes, diagnostics, updating/uninstalling

## Development

🛠️ **[Development setup](docs/DEVELOPMENT.md)** — stack, native libmpv build requirements,
dev commands, verification

## Project Documentation

- [Product Requirements](PRD.md)
- [Software Design](SDD.md)
- [Project Plan and Decision History](PLAN.md)
- [Release Readiness Checklist](RELEASE_READINESS.md)

---

<p align="center"><sub>Feature development is active; persistence formats may still evolve before a stable v1 release.</sub></p>
