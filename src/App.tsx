import { useEffect, useMemo, useRef, useState } from 'react'
import type { XtreamConfig, LiveStream } from '../electron/xtream'
import SettingsScreen from './components/SettingsScreen'
import ChannelList from './components/ChannelList'
import Player from './components/Player'
import EpgGrid from './components/EpgGrid'
import NowNextBar from './components/NowNextBar'
import './app.css'

type View = 'live' | 'guide'

function App() {
  const [config, setConfig] = useState<XtreamConfig | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [view, setView] = useState<View>('live')
  const [selectedStream, setSelectedStream] = useState<LiveStream | null>(null)
  const [previousStream, setPreviousStream] = useState<LiveStream | null>(null)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [channels, setChannels] = useState<LiveStream[]>([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [channelsError, setChannelsError] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [channelFilter, setChannelFilter] = useState('')
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const lastStreamIdRef = useRef<number | null>(null)
  const resumedRef = useRef(false)

  useEffect(() => {
    window.settings.load().then((loaded) => {
      setConfig(loaded)
      setConfigLoaded(true)
    })
    window.prefs.load().then((p) => {
      setFavorites(new Set(p.favoriteStreamIds))
      lastStreamIdRef.current = p.lastStreamId
      setPrefsLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!config) return
    let cancelled = false
    setChannelsLoading(true)
    setChannelsError(null)
    window.xtream
      .getLiveStreams(config)
      .then((streams) => {
        if (!cancelled) setChannels(streams)
      })
      .catch((err) => {
        if (!cancelled) setChannelsError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setChannelsLoading(false)
      })
    // Kick a TTL-gated EPG refresh whenever the config becomes available or
    // changes (a no-op when the cache is fresh).
    window.epg.refresh(config, false)
    return () => {
      cancelled = true
    }
  }, [config])

  useEffect(() => {
    if (config && selectedStream) {
      window.xtream.buildLiveStreamUrl(config, selectedStream.streamId).then(setStreamUrl)
    }
  }, [config, selectedStream])

  const persistPrefs = (favs: Set<number>, lastStreamId: number | null) => {
    window.prefs.save({ favoriteStreamIds: Array.from(favs), lastStreamId })
  }

  const tune = (stream: LiveStream) => {
    if (selectedStream && selectedStream.streamId !== stream.streamId) {
      setPreviousStream(selectedStream)
    }
    setSelectedStream(stream)
    lastStreamIdRef.current = stream.streamId
    persistPrefs(favorites, stream.streamId)
    setView('live')
  }

  // Last-channel resume: once channels and prefs are both in, re-tune the
  // channel that was playing when the app last closed.
  useEffect(() => {
    if (resumedRef.current || !prefsLoaded || channels.length === 0 || selectedStream) return
    resumedRef.current = true
    const last = channels.find((c) => c.streamId === lastStreamIdRef.current)
    if (last) setSelectedStream(last)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoaded, channels])

  const toggleFavorite = (streamId: number) => {
    const next = new Set(favorites)
    if (next.has(streamId)) next.delete(streamId)
    else next.add(streamId)
    setFavorites(next)
    persistPrefs(next, lastStreamIdRef.current)
  }

  // The list as displayed in the sidebar: name-filtered, favorites surfaced
  // first (or exclusively). Keyboard zapping walks this same order.
  const displayChannels = useMemo(() => {
    const text = channelFilter.trim().toLowerCase()
    let list = channels
    if (text) list = list.filter((c) => c.name.toLowerCase().includes(text))
    if (favoritesOnly) return list.filter((c) => favorites.has(c.streamId))
    if (favorites.size === 0) return list
    const favs: LiveStream[] = []
    const rest: LiveStream[] = []
    for (const c of list) (favorites.has(c.streamId) ? favs : rest).push(c)
    return [...favs, ...rest]
  }, [channels, channelFilter, favoritesOnly, favorites])

  // Quick switching: ArrowUp/ArrowDown zap through the visible list,
  // Backspace swaps back to the previously tuned channel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== 'live' || showSettings) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (displayChannels.length === 0) return
        const idx = displayChannels.findIndex((c) => c.streamId === selectedStream?.streamId)
        const step = e.key === 'ArrowDown' ? 1 : -1
        const next =
          idx < 0 ? 0 : (idx + step + displayChannels.length) % displayChannels.length
        tune(displayChannels[next])
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        if (previousStream) tune(previousStream)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!configLoaded) return null

  if (!config || showSettings) {
    return (
      <SettingsScreen
        initialConfig={config}
        onSaved={(saved) => {
          setConfig(saved)
          setShowSettings(false)
        }}
        onCancel={config ? () => setShowSettings(false) : undefined}
      />
    )
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-title">
          <span className="app-title-mark">▶</span> IPTV
        </div>
        <nav className="app-tabs">
          <button className={`app-tab${view === 'live' ? ' active' : ''}`} onClick={() => setView('live')}>
            Live TV
          </button>
          <button className={`app-tab${view === 'guide' ? ' active' : ''}`} onClick={() => setView('guide')}>
            Guide
          </button>
        </nav>
        <div className="app-header-spacer" />
        <button className="app-settings-btn" onClick={() => setShowSettings(true)}>
          Settings
        </button>
      </header>

      {/* The live view stays mounted while the guide is open: the mpv video
          surface is a native child window, so hiding its placeholder (display:
          none) collapses it to 0×0 via Player's ResizeObserver while playback
          (audio) continues. */}
      <div className="app-live" style={{ display: view === 'live' ? 'flex' : 'none' }}>
        <aside className="app-sidebar">
          <ChannelList
            channels={displayChannels}
            totalCount={channels.length}
            loading={channelsLoading}
            error={channelsError}
            selectedStreamId={selectedStream?.streamId ?? null}
            onSelect={tune}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            favoritesOnly={favoritesOnly}
            onToggleFavoritesOnly={() => setFavoritesOnly((v) => !v)}
            filterText={channelFilter}
            onFilterTextChange={setChannelFilter}
          />
        </aside>
        <div className="app-player-col">
          <NowNextBar stream={selectedStream} />
          <div className="app-player-surface">
            <Player streamUrl={streamUrl} />
          </div>
        </div>
      </div>

      {view === 'guide' && (
        <div className="app-guide">
          <EpgGrid
            config={config}
            channels={channels}
            tunedStreamId={selectedStream?.streamId ?? null}
            onTune={tune}
          />
        </div>
      )}
    </div>
  )
}

export default App
