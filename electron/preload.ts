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
  onEvent: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('mpv:event', listener)
    return () => ipcRenderer.removeListener('mpv:event', listener)
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
})

contextBridge.exposeInMainWorld('settings', {
  load: () => ipcRenderer.invoke('settings:load'),
  save: (config: XtreamConfig) => ipcRenderer.invoke('settings:save', config),
})

// --------- Expose viewing prefs (favorites, last channel) ---------
contextBridge.exposeInMainWorld('prefs', {
  load: () => ipcRenderer.invoke('prefs:load'),
  save: (prefs: import('./prefs-store').Prefs) => ipcRenderer.invoke('prefs:save', prefs),
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
