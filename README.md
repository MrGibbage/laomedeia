# Laomedeia

**BETA v0.1**

A modern Windows IPTV application for Xtream-compatible providers. Laomedeia
combines Live TV, a fast electronic programme guide, movies, TV series, resume playback,
favorites, and a personalized Home screen without the dated interface common to many
desktop IPTV clients.

The project name is pronounced **LAY-oh-muh-dee-ah**. Laomedeia is one of Neptune's
moons; its compass-and-play icon reflects the idea of navigating a media universe.

> Beta software: core viewing features are working, but this release is still completing
> its formal release-readiness and clean-machine validation process. If something goes
> wrong, the app can create a sanitized diagnostic report from Settings.

## Highlights

- Fast virtualized TV Guide designed for thousands of channels
- Guide search across channel names, programme titles, and descriptions
- Live TV categories, favorites, channel search, hiding, and keyboard zapping
- Shared category context between Live TV and Guide
- Movie and TV Show browsers with categories, posters, details, and library-wide search
- Resume playback and progress indicators for movies and episodes
- Home screen with favorite channels and unfinished media
- Full-screen cinema mode with idle cursor and control hiding
- Multiple built-in themes plus custom JSON themes
- Playback watchdog, retry handling, software-decoding fallback, and one-click recovery
- Configurable startup screen and remembered browsing categories
- Remembered window size, position, and maximized state
- Privacy-safe logs and exportable diagnostic reports

## Requirements

- Windows 10 or Windows 11, 64-bit
- An active Xtream-compatible IPTV account
- Internet access to the provider
- A GPU capable of normal Windows video playback, or a CPU suitable for software decoding

The application does not provide channels, movies, television shows, subscriptions, or
credentials. Users must supply their own lawful provider account.

## Installation

1. Download the BETA v0.1 Windows installer from the project's
   [GitHub Releases](https://github.com/MrGibbage/iptv/releases) page.
2. Run `Laomedeia-Windows-0.1.0-Setup.exe`.
3. Choose the installation directory when prompted.
4. Launch **Laomedeia** from the Start menu or desktop shortcut.

The installer is per-user and does not require a system-wide installation. Uninstalling
the application retains account settings, preferences, watch progress, and Guide cache so
they remain available after reinstalling.

## First-Time Setup

1. Open **Settings**.
2. Enter the provider's server URL, username, and password.
3. Select **Test Connection**.
4. Save becomes available only after the current values pass the connection test.
5. Select **Save** and allow the channel and Guide data to load.

Provider credentials remain on the local Windows account. Authenticated URLs and account
credentials are removed from application logs and diagnostic reports.

## Home

Home is a quick starting point for:

- Favorite live channels
- Unfinished movies
- Recently watched/resumable TV episodes

Selecting a favorite channel carries its category into Live TV, keeping the tuned channel
visible in the sidebar. The **×** button removes an item from Home without deleting the
favorite or watch progress. Restore dismissed cards from **Settings → Startup**.

## Live TV

### Categories and Search

Use the category dropdown to filter the channel list. Category selection is shared with
Guide and persists across restarts. Changing category returns the list to its first row.

The search box filters channel names inside the active category. Filters compose with
favorites and hidden channels.

### Favorites

Hover over a channel and select its star. Favorites appear first, and the **★** toolbar
button switches to a favorites-only list.

### Hidden Channels

Hover over a channel and select **⊘** to remove a dead, incorrect, or unwanted channel
from Live TV, Guide, and search. Restore channels from **Settings → Hidden Channels**.

### Keyboard Controls

| Key | Action |
|---|---|
| Up / Down | Previous or next channel in the visible filtered list |
| Backspace | Return to the previously tuned channel |
| F11 | Enter or leave full-screen cinema mode |
| Escape | Leave full screen |
| Tab | Switch between Live TV and Guide while full screen |

Keyboard channel controls are disabled while typing in an input field.

## Guide

The Guide provides:

- Channel-by-time grid with sticky headers
- Current-time line and jump-to-now
- Previous/next day navigation
- Programme details and Watch actions
- Search across channel, title, and description
- Manual Guide refresh
- The same category filter used by Live TV

Selecting a channel in Guide tunes it and returns to Live TV without losing category
context. Changing the Guide category resets vertical position while preserving the current
horizontal time position.

Guide data refreshes automatically when older than 12 hours and is checked hourly while
the app remains open.

## Movies and TV Shows

Movies and TV Shows have independent category browsers. Each remembers its category across
restarts.

Search normally applies to the selected category. Once text is entered, choose **All** to
search the complete provider library. Full-library results load on demand and are cached
for the session.

Movie details may include plot, cast, director, genre, rating, and release date. TV Show
details include seasons and episodes when supplied by the provider.

Playback progress is saved periodically. Unfinished titles offer Resume, while media
played to near completion returns to a normal Play state.

## Playback and Full Screen

Live TV, movies, and episodes share one embedded libmpv player. Movies and episodes include
a scrubber for seeking.

Press **F11** or use the header control for cinema mode. Application chrome hides around
the video, and the cursor and media controls hide after a few seconds without movement.
Move the pointer to reveal them again.

### Playback Failures

IPTV streams vary widely in quality. The app monitors playback without blocking its user
interface:

- A stream that does not start in time reports an error.
- A stream that stops advancing reports a stall.
- Recoverable failures offer **Retry**.
- An unresponsive player offers **Restart Player**.
- **Settings → Playback → Maximum compatibility** disables GPU decoding when malformed
  streams cause hardware-decoder problems.

A channel becomes the automatic next-launch target only after playing successfully long
enough to be considered safe.

## Personalization

### Startup Screen

Choose the startup destination under **Settings → Startup**:

- Home
- Live TV
- Live TV Guide
- Movie List
- TV Show List

Only a Live TV startup automatically begins the remembered live channel. Other startup
screens do not play hidden live audio.

### Themes

Choose System, Default Dark/Light, Catppuccin Mocha, Nord, Dracula, Tokyo Night, Rosé
Pine, Rosé Pine Dawn, or Solarized Light. System follows the Windows color preference.
Advanced users can paste a custom theme token map as JSON.

### Window State

The application remembers normal window size and position or maximized state. Cinema full
screen is deliberately never restored after restarting. Saved coordinates are validated
against connected displays to prevent an off-screen window after monitor changes.

## Diagnostics and Privacy

Open **Settings → Diagnostics** to:

- Open the logs folder
- Create a sanitized diagnostic report

Logs contain concise lifecycle, provider-operation, Guide, playback, and crash events.
They rotate at 2 MB with four older generations retained.

The logger removes URLs, usernames, passwords, tokens, and authenticated playback paths.
Diagnostic reports are sanitized a second time and include only logs plus basic application
and Windows runtime versions. Raw mpv logging is disabled because it may expose complete
authenticated stream URLs.

When reporting a problem:

1. Reproduce the issue if it is safe to do so.
2. Open **Settings → Diagnostics**.
3. Select **Create Diagnostic Report**.
4. Send the generated text file with a short description of what happened.

## Updating and Uninstalling

Beta updates are published through
[GitHub Releases](https://github.com/MrGibbage/iptv/releases). Install a newer version over
the existing version to retain local preferences and progress.

Uninstall from **Windows Settings → Apps → Installed apps**. Application data is retained
by default. To remove it manually, delete `%APPDATA%\iptv` after uninstalling. The
internal data-directory name remains `iptv` so upgrades from pre-Laomedeia beta builds
retain account settings, favorites, history, and Guide data.

## Development

### Stack

- Electron
- React and TypeScript
- libmpv through a patched `electron-libmpv` native addon
- better-sqlite3 and FTS5 for Guide storage/search
- sax for streaming XMLTV ingestion
- TanStack Virtual for Guide rows

### Native Development Setup

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

### Development Guide Data

Set `IPTV_EPG_FILE` to a local XMLTV file before `npm run dev` to ingest from disk instead
of downloading the provider feed.

### Verification

```powershell
npx tsc --noEmit
npm run lint
npx vite build
```

Release builds must also pass the clean-machine checklist in
[RELEASE_READINESS.md](RELEASE_READINESS.md).

## Documentation

- [Product Requirements](PRD.md)
- [Software Design](SDD.md)
- [Project Plan and Decision History](PLAN.md)
- [Release Readiness Checklist](RELEASE_READINESS.md)

## Beta Status

BETA v0.1 is the first packaged preview. Feature development is active, persistence
formats may still evolve, and unexpected provider-specific media issues may remain. The
release becomes a stable v1 only after the release-readiness checklist and clean-machine
validation are complete.
