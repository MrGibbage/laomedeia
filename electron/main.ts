import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Mpv from 'electron-libmpv'
import type { XtreamConfig } from './xtream'
import * as xtream from './xtream'
import * as settingsStore from './settings-store'
import * as prefsStore from './prefs-store'
import * as epg from './epg'
import * as epgDb from './epg-db'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

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
    onEvent: () => {
      window.webContents.send('mpv:event')
    },
  })

  ipcMain.handle('mpv:attach', (_event, x: number, y: number, width: number, height: number) => {
    const handle = window.getNativeWindowHandle()
    return player!.attach(handle, x, y, width, height)
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
}

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
  createWindow()
  refreshEpgIfConfigured()
  setInterval(refreshEpgIfConfigured, 60 * 60 * 1000)
})
