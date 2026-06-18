// ESPN public API — no key required
// Primary data source for WC 2026: scores, scorers, kickoff times, live status

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world'

export interface ESPNGoal {
  scorer: string
  minute: string
  team: string
  assist?: string
}

export interface ESPNMatch {
  id: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  status: 'finished' | 'live' | 'upcoming'
  statusDisplay: string   // 'Full Time', '45\'', 'HT', etc.
  kickoffUTC: string      // ISO UTC string from ESPN
  goals: ESPNGoal[]
}

function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

export async function fetchESPNMatchesByDate(dateParam: string): Promise<ESPNMatch[]> {
  try {
    const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${dateParam}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const json = await res.json()
    const events: unknown[] = json.events ?? []

    return events.map((e: unknown) => {
      const ev = e as Record<string, unknown>
      const comp = (ev.competitions as Record<string, unknown>[])?.[0] ?? {}
      const competitors = (comp.competitors as Record<string, unknown>[]) ?? []
      const home = competitors.find((c: Record<string, unknown>) => c.homeAway === 'home') ?? {}
      const away = competitors.find((c: Record<string, unknown>) => c.homeAway === 'away') ?? {}
      const homeTeam = (home as Record<string, unknown>).team as Record<string, unknown> | undefined
      const awayTeam = (away as Record<string, unknown>).team as Record<string, unknown> | undefined

      const statusObj = ev.status as Record<string, unknown> | undefined
      const statusType = statusObj?.type as Record<string, unknown> | undefined
      const statusName = String(statusType?.name ?? '')
      const statusDesc = String(statusType?.description ?? '')

      let status: ESPNMatch['status'] = 'upcoming'
      if (statusName === 'STATUS_FINAL') status = 'finished'
      else if (statusName === 'STATUS_IN_PROGRESS' || statusName === 'STATUS_HALFTIME') status = 'live'

      // Kickoff time from competitions[0].startDate
      const kickoffUTC = String((comp as Record<string, unknown>).startDate ?? ev.date ?? '')

      return {
        id: String(ev.id ?? ''),
        homeTeam: String(homeTeam?.displayName ?? ''),
        awayTeam: String(awayTeam?.displayName ?? ''),
        homeScore: status !== 'upcoming' ? Number((home as Record<string, unknown>).score ?? 0) : null,
        awayScore: status !== 'upcoming' ? Number((away as Record<string, unknown>).score ?? 0) : null,
        status,
        statusDisplay: statusDesc,
        kickoffUTC,
        goals: [],
      }
    })
  } catch {
    return []
  }
}

export async function fetchESPNGoals(eventId: string): Promise<ESPNGoal[]> {
  try {
    const res = await fetch(`${ESPN_BASE}/summary?event=${eventId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 60 },
    })
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
  } catch {
    return []
  }
}

// Fetch ESPN matches across a date range (±1 day for timezone safety)
export async function fetchESPNAroundDate(isoDate: string): Promise<ESPNMatch[]> {
  const d = new Date(isoDate)
  const params = [
    toDateParam(new Date(d.getTime() - 86400000)),
    toDateParam(d),
    toDateParam(new Date(d.getTime() + 86400000)),
  ]
  const results = await Promise.all(params.map(fetchESPNMatchesByDate))
  return results.flat()
}
