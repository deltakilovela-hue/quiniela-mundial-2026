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
    const espnMatch = allESPN.find(e => matchESPN(e, dbMatch.home_team, dbMatch.away_team))
    if (!espnMatch) continue

    const updates: Record<string, unknown> = {}

    // Live → lock predictions
    if (espnMatch.status === 'live' && !dbMatch.is_locked) {
      updates.is_locked = true
      result.locked++
    }

    // Finished → write score + scorers
    if (espnMatch.status === 'finished' && espnMatch.homeScore !== null && espnMatch.awayScore !== null) {
      if (dbMatch.home_goals_real !== espnMatch.homeScore || dbMatch.away_goals_real !== espnMatch.awayScore) {
        updates.home_goals_real = espnMatch.homeScore
        updates.away_goals_real = espnMatch.awayScore
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
