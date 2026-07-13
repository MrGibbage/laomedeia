# Product Requirements Document

## Document Status

- Product: Laomedeia
- Platform: Windows desktop
- Status: BETA v0.1 living PRD reflecting the product on 2026-07-12
- Provider protocol: Xtream Codes API
- Related: [PLAN.md](PLAN.md), [SDD.md](SDD.md), [README.md](README.md)

This PRD was created after iterative development began. It describes the product that
exists today, the requirements it satisfies, and remaining release work without
pretending every decision was known before implementation.

## Product Summary

Laomedeia is a modern Windows IPTV client centered on a fast, readable
electronic programme guide. It combines Live TV, a virtualized guide, movies, series,
resume support, and a personalized Home screen in one themed desktop experience.

## Problem

Windows IPTV clients commonly have dated interfaces, weak EPG navigation, unreliable
playback recovery, and poor continuity between sessions. Large Xtream libraries amplify
these problems because users may need to navigate thousands of channels and titles.

The product must minimize the effort between opening the app and reaching the desired
channel, programme, movie, or episode.

## Goals

1. Deliver an excellent EPG that remains responsive with large lineups.
2. Make Live TV discovery and channel switching quick and predictable.
3. Present VOD and series in a modern visual browser with resume support.
4. Preserve useful context across screens and restarts.
5. Recover honestly from unreliable IPTV streams without freezing the UI.
6. Provide a cohesive, configurable Windows experience.
7. Keep provider credentials and personal viewing state local.

## v1 Non-Goals

- DVR or recording inside the desktop client
- Provider formats other than Xtream Codes
- Chromecast or other remote-playback protocols
- Multi-user profiles or cloud synchronization
- Hidden-title management for movies and series
- Windows System Media Transport Controls

Recordings remain v2 and must run on an always-on server rather than depend on the
desktop application remaining open.

## Target User

The primary user has an Xtream-compatible account, uses Windows, and wants a polished
personal viewing app. The design must accommodate thousands of live channels and many
thousands of VOD and series entries.

## Core Journeys

### First Run

1. Enter provider URL, username, and password in Settings.
2. Test the connection.
3. Save only after the current values pass the test.
4. Load Live TV, provider categories, and guide data.

### Watch Live TV

1. Open Live TV or select a favorite channel from Home.
2. Filter by name, category, or favorites.
3. Select a channel and view now/next information.
4. Zap with Up/Down inside the visible filtered list.

### Use the Guide

1. Open Guide with the current Live TV category already selected.
2. Change category, day, time position, or search query.
3. Search channel names, programme titles, and descriptions.
4. Select a channel or Watch; return to Live TV without losing category context.

### Continue Media

1. Open Home, Movies, or TV Shows.
2. Find unfinished content with resume progress.
3. Resume near the saved position.
4. Clear resume state automatically near completion.

### Resume an App Session

1. Restore the configured startup destination.
2. Restore Live/Guide, Movie, and TV Show categories independently.
3. Auto-resume the last confirmed channel only for a Live TV startup.
4. Restore normal window bounds or maximized state, never cinema full screen.

## Functional Requirements

### Account and Settings

- Accept Xtream URL, username, and password.
- Require a successful test before saving changed credentials.
- Store credentials only under Electron's local `userData` directory.
- Expose appearance, startup, playback compatibility, hidden channels, dismissed Home
  items, and keyboard-shortcut information.

### Home

- Use **Home** as the landing-screen name.
- Show favorite live channels.
- Show unfinished movies ordered by recent activity.
- Show recent resumable TV episodes when metadata is available.
- Tune or resume content directly from its card. Favorite-channel cards shall carry the
  channel's category into Live TV so the tuned row remains visible in the sidebar.
- Allow a card to be dismissed without removing its favorite or watch progress.
- Allow all dismissed cards to be restored from Settings.
- Link to Live TV, Movies, and TV Shows.

### Startup

- Allow Home, Live TV, Live TV Guide, Movie List, or TV Show List as startup choices.
- Persist the choice.
- Prevent hidden live audio when starting anywhere except Live TV.

### Live TV

- Load live categories and streams from Xtream.
- Show channel names and logos when available.
- Support favorites, favorites-only filtering, hiding, and name search.
- Compose category, name, hidden-channel, and favorite filtering.
- Show only nonempty category choices with channel counts.
- Scroll to the first channel after a category change.
- Persist the selected category.
- Zap through the visible list with wraparound.
- Return to the previous channel with Backspace.
- Trust a channel for restart resume only after it remains playable long enough.

### Electronic Programme Guide

- Render a virtualized channel-by-time grid suitable for thousands of channels.
- Provide sticky headers, now line, day navigation, jump-to-now, and details.
- Load programme rows only for the visible/overscanned viewport.
- Search channel name, title, and description through FTS.
- Share category selection with Live TV for grid rows and search results.
- Reset vertical scroll on category change while preserving horizontal time.
- Tune a Guide channel and retain category context in Live TV.
- Support automatic and manual guide refresh.

### Movies

- Display category navigation and poster grids.
- Persist the selected category.
- Search within a category or lazy-load an All scope.
- Show available plot, cast, director, genre, rating, and release information.
- Support Play, Resume, progress indicators, and a playback scrubber.
- Preserve browser state while playing.

### TV Shows

- Display category navigation and poster grids.
- Persist the selected category.
- Search within a category or lazy-load an All scope.
- Show series details, seasons, and episodes.
- Show a clear state when a listed series has no episodes.
- Support episode Play, Resume, progress, and scrubbing.
- Preserve browser state while playing.

### Playback

- Share one embedded libmpv instance across all media.
- Enter a distraction-free cinema presentation in full screen.
- Hide the cursor and media toolbar after pointer inactivity.
- Surface loading, failure, stall, and wedge states.
- Offer Retry for recoverable errors and Restart Player for a wedged core.
- Offer persisted software decoding as a compatibility fallback.
- Keep time-sensitive playback monitoring event-driven.

### Appearance and Window

- Style all screens from shared semantic design tokens.
- Offer System, bundled named themes, and custom JSON themes.
- Open first launch centered at 1280 by 800, clamped to the display.
- Persist normal bounds and maximized state.
- Reject saved bounds that no longer overlap a connected display.
- Never persist full-screen state.

## Local Data

- `xtream-config.json`: account configuration
- `prefs.json`: favorites, hidden channels, category choices, startup choice, theme,
  compatibility mode, last confirmed channel, and dismissed Home cards
- `progress.json`: movie/episode resume positions and available media metadata
- `window-state.json`: normal bounds and maximized state
- `epg-cache.sqlite3`: guide channels, programmes, indexes, and FTS
- `logs/main.log` and bounded rotated generations: sanitized diagnostics

All data lives in Electron's per-user application directory and must remain outside the
public repository.

## Nonfunctional Requirements

### Performance

- Guide scrolling must remain responsive near 2,000 channels and 100,000 programmes.
- Live category switching must be immediate over loaded data.
- Full-library VOD/Series search may lazy-load and cache for the session.

### Reliability

- EPG refresh must never expose a partially replaced guide.
- Playback monitoring must not synchronously block Electron's main process.
- Last-channel resume must avoid boot loops into recently failing streams.
- Corrupt or off-screen window state must not make the app inaccessible.

### Security and Privacy

- Never commit or intentionally log provider credentials or authenticated URLs.
- Limit renderer access to typed preload-bridge capabilities.
- Exclude configuration, logs, native runtimes, build output, and secrets from Git.

### Usability

- Provide explicit loading, empty, and failure states.
- Prevent playback shortcuts while typing in inputs.
- Label icon-only controls with useful titles or accessible text.
- Keep theme and interaction behavior consistent across screens.

## v1 Success Criteria

- A real Xtream account can be configured and validated.
- Live TV, Guide, Movies, and TV Shows work against a real provider.
- Large guide data remains smooth and searchable.
- Playback failure can be understood and recovered without a terminal.
- User context persists as defined above.
- A normal Windows installer installs, launches, and removes the app.

## Remaining v1 Work

- Complete packaging and clean-machine installer verification.
- Investigate the known native mpv child-window sizing flash on some launch/relaunch
  playback paths.
- Perform a focused Home usability pass with accumulated real viewing history.
- Decide whether Recent Shows should retain completed history or remain resumable-only.

## Future Scope

### v2 Recordings

- Server-side scheduling and ffmpeg capture
- Recording rules, retention, and storage management
- Schedule from EPG
- Browse and play recordings in the client

### Possible Later Enhancements

- Windows media controls
- Profiles
- Home section visibility/order controls
- Completed-watch history

Chromecast is deliberately not on the backlog at this time.
