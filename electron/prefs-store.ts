import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'

// Local viewing preferences (favorites, last tuned channel). Lives next to
// xtream-config.json in userData — never in the repo.
export interface Prefs {
  favoriteStreamIds: number[]
  lastStreamId: number | null
}

function prefsPath(): string {
  return path.join(app.getPath('userData'), 'prefs.json')
}

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = JSON.parse(await fs.readFile(prefsPath(), 'utf-8')) as Partial<Prefs>
    return {
      favoriteStreamIds: Array.isArray(raw.favoriteStreamIds)
        ? raw.favoriteStreamIds.filter((id): id is number => typeof id === 'number')
        : [],
      lastStreamId: typeof raw.lastStreamId === 'number' ? raw.lastStreamId : null,
    }
  } catch {
    return { favoriteStreamIds: [], lastStreamId: null }
  }
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  await fs.mkdir(path.dirname(prefsPath()), { recursive: true })
  await fs.writeFile(prefsPath(), JSON.stringify(prefs, null, 2), 'utf-8')
}
