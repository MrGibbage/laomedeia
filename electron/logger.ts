import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

const MAX_LOG_BYTES = 2 * 1024 * 1024
const RETAINED_LOGS = 4
let dir: string | null = null

export function logsDir(): string {
  if (!dir) {
    dir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

const logPath = (generation = 0) =>
  path.join(logsDir(), generation === 0 ? 'main.log' : `main.${generation}.log`)

// Defense in depth: callers should log operation names/ids instead of URLs,
// but every message is sanitized here so one accidental interpolation cannot
// expose an Xtream provider host, username, password, or authenticated path.
export function sanitizeLogText(value: unknown): string {
  return String(value)
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED_URL]')
    .replace(/(username|user|password|passwd|token|authorization)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/\/(live|movie|series)\/[^/\s]+\/[^/\s]+\//gi, '/$1/[REDACTED]/[REDACTED]/')
}

export function rotateLogs(maxBytes = MAX_LOG_BYTES): void {
  try {
    // Builds before the privacy hardening let mpv write authenticated stream
    // URLs directly. Never retain that legacy file after upgrading.
    const legacyMpvLog = path.join(logsDir(), 'mpv.log')
    if (fs.existsSync(legacyMpvLog)) fs.rmSync(legacyMpvLog)
    if (fs.statSync(logPath()).size <= maxBytes) return
    for (let generation = RETAINED_LOGS; generation >= 1; generation--) {
      const source = logPath(generation - 1)
      const destination = logPath(generation)
      if (!fs.existsSync(source)) continue
      if (generation === RETAINED_LOGS && fs.existsSync(destination)) fs.rmSync(destination)
      fs.renameSync(source, destination)
    }
  } catch {
    // Logging must never prevent startup.
  }
}

export function log(scope: string, message: unknown): void {
  const safeScope = sanitizeLogText(scope).replace(/[\r\n]/g, ' ')
  const safeMessage = sanitizeLogText(message).replace(/[\r\n]+/g, ' ')
  const line = `${new Date().toISOString()} [${safeScope}] ${safeMessage}\n`
  try {
    fs.appendFileSync(logPath(), line)
  } catch {
    // Diagnostics are best-effort and must never take the app down.
  }
}

export function createDiagnosticReport(metadata: Record<string, string | number | boolean>): string {
  const reportDir = path.join(app.getPath('userData'), 'diagnostics')
  fs.mkdirSync(reportDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const destination = path.join(reportDir, `iptv-diagnostics-${stamp}.txt`)
  const sections = [
    'Laomedeia diagnostic report',
    `Created: ${new Date().toISOString()}`,
    '',
    'Environment',
    ...Object.entries(metadata).map(([key, value]) => `${key}: ${sanitizeLogText(value)}`),
  ]

  for (let generation = 0; generation <= RETAINED_LOGS; generation++) {
    const source = logPath(generation)
    if (!fs.existsSync(source)) continue
    sections.push('', `--- ${path.basename(source)} ---`)
    // Sanitize again during export so reports remain safe even if an older
    // pre-redaction log is still present from a previous app version.
    sections.push(sanitizeLogText(fs.readFileSync(source, 'utf-8')))
  }

  fs.writeFileSync(destination, sections.join('\n'), 'utf-8')
  return destination
}
