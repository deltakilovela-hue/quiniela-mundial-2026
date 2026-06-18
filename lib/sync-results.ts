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
import { fetchESPNMatchesByDate, fetchESPNGoals } from '@/lib/espn-football'

export interface SyncResult {
  updated: number
  locked: number
  scorers_updated: number
  errors: string[]
  fixtures_fetched: number
}

// Maps Spanish DB name → ESPN English display name
const ES_TO_ESPN: Record<string, string> = {
  'México': 'Mexico', 'Sudáfrica': 'South Africa', 'Corea del Sur': 'South Korea',
  'Rep. Checa': 'Czechia', 'Canadá': 'Canada', 'EE.UU.': 'United States',
  'Brasil': 'Brazil', 'Panamá': 'Panama', 'Haití': 'Haiti',
  'Trinidad y Tobago': 'Trinidad and Tobago', 'Curazao': 'Curaçao',
  'Alemania': 'Germany', 'Francia': 'France', 'España': 'Spain',
  'Países Bajos': 'Netherlands', 'Bélgica': 'Belgium', 'Croacia': 'Croatia',
  'Italia': 'Italy', 'Inglaterra': 'England', 'Escocia': 'Scotland',
  'Dinamarca': 'Denmark', 'Suiza': 'Switzerland', 'Suecia': 'Sweden',
  'Noruega': 'Norway', 'Rumania': 'Romania', 'Eslovaquia': 'Slovakia',
  'Bosnia y Herz.': 'Bosnia-Herzegovina', 'Japón': 'Japan',
  'Arabia Saudita': 'Saudi Arabia', 'Irak': 'Iraq', 'Irán': 'Iran',
  'Jordania': 'Jordan', 'Uzbekistán': 'Uzbekistan', 'Turquía': 'Turkey',
  'Nueva Zelanda': 'New Zealand', 'Marruecos': 'Morocco', 'Argelia': 'Algeria',
  'Túnez': 'Tunisia', 'Egipto': 'Egypt', 'Camerún': 'Cameroon',
  'Costa de Marfil': 'Ivory Coast', 'Cabo Verde': 'Cape Verde',
  'Congo RD': 'Congo DR', 'Kenia': 'Kenya', 'Catar': 'Qatar',
}

function normESPN(name: string) {
  return name.toLowerCase().replace(/[^a-z]/g, '')
}

// Sync goal scorers from ESPN for all recently finished matches
async function syncScorers(result: SyncResult) {
  const supabase = getServiceClient()

  // Fetch finished matches from the last 2 days that might need scorers
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  const { data: matches } = await supabase
    .from('matches')
    .select('id, home_team, away_team, match_date, scorers, home_goals_real')
    .not('home_goals_real', 'is', null)
    .gte('match_date', twoDaysAgo.toISOString())

  if (!matches?.length) return

  // Build ESPN match cache for relevant dates
  const espnByDate: Record<string, Awaited<ReturnType<typeof fetchESPNMatchesByDate>>> = {}
  const dateParams = new Set<string>()

  for (const m of matches) {
    const base = m.match_date?.slice(0, 10).replace(/-/g, '') ?? ''
    if (base) {
      dateParams.add(base)
      // Also add ±1 day for timezone shifts
      const d = new Date(m.match_date)
      dateParams.add(new Date(d.getTime() - 86400000).toISOString().slice(0,10).replace(/-/g,''))
      dateParams.add(new Date(d.getTime() + 86400000).toISOString().slice(0,10).replace(/-/g,''))
    }
  }

  await Promise.all([...dateParams].map(async (p) => {
    if (!espnByDate[p]) espnByDate[p] = await fetchESPNMatchesByDate(p)
  }))

  const allESPN = Object.values(espnByDate).flat()

  for (const match of matches) {
    const homeEN = ES_TO_ESPN[match.home_team] ?? match.home_team
    const awayEN = ES_TO_ESPN[match.away_team] ?? match.away_team
    const nH = normESPN(homeEN)
    const nA = normESPN(awayEN)

    const espnMatch = allESPN.find(e => {
      const eH = normESPN(e.homeTeam)
      const eA = normESPN(e.awayTeam)
      return (eH.includes(nH) || nH.includes(eH)) && (eA.includes(nA) || nA.includes(eA))
    })

    if (!espnMatch) continue

    const goals = await fetchESPNGoals(espnMatch.id)
    if (!goals.length) continue

    const scorersStr = goals.map(g => `${g.scorer} ${g.minute}`).join(' · ')
    if (match.scorers === scorersStr) continue

    const { error } = await supabase
      .from('matches')
      .update({ scorers: scorersStr })
      .eq('id', match.id)

    if (!error) result.scorers_updated++
  }
}

// Maps API team names (English) → our Spanish names in the DB
const TEAM_NAME_MAP: Record<string, string> = {
  // Americas
  'United States': 'EE.UU.',
  'USA': 'EE.UU.',
  'US': 'EE.UU.',
  'Mexico': 'México',
  'Canada': 'Canadá',
  'Brazil': 'Brasil',
  'Argentina': 'Argentina',
  'Colombia': 'Colombia',
  'Uruguay': 'Uruguay',
  'Ecuador': 'Ecuador',
  'Peru': 'Perú',
  'Paraguay': 'Paraguay',
  'Chile': 'Chile',
  'Bolivia': 'Bolivia',
  'Venezuela': 'Venezuela',
  'Panama': 'Panamá',
  'Costa Rica': 'Costa Rica',
  'Honduras': 'Honduras',
  'Guatemala': 'Guatemala',
  'Cuba': 'Cuba',
  'Haiti': 'Haití',
  'Trinidad and Tobago': 'Trinidad y Tobago',
  'Trinidad & Tobago': 'Trinidad y Tobago',
  'Curacao': 'Curazao',
  'Curaçao': 'Curazao',
  // Europe
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
  'Scotland': 'Escocia',
  'Denmark': 'Dinamarca',
  'Switzerland': 'Suiza',
  'Austria': 'Austria',
  'Serbia': 'Serbia',
  'Sweden': 'Suecia',
  'Norway': 'Noruega',
  'Romania': 'Rumania',
  'Slovakia': 'Eslovaquia',
  'Czech Republic': 'Rep. Checa',
  'Czechia': 'Rep. Checa',
  'Bosnia and Herzegovina': 'Bosnia y Herz.',
  'Bosnia & Herzegovina': 'Bosnia y Herz.',
  'Bosnia': 'Bosnia y Herz.',
  'Ireland': 'Irlanda',
  // Asia / Middle East
  'Japan': 'Japón',
  'South Korea': 'Corea del Sur',
  'Korea Republic': 'Corea del Sur',
  'Saudi Arabia': 'Arabia Saudita',
  'Iraq': 'Irak',
  'Iran': 'Irán',
  'Jordan': 'Jordania',
  'Uzbekistan': 'Uzbekistán',
  'Turkey': 'Turquía',
  'Türkiye': 'Turquía',
  'Australia': 'Australia',
  'New Zealand': 'Nueva Zelanda',
  // Africa
  'Morocco': 'Marruecos',
  'Senegal': 'Senegal',
  'Nigeria': 'Nigeria',
  'Ghana': 'Ghana',
  'Algeria': 'Argelia',
  'Tunisia': 'Túnez',
  'Egypt': 'Egipto',
  'Cameroon': 'Camerún',
  'South Africa': 'Sudáfrica',
  "Ivory Coast": 'Costa de Marfil',
  "Côte d'Ivoire": 'Costa de Marfil',
  'Cape Verde': 'Cabo Verde',
  'DR Congo': 'Congo RD',
  'Democratic Republic of Congo': 'Congo RD',
  'Congo DR': 'Congo RD',
  'Congo': 'Congo RD',
  'Kenya': 'Kenia',
  'Qatar': 'Catar',
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
  const result: SyncResult = { updated: 0, locked: 0, scorers_updated: 0, errors: [], fixtures_fetched: 0 }

  try {
    // 1. Check live matches — lock them immediately
    const liveMatches = await fetchLiveMatches()
    await processMatches(liveMatches, result)

    // 2. Fetch today + yesterday by date (no league filter — WC uses multiple dynamic league IDs)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    for (const date of [formatDateParam(yesterday), formatDateParam(today)]) {
      const dayMatches = await fetchMatchesByDate(date)
      await processMatches(dayMatches, result)
    }

    // 3. Sync goal scorers from ESPN for recently finished matches
    await syncScorers(result)
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
