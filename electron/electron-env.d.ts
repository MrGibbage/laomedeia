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
  mpv: {
    attach: (x: number, y: number, width: number, height: number) => Promise<boolean>
    resize: (x: number, y: number, width: number, height: number) => Promise<void>
    command: (...args: string[]) => Promise<number | undefined>
    setProperty: (name: string, value: string | number | boolean) => Promise<number | undefined>
    getProperty: (name: string) => Promise<string | null>
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
  }
  settings: {
    load: () => Promise<import('../electron/xtream').XtreamConfig | null>
    save: (config: import('../electron/xtream').XtreamConfig) => Promise<void>
  }
  prefs: {
    load: () => Promise<import('../electron/prefs-store').Prefs>
    save: (prefs: import('../electron/prefs-store').Prefs) => Promise<void>
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
