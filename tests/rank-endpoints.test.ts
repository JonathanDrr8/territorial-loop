import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { startServer, type RunningServer } from '../server/server'

/** Online-Rangliste (ADR-0027): HTTP-Endpoints /leaderboard + /rank/submit gegen In-Memory-DB. */
let server: RunningServer

beforeEach(async () => {
  server = await startServer(0, ':memory:') // ephemerer Port, DB nur im RAM
})

afterEach(async () => {
  await server.close()
})

const base = (): string => `http://localhost:${String(server.port)}`

async function submit(body: Record<string, unknown>): Promise<Response> {
  return fetch(`${base()}/rank/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Ranglisten-Endpoints', () => {
  it('leere Rangliste liefert []', async () => {
    const res = await fetch(`${base()}/leaderboard`)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { entries: unknown[] }
    expect(json.entries).toEqual([])
  })

  it('Stand einreichen und in der Rangliste wiederfinden', async () => {
    const res = await submit({
      token: 'guest-abc123',
      name: 'Merkur',
      elo: 1280,
      wins: 5,
      losses: 2,
      peak: 1300,
    })
    expect(res.status).toBe(200)
    const saved = (await res.json()) as { elo: number; wins: number; peak: number }
    expect(saved.elo).toBe(1280)
    expect(saved.peak).toBe(1300)

    const board = (await (await fetch(`${base()}/leaderboard`)).json()) as {
      entries: { rank: number; displayName: string; elo: number }[]
    }
    expect(board.entries).toHaveLength(1)
    expect(board.entries[0]).toMatchObject({ rank: 1, displayName: 'Merkur', elo: 1280 })
  })

  it('erneutes Einreichen aktualisiert denselben Account (kein Duplikat)', async () => {
    await submit({
      token: 'guest-abc123',
      name: 'Merkur',
      elo: 1000,
      wins: 0,
      losses: 0,
      peak: 1000,
    })
    await submit({
      token: 'guest-abc123',
      name: 'Merkur',
      elo: 1100,
      wins: 1,
      losses: 0,
      peak: 1100,
    })
    const board = (await (await fetch(`${base()}/leaderboard`)).json()) as { entries: unknown[] }
    expect(board.entries).toHaveLength(1)
  })

  it('Rangliste ist nach ELO absteigend sortiert', async () => {
    await submit({
      token: 'guest-aaa11111',
      name: 'Anton',
      elo: 1100,
      wins: 1,
      losses: 0,
      peak: 1100,
    })
    await submit({
      token: 'guest-bbb22222',
      name: 'Berta',
      elo: 1400,
      wins: 4,
      losses: 0,
      peak: 1400,
    })
    await submit({
      token: 'guest-ccc33333',
      name: 'Cesar',
      elo: 1250,
      wins: 2,
      losses: 1,
      peak: 1250,
    })
    const board = (await (await fetch(`${base()}/leaderboard`)).json()) as {
      entries: { displayName: string }[]
    }
    expect(board.entries.map((e) => e.displayName)).toEqual(['Berta', 'Cesar', 'Anton'])
  })

  it('ELO wird server-seitig geklemmt (Anti-Unsinn)', async () => {
    const res = await submit({
      token: 'guest-cheater1',
      name: 'Cheat',
      elo: 999999,
      wins: 0,
      losses: 0,
      peak: 999999,
    })
    const saved = (await res.json()) as { elo: number }
    expect(saved.elo).toBe(2000) // ELO_MAX
  })

  it('hidden=true blendet den Eintrag aus der öffentlichen Rangliste aus', async () => {
    await submit({
      token: 'guest-visible1',
      name: 'Sicht',
      elo: 1200,
      wins: 2,
      losses: 0,
      peak: 1200,
    })
    await submit({
      token: 'guest-hidden01',
      name: 'Versteckt',
      elo: 1500,
      wins: 9,
      losses: 0,
      peak: 1500,
      hidden: true,
    })
    const board = (await (await fetch(`${base()}/leaderboard`)).json()) as {
      entries: { displayName: string }[]
    }
    expect(board.entries.map((e) => e.displayName)).toEqual(['Sicht'])

    // Wieder einblenden → erscheint (und steht wegen höherem ELO oben).
    await submit({
      token: 'guest-hidden01',
      name: 'Versteckt',
      elo: 1500,
      wins: 9,
      losses: 0,
      peak: 1500,
      hidden: false,
    })
    const board2 = (await (await fetch(`${base()}/leaderboard`)).json()) as {
      entries: { displayName: string }[]
    }
    expect(board2.entries.map((e) => e.displayName)).toEqual(['Versteckt', 'Sicht'])
  })

  it('ungültiges/kurzes Token wird abgewiesen', async () => {
    expect((await submit({ token: 'x', name: 'Y', elo: 1000 })).status).toBe(400)
    expect((await submit({ name: 'Y', elo: 1000 })).status).toBe(400)
  })
})
