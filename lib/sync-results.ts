import { getServiceClient } from '@/lib/supabase'
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
  'Jordania': 'Jordan', 'Uzbekistán': 'Uzbekistan', 'Turquía': 'Türkiye',
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
  // Fold accents (Türkiye → turkiye, Curaçao → curacao) then keep only letters
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
}

function teamsEqual(espnTeam: string, dbTeamES: string): boolean {
  const en = ES_TO_ESPN[dbTeamES] ?? dbTeamES
  const e = normName(espnTeam)
  const n = normName(en)
  return e.includes(n) || n.includes(e)
}

// ESPN sometimes lists a fixture with home/away swapped vs our quiniela.
// Returns 'direct', 'reversed', or null (no match). On 'reversed' the caller
// must flip the score so it stays correct for our home/away orientation.
function matchOrientation(espn: ESPNMatch, homeES: string, awayES: string): 'direct' | 'reversed' | null {
  if (teamsEqual(espn.homeTeam, homeES) && teamsEqual(espn.awayTeam, awayES)) return 'direct'
  if (teamsEqual(espn.homeTeam, awayES) && teamsEqual(espn.awayTeam, homeES)) return 'reversed'
  return null
}

// Loads the ESPN scoreboard across the whole group-stage window once, so every
// played match can be matched by team name regardless of its (placeholder) date.
async function loadESPNRange(): Promise<ESPNMatch[]> {
  const espnCache: Record<string, ESPNMatch[]> = {}
  const today = new Date()
  // Cover today-15 .. today+3 — wide enough to catch any recently played match
  for (let offset = -15; offset <= 3; offset++) {
    const d = new Date(today)
    d.setDate(today.getDate() + offset)
    const param = d.toISOString().slice(0, 10).replace(/-/g, '')
    if (!espnCache[param]) espnCache[param] = await fetchESPNMatchesByDate(param)
  }
  return Object.values(espnCache).flat()
}

// PRIMARY: Sync match scores + scorers + live lock from ESPN (the internet).
// Results come automatically from real World Cup data — no manual entry.
async function syncFromESPN(result: SyncResult) {
  const supabase = getServiceClient()
  const { data: dbMatches } = await supabase.from('matches').select('*').order('match_date')
  if (!dbMatches?.length) return

  const allESPN = await loadESPNRange()
  result.fixtures_fetched += allESPN.length

  for (const dbMatch of dbMatches) {
    let orientation: 'direct' | 'reversed' | null = null
    const espnMatch = allESPN.find(e => {
      orientation = matchOrientation(e, dbMatch.home_team, dbMatch.away_team)
      return orientation !== null
    })
    if (!espnMatch || !orientation) continue

    const updates: Record<string, unknown> = {}

    // Live → lock predictions
    if (espnMatch.status === 'live' && !dbMatch.is_locked) {
      updates.is_locked = true
      result.locked++
    }

    // Finished → write score + scorers (flip score if ESPN has teams swapped)
    if (espnMatch.status === 'finished' && espnMatch.homeScore !== null && espnMatch.awayScore !== null) {
      const homeScore = orientation === 'reversed' ? espnMatch.awayScore : espnMatch.homeScore
      const awayScore = orientation === 'reversed' ? espnMatch.homeScore : espnMatch.awayScore
      if (dbMatch.home_goals_real !== homeScore || dbMatch.away_goals_real !== awayScore) {
        updates.home_goals_real = homeScore
        updates.away_goals_real = awayScore
        updates.is_locked = true
        result.updated++
      }
      // Fetch scorers if we don't have them yet
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

export async function syncResults(): Promise<SyncResult> {
  const result: SyncResult = { updated: 0, locked: 0, scorers_updated: 0, time_updated: 0, errors: [], fixtures_fetched: 0 }

  try {
    // ESPN (internet) — scores + scorers + live lock, fully automatic
    await syncFromESPN(result)
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
