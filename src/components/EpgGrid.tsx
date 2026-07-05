import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { LiveStream, XtreamConfig } from '../../electron/xtream'
import type { EpgBounds, EpgProgramme, EpgSearchResult } from '../../electron/epg-db'
import type { EpgStatus } from '../../electron/epg'
import './epg.css'

// Keep CH_COL_W in sync with .epg-channel-cell width in epg.css.
const PX_PER_MIN = 4
const ROW_H = 52
const CH_COL_W = 220
const RULER_H = 36
const DAY_MS = 24 * 60 * 60 * 1000

function localMidnight(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Next local midnight, robust across DST shifts (23/25-hour days).
function nextMidnight(dayStartMs: number): number {
  return localMidnight(dayStartMs + DAY_MS + DAY_MS / 2)
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDay(ms: number): string {
  return new Date(ms).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtAgo(ms: number): string {
  const mins = Math.round((Date.now() - ms) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

interface SelectedProgramme {
  programme: EpgProgramme
  channelName: string
}

interface EpgGridProps {
  config: XtreamConfig
  channels: LiveStream[]
  tunedStreamId: number | null
  onTune: (stream: LiveStream) => void
}

function EpgGrid({ config, channels, tunedStreamId, onTune }: EpgGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [dayStartMs, setDayStartMs] = useState(() => localMidnight(Date.now()))
  const [programmes, setProgrammes] = useState<Map<string, EpgProgramme[]>>(new Map())
  const requestedIdsRef = useRef(new Set<string>())
  const [selected, setSelected] = useState<SelectedProgramme | null>(null)
  const [status, setStatus] = useState<EpgStatus | null>(null)
  const [bounds, setBounds] = useState<EpgBounds | null>(null)
  const [nowMs, setNowMs] = useState(Date.now())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<EpgSearchResult[]>([])
  const [jumpTarget, setJumpTarget] = useState<{ channelId: string; timeMs: number } | null>(null)
  const lastRefreshRef = useRef<number | null>(null)

  const dayEndMs = nextMidnight(dayStartMs)
  const dayMinutes = (dayEndMs - dayStartMs) / 60_000
  const contentWidth = CH_COL_W + dayMinutes * PX_PER_MIN
  const searchActive = searchQuery.trim().length > 0

  const rowVirtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 8,
  })
  const virtualItems = rowVirtualizer.getVirtualItems()
  const visibleStart = virtualItems[0]?.index ?? 0
  const visibleEnd = virtualItems[virtualItems.length - 1]?.index ?? -1

  const resetProgrammeCache = () => {
    requestedIdsRef.current = new Set()
    setProgrammes(new Map())
  }

  const changeDay = (newDayStartMs: number) => {
    setDayStartMs(newDayStartMs)
    resetProgrammeCache()
  }

  // Initial status/bounds + live status updates; a completed refresh
  // invalidates the programme cache so new data shows up without a reload.
  useEffect(() => {
    let disposed = false
    const applyStatus = (s: EpgStatus) => {
      if (disposed) return
      setStatus(s)
      if (s.lastRefreshMs !== lastRefreshRef.current) {
        lastRefreshRef.current = s.lastRefreshMs
        requestedIdsRef.current = new Set()
        setProgrammes(new Map())
        window.epg.getBounds().then((b) => {
          if (!disposed) setBounds(b)
        })
      }
    }
    window.epg.getStatus().then(applyStatus)
    const unsubscribe = window.epg.onStatus(applyStatus)
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  // Fetch programmes for visible rows (plus overscan) that aren't cached yet.
  useEffect(() => {
    if (visibleEnd < 0) return
    const timer = setTimeout(() => {
      const ids: string[] = []
      for (let i = visibleStart; i <= visibleEnd && i < channels.length; i++) {
        const epgId = channels[i].epgChannelId
        if (epgId && !requestedIdsRef.current.has(epgId)) {
          requestedIdsRef.current.add(epgId)
          ids.push(epgId)
        }
      }
      if (ids.length === 0) return
      window.epg
        .getProgrammes(ids, dayStartMs, dayEndMs)
        .then((rows) => {
          setProgrammes((prev) => {
            const next = new Map(prev)
            for (const id of ids) next.set(id, [])
            for (const row of rows) next.get(row.channelId)?.push(row)
            return next
          })
        })
        .catch(() => {
          for (const id of ids) requestedIdsRef.current.delete(id)
        })
    }, 120)
    return () => clearTimeout(timer)
  }, [visibleStart, visibleEnd, dayStartMs, dayEndMs, channels, programmes])

  // Tick the now-line / past-dimming every 30s.
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Debounced full-text search over channel name + title + description.
  useEffect(() => {
    if (!searchActive) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(() => {
      window.epg.search(searchQuery.trim()).then(setSearchResults)
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery, searchActive])

  const scrollToTime = (timeMs: number) => {
    const el = scrollRef.current
    if (!el) return
    const minutes = (timeMs - dayStartMs) / 60_000
    el.scrollLeft = Math.max(0, (minutes - 15) * PX_PER_MIN)
  }

  // Open the grid at the current time rather than 12:00 AM. Runs once per
  // mount (the Guide remounts whenever the tab is opened); keyed on status
  // because the scroll container doesn't render until guide data exists.
  const didInitialScrollRef = useRef(false)
  useEffect(() => {
    if (didInitialScrollRef.current || !scrollRef.current) return
    didInitialScrollRef.current = true
    scrollToTime(Date.now())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // Apply a pending jump (from search or jump-to-now) once the target day is
  // the active day.
  useEffect(() => {
    if (!jumpTarget) return
    if (localMidnight(jumpTarget.timeMs) !== dayStartMs) return
    setJumpTarget(null)
    const rowIndex = channels.findIndex((c) => c.epgChannelId === jumpTarget.channelId)
    if (rowIndex >= 0) rowVirtualizer.scrollToIndex(rowIndex, { align: 'center' })
    scrollToTime(jumpTarget.timeMs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTarget, dayStartMs, channels])

  const jumpToNow = () => {
    const now = Date.now()
    const today = localMidnight(now)
    if (today !== dayStartMs) changeDay(today)
    // scrollToTime uses dayStartMs from this render; when the day changes the
    // offset math is identical because it's relative to the target day.
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollLeft = Math.max(0, ((now - today) / 60_000 - 15) * PX_PER_MIN)
    })
  }

  const openSearchResult = (result: EpgSearchResult) => {
    setSearchQuery('')
    setSelected({ programme: result, channelName: result.channelName })
    const day = localMidnight(result.startMs)
    if (day !== dayStartMs) changeDay(day)
    setJumpTarget({ channelId: result.channelId, timeMs: result.startMs })
  }

  const streamsByEpgId = useMemo(() => {
    const map = new Map<string, LiveStream>()
    for (const s of channels) {
      if (s.epgChannelId && !map.has(s.epgChannelId)) map.set(s.epgChannelId, s)
    }
    return map
  }, [channels])

  const minDay = bounds?.minStartMs != null ? localMidnight(bounds.minStartMs) : null
  const maxDay = bounds?.maxStopMs != null ? localMidnight(bounds.maxStopMs - 1) : null
  const refreshing = status?.state === 'refreshing'
  const hasData = (status?.programmeCount ?? 0) > 0

  const statusText = (() => {
    if (!status) return ''
    if (status.state === 'refreshing') {
      return status.phase === 'download' ? 'Downloading guide…' : 'Indexing guide…'
    }
    if (status.state === 'error') return `Guide refresh failed: ${status.error}`
    if (status.lastRefreshMs == null) return 'Guide never refreshed'
    return `Updated ${fmtAgo(status.lastRefreshMs)} · ${status.channelCount.toLocaleString()} channels · ${status.programmeCount.toLocaleString()} programmes`
  })()

  const ticks = []
  for (let m = 0; m < dayMinutes; m += 30) {
    const tickMs = dayStartMs + m * 60_000
    ticks.push(
      <div key={m} className="epg-tick" style={{ left: CH_COL_W + m * PX_PER_MIN, width: 30 * PX_PER_MIN }}>
        {m % 60 === 0 ? fmtTime(tickMs) : ''}
      </div>,
    )
  }

  const nowInDay = nowMs >= dayStartMs && nowMs < dayEndMs
  const nowLeft = CH_COL_W + ((nowMs - dayStartMs) / 60_000) * PX_PER_MIN

  return (
    <div className="epg-root">
      <div className="epg-toolbar">
        <button onClick={() => changeDay(localMidnight(dayStartMs - DAY_MS / 2))} disabled={minDay != null && dayStartMs <= minDay}>
          ◀
        </button>
        <span className="epg-day-label">{fmtDay(dayStartMs)}</span>
        <button onClick={() => changeDay(dayEndMs)} disabled={maxDay != null && dayStartMs >= maxDay}>
          ▶
        </button>
        <button onClick={jumpToNow}>Now</button>
        <input
          className="epg-search-input"
          type="search"
          placeholder="Search channels, titles, descriptions…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button onClick={() => window.epg.refresh(config, true)} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        <span className={`epg-status${status?.state === 'error' ? ' epg-status-error' : ''}`}>{statusText}</span>
      </div>

      {searchActive ? (
        <div className="epg-search-results">
          {searchResults.length === 0 ? (
            <div className="epg-detail-empty" style={{ padding: 16 }}>
              No matches.
            </div>
          ) : (
            searchResults.map((r) => {
              const isLive = r.startMs <= nowMs && r.stopMs > nowMs
              return (
                <div
                  key={r.id}
                  className={`epg-search-result${isLive ? ' epg-sr-live' : ''}`}
                  onClick={() => openSearchResult(r)}
                >
                  <span className="epg-sr-time">
                    {fmtDay(r.startMs)} {fmtTime(r.startMs)}–{fmtTime(r.stopMs)}
                  </span>
                  {isLive && <span className="epg-sr-live-badge">LIVE</span>}
                  <span className="epg-sr-channel">{r.channelName}</span>
                  <span className="epg-sr-title">{r.title}</span>
                  <span className="epg-sr-desc">{r.description}</span>
                </div>
              )
            })
          )}
        </div>
      ) : !hasData ? (
        <div className="epg-empty-state">
          {refreshing ? (
            <>
              <div className="epg-spinner" />
              <p className="epg-empty-title">
                {status?.phase === 'download' ? 'Downloading your guide…' : 'Indexing your guide…'}
              </p>
              <p className="epg-empty-sub">
                The first download can take a minute or two — the grid appears automatically when
                it finishes.
              </p>
            </>
          ) : status?.state === 'error' ? (
            <>
              <p className="epg-empty-title">Couldn’t refresh the guide</p>
              <p className="epg-empty-sub">{status.error}</p>
              <button className="btn-accent" onClick={() => window.epg.refresh(config, true)}>
                Try again
              </button>
            </>
          ) : (
            <>
              <p className="epg-empty-title">No guide data yet</p>
              <p className="epg-empty-sub">
                Download the programme guide from your provider to fill in the grid. After the
                first download it refreshes automatically in the background.
              </p>
              <button className="btn-accent" onClick={() => window.epg.refresh(config, true)}>
                Download guide
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="epg-scroll" ref={scrollRef}>
          <div style={{ width: contentWidth, height: RULER_H + rowVirtualizer.getTotalSize(), position: 'relative' }}>
            <div className="epg-ruler" style={{ height: RULER_H, width: '100%' }}>
              {ticks}
              <div className="epg-ruler-corner" style={{ width: CH_COL_W }}>
                Channel
              </div>
            </div>

            {nowInDay && (
              <div className="epg-now-line" style={{ left: nowLeft, height: RULER_H + rowVirtualizer.getTotalSize() }} />
            )}

            {virtualItems.map((vi) => {
              const stream = channels[vi.index]
              const progs = stream.epgChannelId ? programmes.get(stream.epgChannelId) : undefined
              const loaded = stream.epgChannelId != null && progs !== undefined
              return (
                <div
                  key={vi.key}
                  className="epg-row"
                  style={{ top: RULER_H + vi.start, height: vi.size, width: contentWidth }}
                >
                  <div
                    className={`epg-channel-cell${stream.streamId === tunedStreamId ? ' epg-tuned' : ''}`}
                    title={stream.name}
                    onClick={() => onTune(stream)}
                  >
                    {stream.streamIcon && <img src={stream.streamIcon} alt="" loading="lazy" />}
                    <span>{stream.name}</span>
                  </div>
                  {progs?.map((p) => {
                    const clampedStart = Math.max(p.startMs, dayStartMs)
                    const clampedStop = Math.min(p.stopMs, dayEndMs)
                    const left = CH_COL_W + ((clampedStart - dayStartMs) / 60_000) * PX_PER_MIN
                    const width = Math.max(6, ((clampedStop - clampedStart) / 60_000) * PX_PER_MIN - 2)
                    const isSelected = selected?.programme.id === p.id
                    const isPast = p.stopMs <= nowMs
                    return (
                      <div
                        key={p.id}
                        className={`epg-block${isSelected ? ' epg-block-selected' : ''}${isPast ? ' epg-block-past' : ''}`}
                        style={{ left, width }}
                        title={p.title}
                        onClick={() => setSelected({ programme: p, channelName: stream.name })}
                      >
                        <div className="epg-block-title">{p.title}</div>
                        <div className="epg-block-time">
                          {fmtTime(p.startMs)}–{fmtTime(p.stopMs)}
                        </div>
                      </div>
                    )
                  })}
                  {(stream.epgChannelId == null || (loaded && progs!.length === 0)) && (
                    <div className="epg-no-data">No guide data</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!searchActive && hasData && (
        <div className="epg-detail">
          {selected ? (
            <>
              <div className="epg-detail-body">
                <div className="epg-detail-title">{selected.programme.title}</div>
                <div className="epg-detail-meta">
                  {selected.channelName} · {fmtDay(selected.programme.startMs)} {fmtTime(selected.programme.startMs)}–
                  {fmtTime(selected.programme.stopMs)}
                </div>
                <div className="epg-detail-desc">{selected.programme.description || 'No description.'}</div>
              </div>
              {streamsByEpgId.has(selected.programme.channelId) && (
                <button onClick={() => onTune(streamsByEpgId.get(selected.programme.channelId)!)}>▶ Watch</button>
              )}
            </>
          ) : (
            <div className="epg-detail-empty">Select a programme to see details.</div>
          )}
        </div>
      )}
    </div>
  )
}

export default EpgGrid
