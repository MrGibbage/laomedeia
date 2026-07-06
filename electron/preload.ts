import { ipcRenderer, contextBridge } from 'electron'
import type { XtreamConfig } from './xtream'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

// --------- Expose mpv playback controls to the Renderer process ---------
contextBridge.exposeInMainWorld('mpv', {
  attach: (x: number, y: number, width: number, height: number) =>
    ipcRenderer.invoke('mpv:attach', x, y, width, height),
  resize: (x: number, y: number, width: number, height: number) =>
    ipcRenderer.invoke('mpv:resize', x, y, width, height),
  command: (...args: string[]) => ipcRenderer.invoke('mpv:command', ...args),
  setProperty: (name: string, value: string | number | boolean) =>
    ipcRenderer.invoke('mpv:setProperty', name, value),
  getProperty: (name: string) => ipcRenderer.invoke('mpv:getProperty', name),
  setCursorVisible: (visible: boolean) => ipcRenderer.invoke('mpv:setCursorVisible', visible),
  onEvent: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('mpv:event', listener)
    return () => ipcRenderer.removeListener('mpv:event', listener)
  },
})

// --------- Expose app-shell controls (full screen) to the Renderer process ---------
contextBridge.exposeInMainWorld('app', {
  toggleFullScreen: () => ipcRenderer.invoke('app:toggleFullScreen') as Promise<boolean>,
  isFullScreen: () => ipcRenderer.invoke('app:isFullScreen') as Promise<boolean>,
  relaunch: () => ipcRenderer.invoke('app:relaunch') as Promise<void>,
  onFullScreenChange: (callback: (isFullScreen: boolean) => void) => {
    const listener = (_event: unknown, isFullScreen: boolean) => callback(isFullScreen)
    ipcRenderer.on('app:fullscreen-changed', listener)
    return () => ipcRenderer.removeListener('app:fullscreen-changed', listener)
  },
})

// --------- Expose Xtream API + settings persistence to the Renderer process ---------
contextBridge.exposeInMainWorld('xtream', {
  testConnection: (config: XtreamConfig) => ipcRenderer.invoke('xtream:testConnection', config),
  getLiveCategories: (config: XtreamConfig) => ipcRenderer.invoke('xtream:getLiveCategories', config),
  getLiveStreams: (config: XtreamConfig, categoryId?: string) =>
    ipcRenderer.invoke('xtream:getLiveStreams', config, categoryId),
  buildLiveStreamUrl: (config: XtreamConfig, streamId: number) =>
    ipcRenderer.invoke('xtream:buildLiveStreamUrl', config, streamId),
  getVodCategories: (config: XtreamConfig) => ipcRenderer.invoke('xtream:getVodCategories', config),
  getVodStreams: (config: XtreamConfig, categoryId?: string) =>
    ipcRenderer.invoke('xtream:getVodStreams', config, categoryId),
  getVodInfo: (config: XtreamConfig, vodId: number) => ipcRenderer.invoke('xtream:getVodInfo', config, vodId),
  buildVodStreamUrl: (config: XtreamConfig, streamId: number, extension: string) =>
    ipcRenderer.invoke('xtream:buildVodStreamUrl', config, streamId, extension),
  getSeriesCategories: (config: XtreamConfig) => ipcRenderer.invoke('xtream:getSeriesCategories', config),
  getSeriesList: (config: XtreamConfig, categoryId?: string) =>
    ipcRenderer.invoke('xtream:getSeriesList', config, categoryId),
  getSeriesInfo: (config: XtreamConfig, seriesId: number) =>
    ipcRenderer.invoke('xtream:getSeriesInfo', config, seriesId),
  buildSeriesStreamUrl: (config: XtreamConfig, episodeId: string, extension: string) =>
    ipcRenderer.invoke('xtream:buildSeriesStreamUrl', config, episodeId, extension),
})

contextBridge.exposeInMainWorld('settings', {
  load: () => ipcRenderer.invoke('settings:load'),
  save: (config: XtreamConfig) => ipcRenderer.invoke('settings:save', config),
})

// --------- Expose watched playback (loadfile + failure detection) ---------
contextBridge.exposeInMainWorld('playback', {
  play: (url: string, streamId?: number) => ipcRenderer.invoke('playback:play', url, streamId),
  stop: () => ipcRenderer.invoke('playback:stop'),
  setSoftwareDecoding: (enabled: boolean) =>
    ipcRenderer.invoke('playback:setSoftwareDecoding', enabled),
  onStatus: (callback: (status: unknown) => void) => {
    const listener = (_event: unknown, status: unknown) => callback(status)
    ipcRenderer.on('playback:status', listener as never)
    return () => ipcRenderer.removeListener('playback:status', listener as never)
  },
  // Fires once a tuned channel has played without stalling/erroring for long
  // enough to trust as a startup-resume target (see CONFIRM_PLAYABLE_MS).
  onConfirmed: (callback: (streamId: number) => void) => {
    const listener = (_event: unknown, streamId: number) => callback(streamId)
    ipcRenderer.on('playback:confirmed', listener)
    return () => ipcRenderer.removeListener('playback:confirmed', listener)
  },
})

// --------- Expose viewing prefs (favorites, last channel) ---------
contextBridge.exposeInMainWorld('prefs', {
  load: () => ipcRenderer.invoke('prefs:load'),
  save: (prefs: import('./prefs-store').Prefs) => ipcRenderer.invoke('prefs:save', prefs),
})

// --------- Expose resume-position tracking (VOD/series) ---------
contextBridge.exposeInMainWorld('progress', {
  load: () => ipcRenderer.invoke('progress:load'),
  save: (key: string, progress: import('./progress-store').WatchProgress) =>
    ipcRenderer.invoke('progress:save', key, progress),
})

// --------- Expose the EPG cache to the Renderer process ---------
contextBridge.exposeInMainWorld('epg', {
  refresh: (config: XtreamConfig, force?: boolean) => ipcRenderer.invoke('epg:refresh', config, force),
  getStatus: () => ipcRenderer.invoke('epg:getStatus'),
  getProgrammes: (channelIds: string[], fromMs: number, toMs: number) =>
    ipcRenderer.invoke('epg:getProgrammes', channelIds, fromMs, toMs),
  search: (query: string) => ipcRenderer.invoke('epg:search', query),
  getBounds: () => ipcRenderer.invoke('epg:getBounds'),
  onStatus: (callback: (status: unknown) => void) => {
    const listener = (_event: unknown, status: unknown) => callback(status)
    ipcRenderer.on('epg:status', listener as never)
    return () => ipcRenderer.removeListener('epg:status', listener as never)
  },
})
