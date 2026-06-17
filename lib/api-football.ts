// Free API Live Football Data — by Smart API via RapidAPI
// Host: free-api-live-football-data.p.rapidapi.com

const BASE = 'https://free-api-live-football-data.p.rapidapi.com'
const HEADERS = {
  'x-rapidapi-host': 'free-api-live-football-data.p.rapidapi.com',
  'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
  'Content-Type': 'application/json',
}

// FIFA World Cup league ID = 77 (confirmed via /football-get-popular-leagues)
export const WC_LEAGUE_ID = process.env.WC_LEAGUE_ID ?? '77'

export interface APIMatch {
  id: number | string
  homeTeam: { name: string; id?: number }
  awayTeam: { name: string; id?: number }
  date?: string
  time?: string
  status?: string          // 'FT', 'HT', '1H', '2H', 'NS', etc.
  score?: {
    home: number | null
    away: number | null
    halftime?: { home: number | null; away: number | null }
    fulltime?: { home: number | null; away: number | null }
  }
  goals?: { home: number | null; away: number | null }
  league?: { id?: number | string; name?: string }
  round?: string
  // Raw response preserved for debugging
  _raw?: unknown
}

// Normalize different response shapes this API might return
function normalizeMatch(raw: Record<string, unknown>): APIMatch {
  // The API may nest data differently — handle both flat and nested
  const home = (raw.homeTeam as Record<string, unknown>) ??
    (raw.home_team as Record<string, unknown>) ??
    { name: raw.homeName ?? raw.home_name ?? '' }

  const away = (raw.awayTeam as Record<string, unknown>) ??
    (raw.away_team as Record<string, unknown>) ??
    { name: raw.awayName ?? raw.away_name ?? '' }

  const score = (raw.score as Record<string, unknown>) ??
    (raw.goals as Record<string, unknown>) ??
    {}

  const homeGoals =
    (score.fulltime as Record<string, unknown>)?.home ??
    (score as Record<string, unknown>).home ??
    raw.home_score ??
    raw.homeScore ??
    null

  const awayGoals =
    (score.fulltime as Record<string, unknown>)?.away ??
    (score as Record<string, unknown>).away ??
    raw.away_score ??
    raw.awayScore ??
    null

  const status = String(
    raw.status ?? raw.statusShort ?? raw.state ?? raw.matchStatus ?? ''
  ).toUpperCase()

  return {
    id: (raw.id ?? raw.matchId ?? raw.fixture_id ?? 0) as number,
    homeTeam: { name: String((home as Record<string, unknown>).name ?? ''), id: (home as Record<string, unknown>).id as number },
    awayTeam: { name: String((away as Record<string, unknown>).name ?? ''), id: (away as Record<string, unknown>).id as number },
    status,
    score: {
      home: homeGoals as number | null,
      away: awayGoals as number | null,
    },
    league: (raw.league as Record<string, unknown>) ?? {},
    _raw: raw,
  }
}

async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: HEADERS, cache: 'no-store' })
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json()
}

// GET /football-current-live — all live matches right now
export async function fetchLiveMatches(): Promise<APIMatch[]> {
  const json = await fetchJSON(`${BASE}/football-current-live`) as Record<string, unknown>
  const items = extractArray(json)
  return items.map(normalizeMatch)
}

// GET /football-get-matches-by-date?date=YYYYMMDD
export async function fetchMatchesByDate(date: string): Promise<APIMatch[]> {
  const json = await fetchJSON(`${BASE}/football-get-matches-by-date?date=${date}`) as Record<string, unknown>
  const items = extractArray(json)
  return items.map(normalizeMatch)
}

// GET /football-get-matches-by-date-and-league?date=YYYYMMDD&leagueId=ID
export async function fetchLeagueMatchesByDate(date: string, leagueId: string): Promise<APIMatch[]> {
  const json = await fetchJSON(
    `${BASE}/football-get-matches-by-date-and-league?date=${date}&leagueId=${leagueId}`
  ) as Record<string, unknown>
  const items = extractArray(json)
  return items.map(normalizeMatch)
}

// Helper: most APIs wrap results in response/data/matches/events/fixtures key
function extractArray(json: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[]
  for (const key of ['response', 'data', 'matches', 'events', 'fixtures', 'results', 'livescores']) {
    if (Array.isArray(json[key])) return json[key] as Record<string, unknown>[]
  }
  // Sometimes wrapped in { response: { matches: [...] } }
  for (const outer of Object.values(json)) {
    if (Array.isArray(outer)) return outer as Record<string, unknown>[]
    if (typeof outer === 'object' && outer !== null) {
      for (const inner of Object.values(outer as Record<string, unknown>)) {
        if (Array.isArray(inner)) return inner as Record<string, unknown>[]
      }
    }
  }
  return []
}

// Format date as YYYYMMDD for the API
export function formatDateParam(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

// Status codes that mean the match is finished
export const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO', 'FINISHED', 'ENDED', 'FULL TIME', 'FULLTIME']
export const LIVE_STATUSES = ['1H', '2H', 'ET', 'P', 'BT', 'HT', 'LIVE', 'IN PLAY', 'IN_PLAY', 'INPLAY', 'PLAYING']
