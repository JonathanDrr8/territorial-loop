import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { startServer, type RunningServer } from '../server/server'

/** Account-System (ADR-0027 Phase 2): register / login / recover gegen In-Memory-DB. */
let server: RunningServer

beforeEach(async () => {
  server = await startServer(0, ':memory:')
})

afterEach(async () => {
  await server.close()
})

const base = (): string => `http://localhost:${String(server.port)}`

function post(path: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${base()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const TOKEN = 'guest-aaaa1111bbbb2222'

describe('Account: Registrierung', () => {
  it('wertet einen Gast zu einem Account auf und gibt einen Recovery-Code zurück', async () => {
    const res = await post('/account/register', {
      token: TOKEN,
      username: 'Merkur',
      password: 'geheim123',
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; recoveryCode: string }
    expect(json.ok).toBe(true)
    expect(json.recoveryCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
  })

  it('behält das ELO des Gasts beim Aufwerten (kein Fortschrittsverlust)', async () => {
    await post('/rank/submit', {
      token: TOKEN,
      name: 'Merkur',
      elo: 1330,
      wins: 6,
      losses: 2,
      peak: 1340,
    })
    await post('/account/register', { token: TOKEN, username: 'Merkur', password: 'geheim123' })
    const me = (await (await fetch(`${base()}/account/me?token=${TOKEN}`)).json()) as {
      username: string
      elo: number
    }
    expect(me.username).toBe('Merkur')
    expect(me.elo).toBe(1330)
  })

  it('lehnt bereits vergebene Benutzernamen ab (case-insensitiv)', async () => {
    await post('/account/register', { token: TOKEN, username: 'Merkur', password: 'geheim123' })
    const dup = await post('/account/register', {
      token: 'guest-cccc3333dddd4444',
      username: 'MERKUR',
      password: 'anders123',
    })
    expect(dup.status).toBe(409)
  })

  it('validiert Benutzername und Passwort', async () => {
    expect(
      (await post('/account/register', { token: TOKEN, username: 'ab', password: 'geheim123' }))
        .status,
    ).toBe(400)
    expect(
      (await post('/account/register', { token: TOKEN, username: 'Gut', password: '123' })).status,
    ).toBe(400)
  })
})

describe('Account: Login', () => {
  it('meldet mit korrektem Passwort an und gibt das Gast-Token zurück (Cross-Device)', async () => {
    await post('/account/register', { token: TOKEN, username: 'Merkur', password: 'geheim123' })
    const res = await post('/account/login', { username: 'merkur', password: 'geheim123' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; token: string; username: string }
    expect(json.ok).toBe(true)
    expect(json.token).toBe(TOKEN) // dasselbe Token → neues Gerät übernimmt es
    expect(json.username).toBe('Merkur')
  })

  it('lehnt falsches Passwort und unbekannte User ab', async () => {
    await post('/account/register', { token: TOKEN, username: 'Merkur', password: 'geheim123' })
    expect((await post('/account/login', { username: 'Merkur', password: 'falsch' })).status).toBe(
      401,
    )
    expect((await post('/account/login', { username: 'Niemand', password: 'x' })).status).toBe(401)
  })
})

describe('Account: geräteübergreifende Einstellungen', () => {
  it('speichert Einstellungen und gibt sie als Objekt zurück', async () => {
    await post('/account/register', { token: TOKEN, username: 'Merkur', password: 'geheim123' })
    const save = await post('/account/settings', {
      token: TOKEN,
      settings: { 'territorial-loop:theme:v1': 'kriegskarte', 'territorial-loop:locale:v1': 'de' },
    })
    expect(save.status).toBe(200)

    const got = (await (await fetch(`${base()}/account/settings?token=${TOKEN}`)).json()) as {
      settings: Record<string, string> | null
    }
    expect(got.settings).toMatchObject({ 'territorial-loop:theme:v1': 'kriegskarte' })
  })

  it('liefert null, solange keine Einstellungen gespeichert sind', async () => {
    await post('/account/register', { token: TOKEN, username: 'Merkur', password: 'geheim123' })
    const got = (await (await fetch(`${base()}/account/settings?token=${TOKEN}`)).json()) as {
      settings: unknown
    }
    expect(got.settings).toBeNull()
  })

  it('weist Einstellungen für ein unbekanntes Token ab', async () => {
    const res = await post('/account/settings', { token: 'guest-unbekannt00', settings: { x: 1 } })
    expect(res.status).toBe(404)
  })
})

describe('Account: Passwort-Reset per Recovery-Code', () => {
  it('setzt mit gültigem Code ein neues Passwort, danach Login mit dem neuen', async () => {
    const reg = (await (
      await post('/account/register', { token: TOKEN, username: 'Merkur', password: 'altpass123' })
    ).json()) as { recoveryCode: string }

    const rec = await post('/account/recover', {
      username: 'Merkur',
      recoveryCode: reg.recoveryCode,
      newPassword: 'neupass456',
    })
    expect(rec.status).toBe(200)

    expect(
      (await post('/account/login', { username: 'Merkur', password: 'neupass456' })).status,
    ).toBe(200)
    expect(
      (await post('/account/login', { username: 'Merkur', password: 'altpass123' })).status,
    ).toBe(401)
  })

  it('lehnt einen falschen Recovery-Code ab', async () => {
    await post('/account/register', { token: TOKEN, username: 'Merkur', password: 'altpass123' })
    const rec = await post('/account/recover', {
      username: 'Merkur',
      recoveryCode: 'WRONG-CODE-2345-6789',
      newPassword: 'neupass456',
    })
    expect(rec.status).toBe(401)
  })
})

describe('Account: Löschen (ADR-0027 Phase 3)', () => {
  it('löscht das Konto mit korrektem Passwort; danach kein Login/Profil mehr', async () => {
    await post('/account/register', { token: TOKEN, username: 'Merkur', password: 'geheim123' })

    const del = await post('/account/delete', { token: TOKEN, password: 'geheim123' })
    expect(del.status).toBe(200)
    expect((await del.json()) as { ok: boolean }).toEqual({ ok: true })

    // Konto ist weg: Login schlägt fehl, /me kennt das Token nicht mehr.
    expect(
      (await post('/account/login', { username: 'Merkur', password: 'geheim123' })).status,
    ).toBe(401)
    expect((await fetch(`${base()}/account/me?token=${TOKEN}`)).status).toBe(404)
  })

  it('lehnt das Löschen bei falschem Passwort ab (Konto bleibt erhalten)', async () => {
    await post('/account/register', { token: TOKEN, username: 'Merkur', password: 'geheim123' })

    const del = await post('/account/delete', { token: TOKEN, password: 'falsch' })
    expect(del.status).toBe(401)
    expect(((await del.json()) as { error: string }).error).toBe('wrongpw')

    // Konto existiert weiterhin (Login geht).
    expect(
      (await post('/account/login', { username: 'Merkur', password: 'geheim123' })).status,
    ).toBe(200)
  })

  it('lehnt das Löschen eines reinen Gasts (ohne Konto) ab', async () => {
    // Gast anlegen (über /rank/submit), aber NICHT zu einem Account aufwerten.
    await post('/rank/submit', {
      token: TOKEN,
      name: 'Gast',
      elo: 1000,
      wins: 0,
      losses: 0,
      peak: 1000,
    })
    const del = await post('/account/delete', { token: TOKEN, password: 'egal' })
    expect(del.status).toBe(400)
    expect(((await del.json()) as { error: string }).error).toBe('guestonly')
  })
})
