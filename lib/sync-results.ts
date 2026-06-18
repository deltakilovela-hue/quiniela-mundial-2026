import { getServiceClient } from '@/lib/supabase'
import { fetchESPNMatchesByDate, fetchESPNGoals, type ESPNMatch } from '@/lib/espn-football'
import { fetchSheetResults } from '@/lib/sheet-results'

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

// PRIMARY: Sync match scores from the Google Sheet (published as CSV).
// The Sheet is the family's source of truth for results.
async function syncFromSheet(result: SyncResult) {
  const csvUrl = process.env.SHEET_CSV_URL
  if (!csvUrl) {
    result.errors.push('SHEET_CSV_URL not set')
    return
  }

  const supabase = getServiceClient()
  const { data: dbMatches } = await supabase.from('matches').select('*').order('match_date')
  if (!dbMatches?.length) return

  const sheetResults = await fetchSheetResults(csvUrl)
  result.fixtures_fetched += sheetResults.length

  for (const dbMatch of dbMatches) {
    // Match by team names (normalized) — Sheet uses the same Spanish names as the DB
    const sr = sheetResults.find(
      s => normName(s.home) === normName(dbMatch.home_team) && normName(s.away) === normName(dbMatch.away_team)
    )
    if (!sr) continue

    if (dbMatch.home_goals_real !== sr.homeGoals || dbMatch.away_goals_real !== sr.awayGoals) {
      const { error } = await supabase
        .from('matches')
        .update({ home_goals_real: sr.homeGoals, away_goals_real: sr.awayGoals, is_locked: true })
        .eq('id', dbMatch.id)
      if (error) result.errors.push(`${dbMatch.id}: ${error.message}`)
      else result.updated++
    }
  }
}

// SECONDARY: Fetch goal scorers from ESPN for matches already marked as played.
// ESPN no longer writes scores — only scorers (which the Sheet doesn't have).
async function syncScorersFromESPN(result: SyncResult) {
  const supabase = getServiceClient()

  const { data: dbMatches } = await supabase
    .from('matches')
    .select('*')
    .not('home_goals_real', 'is', null)
    .is('scorers', null)

  if (!dbMatches?.length) return

  const espnCache: Record<string, ESPNMatch[]> = {}
  async function loadDate(param: string) {
    if (!espnCache[param]) espnCache[param] = await fetchESPNMatchesByDate(param)
  }

  const today = new Date()
  for (let offset = -10; offset <= 1; offset++) {
    const d = new Date(today)
    d.setDate(today.getDate() + offset)
    await loadDate(d.toISOString().slice(0, 10).replace(/-/g, ''))
  }

  const allESPN = Object.values(espnCache).flat()

  for (const dbMatch of dbMatches) {
    const espnMatch = allESPN.find(e => matchESPN(e, dbMatch.home_team, dbMatch.away_team))
    if (!espnMatch || espnMatch.status !== 'finished') continue

    const goals = await fetchESPNGoals(espnMatch.id)
    if (goals.length > 0) {
      const scorersStr = goals.map(g => `${g.scorer} ${g.minute}`).join(' · ')
      const { error } = await supabase.from('matches').update({ scorers: scorersStr }).eq('id', dbMatch.id)
      if (!error) result.scorers_updated++
    }
  }
}

export async function syncResults(): Promise<SyncResult> {
  const result: SyncResult = { updated: 0, locked: 0, scorers_updated: 0, time_updated: 0, errors: [], fixtures_fetched: 0 }

  try {
    // PRIMARY: Google Sheet — match scores (family's source of truth)
    await syncFromSheet(result)

    // SECONDARY: ESPN — goal scorers only (Sheet doesn't have them)
    await syncScorersFromESPN(result)
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
