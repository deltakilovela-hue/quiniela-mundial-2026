import { getServiceClient } from '@/lib/supabase'
import { fetchLiveMatches, fetchMatchesByDate, formatDateParam, FINISHED_STATUSES, LIVE_STATUSES, type APIMatch } from '@/lib/api-football'
import { fetchESPNMatchesByDate, fetchESPNGoals, type ESPNMatch } from '@/lib/espn-football'

export interface SyncResult {
  updated: number
  locked: number
  scorers_updated: number
  time_updated: number
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
  // pass-through
  'Portugal': 'Portugal', 'Argentina': 'Argentina', 'Colombia': 'Colombia',
  'Uruguay': 'Uruguay', 'Ecuador': 'Ecuador', 'Paraguay': 'Paraguay',
  'Chile': 'Chile', 'Bolivia': 'Bolivia', 'Venezuela': 'Venezuela',
  'Honduras': 'Honduras', 'Guatemala': 'Guatemala', 'Cuba': 'Cuba',
  'Costa Rica': 'Costa Rica', 'Austria': 'Austria', 'Serbia': 'Serbia',
  'Australia': 'Australia', 'Senegal': 'Senegal', 'Nigeria': 'Nigeria',
  'Ghana': 'Ghana', 'Irlanda': 'Ireland',
}

function normName(name: string) {
  return name.toLowerCase().replace(/[^a-z]/g, '')
}

function matchESPN(espn: ESPNMatch, homeES: string, awayES: string): boolean {
  const homeEN = ES_TO_ESPN[homeES] ?? homeES
  const awayEN = ES_TO_ESPN[awayES] ?? awayES
  const eH = normName(espn.homeTeam)
  const eA = normName(espn.awayTeam)
  const nH = normName(homeEN)
  const nA = normName(awayEN)
  return (eH.includes(nH) || nH.includes(eH)) && (eA.includes(nA) || nA.includes(eA))
}

// PRIMARY: Sync scores, scorers, kickoff times from ESPN
async function syncFromESPN(result: SyncResult) {
  const supabase = getServiceClient()

  // Fetch all DB matches that are either unplayed or played in the last 2 days
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  const { data: dbMatches } = await supabase
    .from('matches')
    .select('*')
    .order('match_date')

  if (!dbMatches?.length) return

  // Build ESPN cache for all relevant dates
  const espnCache: Record<string, ESPNMatch[]> = {}

  async function loadDate(param: string) {
    if (!espnCache[param]) {
      espnCache[param] = await fetchESPNMatchesByDate(param)
    }
  }

  // Load today ± 3 days to cover all live/recent/upcoming matches
  const today = new Date()
  for (let offset = -3; offset <= 3; offset++) {
    const d = new Date(today)
    d.setDate(today.getDate() + offset)
    await loadDate(d.toISOString().slice(0, 10).replace(/-/g, ''))
  }

  const allESPN = Object.values(espnCache).flat()
  result.fixtures_fetched += allESPN.length

  for (const dbMatch of dbMatches) {
    const espnMatch = allESPN.find(e => matchESPN(e, dbMatch.home_team, dbMatch.away_team))
    if (!espnMatch) continue

    const updates: Record<string, unknown> = {}

    // Lock if live
    if (espnMatch.status === 'live' && !dbMatch.is_locked) {
      updates.is_locked = true
      result.locked++
    }

    // Update score if finished
    if (espnMatch.status === 'finished' && espnMatch.homeScore !== null && espnMatch.awayScore !== null) {
      if (dbMatch.home_goals_real !== espnMatch.homeScore || dbMatch.away_goals_real !== espnMatch.awayScore) {
        updates.home_goals_real = espnMatch.homeScore
        updates.away_goals_real = espnMatch.awayScore
        updates.is_locked = true
        result.updated++
      }

      // Always fetch scorers for finished matches (not just when score changes)
      if (!dbMatch.scorers) {
        const goals = await fetchESPNGoals(espnMatch.id)
        if (goals.length > 0) {
          updates.scorers = goals.map(g => `${g.scorer} ${g.minute}`).join(' · ')
          result.scorers_updated++
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('matches').update(updates).eq('id', dbMatch.id)
      if (error) result.errors.push(`${dbMatch.id}: ${error.message}`)
    }
  }
}

// SECONDARY: RapidAPI for live lock (backup — kept as fallback)
const TEAM_NAME_MAP: Record<string, string> = {
  'United States': 'EE.UU.', 'USA': 'EE.UU.', 'Mexico': 'México', 'Canada': 'Canadá',
  'Brazil': 'Brasil', 'Panama': 'Panamá', 'Haiti': 'Haití',
  'Trinidad and Tobago': 'Trinidad y Tobago', 'Trinidad & Tobago': 'Trinidad y Tobago',
  'Curacao': 'Curazao', 'Curaçao': 'Curazao',
  'Germany': 'Alemania', 'France': 'Francia', 'Spain': 'España',
  'Netherlands': 'Países Bajos', 'Holland': 'Países Bajos', 'Belgium': 'Bélgica',
  'Croatia': 'Croacia', 'Italy': 'Italia', 'England': 'Inglaterra', 'Scotland': 'Escocia',
  'Denmark': 'Dinamarca', 'Switzerland': 'Suiza', 'Sweden': 'Suecia', 'Norway': 'Noruega',
  'Romania': 'Rumania', 'Slovakia': 'Eslovaquia',
  'Czech Republic': 'Rep. Checa', 'Czechia': 'Rep. Checa',
  'Bosnia and Herzegovina': 'Bosnia y Herz.', 'Bosnia & Herzegovina': 'Bosnia y Herz.',
  'Japan': 'Japón', 'South Korea': 'Corea del Sur', 'Korea Republic': 'Corea del Sur',
  'Saudi Arabia': 'Arabia Saudita', 'Iraq': 'Irak', 'Iran': 'Irán', 'Jordan': 'Jordania',
  'Uzbekistan': 'Uzbekistán', 'Turkey': 'Turquía', 'Türkiye': 'Turquía',
  'New Zealand': 'Nueva Zelanda', 'Morocco': 'Marruecos', 'Algeria': 'Argelia',
  'Tunisia': 'Túnez', 'Egypt': 'Egipto', 'Cameroon': 'Camerún',
  'South Africa': 'Sudáfrica', "Ivory Coast": 'Costa de Marfil', "Côte d'Ivoire": 'Costa de Marfil',
  'Cape Verde': 'Cabo Verde', 'DR Congo': 'Congo RD', 'Congo DR': 'Congo RD',
  'Democratic Republic of Congo': 'Congo RD', 'Congo': 'Congo RD', 'Kenya': 'Kenia', 'Qatar': 'Catar',
}

function normalizeRapid(name: string): string {
  return (TEAM_NAME_MAP[name] ?? name).toLowerCase().trim()
}

async function lockLiveMatchesRapid(result: SyncResult) {
  const supabase = getServiceClient()
  try {
    const liveMatches = await fetchLiveMatches()
    if (!liveMatches.length) return

    const { data: dbMatches } = await supabase
      .from('matches')
      .select('id, is_locked, home_team, away_team')
      .eq('is_locked', false)

    for (const match of liveMatches) {
      const status = (match.status ?? '').toUpperCase()
      const isLive = LIVE_STATUSES.some(s => status.includes(s))
      if (!isLive) continue

      const homeTeam = normalizeRapid(match.homeTeam.name)
      const awayTeam = normalizeRapid(match.awayTeam.name)

      const dbMatch = (dbMatches ?? []).find(
        (m: { home_team: string; away_team: string }) =>
          normalizeRapid(m.home_team) === homeTeam && normalizeRapid(m.away_team) === awayTeam
      )
      if (!dbMatch) continue

      const { error } = await supabase.from('matches').update({ is_locked: true }).eq('id', dbMatch.id)
      if (!error) result.locked++
    }
  } catch {
    // RapidAPI failure is non-fatal — ESPN already handles live detection
  }
}

export async function syncResults(): Promise<SyncResult> {
  const result: SyncResult = { updated: 0, locked: 0, scorers_updated: 0, time_updated: 0, errors: [], fixtures_fetched: 0 }

  try {
    // PRIMARY: ESPN — scores + scorers + kickoff times
    await syncFromESPN(result)

    // SECONDARY: RapidAPI — live lock backup
    await lockLiveMatchesRapid(result)
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err))
  }

  // Log to DB
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
