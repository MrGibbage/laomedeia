import { useEffect, useState } from 'react'
import type { XtreamConfig, SeriesCategory, SeriesListItem, SeriesInfo, SeriesEpisode } from '../../electron/xtream'
import type { ProgressMap } from '../../electron/progress-store'

interface SeriesBrowserProps {
  config: XtreamConfig
  progress: ProgressMap
  onPlay: (episode: SeriesEpisode, seriesName: string, resumeSecs: number) => void
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function SeriesBrowser({ config, progress, onPlay }: SeriesBrowserProps) {
  const [categories, setCategories] = useState<SeriesCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const [seriesList, setSeriesList] = useState<SeriesListItem[]>([])
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [seriesError, setSeriesError] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')

  const [selectedSeries, setSelectedSeries] = useState<SeriesListItem | null>(null)
  const [info, setInfo] = useState<SeriesInfo | null>(null)
  const [infoLoading, setInfoLoading] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setCategoriesLoading(true)
    setCategoriesError(null)
    window.xtream
      .getSeriesCategories(config)
      .then((cats) => {
        if (cancelled) return
        setCategories(cats)
        if (cats.length > 0) setSelectedCategoryId(cats[0].categoryId)
      })
      .catch((err) => {
        if (!cancelled) setCategoriesError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [config])

  useEffect(() => {
    if (!selectedCategoryId) return
    let cancelled = false
    setSeriesLoading(true)
    setSeriesError(null)
    window.xtream
      .getSeriesList(config, selectedCategoryId)
      .then((items) => {
        if (!cancelled) setSeriesList(items)
      })
      .catch((err) => {
        if (!cancelled) setSeriesError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setSeriesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [config, selectedCategoryId])

  useEffect(() => {
    if (!selectedSeries) {
      setInfo(null)
      setSelectedSeason(null)
      return
    }
    let cancelled = false
    setInfoLoading(true)
    window.xtream
      .getSeriesInfo(config, selectedSeries.seriesId)
      .then((result) => {
        if (cancelled) return
        setInfo(result)
        setSelectedSeason(result?.seasons[0]?.seasonNumber ?? null)
      })
      .finally(() => {
        if (!cancelled) setInfoLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [config, selectedSeries])

  const text = filterText.trim().toLowerCase()
  const visibleSeries = text ? seriesList.filter((s) => s.name.toLowerCase().includes(text)) : seriesList

  const closeDetail = () => setSelectedSeries(null)

  const season = info?.seasons.find((s) => s.seasonNumber === selectedSeason)

  const play = (episode: SeriesEpisode, resumeSecs: number) => {
    if (!selectedSeries) return
    onPlay(episode, selectedSeries.name, resumeSecs)
    closeDetail()
  }

  return (
    <div className="vod-panel">
      <aside className="vod-sidebar">
        {categoriesLoading ? (
          <p className="channel-hint">Loading categories…</p>
        ) : categoriesError ? (
          <p className="channel-hint channel-error">Failed to load categories: {categoriesError}</p>
        ) : (
          <div className="vod-category-list">
            {categories.map((cat) => (
              <div
                key={cat.categoryId}
                className={`vod-category-row${cat.categoryId === selectedCategoryId ? ' selected' : ''}`}
                onClick={() => setSelectedCategoryId(cat.categoryId)}
              >
                {cat.categoryName}
              </div>
            ))}
          </div>
        )}
      </aside>

      <div className="vod-main">
        <div className="vod-toolbar">
          <input
            className="vod-search"
            type="search"
            placeholder="Filter shows…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>

        {seriesLoading ? (
          <p className="channel-hint">Loading shows…</p>
        ) : seriesError ? (
          <p className="channel-hint channel-error">Failed to load shows: {seriesError}</p>
        ) : visibleSeries.length === 0 ? (
          <p className="channel-hint">No shows match.</p>
        ) : (
          <div className="vod-grid">
            {visibleSeries.map((item) => (
              <div key={item.seriesId} className="vod-poster-card" onClick={() => setSelectedSeries(item)}>
                {item.cover ? (
                  <img className="vod-poster-img" src={item.cover} alt="" loading="lazy" />
                ) : (
                  <div className="vod-poster-img vod-poster-fallback">{item.name.charAt(0).toUpperCase()}</div>
                )}
                <div className="vod-poster-title" title={item.name}>
                  {item.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedSeries && (
        <div className="vod-detail-backdrop" onClick={closeDetail}>
          <div className="vod-detail-card series-detail-card" onClick={(e) => e.stopPropagation()}>
            <button className="vod-detail-close" onClick={closeDetail}>
              ✕
            </button>
            {selectedSeries.cover ? (
              <img className="vod-detail-poster" src={selectedSeries.cover} alt="" />
            ) : (
              <div className="vod-detail-poster vod-poster-fallback">
                {selectedSeries.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="vod-detail-info">
              <h2 className="vod-detail-title">{selectedSeries.name}</h2>
              {infoLoading ? (
                <p className="channel-hint">Loading details…</p>
              ) : (
                <>
                  <div className="vod-detail-meta">
                    {(info?.rating ?? selectedSeries.rating) != null && (
                      <span>★ {(info?.rating ?? selectedSeries.rating)?.toFixed(1)}</span>
                    )}
                    {info?.releaseDate && <span>{info.releaseDate.slice(0, 4)}</span>}
                    {info?.genre && <span>{info.genre}</span>}
                  </div>
                  {info?.plot && <p className="vod-detail-plot">{info.plot}</p>}
                  {info?.cast && (
                    <p className="vod-detail-cast">
                      <strong>Cast:</strong> {info.cast}
                    </p>
                  )}

                  {info && info.seasons.length === 0 && (
                    <p className="channel-hint" style={{ marginTop: 16 }}>
                      No episodes available — the provider hasn't listed any for this title.
                    </p>
                  )}

                  {info && info.seasons.length > 0 && (
                    <>
                      <div className="series-season-tabs">
                        {info.seasons.map((s) => (
                          <button
                            key={s.seasonNumber}
                            className={`series-season-tab${s.seasonNumber === selectedSeason ? ' active' : ''}`}
                            onClick={() => setSelectedSeason(s.seasonNumber)}
                          >
                            {s.name || `Season ${s.seasonNumber}`}
                          </button>
                        ))}
                      </div>

                      <div className="series-episode-list">
                        {season?.episodes.map((ep) => {
                          const epProgress = progress[`ep:${ep.id}`]
                          return (
                            <div key={ep.id} className="series-episode-row">
                              <div className="series-episode-main">
                                <span className="series-episode-num">{ep.episodeNum}.</span>
                                <span className="series-episode-title" title={ep.title}>
                                  {ep.title}
                                </span>
                                {ep.duration && <span className="series-episode-duration">{ep.duration}</span>}
                              </div>
                              {epProgress && epProgress.durationSecs && (
                                <div className="vod-poster-progress">
                                  <div
                                    className="vod-poster-progress-fill"
                                    style={{
                                      width: `${Math.min(100, (epProgress.positionSecs / epProgress.durationSecs) * 100)}%`,
                                    }}
                                  />
                                </div>
                              )}
                              <div className="series-episode-actions">
                                <button onClick={() => play(ep, 0)}>▶ Play</button>
                                {epProgress && epProgress.durationSecs && (
                                  <button onClick={() => play(ep, epProgress.positionSecs)}>
                                    Resume at {formatDuration(epProgress.positionSecs)}
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SeriesBrowser
