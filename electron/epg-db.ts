import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

export interface EpgChannel {
  id: string
  displayName: string
  icon: string | null
}

export interface EpgProgramme {
  id: number
  channelId: string
  startMs: number
  stopMs: number
  title: string
  description: string
}

export interface EpgSearchResult extends EpgProgramme {
  channelName: string
}

export interface EpgBounds {
  minStartMs: number | null
  maxStopMs: number | null
}

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (db) return db
  const file = path.join(app.getPath('userData'), 'epg-cache.sqlite3')
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS epg_channels (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      icon TEXT
    );
    CREATE TABLE IF NOT EXISTS programmes (
      id INTEGER PRIMARY KEY,
      channel_id TEXT NOT NULL,
      start_ms INTEGER NOT NULL,
      stop_ms INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_programmes_channel_time
      ON programmes (channel_id, start_ms);
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  createFtsTable(db)
  return db
}

// Contentless FTS5 tables don't support DELETE, and a refresh replaces every
// row anyway, so each ingest builds a fresh FTS table in staging.
function createFtsTable(d: Database.Database): void {
  d.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS programmes_fts
      USING fts5(title, description, channel_name, content='');
  `)
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM meta WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value)
}

export interface IngestHandle {
  insertChannel(channel: Omit<EpgChannel, 'id'> & { id: string }): void
  insertProgramme(p: {
    channelId: string
    startMs: number
    stopMs: number
    title: string
    description: string
    channelName: string
  }): void
  commit(): void
  rollback(): void
}

// Begins a full-replace ingest. Rows are written to *_staging tables so the
// live tables stay fully readable (showing the previous guide) for the whole
// refresh; commit() swaps staging in atomically. The transaction is held open
// across async parser callbacks (better-sqlite3 statements are synchronous,
// so interleaved awaits between batches are safe on this single connection —
// reads in between see the untouched live tables). Callers MUST call commit()
// or rollback(); either way the transaction ends, so staging tables created
// inside it never survive a crash.
export function beginReplaceIngest(): IngestHandle {
  const d = getDb()
  d.exec('BEGIN IMMEDIATE')
  try {
    d.exec(`
      DROP TABLE IF EXISTS epg_channels_staging;
      DROP TABLE IF EXISTS programmes_staging;
      DROP TABLE IF EXISTS programmes_fts_staging;
      CREATE TABLE epg_channels_staging (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        icon TEXT
      );
      CREATE TABLE programmes_staging (
        id INTEGER PRIMARY KEY,
        channel_id TEXT NOT NULL,
        start_ms INTEGER NOT NULL,
        stop_ms INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT ''
      );
      CREATE VIRTUAL TABLE programmes_fts_staging
        USING fts5(title, description, channel_name, content='');
    `)
  } catch (err) {
    d.exec('ROLLBACK')
    throw err
  }

  const insChannel = d.prepare(
    'INSERT OR REPLACE INTO epg_channels_staging (id, display_name, icon) VALUES (?, ?, ?)',
  )
  const insProgramme = d.prepare(
    'INSERT INTO programmes_staging (channel_id, start_ms, stop_ms, title, description) VALUES (?, ?, ?, ?, ?)',
  )
  const insFts = d.prepare(
    'INSERT INTO programmes_fts_staging (rowid, title, description, channel_name) VALUES (?, ?, ?, ?)',
  )

  let open = true

  return {
    insertChannel(channel) {
      insChannel.run(channel.id, channel.displayName, channel.icon)
    },
    insertProgramme(p) {
      const info = insProgramme.run(p.channelId, p.startMs, p.stopMs, p.title, p.description)
      insFts.run(info.lastInsertRowid, p.title, p.description, p.channelName)
    },
    commit() {
      if (!open) return
      open = false
      try {
        // Atomic swap: the old guide disappears and the new one appears in the
        // same transaction. The channel+time index is rebuilt here (bulk insert
        // into an unindexed table + one index build is faster than maintaining
        // the index row-by-row).
        d.exec(`
          DROP TABLE epg_channels;
          DROP TABLE programmes;
          DROP TABLE IF EXISTS programmes_fts;
          ALTER TABLE epg_channels_staging RENAME TO epg_channels;
          ALTER TABLE programmes_staging RENAME TO programmes;
          ALTER TABLE programmes_fts_staging RENAME TO programmes_fts;
          CREATE INDEX idx_programmes_channel_time ON programmes (channel_id, start_ms);
          COMMIT;
        `)
      } catch (err) {
        d.exec('ROLLBACK')
        throw err
      }
    },
    rollback() {
      if (!open) return
      open = false
      d.exec('ROLLBACK')
    },
  }
}

export function getProgrammes(channelIds: string[], fromMs: number, toMs: number): EpgProgramme[] {
  if (channelIds.length === 0) return []
  const placeholders = channelIds.map(() => '?').join(', ')
  const rows = getDb()
    .prepare(
      `SELECT id, channel_id, start_ms, stop_ms, title, description
       FROM programmes
       WHERE channel_id IN (${placeholders}) AND start_ms < ? AND stop_ms > ?
       ORDER BY channel_id, start_ms`,
    )
    .all(...channelIds, toMs, fromMs) as Array<{
    id: number
    channel_id: string
    start_ms: number
    stop_ms: number
    title: string
    description: string
  }>
  return rows.map((r) => ({
    id: r.id,
    channelId: r.channel_id,
    startMs: r.start_ms,
    stopMs: r.stop_ms,
    title: r.title,
    description: r.description,
  }))
}

// Turns free-text user input into an FTS5 prefix query: each whitespace-run-
// separated token becomes a quoted prefix term, ANDed together.
function buildFtsQuery(input: string): string | null {
  const tokens = input
    .split(/\s+/)
    .map((t) => t.replace(/"/g, '').trim())
    .filter((t) => t.length > 0)
  if (tokens.length === 0) return null
  return tokens.map((t) => `"${t}"*`).join(' ')
}

// Search answers "what can I watch, now or later" — programmes that already
// ended are excluded (still-airing ones stay in).
export function search(query: string, limit = 200): EpgSearchResult[] {
  const match = buildFtsQuery(query)
  if (!match) return []
  const rows = getDb()
    .prepare(
      `SELECT p.id, p.channel_id, p.start_ms, p.stop_ms, p.title, p.description,
              COALESCE(c.display_name, p.channel_id) AS channel_name
       FROM programmes_fts f
       JOIN programmes p ON p.id = f.rowid
       LEFT JOIN epg_channels c ON c.id = p.channel_id
       WHERE programmes_fts MATCH ? AND p.stop_ms > ?
       ORDER BY p.start_ms
       LIMIT ?`,
    )
    .all(match, Date.now(), limit) as Array<{
    id: number
    channel_id: string
    start_ms: number
    stop_ms: number
    title: string
    description: string
    channel_name: string
  }>
  return rows.map((r) => ({
    id: r.id,
    channelId: r.channel_id,
    startMs: r.start_ms,
    stopMs: r.stop_ms,
    title: r.title,
    description: r.description,
    channelName: r.channel_name,
  }))
}

export function getBounds(): EpgBounds {
  const row = getDb()
    .prepare('SELECT MIN(start_ms) AS min_start, MAX(stop_ms) AS max_stop FROM programmes')
    .get() as { min_start: number | null; max_stop: number | null }
  return { minStartMs: row.min_start, maxStopMs: row.max_stop }
}

export function getCounts(): { channels: number; programmes: number } {
  const d = getDb()
  const channels = (d.prepare('SELECT COUNT(*) AS n FROM epg_channels').get() as { n: number }).n
  const programmes = (d.prepare('SELECT COUNT(*) AS n FROM programmes').get() as { n: number }).n
  return { channels, programmes }
}
