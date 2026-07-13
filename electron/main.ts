import { app, BrowserWindow, ipcMain, Menu, screen, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import Mpv from 'electron-libmpv'
import type { XtreamConfig } from './xtream'
import * as xtream from './xtream'
import * as settingsStore from './settings-store'
import * as prefsStore from './prefs-store'
import * as progressStore from './progress-store'
import * as windowStateStore from './window-state-store'
import * as epg from './epg'
import * as epgDb from './epg-db'
import * as playback from './playback'
import { createDiagnosticReport, log, logsDir, rotateLogs } from './logger'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// No File/Edit/View/Window/Help bar — it's Electron's default template, not
// anything this app uses. Reload/DevTools remain available via their usual
// keyboard shortcuts even with the menu gone.
Menu.setApplicationMenu(null)

// Required for libmpv to render via GPU-accelerated D3D11 into the embedded window.
app.commandLine.appendSwitch('use-angle', 'd3d11')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-accelerated-video-decode')

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let player: InstanceType<typeof Mpv> | null = null
let rendererClosing = false

// Native mpv/EPG callbacks can arrive during BrowserWindow teardown. Calling
// webContents.send after Chromium has destroyed the target throws from inside
// the N-API callback, which Node reports as DEP0168. Treat renderer delivery as
// best-effort at this boundary: shutdown events have no UI consumer anyway.
function sendToRenderer(target: BrowserWindow | null, channel: string, ...args: unknown[]): boolean {
  if (rendererClosing || !target || target.isDestroyed() || target.webContents.isDestroyed()) return false
  try {
    target.webContents.send(channel, ...args)
    return true
  } catch (err) {
    // Do not let a renderer teardown race escape through a native callback.
    log('main', `renderer send skipped (${channel}): ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

async function loggedOperation<T>(name: string, operation: () => Promise<T>, summarize?: (result: T) => string): Promise<T> {
  const startedAt = Date.now()
  try {
    const result = await operation()
    const summary = summarize?.(result)
    log('operation', `${name} completed in ${Date.now() - startedAt}ms${summary ? ` ${summary}` : ''}`)
    return result
  } catch (err) {
    log('operation', `${name} failed in ${Date.now() - startedAt}ms: ${err instanceof Error ? err.message : String(err)}`)
    throw err
  }
}

async function createWindow() {
  rendererClosing = false
  const savedWindowState = await windowStateStore.loadWindowState()
  win = new BrowserWindow({
    title: 'Laomedeia',
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    ...savedWindowState.bounds,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  if (savedWindowState.maximized) win.maximize()

  let stateSaveTimer: ReturnType<typeof setTimeout> | null = null
  const saveWindowState = () => {
    if (!win || win.isFullScreen()) return
    if (stateSaveTimer) clearTimeout(stateSaveTimer)
    stateSaveTimer = setTimeout(() => {
      if (!win || win.isFullScreen()) return
      void windowStateStore.saveWindowState({
        bounds: win.getNormalBounds(),
        maximized: win.isMaximized(),
      })
    }, 250)
  }
  win.on('resize', saveWindowState)
  win.on('move', saveWindowState)
  win.on('maximize', saveWindowState)
  win.on('unmaximize', saveWindowState)
  win.on('close', () => {
    rendererClosing = true
    if (stateSaveTimer) clearTimeout(stateSaveTimer)
    if (!win || win.isFullScreen()) return
    void windowStateStore.saveWindowState({
      bounds: win.getNormalBounds(),
      maximized: win.isMaximized(),
    })
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    sendToRenderer(win, 'main-process-message', (new Date).toLocaleString())
  })
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    log('renderer', `load failed code=${errorCode} description=${errorDescription}`)
  })

  // Electron's Ctrl+R/Ctrl+Shift+I only exist because of the default menu's
  // 'reload'/'toggleDevTools' roles — removing the menu bar (Menu.setApplicationMenu
  // above) silently took them with it. Rebind them directly so dev/debugging still
  // works with no menu.
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F11') {
      win?.setFullScreen(!win.isFullScreen())
      return
    }
    if (input.key === 'Escape' && win?.isFullScreen()) {
      win.setFullScreen(false)
      return
    }
    if (!input.control) return
    if (input.key.toLowerCase() === 'r') win?.webContents.reload()
    else if (input.key.toLowerCase() === 'i' && input.shift) win?.webContents.toggleDevTools()
  })

  win.on('enter-full-screen', () => sendToRenderer(win, 'app:fullscreen-changed', true))
  win.on('leave-full-screen', () => sendToRenderer(win, 'app:fullscreen-changed', false))

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  setupMpv(win)
}

function setupMpv(window: BrowserWindow) {
  player = new Mpv({
    onEvent: (event) => {
      const ev = event as playback.MpvEvent
      playback.handleMpvEvent(ev)
      // Forward the playback position (mpv already observes time-pos for the
      // stall watchdog — see the addon patch — so this is free; no extra
      // synchronous getProperty poll). Drives the VOD/series scrubber.
      if (ev.event === 'property-change' && ev.name === 'time-pos' && typeof ev.value === 'number') {
        sendToRenderer(window, 'mpv:timepos', ev.value)
      }
      sendToRenderer(window, 'mpv:event')
    },
  })

  playback.init(
    player,
    (status) => {
      sendToRenderer(window, 'playback:status', status)
    },
    (streamId) => {
      sendToRenderer(window, 'playback:confirmed', streamId)
    },
  )

  ipcMain.handle('mpv:attach', async (_event, x: number, y: number, width: number, height: number) => {
    const handle = window.getNativeWindowHandle()
    const ok = player!.attach(handle, x, y, width, height)
    if (ok) {
      // Apply the saved decode mode before configureMpv sets the rest of the
      // runtime options, so hwdec is right from the very first loadfile.
      const prefs = await prefsStore.loadPrefs()
      playback.setSoftwareDecoding(prefs.softwareDecoding)
      playback.configureMpv()
    }
    return ok
  })

  ipcMain.handle('mpv:resize', (_event, x: number, y: number, width: number, height: number) => {
    player?.resize(x, y, width, height)
  })

  ipcMain.handle('mpv:command', (_event, ...args: string[]) => {
    return player?.command(...args)
  })

  ipcMain.handle('mpv:setProperty', (_event, name: string, value: string | number | boolean) => {
    return player?.property(name, value)
  })

  ipcMain.handle('mpv:getProperty', (_event, name: string) => {
    return player?.getRawProperty(name) ?? null
  })

  ipcMain.handle('mpv:setCursorVisible', (_event, visible: boolean) => {
    player?.setCursorVisible(visible)
  })
}

ipcMain.handle('app:toggleFullScreen', () => {
  win?.setFullScreen(!win.isFullScreen())
  return win?.isFullScreen() ?? false
})

ipcMain.handle('app:isFullScreen', () => win?.isFullScreen() ?? false)

ipcMain.handle('app:openLogsFolder', async () => {
  const error = await shell.openPath(logsDir())
  if (error) log('diagnostics', `open logs folder failed: ${error}`)
})

ipcMain.handle('app:createDiagnosticReport', () => {
  const report = createDiagnosticReport({
    appVersion: app.getVersion(),
    packaged: app.isPackaged,
    platform: `${process.platform} ${os.release()} ${process.arch}`,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  })
  log('diagnostics', 'sanitized diagnostic report created')
  shell.showItemInFolder(report)
  return report
})

// Global cursor position, polled by the renderer to drive idle-based
// cursor/scrubber hiding in theater mode. Works even while the pointer is over
// mpv's native child window (which swallows DOM mouse events, so a renderer
// mousemove listener can't see motion over the video).
ipcMain.handle('app:getCursorPoint', () => screen.getCursorScreenPoint())

ipcMain.handle('playback:play', (_event, url: string, streamId?: number) => {
  playback.play(url, streamId)
})

ipcMain.handle('playback:stop', () => {
  playback.stop()
})

// Apply a GPU/software decode change live (takes effect on the next tune).
// Persistence is the renderer's job via prefs.json — it's the single writer
// for that file — and it's re-read here on the next launch's mpv:attach.
ipcMain.handle('playback:setSoftwareDecoding', (_event, enabled: boolean) => {
  playback.setSoftwareDecoding(enabled)
})

// Recovery from a wedged mpv core (see electron/playback.ts): the core is
// genuinely dead and the GPU driver it hung may block Electron's own graceful
// exit, so relaunch the hard way — spawn a fresh detached instance, then
// process.exit(0) (the same hard-kill Ctrl-C did manually). The new instance
// auto-resumes the last confirmed-good channel on its own.
ipcMain.handle('app:relaunch', () => {
  log('main', 'user-requested relaunch after wedge')
  // In dev, execPath is electron.exe and argv[1..] point at the app; in a
  // packaged build execPath is the app exe itself. Either way this re-runs
  // exactly what launched us.
  const args = process.argv.slice(1).filter((a) => a !== '--relaunch')
  spawn(process.execPath, args, { detached: true, stdio: 'ignore' }).unref()
  process.exit(0)
})

ipcMain.handle('xtream:testConnection', async (_event, config: XtreamConfig) => {
  return loggedOperation('account test', () => xtream.testConnection(config), (result) => `result=${result.ok ? 'passed' : 'failed'}`)
})

ipcMain.handle('xtream:getLiveCategories', (_event, config: XtreamConfig) => {
  return loggedOperation('load live categories', () => xtream.getLiveCategories(config), (items) => `count=${items.length}`)
})

ipcMain.handle('xtream:getLiveStreams', (_event, config: XtreamConfig, categoryId?: string) => {
  return loggedOperation('load live streams', () => xtream.getLiveStreams(config, categoryId), (items) => `count=${items.length}`)
})

ipcMain.handle('xtream:buildLiveStreamUrl', (_event, config: XtreamConfig, streamId: number) => {
  return xtream.buildLiveStreamUrl(config, streamId)
})

ipcMain.handle('xtream:getVodCategories', (_event, config: XtreamConfig) => {
  return loggedOperation('load VOD categories', () => xtream.getVodCategories(config), (items) => `count=${items.length}`)
})

ipcMain.handle('xtream:getVodStreams', (_event, config: XtreamConfig, categoryId?: string) => {
  return loggedOperation('load VOD streams', () => xtream.getVodStreams(config, categoryId), (items) => `count=${items.length}`)
})

ipcMain.handle('xtream:getVodInfo', (_event, config: XtreamConfig, vodId: number) => {
  return xtream.getVodInfo(config, vodId)
})

ipcMain.handle(
  'xtream:buildVodStreamUrl',
  (_event, config: XtreamConfig, streamId: number, extension: string) => {
    return xtream.buildVodStreamUrl(config, streamId, extension)
  },
)

ipcMain.handle('xtream:getSeriesCategories', (_event, config: XtreamConfig) => {
  return loggedOperation('load series categories', () => xtream.getSeriesCategories(config), (items) => `count=${items.length}`)
})

ipcMain.handle('xtream:getSeriesList', (_event, config: XtreamConfig, categoryId?: string) => {
  return loggedOperation('load series list', () => xtream.getSeriesList(config, categoryId), (items) => `count=${items.length}`)
})

ipcMain.handle('xtream:getSeriesInfo', (_event, config: XtreamConfig, seriesId: number) => {
  return xtream.getSeriesInfo(config, seriesId)
})

ipcMain.handle(
  'xtream:buildSeriesStreamUrl',
  (_event, config: XtreamConfig, episodeId: string, extension: string) => {
    return xtream.buildSeriesStreamUrl(config, episodeId, extension)
  },
)

ipcMain.handle('settings:load', () => {
  return settingsStore.loadConfig()
})

ipcMain.handle('settings:save', (_event, config: XtreamConfig) => {
  return loggedOperation('save account settings', () => settingsStore.saveConfig(config))
})

ipcMain.handle('prefs:load', () => {
  return prefsStore.loadPrefs()
})

ipcMain.handle('prefs:save', (_event, prefs: prefsStore.Prefs) => {
  return prefsStore.savePrefs(prefs)
})

ipcMain.handle('progress:load', () => {
  return progressStore.loadProgress()
})

ipcMain.handle('progress:save', (_event, key: string, progress: progressStore.WatchProgress) => {
  return progressStore.saveProgress(key, progress)
})

ipcMain.handle('epg:refresh', (_event, config: XtreamConfig, force?: boolean) => {
  return epg.refresh(config, force ?? false)
})

ipcMain.handle('epg:getStatus', () => {
  return epg.getStatus()
})

ipcMain.handle('epg:getProgrammes', (_event, channelIds: string[], fromMs: number, toMs: number) => {
  return epgDb.getProgrammes(channelIds, fromMs, toMs)
})

ipcMain.handle('epg:search', (_event, query: string) => {
  return epgDb.search(query)
})

ipcMain.handle('epg:getBounds', () => {
  return epgDb.getBounds()
})

epg.onStatusChange((status) => {
  sendToRenderer(win, 'epg:status', status)
})

process.on('uncaughtException', (err) => {
  log('crash', `uncaught exception: ${err.stack ?? err.message}`)
  setTimeout(() => process.exit(1), 100)
})

process.on('unhandledRejection', (reason) => {
  log('crash', `unhandled rejection: ${reason instanceof Error ? reason.stack ?? reason.message : String(reason)}`)
})

app.on('render-process-gone', (_event, _webContents, details) => {
  log('crash', `renderer gone reason=${details.reason} exitCode=${details.exitCode}`)
})

app.on('child-process-gone', (_event, details) => {
  log('crash', `child process gone type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`)
})

// Refresh the EPG cache on startup when stale (TTL lives in epg.ts), then
// keep checking hourly while the app stays open.
async function refreshEpgIfConfigured() {
  const config = await settingsStore.loadConfig()
  if (config) await epg.refresh(config)
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // A wedged mpv (dead stream, blocked socket) can keep native threads
    // alive through Electron's normal quit, hanging the process until
    // Ctrl-C. Ask mpv to quit, then force-exit as a backstop.
    try {
      player?.command('quit')
    } catch {
      // player already gone
    }
    setTimeout(() => process.exit(0), 2000)
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  rotateLogs()
  log(
    'main',
    `app started version=${app.getVersion()} packaged=${app.isPackaged} platform=${process.platform} ${os.release()} ${process.arch} electron=${process.versions.electron} node=${process.versions.node}`,
  )
  createWindow()
  refreshEpgIfConfigured()
  setInterval(refreshEpgIfConfigured, 60 * 60 * 1000)
})
