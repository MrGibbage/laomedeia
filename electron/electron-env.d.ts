/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer
  app: {
    toggleFullScreen: () => Promise<boolean>
    isFullScreen: () => Promise<boolean>
    relaunch: () => Promise<void>
    onFullScreenChange: (callback: (isFullScreen: boolean) => void) => () => void
  }
  mpv: {
    attach: (x: number, y: number, width: number, height: number) => Promise<boolean>
    resize: (x: number, y: number, width: number, height: number) => Promise<void>
    command: (...args: string[]) => Promise<number | undefined>
    setProperty: (name: string, value: string | number | boolean) => Promise<number | undefined>
    getProperty: (name: string) => Promise<string | null>
    setCursorVisible: (visible: boolean) => Promise<void>
    onEvent: (callback: () => void) => () => void
  }
  xtream: {
    testConnection: (
      config: import('../electron/xtream').XtreamConfig,
    ) => Promise<import('../electron/xtream').XtreamTestResult>
    getLiveCategories: (
      config: import('../electron/xtream').XtreamConfig,
    ) => Promise<import('../electron/xtream').LiveCategory[]>
    getLiveStreams: (
      config: import('../electron/xtream').XtreamConfig,
      categoryId?: string,
    ) => Promise<import('../electron/xtream').LiveStream[]>
    buildLiveStreamUrl: (
      config: import('../electron/xtream').XtreamConfig,
      streamId: number,
    ) => Promise<string>
    getVodCategories: (
      config: import('../electron/xtream').XtreamConfig,
    ) => Promise<import('../electron/xtream').VodCategory[]>
    getVodStreams: (
      config: import('../electron/xtream').XtreamConfig,
      categoryId?: string,
    ) => Promise<import('../electron/xtream').VodStream[]>
    getVodInfo: (
      config: import('../electron/xtream').XtreamConfig,
      vodId: number,
    ) => Promise<import('../electron/xtream').VodInfo | null>
    buildVodStreamUrl: (
      config: import('../electron/xtream').XtreamConfig,
      streamId: number,
      extension: string,
    ) => Promise<string>
    getSeriesCategories: (
      config: import('../electron/xtream').XtreamConfig,
    ) => Promise<import('../electron/xtream').SeriesCategory[]>
    getSeriesList: (
      config: import('../electron/xtream').XtreamConfig,
      categoryId?: string,
    ) => Promise<import('../electron/xtream').SeriesListItem[]>
    getSeriesInfo: (
      config: import('../electron/xtream').XtreamConfig,
      seriesId: number,
    ) => Promise<import('../electron/xtream').SeriesInfo | null>
    buildSeriesStreamUrl: (
      config: import('../electron/xtream').XtreamConfig,
      episodeId: string,
      extension: string,
    ) => Promise<string>
  }
  settings: {
    load: () => Promise<import('../electron/xtream').XtreamConfig | null>
    save: (config: import('../electron/xtream').XtreamConfig) => Promise<void>
  }
  prefs: {
    load: () => Promise<import('../electron/prefs-store').Prefs>
    save: (prefs: import('../electron/prefs-store').Prefs) => Promise<void>
  }
  progress: {
    load: () => Promise<import('../electron/progress-store').ProgressMap>
    save: (key: string, progress: import('../electron/progress-store').WatchProgress) => Promise<void>
  }
  playback: {
    play: (url: string, streamId?: number) => Promise<void>
    stop: () => Promise<void>
    setSoftwareDecoding: (enabled: boolean) => Promise<void>
    onStatus: (
      callback: (status: import('../electron/playback').PlaybackStatus) => void,
    ) => () => void
    onConfirmed: (callback: (streamId: number) => void) => () => void
  }
  epg: {
    refresh: (
      config: import('../electron/xtream').XtreamConfig,
      force?: boolean,
    ) => Promise<import('../electron/epg').EpgStatus>
    getStatus: () => Promise<import('../electron/epg').EpgStatus>
    getProgrammes: (
      channelIds: string[],
      fromMs: number,
      toMs: number,
    ) => Promise<import('../electron/epg-db').EpgProgramme[]>
    search: (query: string) => Promise<import('../electron/epg-db').EpgSearchResult[]>
    getBounds: () => Promise<import('../electron/epg-db').EpgBounds>
    onStatus: (callback: (status: import('../electron/epg').EpgStatus) => void) => () => void
  }
}
