import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'

// Local viewing preferences (favorites, hidden channels, last tuned channel).
// Lives next to xtream-config.json in userData — never in the repo.
export interface Prefs {
  favoriteStreamIds: number[]
  hiddenStreamIds: number[]
  lastStreamId: number | null
  // When true, mpv decodes in software (hwdec=no) instead of on the GPU. Off
  // by default; a "maximum compatibility" escape hatch for the rare malformed
  // stream that can hang the hardware decoder (see electron/playback.ts).
  softwareDecoding: boolean
}

function prefsPath(): string {
  return path.join(app.getPath('userData'), 'prefs.json')
}

function toNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : []
}

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = JSON.parse(await fs.readFile(prefsPath(), 'utf-8')) as Partial<Prefs>
    return {
      favoriteStreamIds: toNumberArray(raw.favoriteStreamIds),
      hiddenStreamIds: toNumberArray(raw.hiddenStreamIds),
      lastStreamId: typeof raw.lastStreamId === 'number' ? raw.lastStreamId : null,
      softwareDecoding: raw.softwareDecoding === true,
    }
  } catch {
    return { favoriteStreamIds: [], hiddenStreamIds: [], lastStreamId: null, softwareDecoding: false }
  }
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  await fs.mkdir(path.dirname(prefsPath()), { recursive: true })
  await fs.writeFile(prefsPath(), JSON.stringify(prefs, null, 2), 'utf-8')
}
