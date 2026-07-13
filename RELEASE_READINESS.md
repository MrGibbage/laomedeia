# Release Readiness Checklist

## Document Status

- Product: Laomedeia
- Target: First distributable Windows release
- Status: **Not ready for external distribution**
- Last reviewed: 2026-07-13
- Owner: Skip
- Related: [PRD.md](PRD.md), [SDD.md](SDD.md), [PLAN.md](PLAN.md),
  [README.md](README.md)

This is the release gate for sending the application to other people. A release is ready
only when every **Blocker** is complete and the smoke-test/sign-off sections pass against
an installed build on a clean Windows machine.

## Release Decision

| Gate | Current state | Required result |
|---|---|---|
| Packaged runtime | Complete | Native dependencies and libmpv included and tested |
| Runtime security | Blocked | Supported Electron and hardened renderer boundary |
| Credential storage | Blocked | Secrets encrypted and plaintext migrated |
| Data integrity | Blocked | Atomic writes and single-instance behavior |
| Installer identity | In progress | Real version, icons, metadata, Windows-only targets |
| Packaged smoke test | In progress | Full checklist passes on clean Windows |
| Distribution trust | Undecided | Signing/update strategy explicitly accepted |

## 1. Release Blockers

### 1.1 Package Native Runtime Dependencies

Current evidence (2026-07-13): `npm run build:unpacked` completes successfully and creates
`release/0.1.0/win-unpacked`. Its ASAR contains the production dependencies and its
`app.asar.unpacked` tree contains both native addons. `libmpv-2.dll` is beside the main
executable. The packaged app launches and remains responsive on the build machine. Skip
confirmed Live TV, Guide/EPG, movie, and episode behavior from this build on 2026-07-13.
The complete `win-unpacked` folder was then zipped, copied to a separate laptop without
development setup, extracted, and successfully exercised with behavior matching the build
machine.

The generated per-user NSIS installer was also copied to the laptop, installed to the
default `%LOCALAPPDATA%\Programs\IPTV Viewer` location under the pre-Laomedeia product
name, launched through the installer's completion action, and exercised successfully. It
correctly reused the existing Electron
user-data directory created by the earlier unpacked-build test.

- [x] Confirm electron-builder includes required production dependencies alongside the
  explicit `dist` and `dist-electron` application files.
- [x] Ensure `electron-libmpv` is packaged and its native addon is unpacked.
- [x] Ensure `better-sqlite3` is packaged and its native addon is unpacked.
- [x] Ensure `sax` is packaged.
- [x] Include `libmpv-2.dll` outside ASAR at the exact location used by Windows DLL
  resolution.
- [x] Confirm the patched addon files are present in the packaged dependency.
- [x] Inspect `app.asar` and `app.asar.unpacked` for the initial BETA v0.1 package.
- [x] Launch `win-unpacked` successfully on the build machine.
- [x] Launch `win-unpacked` without Node/npm or the development checkout on `PATH`.
- [x] Confirm Live playback and EPG SQLite access work from `win-unpacked`.

The Laomedeia branding pass supplies production PNG/ICO assets and a reproducible
post-packaging resource hook for executable metadata. `Laomedeia.exe` launches and closes
cleanly on the build machine, and the NSIS installer builds with the expected name,
version, description, and icon. The renamed installer still needs an installed-build
upgrade test on the separate laptop before the installer-identity gate is complete. Code
signing remains a separate distribution-trust decision.

Reference: [electron-builder application contents](https://www.electron.build/docs/contents/).

### 1.2 Upgrade Electron

Electron 30.5.1 is end-of-life and should not be shipped with an old Chromium/Node
security baseline.

- [ ] Select a currently supported stable Electron major.
- [ ] Upgrade Electron and compatible build tooling.
- [ ] Rebuild `electron-libmpv` and `better-sqlite3` for the chosen Electron ABI.
- [ ] Reapply/adapt `patches/electron-libmpv+1.1.0.patch`.
- [ ] Verify the native addon patch compiles without warnings.
- [ ] Repeat normal playback, stall, failure, wedge, cursor, and shutdown tests.
- [ ] Document the supported Electron version in SDD/README.

References: [Electron release schedule](https://releases.electronjs.org/schedule),
[Electron 30 status](https://releases.electronjs.org/release/v30.5.1).

### 1.3 Harden the Renderer Boundary

- [ ] Remove the generic `window.ipcRenderer` bridge; delete the scaffold-only
  `main-process-message` usage.
- [ ] Explicitly set `nodeIntegration: false`.
- [ ] Explicitly set `contextIsolation: true`.
- [ ] Explicitly set `sandbox: true` and verify native/preload behavior.
- [ ] Add a restrictive Content Security Policy.
- [ ] Block unexpected `will-navigate` events.
- [ ] Deny new windows with `setWindowOpenHandler` unless deliberately allowed.
- [ ] Deny unneeded permission requests.
- [ ] Validate IPC senders before executing privileged handlers.
- [ ] Narrow arbitrary mpv command/property IPC to known operations where practical.
- [ ] Confirm no remote provider content is executed as HTML/JavaScript.

References: [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security),
[Electron IPC guidance](https://www.electronjs.org/docs/latest/tutorial/ipc).

### 1.4 Protect Account Credentials

Xtream URL, username, and password currently live in plaintext `xtream-config.json`.

- [ ] Encrypt secrets through Electron `safeStorage` on Windows.
- [ ] Store only the minimum non-secret metadata unencrypted.
- [ ] Add one-time migration from existing plaintext configuration.
- [ ] Delete/replace the plaintext file only after encrypted storage succeeds.
- [ ] Handle decrypt failure with a clear re-enter-credentials flow.
- [ ] Confirm diagnostics never include plaintext or encrypted secret blobs.
- [ ] Warn users when a provider uses HTTP because credentials travel unencrypted.
- [ ] Verify log redaction with representative Xtream URL formats.

Reference: [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).

### 1.5 Make Persistence Atomic

Apply to account configuration, preferences, progress, and window state.

- [ ] Write to a temporary sibling file.
- [ ] Close/flush the temporary file.
- [ ] Atomically rename it over the destination.
- [ ] Keep a bounded backup for high-value user state where useful.
- [ ] Distinguish first-run missing files from malformed/corrupt files.
- [ ] Log corrupt-state recovery without logging sensitive content.
- [ ] Test forced termination during each write path.
- [ ] Verify recovery does not silently erase favorites/progress/configuration.

### 1.6 Enforce One Application Instance

- [ ] Acquire Electron's single-instance lock before creating the window.
- [ ] Exit cleanly when the lock cannot be obtained.
- [ ] Focus/restore the existing window on a second launch.
- [ ] Restore a minimized window before focusing it.
- [ ] Test second launch while normal, maximized, and full screen.
- [ ] Confirm one provider connection and one writer for JSON/SQLite state.

### 1.7 Add Renderer Error Recovery

- [ ] Add a top-level React error boundary.
- [ ] Show a friendly failure screen instead of a blank window.
- [ ] Provide Restart App.
- [ ] Provide Open Logs Folder and Create Diagnostic Report.
- [ ] Log component stack/error without sensitive application data.
- [ ] Test with a deliberately throwing test component/build.

## 2. Packaging and Installer Identity

- [x] Set the beta semantic version to `0.1.0` (BETA v0.1).
- [x] Pick the final product/executable name and use it consistently: **Laomedeia**.
- [x] Replace Vite/Electron placeholder favicon and application icons.
- [x] Provide Windows `.ico` assets at appropriate sizes.
- [x] Remove macOS and Linux targets; current playback integration is Windows-specific.
- [x] Confirm `appId` remains `org.pelorus.iptv` for upgrades from pre-rename builds.
- [x] Confirm per-user NSIS installation is intentional.
- [x] Confirm allowing installation-directory changes is intentional.
- [x] Confirm uninstall retains account/preferences/progress intentionally.
- [x] Add publisher/copyright metadata.
- [ ] Add license and third-party notices appropriate to distribution.
- [ ] Generate SHA-256 checksums for installer artifacts.
- [ ] Create a Git tag matching the application version.
- [ ] Ensure no samples, credentials, XMLTV data, logs, or diagnostics enter artifacts.

## 3. Code Signing and Update Strategy

These are explicit release decisions. They are not both mandatory for a five-person test,
but the decision and user experience must be understood.

### Code Signing

- [ ] Decide whether to purchase/use a Windows code-signing certificate.
- [ ] If signing, configure certificate secrets outside Git and sign executable/installer.
- [ ] Verify signatures on a clean machine.
- [ ] If unsigned, document the expected Windows SmartScreen warning for testers.

Reference: [Electron code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing).

### Updates

- [ ] Choose automatic updates, manual Check for Updates, or manual release downloads.
- [ ] Display the installed version in Settings/Diagnostics.
- [ ] If automatic, test download, Later, Restart, failure, and rollback behavior.
- [ ] Ensure update shutdown uses the same state/logging protections as normal exit.
- [ ] Document how testers learn that a new version exists.

Reference: [Electron updating applications](https://www.electronjs.org/docs/latest/tutorial/updates).

## 4. Diagnostics and Support

Already implemented:

- [x] Sanitized lifecycle/operation/playback/EPG/crash logging
- [x] URL and credential redaction at the final logger boundary
- [x] Raw mpv file logging disabled
- [x] Legacy sensitive `mpv.log` removed on startup
- [x] Bounded 2 MB log rotation with four retained generations
- [x] Open Logs Folder action
- [x] Second-pass-sanitized diagnostic report export
- [x] Diagnostic artifacts ignored by Git

Before release:

- [ ] Add app version visibly to Settings.
- [ ] Verify redaction tests cover query credentials and Live/Movie/Series URL paths.
- [ ] Generate a report after provider, EPG, playback, and simulated crash events.
- [ ] Manually inspect the report for hostnames, usernames, passwords, and stream URLs.
- [ ] Write a short support instruction: reproduce → create report → send report.

## 5. Automated Tests Worth Adding

The project does not need an enterprise test suite, but these tests protect high-risk
logic cheaply.

- [ ] Logger redaction and diagnostic re-sanitization
- [ ] Preference defaults and migrations
- [ ] Plaintext-to-encrypted credential migration
- [ ] Atomic-file recovery from malformed/truncated JSON
- [ ] Window-bound validation across monitor layouts
- [ ] Progress deletion near completion
- [ ] Home section derivation and dismissals
- [ ] Category persistence and Home-favorite category carryover
- [ ] Xtream response parsing for missing/malformed optional fields
- [ ] Stream URL construction (without printing secrets in failed assertions)
- [ ] EPG date/DST calculations
- [ ] Single-instance behavior where practical

## 6. Clean-Machine Packaged Smoke Test

Run from the installer on Windows without Node, npm, Git, the repository, or `C:\mpv-dev`
available.

### Install and First Run

- [ ] Installer completes as a standard user.
- [ ] Start menu/desktop shortcuts use the real icon.
- [ ] App opens at the intended first-launch size.
- [ ] No console window appears.
- [ ] No missing-DLL/native-module errors occur.
- [ ] Connection test fails clearly for invalid input.
- [ ] Valid account saves only after a passing test.
- [ ] HTTP provider warning appears when applicable.

### Live and Guide

- [ ] Live channels/categories/logos load.
- [ ] Favorites, hiding, search, and category filters work.
- [ ] Home favorite carries category into Live TV.
- [ ] Up/Down and Backspace work without affecting inputs.
- [ ] Guide downloads, ingests, scrolls, searches, and refreshes.
- [ ] Live/Guide category state is shared and persists.
- [ ] Category changes reset vertical channel position.

### Movies and TV Shows

- [ ] Categories, posters, details, seasons, and episodes load.
- [ ] Category choices persist across restart.
- [ ] Category and All-scope searches work.
- [ ] Play, Resume, scrub, and progress clearing work.
- [ ] Browser state survives playback and return.
- [ ] Home reflects unfinished media after progress is saved.

### Playback Resilience

- [ ] Known-good H.264 and HEVC media play.
- [ ] Dead URL/open timeout shows a useful error.
- [ ] Mid-stream stall is detected.
- [ ] Retry works after a recoverable failure.
- [ ] Rapid switch after failure does not wedge normal playback.
- [ ] Restart Player recovers a simulated/real wedge.
- [ ] Software decoding persists and plays correctly.
- [ ] Full screen, Escape, cursor hiding, and scrubber reveal work.
- [ ] Exit produces no N-API deprecation warning.

### State and Recovery

- [ ] Every startup destination opens correctly.
- [ ] Non-Live startup does not play invisible live audio.
- [ ] Last confirmed channel resumes only on Live startup.
- [ ] Windowed size/position restores.
- [ ] Maximized state restores.
- [ ] Full-screen state does not restore.
- [ ] Disconnected-monitor bounds fall back on-screen.
- [ ] Corrupt JSON state recovers visibly and safely.
- [ ] Second launch focuses the first instance.

### Diagnostics and Uninstall

- [ ] Open Logs Folder works in the installed app.
- [ ] Create Diagnostic Report reveals the generated report.
- [ ] Report contains useful versions/events and no secrets.
- [ ] Uninstall completes.
- [ ] Retained/deleted app data matches the documented choice.
- [ ] Reinstall behavior is correct with retained state.

## 7. Known Issues to Resolve or Explicitly Accept

- [ ] Investigate the native mpv child-window sizing flash during some fresh/relaunch
  playback paths.
- [ ] Decide whether the brief theme flash before async preferences load is acceptable.
- [ ] Decide how to communicate unsupported/malformed provider streams.
- [ ] Confirm progress read-modify-write behavior is safe after single-instance locking.
- [ ] Review all swallowed catches and log/recover when an existing file is corrupt.
- [ ] Confirm image URLs cannot navigate or create windows.

## 8. Large Product Features Missing from a Broad Production App

These are not first-release blockers unless the intended audience requires them.

### Highest Product Value

- [ ] Subtitle enable/disable and track/language selection
- [ ] Audio-track/language selection
- [ ] Parental controls/PIN and adult-category protection
- [ ] Durable completed-watch history and watched/unwatched controls
- [ ] Automatic/optional next-episode playback
- [ ] Manual provider library refresh with visible last-refresh state

### Later Product Expansion

- [ ] Multiple provider accounts/profiles
- [ ] Export/backup and restore of non-secret user state
- [ ] Accessibility pass: keyboard navigation, focus, screen reader, contrast, reduced
  motion, and UI scaling
- [ ] Home section visibility/order controls
- [ ] Windows System Media Transport Controls
- [ ] Server-side DVR/recordings (v2 architecture in SDD/PLAN)

### Deliberately Not on the Backlog

- Chromecast
- Cloud synchronization
- Recommendations engine
- Social features
- Telemetry by default

## 9. Release Sign-Off

Complete this for each external build.

- Version:
- Git commit/tag:
- Electron version:
- Installer filename:
- SHA-256:
- Signed: Yes / No
- Clean-machine test environment:
- Upgrade tested from version:
- Diagnostic report inspected: Yes / No
- Known issues accepted:
- Release approved by:
- Date:

### Final Go/No-Go Rule

**Go** only when all Section 1 blockers are complete, the installed clean-machine smoke
test passes, and the sign-off record is filled in. Product enhancements in Section 8 may
remain deferred without blocking v1.
