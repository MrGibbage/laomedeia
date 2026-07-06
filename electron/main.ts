import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import path from 'node:path'
import Mpv from 'electron-libmpv'
import type { XtreamConfig } from './xtream'
import * as xtream from './xtream'
import * as settingsStore from './settings-store'
import * as prefsStore from './prefs-store'
import * as progressStore from './progress-store'
import * as epg from './epg'
import * as epgDb from './epg-db'
import * as playback from './playback'
import { log, rotateLogs } from './logger'

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

function createWindow() {
  win = new BrowserWindow({
    title: "Skip's IPTV Viewer",
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
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

  win.on('enter-full-screen', () => win?.webContents.send('app:fullscreen-changed', true))
  win.on('leave-full-screen', () => win?.webContents.send('app:fullscreen-changed', false))

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
      playback.handleMpvEvent(event as playback.MpvEvent)
      window.webContents.send('mpv:event')
    },
  })

  playback.init(
    player,
    (status) => {
      window.webContents.send('playback:status', status)
    },
    (streamId) => {
      window.webContents.send('playback:confirmed', streamId)
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

ipcMain.handle('xtream:testConnection', (_event, config: XtreamConfig) => {
  return xtream.testConnection(config)
})

ipcMain.handle('xtream:getLiveCategories', (_event, config: XtreamConfig) => {
  return xtream.getLiveCategories(config)
})

ipcMain.handle('xtream:getLiveStreams', (_event, config: XtreamConfig, categoryId?: string) => {
  return xtream.getLiveStreams(config, categoryId)
})

ipcMain.handle('xtream:buildLiveStreamUrl', (_event, config: XtreamConfig, streamId: number) => {
  return xtream.buildLiveStreamUrl(config, streamId)
})

ipcMain.handle('xtream:getVodCategories', (_event, config: XtreamConfig) => {
  return xtream.getVodCategories(config)
})

ipcMain.handle('xtream:getVodStreams', (_event, config: XtreamConfig, categoryId?: string) => {
  return xtream.getVodStreams(config, categoryId)
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
  return xtream.getSeriesCategories(config)
})

ipcMain.handle('xtream:getSeriesList', (_event, config: XtreamConfig, categoryId?: string) => {
  return xtream.getSeriesList(config, categoryId)
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
  return settingsStore.saveConfig(config)
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
  if (status.state === 'error' && status.error) log('epg', `refresh failed: ${status.error}`)
  win?.webContents.send('epg:status', status)
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
  log('main', 'app started')
  createWindow()
  refreshEpgIfConfigured()
  setInterval(refreshEpgIfConfigured, 60 * 60 * 1000)
})
