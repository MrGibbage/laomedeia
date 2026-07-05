import { useEffect, useRef } from 'react'
import type { LiveStream } from '../../electron/xtream'

interface ChannelListProps {
  channels: LiveStream[]
  totalCount: number
  loading: boolean
  error: string | null
  onSelect: (stream: LiveStream) => void
  selectedStreamId: number | null
  favorites: Set<number>
  onToggleFavorite: (streamId: number) => void
  favoritesOnly: boolean
  onToggleFavoritesOnly: () => void
  filterText: string
  onFilterTextChange: (text: string) => void
}

function ChannelList({
  channels,
  totalCount,
  loading,
  error,
  onSelect,
  selectedStreamId,
  favorites,
  onToggleFavorite,
  favoritesOnly,
  onToggleFavoritesOnly,
  filterText,
  onFilterTextChange,
}: ChannelListProps) {
  const selectedRef = useRef<HTMLDivElement>(null)

  // Keep the tuned channel visible while zapping with the keyboard.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedStreamId])

  return (
    <div className="channel-panel">
      <div className="channel-toolbar">
        <input
          className="channel-search"
          type="search"
          placeholder="Filter channels…"
          value={filterText}
          onChange={(e) => onFilterTextChange(e.target.value)}
        />
        <button
          className={`channel-fav-filter${favoritesOnly ? ' active' : ''}`}
          title={favoritesOnly ? 'Show all channels' : 'Show favorites only'}
          onClick={onToggleFavoritesOnly}
        >
          ★
        </button>
      </div>

      {loading ? (
        <p className="channel-hint">Loading channels…</p>
      ) : error ? (
        <p className="channel-hint channel-error">Failed to load channels: {error}</p>
      ) : (
        <>
          <div className="channel-scroll">
            {channels.length === 0 && (
              <p className="channel-hint">
                {favoritesOnly
                  ? 'No favorites yet — click a channel’s star to add one.'
                  : 'No channels match.'}
              </p>
            )}
            {channels.map((channel) => {
              const isSelected = channel.streamId === selectedStreamId
              const isFav = favorites.has(channel.streamId)
              return (
                <div
                  key={channel.streamId}
                  ref={isSelected ? selectedRef : undefined}
                  className={`channel-row${isSelected ? ' selected' : ''}`}
                  onClick={() => onSelect(channel)}
                >
                  {channel.streamIcon ? (
                    <img className="channel-logo" src={channel.streamIcon} alt="" loading="lazy" />
                  ) : (
                    <div className="channel-logo channel-logo-fallback">
                      {channel.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="channel-name" title={channel.name}>
                    {channel.name}
                  </span>
                  <button
                    className={`channel-star${isFav ? ' faved' : ''}`}
                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite(channel.streamId)
                    }}
                  >
                    {isFav ? '★' : '☆'}
                  </button>
                </div>
              )
            })}
          </div>
          <div className="channel-count">
            {channels.length === totalCount
              ? `${totalCount.toLocaleString()} channels`
              : `${channels.length.toLocaleString()} of ${totalCount.toLocaleString()} channels`}
          </div>
        </>
      )}
    </div>
  )
}

export default ChannelList
