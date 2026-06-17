import { getServiceClient } from '@/lib/supabase'
import {
  fetchLiveMatches,
  fetchMatchesByDate,
  fetchLeagueMatchesByDate,
  formatDateParam,
  FINISHED_STATUSES,
  LIVE_STATUSES,
  WC_LEAGUE_ID,
  type APIMatch,
} from '@/lib/api-football'

export interface SyncResult {
  updated: number
  locked: number
  errors: string[]
  fixtures_fetched: number
}

// Maps API team names (English) → our Spanish names in seed-data
const TEAM_NAME_MAP: Record<string, string> = {
  'United States': 'Estados Unidos',
  'USA': 'Estados Unidos',
  'US': 'Estados Unidos',
  'Mexico': 'México',
  'Germany': 'Alemania',
  'France': 'Francia',
  'Spain': 'España',
  'Portugal': 'Portugal',
  'Netherlands': 'Países Bajos',
  'Holland': 'Países Bajos',
  'Belgium': 'Bélgica',
  'Croatia': 'Croacia',
  'Italy': 'Italia',
  'England': 'Inglaterra',
  'Brazil': 'Brasil',
  'Argentina': 'Argentina',
  'Japan': 'Japón',
  'South Korea': 'Corea del Sur',
  'Korea Republic': 'Corea del Sur',
  'Morocco': 'Marruecos',
  'Senegal': 'Senegal',
  'Nigeria': 'Nigeria',
  'Colombia': 'Colombia',
  'Uruguay': 'Uruguay',
  'Denmark': 'Dinamarca',
  'Switzerland': 'Suiza',
  'Austria': 'Austria',
  'Serbia': 'Serbia',
  'Sweden': 'Suecia',
  'Scotland': 'Escocia',
  'Saudi Arabia': 'Arabia Saudita',
  'Ecuador': 'Ecuador',
  'Ghana': 'Ghana',
  'Canada': 'Canadá',
  'Tunisia': 'Túnez',
  'Peru': 'Perú',
  'Costa Rica': 'Costa Rica',
  'Romania': 'Rumania',
  'Slovakia': 'Eslovaquia',
  'Australia': 'Australia',
  "Ivory Coast": 'Costa de Marfil',
  "Côte d'Ivoire": 'Costa de Marfil',
  'Algeria': 'Argelia',
  'Kenya': 'Kenia',
  'Iraq': 'Irak',
  'Cuba': 'Cuba',
  'Guatemala': 'Guatemala',
  'Trinidad and Tobago': 'Trinidad y Tobago',
  'Czech Republic': 'República Checa',
  'Cameroon': 'Camerún',
  'Ireland': 'Irlanda',
}

function normalize(name: string): string {
  return (TEAM_NAME_MAP[name] ?? name).toLowerCase().trim()
}

// Process a list of API matches and update our DB
async function processMatches(matches: APIMatch[], result: SyncResult) {
  const supabase = getServiceClient()

  for (const match of matches) {
    result.fixtures_fetched++

    const status = (match.status ?? '').toUpperCase()
    const isLive = LIVE_STATUSES.some((s) => status.includes(s))
    const isFinished = FINISHED_STATUSES.some((s) => status.includes(s))

    if (!isLive && !isFinished) continue

    const homeTeam = normalize(match.homeTeam.name)
    const awayTeam = normalize(match.awayTeam.name)

    // Find match in our DB — compare normalized names
    const { data: dbMatches } = await supabase
      .from('matches')
      .select('id, is_locked, home_goals_real, home_team, away_team')

    const dbMatch = (dbMatches ?? []).find(
      (m: { home_team: string; away_team: string }) =>
        normalize(m.home_team) === homeTeam && normalize(m.away_team) === awayTeam
    )

    if (!dbMatch) continue

    // Lock if live
    if (isLive && !dbMatch.is_locked) {
      const { error } = await supabase
        .from('matches')
        .update({ is_locked: true })
        .eq('id', dbMatch.id)
      if (!error) result.locked++
    }

    // Update result if finished
    if (isFinished) {
      const homeGoals = match.score?.home ?? null
      const awayGoals = match.score?.away ?? null

      if (homeGoals === null || awayGoals === null) continue
      // Skip if already stored
      if (dbMatch.home_goals_real === homeGoals) continue

      const { error } = await supabase
        .from('matches')
        .update({ home_goals_real: homeGoals, away_goals_real: awayGoals, is_locked: true })
        .eq('id', dbMatch.id)

      if (error) {
        result.errors.push(`${dbMatch.id}: ${error.message}`)
      } else {
        result.updated++
      }
    }
  }
}

export async function syncResults(): Promise<SyncResult> {
  const result: SyncResult = { updated: 0, locked: 0, errors: [], fixtures_fetched: 0 }

  try {
    // 1. Check live matches — lock them immediately
    const liveMatches = await fetchLiveMatches()
    await processMatches(liveMatches, result)

    // 2. Fetch today's matches (and yesterday as safety net)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    const dates = [formatDateParam(yesterday), formatDateParam(today)]

    for (const date of dates) {
      let dayMatches: APIMatch[]

      if (WC_LEAGUE_ID) {
        // If we know the WC league ID, filter precisely
        dayMatches = await fetchLeagueMatchesByDate(date, WC_LEAGUE_ID)
      } else {
        // Otherwise fetch all matches that day and filter by known team names
        dayMatches = await fetchMatchesByDate(date)
      }

      await processMatches(dayMatches, result)
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err))
  }

  // Log sync to DB
  await getServiceClient()
    .from('sync_log')
    .insert({
      fixtures_fetched: result.fixtures_fetched,
      updated: result.updated,
      locked: result.locked,
      errors: result.errors,
    })

  return result
}
