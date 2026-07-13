# User Guide

[← Back to README](../README.md)

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
[GitHub Releases](https://github.com/MrGibbage/laomedeia/releases). Install a newer version over
the existing version to retain local preferences and progress.

Uninstall from **Windows Settings → Apps → Installed apps**. Application data is retained
by default. To remove it manually, delete `%APPDATA%\iptv` after uninstalling. The
internal data-directory name remains `iptv` so upgrades from pre-Laomedeia beta builds
retain account settings, favorites, history, and Guide data.
