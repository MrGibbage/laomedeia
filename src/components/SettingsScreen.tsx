import { useState } from 'react'
import type { XtreamConfig } from '../../electron/xtream'
import '../app.css'

interface SettingsScreenProps {
  initialConfig: XtreamConfig | null
  onSaved: (config: XtreamConfig) => void
  onCancel?: () => void
}

function SettingsScreen({ initialConfig, onSaved, onCancel }: SettingsScreenProps) {
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
          {onCancel && (
            <button onClick={onCancel} style={{ marginLeft: 'auto' }}>
              Cancel
            </button>
          )}
        </div>

        {testMessage && (
          <p className={`settings-message ${canSave ? 'ok' : 'err'}`}>{testMessage}</p>
        )}
      </div>
    </div>
  )
}

export default SettingsScreen
