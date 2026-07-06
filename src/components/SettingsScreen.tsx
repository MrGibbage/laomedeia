import { useState } from 'react'
import type { XtreamConfig, LiveStream } from '../../electron/xtream'
import '../app.css'

interface SettingsScreenProps {
  initialConfig: XtreamConfig | null
  onSaved: (config: XtreamConfig) => void
  onCancel?: () => void
  channels?: LiveStream[]
  hiddenIds?: Set<number>
  onUnhideChannel?: (streamId: number) => void
  softwareDecoding?: boolean
  onToggleSoftwareDecoding?: (enabled: boolean) => void
}

function SettingsScreen({
  initialConfig,
  onSaved,
  onCancel,
  channels,
  hiddenIds,
  onUnhideChannel,
  softwareDecoding,
  onToggleSoftwareDecoding,
}: SettingsScreenProps) {
  const [serverUrl, setServerUrl] = useState(initialConfig?.serverUrl ?? '')
  const [username, setUsername] = useState(initialConfig?.username ?? '')
  const [password, setPassword] = useState(initialConfig?.password ?? '')
  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [testPassedFor, setTestPassedFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const currentKey = JSON.stringify({ serverUrl, username, password })
  const canSave = testPassedFor === currentKey

  const handleTest = async () => {
    setTesting(true)
    setTestMessage(null)
    try {
      const result = await window.xtream.testConnection({ serverUrl, username, password })
      setTestMessage(result.message)
      setTestPassedFor(result.ok ? currentKey : null)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const config: XtreamConfig = { serverUrl, username, password }
      await window.settings.save(config)
      onSaved(config)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-wrap">
      {onCancel && (
        <div className="settings-header">
          <button onClick={onCancel}>← Back</button>
          <span className="settings-header-title">Settings</span>
        </div>
      )}
      <div className="settings-card">
        <h2>Xtream Account</h2>
        <p className="settings-sub">
          A passing connection test is required before the account can be saved.
        </p>
        <label className="settings-field">
          <span className="settings-field-label">Server URL</span>
          <input
            type="text"
            placeholder="http://example.com:8080"
            value={serverUrl}
            onChange={(e) => {
              setServerUrl(e.target.value)
              setTestPassedFor(null)
            }}
          />
        </label>
        <label className="settings-field">
          <span className="settings-field-label">Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setTestPassedFor(null)
            }}
          />
        </label>
        <label className="settings-field">
          <span className="settings-field-label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setTestPassedFor(null)
            }}
          />
        </label>

        <div className="settings-actions">
          <button onClick={handleTest} disabled={testing || !serverUrl || !username || !password}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <button className="btn-accent" onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {testMessage && (
          <p className={`settings-message ${canSave ? 'ok' : 'err'}`}>{testMessage}</p>
        )}
      </div>

      {onToggleSoftwareDecoding && (
        <div className="settings-card">
          <h2>Playback</h2>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={!!softwareDecoding}
              onChange={(e) => onToggleSoftwareDecoding(e.target.checked)}
            />
            <span>Maximum compatibility (software decoding)</span>
          </label>
          <p className="settings-sub" style={{ marginBottom: 0 }}>
            Decodes video on the CPU instead of the GPU. Turn this on if playback
            ever freezes the player and you have to restart it — some malformed
            streams can hang the GPU decoder, and software decoding sidesteps that
            entirely. Costs more CPU (fine for most channels; heaviest on 4K).
            Takes effect on the next channel you tune.
          </p>
        </div>
      )}

      <div className="settings-card">
        <details className="shortcuts-details">
          <summary>Keyboard shortcuts</summary>
          <div className="shortcuts-list">
            <div className="shortcuts-row">
              <span className="shortcuts-keys">↑ / ↓</span>
              <span>Previous / next channel</span>
            </div>
            <div className="shortcuts-row">
              <span className="shortcuts-keys">Backspace</span>
              <span>Return to the previously tuned channel</span>
            </div>
            <div className="shortcuts-row">
              <span className="shortcuts-keys">F11</span>
              <span>Toggle full screen (hides all UI on the Live tab — only the video remains)</span>
            </div>
            <div className="shortcuts-row">
              <span className="shortcuts-keys">Esc</span>
              <span>Exit full screen</span>
            </div>
            <div className="shortcuts-row">
              <span className="shortcuts-keys">Tab</span>
              <span>Jump to the guide and back (while full screen)</span>
            </div>
          </div>
        </details>
      </div>

      {/* Only shown once channels have actually loaded (not on first run). No
          preview/playback here by design — reviewing a bad channel is the
          whole point, so nothing on this screen should be able to tune it. */}
      {channels && channels.length > 0 && hiddenIds && onUnhideChannel && (
        <div className="settings-card">
          <h2>Hidden Channels</h2>
          <p className="settings-sub">
            Channels you've hidden — manually, or automatically after one froze playback — are
            removed from the channel list, guide, and search. Restore one to bring it back.
          </p>
          {hiddenIds.size === 0 ? (
            <p className="settings-sub" style={{ marginBottom: 0 }}>
              No channels hidden.
            </p>
          ) : (
            Array.from(hiddenIds)
              .map((streamId) => ({
                streamId,
                name: channels.find((c) => c.streamId === streamId)?.name ?? `Channel ${streamId}`,
              }))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(({ streamId, name }) => (
                <div key={streamId} className="hidden-channel-row">
                  <span className="hidden-channel-name" title={name}>
                    {name}
                  </span>
                  <button onClick={() => onUnhideChannel(streamId)}>Restore</button>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  )
}

export default SettingsScreen
