// ESPN public API — no key required
// Provides WC 2026 match events including goal scorers

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world'

export interface ESPNGoal {
  scorer: string
  minute: string
  team: string   // ESPN English team name
  assist?: string
}

export interface ESPNMatch {
  id: string
  homeTeam: string   // ESPN English name
  awayTeam: string
  homeScore: number
  awayScore: number
  status: string     // 'Full Time', 'In Progress', etc.
  date: string       // YYYY-MM-DD UTC
  goals: ESPNGoal[]
}

function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

// Fetch all WC matches for a given date (YYYYMMDD)
export async function fetchESPNMatchesByDate(dateParam: string): Promise<ESPNMatch[]> {
  const res = await fetch(
    `${ESPN_BASE}/scoreboard?dates=${dateParam}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 120 } }
  )
  if (!res.ok) return []
  const json = await res.json()
  const events: unknown[] = json.events ?? []

  return events.map((e: unknown) => {
    const ev = e as Record<string, unknown>
    const comp = (ev.competitions as Record<string, unknown>[])?.[0] ?? {}
    const competitors = (comp.competitors as Record<string, unknown>[]) ?? []
    const home = competitors.find(c => c.homeAway === 'home') ?? {}
    const away = competitors.find(c => c.homeAway === 'away') ?? {}
    const homeTeam = home.team as Record<string, unknown> | undefined
    const awayTeam = away.team as Record<string, unknown> | undefined

    return {
      id: String(ev.id ?? ''),
      homeTeam: String(homeTeam?.displayName ?? ''),
      awayTeam: String(awayTeam?.displayName ?? ''),
      homeScore: Number((home.score as string | undefined) ?? 0),
      awayScore: Number((away.score as string | undefined) ?? 0),
      status: String((ev.status as Record<string, unknown>)?.type
        ? ((ev.status as Record<string, unknown>).type as Record<string, unknown>).description
        : ''),
      date: dateParam,
      goals: [],
    }
  })
}

// Fetch goal scorers for a specific ESPN event ID
export async function fetchESPNGoals(eventId: string): Promise<ESPNGoal[]> {
  const res = await fetch(
    `${ESPN_BASE}/summary?event=${eventId}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 120 } }
  )
  if (!res.ok) return []
  const json = await res.json()

  const keyEvents: unknown[] = json.keyEvents ?? []
  const goals: ESPNGoal[] = []

  for (const ev of keyEvents) {
    const e = ev as Record<string, unknown>
    const type = e.type as Record<string, unknown> | undefined
    if (type?.type !== 'goal') continue

    const participants = (e.participants as Record<string, unknown>[]) ?? []
    const scorer = participants[0]?.athlete as Record<string, unknown> | undefined
    const assister = participants[1]?.athlete as Record<string, unknown> | undefined
    const team = e.team as Record<string, unknown> | undefined
    const clock = e.clock as Record<string, unknown> | undefined

    goals.push({
      scorer: String(scorer?.displayName ?? ''),
      minute: String(clock?.displayValue ?? ''),
      team: String(team?.displayName ?? ''),
      assist: assister ? String(assister.displayName ?? '') : undefined,
    })
  }

  return goals
}

// Fetch scorers for a match identified by team names (English) across a date range
export async function fetchScorersForMatch(
  homeTeamEN: string,
  awayTeamEN: string,
  matchDate: string   // ISO date string from our DB
): Promise<ESPNGoal[]> {
  const date = new Date(matchDate)
  // Check date ± 1 day to handle timezone differences
  const dates = [
    toDateParam(new Date(date.getTime() - 86400000)),
    toDateParam(date),
    toDateParam(new Date(date.getTime() + 86400000)),
  ]

  const normHome = homeTeamEN.toLowerCase().replace(/[^a-z]/g, '')
  const normAway = awayTeamEN.toLowerCase().replace(/[^a-z]/g, '')

  for (const d of dates) {
    const matches = await fetchESPNMatchesByDate(d)
    const found = matches.find(m => {
      const mHome = m.homeTeam.toLowerCase().replace(/[^a-z]/g, '')
      const mAway = m.awayTeam.toLowerCase().replace(/[^a-z]/g, '')
      return (
        (mHome.includes(normHome) || normHome.includes(mHome)) &&
        (mAway.includes(normAway) || normAway.includes(mAway))
      )
    })
    if (found) return fetchESPNGoals(found.id)
  }

  return []
}
