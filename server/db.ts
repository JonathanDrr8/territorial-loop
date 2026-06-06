/**
 * Account-/Ranglisten-Datenbank (ADR-0027, Phase 1).
 *
 * SQLite über `better-sqlite3` (synchron). Die DB-Datei liegt in einem **festen Verzeichnis
 * außerhalb des Repos** (`DATA_DIR`, per Volume gemountet) und überlebt jedes Deployment — sie
 * kommt **nie ins Git**. Hier liegen ausschließlich Account-Metadaten (Gast-Token, Anzeigename,
 * ELO/Bilanz); die Spielsimulation bleibt davon unberührt.
 *
 * Schema-Versionierung über `PRAGMA user_version` (simples lineares Migrationssystem). Phase 2
 * füllt die schon angelegten, vorerst leeren Account-Spalten (Username/Passwort/Email/Recovery).
 *
 * Reine Daten-Schicht: kein Netz, kein Spiel-State. Die Operationen sind gekapselt (prepared
 * statements), damit der Server nie rohes SQL anfasst.
 */

import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** Persistentes Datenverzeichnis (per Volume gemountet, außerhalb von `dist/`/Repo). */
const DATA_DIR = resolve(process.env.DATA_DIR ?? 'data')
const DEFAULT_DB_PATH = join(DATA_DIR, 'accounts.db')

/** Start-ELO + Grenzen — gespiegelt aus `src/ui/ranked.ts`, damit Server & Client übereinstimmen. */
export const STARTING_ELO = 1000
export const ELO_MIN = 100
export const ELO_MAX = 2000

/** Ein Account-Datensatz (Gast oder — ab Phase 2 — mit Login). */
export interface AccountRow {
  readonly id: number
  /** Anonymes Gast-Token (Phase 1, im localStorage des Clients). Unfälschbar serverseitig vergeben. */
  readonly guestToken: string
  readonly displayName: string
  readonly elo: number
  readonly wins: number
  readonly losses: number
  readonly peak: number
  /** Gewählter Benutzername, falls der Gast zu einem echten Account aufgewertet wurde (sonst null). */
  readonly username: string | null
}

/** Auth-Felder eines Accounts (nie an Clients ausliefern) — für Login/Recovery-Prüfung. */
export interface AccountAuth {
  readonly guestToken: string
  readonly pwHash: string
  readonly pwSalt: string
  readonly recoveryHash: string
  readonly recoverySalt: string
}

/** Eingangsdaten zum Aufwerten eines Gasts zu einem echten Account (Phase 2). */
export interface RegisterInput {
  readonly guestToken: string
  readonly username: string
  readonly pwHash: string
  readonly pwSalt: string
  readonly email: string | null
  readonly recoveryHash: string
  readonly recoverySalt: string
}

/** Ein Ranglisten-Eintrag (öffentlich, ohne Token). */
export interface LeaderboardEntry {
  readonly rank: number
  readonly displayName: string
  readonly elo: number
  readonly wins: number
  readonly losses: number
}

/** Lineare Migrationen. Index+1 == Ziel-`user_version`. Nur anhängen, nie umschreiben. */
const MIGRATIONS: readonly string[] = [
  // v1 — Accounts-Tabelle. Phase-1-Felder aktiv; Phase-2-Spalten nullable vorbereitet.
  `
  CREATE TABLE IF NOT EXISTS accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_token   TEXT    NOT NULL UNIQUE,
    display_name  TEXT    NOT NULL,
    elo           INTEGER NOT NULL DEFAULT ${STARTING_ELO},
    wins          INTEGER NOT NULL DEFAULT 0,
    losses        INTEGER NOT NULL DEFAULT 0,
    peak          INTEGER NOT NULL DEFAULT ${STARTING_ELO},
    username      TEXT    UNIQUE,
    pw_hash       TEXT,
    pw_salt       TEXT,
    email         TEXT,
    recovery_hash TEXT,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_accounts_elo ON accounts (elo DESC);
  `,
  // v2 — Selbst-Ausblenden: versteckte Accounts erscheinen nicht in der öffentlichen Rangliste.
  `ALTER TABLE accounts ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;`,
  // v3 — Eigener Account (Phase 2): Salt zum Recovery-Code-Hash (pw_salt existiert bereits aus v1).
  `ALTER TABLE accounts ADD COLUMN recovery_salt TEXT;`,
  // v4 — Geräteübergreifende Einstellungen (HUD-Layout/Theme/Audio/Vorgaben/Sprache) als JSON-Blob.
  `ALTER TABLE accounts ADD COLUMN settings TEXT;`,
]

const clampElo = (v: number): number =>
  Math.max(ELO_MIN, Math.min(ELO_MAX, Math.round(Number.isFinite(v) ? v : STARTING_ELO)))

const clampName = (name: string): string => {
  const trimmed = name.trim().slice(0, 24)
  return trimmed.length > 0 ? trimmed : 'Spieler'
}

/** Wendet alle noch ausstehenden Migrationen an (idempotent, über `user_version`). */
function migrate(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  for (let v = current; v < MIGRATIONS.length; v++) {
    const sql = MIGRATIONS[v]
    if (sql === undefined) continue
    db.exec(sql)
    db.pragma(`user_version = ${v + 1}`)
  }
}

/** Gekapselte Datenbank-Schnittstelle — der Server sieht nur diese Operationen, nie rohes SQL. */
export interface AccountDb {
  /** Holt den Account zum Gast-Token, legt ihn bei Bedarf an (Name wird aktualisiert, falls geändert). */
  getOrCreateGuest(guestToken: string, displayName: string): AccountRow
  /** Setzt ELO/Bilanz/Peak eines Gast-Tokens (server-validierte Werte) und gibt den neuen Stand zurück. */
  setRanked(
    guestToken: string,
    elo: number,
    wins: number,
    losses: number,
    peak: number,
  ): AccountRow | null
  /** Aktualisiert nur den Anzeigenamen. */
  setName(guestToken: string, displayName: string): void
  /** Blendet den Account aus der öffentlichen Rangliste aus (true) bzw. wieder ein (false). */
  setHidden(guestToken: string, hidden: boolean): void
  /** Top-N nach ELO (öffentlich, ohne Token). */
  leaderboard(limit: number): LeaderboardEntry[]
  /** Rohzugriff auf den Account zum Token (oder null). */
  getByToken(guestToken: string): AccountRow | null
  /** Ist dieser Benutzername (case-insensitiv) bereits vergeben? */
  usernameTaken(username: string): boolean
  /**
   * Wertet einen Gast zu einem echten Account auf (setzt Username/Passwort/Email/Recovery). Legt
   * den Gast bei Bedarf an. Gibt `false`, wenn der Username vergeben ist oder der Gast schon einen hat.
   */
  registerAccount(input: RegisterInput): boolean
  /** Auth-Daten zu einem Benutzernamen (case-insensitiv) — für Login/Recovery. Null wenn unbekannt. */
  authByUsername(username: string): AccountAuth | null
  /** Account zu einem Benutzernamen (öffentliche Felder). */
  getByUsername(username: string): AccountRow | null
  /** Setzt ein neues Passwort (per Benutzername) — für die Recovery. */
  setPassword(username: string, pwHash: string, pwSalt: string): void
  /** Speichert den geräteübergreifenden Einstellungs-Blob (JSON-String) am Account. */
  setSettings(guestToken: string, settingsJson: string): void
  /** Liest den Einstellungs-Blob (JSON-String) oder null. */
  getSettings(guestToken: string): string | null
  /** Löscht den Account (gesamte Zeile) zu einem Gast-Token endgültig. True, wenn etwas gelöscht wurde. */
  deleteByToken(guestToken: string): boolean
  /** Schließt die DB (Tests/Shutdown). */
  close(): void
}

function rowToAccount(r: Record<string, unknown>): AccountRow {
  return {
    id: r.id as number,
    guestToken: r.guest_token as string,
    displayName: r.display_name as string,
    elo: r.elo as number,
    wins: r.wins as number,
    losses: r.losses as number,
    peak: r.peak as number,
    username: (r.username as string | null) ?? null,
  }
}

/**
 * Öffnet (oder erstellt) die Account-DB und liefert die gekapselte Schnittstelle.
 *
 * @param dbPath  Pfad zur DB-Datei. Default `DATA_DIR/accounts.db`. `':memory:'` für Tests.
 * @param now     Zeitquelle (ms). Injizierbar für Tests — der Server reicht `Date.now` herein.
 *                (Account-Timestamps sind reine Metadaten, kein Sim-State → kein Determinismus-Bruch.)
 */
export function openDb(dbPath: string = DEFAULT_DB_PATH, now: () => number = Date.now): AccountDb {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)

  const selByToken = db.prepare('SELECT * FROM accounts WHERE guest_token = ?')
  const insGuest = db.prepare(
    `INSERT INTO accounts (guest_token, display_name, created_at, updated_at)
     VALUES (@token, @name, @ts, @ts)`,
  )
  const updName = db.prepare(
    'UPDATE accounts SET display_name = @name, updated_at = @ts WHERE guest_token = @token',
  )
  const updRanked = db.prepare(
    `UPDATE accounts SET elo = @elo, wins = @wins, losses = @losses, peak = @peak, updated_at = @ts
     WHERE guest_token = @token`,
  )
  const updHidden = db.prepare(
    'UPDATE accounts SET hidden = @hidden, updated_at = @ts WHERE guest_token = @token',
  )
  const selTop = db.prepare(
    'SELECT display_name, elo, wins, losses FROM accounts WHERE hidden = 0 ORDER BY elo DESC, wins DESC, id ASC LIMIT ?',
  )
  const selByUsername = db.prepare('SELECT * FROM accounts WHERE username = ? COLLATE NOCASE')
  const updRegister = db.prepare(
    `UPDATE accounts SET username = @username, pw_hash = @pwHash, pw_salt = @pwSalt,
       email = @email, recovery_hash = @recoveryHash, recovery_salt = @recoverySalt, updated_at = @ts
     WHERE guest_token = @token AND username IS NULL`,
  )
  const updPassword = db.prepare(
    'UPDATE accounts SET pw_hash = @pwHash, pw_salt = @pwSalt, updated_at = @ts WHERE username = @username COLLATE NOCASE',
  )
  const updSettings = db.prepare(
    'UPDATE accounts SET settings = @settings, updated_at = @ts WHERE guest_token = @token',
  )
  const selSettings = db.prepare('SELECT settings FROM accounts WHERE guest_token = ?')
  const delByToken = db.prepare('DELETE FROM accounts WHERE guest_token = ?')

  return {
    getOrCreateGuest(guestToken, displayName) {
      const name = clampName(displayName)
      const existing = selByToken.get(guestToken) as Record<string, unknown> | undefined
      if (existing !== undefined) {
        if (existing.display_name !== name) updName.run({ token: guestToken, name, ts: now() })
        return rowToAccount({ ...existing, display_name: name })
      }
      insGuest.run({ token: guestToken, name, ts: now() })
      return rowToAccount(selByToken.get(guestToken) as Record<string, unknown>)
    },

    setRanked(guestToken, elo, wins, losses, peak) {
      const row = selByToken.get(guestToken) as Record<string, unknown> | undefined
      if (row === undefined) return null
      const e = clampElo(elo)
      const p = Math.max(clampElo(peak), e)
      updRanked.run({
        token: guestToken,
        elo: e,
        wins: Math.max(0, Math.round(wins)),
        losses: Math.max(0, Math.round(losses)),
        peak: p,
        ts: now(),
      })
      return rowToAccount(selByToken.get(guestToken) as Record<string, unknown>)
    },

    setName(guestToken, displayName) {
      updName.run({ token: guestToken, name: clampName(displayName), ts: now() })
    },

    setHidden(guestToken, hidden) {
      updHidden.run({ token: guestToken, hidden: hidden ? 1 : 0, ts: now() })
    },

    leaderboard(limit) {
      const rows = selTop.all(Math.max(1, Math.min(500, Math.round(limit)))) as Record<
        string,
        unknown
      >[]
      return rows.map((r, i) => ({
        rank: i + 1,
        displayName: r.display_name as string,
        elo: r.elo as number,
        wins: r.wins as number,
        losses: r.losses as number,
      }))
    },

    getByToken(guestToken) {
      const row = selByToken.get(guestToken) as Record<string, unknown> | undefined
      return row === undefined ? null : rowToAccount(row)
    },

    usernameTaken(username) {
      return selByUsername.get(username) !== undefined
    },

    registerAccount(input) {
      if (selByUsername.get(input.username) !== undefined) return false // Username vergeben
      if (selByToken.get(input.guestToken) === undefined) {
        insGuest.run({ token: input.guestToken, name: input.username, ts: now() })
      }
      const res = updRegister.run({
        token: input.guestToken,
        username: input.username,
        pwHash: input.pwHash,
        pwSalt: input.pwSalt,
        email: input.email,
        recoveryHash: input.recoveryHash,
        recoverySalt: input.recoverySalt,
        ts: now(),
      })
      return res.changes > 0
    },

    authByUsername(username) {
      const r = selByUsername.get(username) as Record<string, unknown> | undefined
      if (r === undefined) return null
      return {
        guestToken: r.guest_token as string,
        pwHash: (r.pw_hash as string | null) ?? '',
        pwSalt: (r.pw_salt as string | null) ?? '',
        recoveryHash: (r.recovery_hash as string | null) ?? '',
        recoverySalt: (r.recovery_salt as string | null) ?? '',
      }
    },

    getByUsername(username) {
      const r = selByUsername.get(username) as Record<string, unknown> | undefined
      return r === undefined ? null : rowToAccount(r)
    },

    setPassword(username, pwHash, pwSalt) {
      updPassword.run({ username, pwHash, pwSalt, ts: now() })
    },

    setSettings(guestToken, settingsJson) {
      updSettings.run({ token: guestToken, settings: settingsJson, ts: now() })
    },

    getSettings(guestToken) {
      const r = selSettings.get(guestToken) as Record<string, unknown> | undefined
      return r === undefined ? null : ((r.settings as string | null) ?? null)
    },

    deleteByToken(guestToken) {
      return delByToken.run(guestToken).changes > 0
    },

    close() {
      db.close()
    },
  }
}
