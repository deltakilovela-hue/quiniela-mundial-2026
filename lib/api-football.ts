// API-Football v3 via RapidAPI
// Docs: https://www.api-football.com/documentation-v3

const BASE = 'https://api-football-v1.p.rapidapi.com/v3'
const HEADERS = {
  'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
  'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
}

// World Cup 2026 league ID in API-Football
// We'll discover this dynamically — FIFA World Cup is typically id=1 (season 2026)
export const WC_LEAGUE_ID = parseInt(process.env.WC_LEAGUE_ID ?? '1')
export const WC_SEASON = parseInt(process.env.WC_SEASON ?? '2026')

export interface APIFixture {
  fixture: {
    id: number
    date: string
    status: { short: string; elapsed: number | null }
  }
  league: { id: number; season: number; round: string }
  teams: {
    home: { id: number; name: string }
    away: { id: number; name: string }
  }
  goals: { home: number | null; away: number | null }
  score: {
    fulltime: { home: number | null; away: number | null }
    halftime: { home: number | null; away: number | null }
  }
}

export async function fetchFixtures(date?: string): Promise<APIFixture[]> {
  const params = new URLSearchParams({
    league: String(WC_LEAGUE_ID),
    season: String(WC_SEASON),
    ...(date ? { date } : {}),
  })

  const res = await fetch(`${BASE}/fixtures?${params}`, {
    headers: HEADERS,
    next: { revalidate: 0 },
  })

  if (!res.ok) throw new Error(`API-Football error: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.response as APIFixture[]
}

export async function fetchFixtureById(fixtureId: number): Promise<APIFixture | null> {
  const res = await fetch(`${BASE}/fixtures?id=${fixtureId}`, {
    headers: HEADERS,
    next: { revalidate: 0 },
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.response?.[0] ?? null
}

// Status codes from API-Football
// FT = Full Time, AET = After Extra Time, PEN = Penalties, FT_PEN = used sometimes
export const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO']
export const LIVE_STATUSES = ['1H', '2H', 'ET', 'P', 'BT', 'HT', 'LIVE']
