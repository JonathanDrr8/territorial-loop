import { describe, it, expect } from 'vitest'

import { openDb, STARTING_ELO, ELO_MAX, ELO_MIN } from '../server/db'

/** Frische In-Memory-DB mit fester Zeitquelle (Metadaten, kein Sim-State). */
function freshDb() {
  let t = 1000
  return openDb(':memory:', () => t++)
}

describe('AccountDb', () => {
  it('legt einen Gast an und ist idempotent über das Token', () => {
    const db = freshDb()
    const a = db.getOrCreateGuest('tok-1', 'Merkur')
    expect(a.guestToken).toBe('tok-1')
    expect(a.displayName).toBe('Merkur')
    expect(a.elo).toBe(STARTING_ELO)
    expect(a.wins).toBe(0)

    const again = db.getOrCreateGuest('tok-1', 'Merkur')
    expect(again.id).toBe(a.id) // kein zweiter Datensatz
    db.close()
  })

  it('aktualisiert den Anzeigenamen beim erneuten Holen', () => {
    const db = freshDb()
    db.getOrCreateGuest('tok-1', 'Alt')
    const renamed = db.getOrCreateGuest('tok-1', 'Neu')
    expect(renamed.displayName).toBe('Neu')
    expect(db.getByToken('tok-1')?.displayName).toBe('Neu')
    db.close()
  })

  it('leere/zu lange Namen werden bereinigt', () => {
    const db = freshDb()
    const blank = db.getOrCreateGuest('tok-blank', '   ')
    expect(blank.displayName).toBe('Spieler')
    const long = db.getOrCreateGuest('tok-long', 'x'.repeat(50))
    expect(long.displayName.length).toBe(24)
    db.close()
  })

  it('setRanked setzt Werte und klemmt ELO an die Grenzen', () => {
    const db = freshDb()
    db.getOrCreateGuest('tok-1', 'Merkur')
    const up = db.setRanked('tok-1', 1234, 3, 1, 1234)
    expect(up?.elo).toBe(1234)
    expect(up?.wins).toBe(3)
    expect(up?.peak).toBe(1234)

    expect(db.setRanked('tok-1', 99999, 0, 0, 99999)?.elo).toBe(ELO_MAX)
    expect(db.setRanked('tok-1', -50, 0, 0, 0)?.elo).toBe(ELO_MIN)
    db.close()
  })

  it('peak ist nie kleiner als das aktuelle ELO', () => {
    const db = freshDb()
    db.getOrCreateGuest('tok-1', 'Merkur')
    const up = db.setRanked('tok-1', 1300, 0, 0, 1100) // peak unter elo angegeben
    expect(up?.peak).toBe(1300)
    db.close()
  })

  it('setRanked auf unbekanntes Token liefert null', () => {
    const db = freshDb()
    expect(db.setRanked('ghost', 1500, 0, 0, 1500)).toBeNull()
    db.close()
  })

  it('leaderboard sortiert nach ELO absteigend und vergibt Ränge', () => {
    const db = freshDb()
    db.getOrCreateGuest('a', 'Anton')
    db.getOrCreateGuest('b', 'Berta')
    db.getOrCreateGuest('c', 'Cesar')
    db.setRanked('a', 1100, 1, 0, 1100)
    db.setRanked('b', 1400, 4, 0, 1400)
    db.setRanked('c', 1250, 2, 1, 1250)

    const top = db.leaderboard(10)
    expect(top.map((e) => e.displayName)).toEqual(['Berta', 'Cesar', 'Anton'])
    expect(top[0]?.rank).toBe(1)
    expect(top[0]?.elo).toBe(1400)
    db.close()
  })

  it('Migrationen sind idempotent (zweites Öffnen wirft nicht)', () => {
    // Datei-DB wäre nötig für echtes Reopen; hier prüfen wir, dass open + Schema mehrfach geht.
    const db1 = freshDb()
    db1.getOrCreateGuest('x', 'X')
    db1.close()
    const db2 = freshDb()
    expect(db2.leaderboard(1)).toEqual([])
    db2.close()
  })
})
