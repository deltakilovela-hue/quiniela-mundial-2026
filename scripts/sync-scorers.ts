/**
 * Syncs goal scorers from ESPN public API into the matches.scorers column.
 * Run: npx tsx scripts/sync-scorers.ts
 *
 * Prerequisite — run this SQL in Supabase SQL Editor first:
 *   ALTER TABLE matches ADD COLUMN IF NOT EXISTS scorers text;
 */
import 'dotenv/config'
import { getServiceClient } from '../lib/supabase'
import { fetchESPNMatchesByDate, fetchESPNGoals, type ESPNGoal } from '../lib/espn-football'

// Maps Spanish DB name → ESPN English name(s) for fuzzy matching
const ES_TO_EN: Record<string, string> = {
  'México': 'Mexico', 'Sudáfrica': 'South Africa', 'Corea del Sur': 'South Korea',
  'Rep. Checa': 'Czechia', 'Canadá': 'Canada', 'EE.UU.': 'United States',
  'Brasil': 'Brazil', 'Panamá': 'Panama', 'Haití': 'Haiti',
  'Trinidad y Tobago': 'Trinidad and Tobago', 'Curazao': 'Curaçao',
  'Alemania': 'Germany', 'Francia': 'France', 'España': 'Spain',
  'Países Bajos': 'Netherlands', 'Bélgica': 'Belgium', 'Croacia': 'Croatia',
  'Italia': 'Italy', 'Inglaterra': 'England', 'Escocia': 'Scotland',
  'Dinamarca': 'Denmark', 'Suiza': 'Switzerland', 'Serbia': 'Serbia',
  'Suecia': 'Sweden', 'Noruega': 'Norway', 'Rumania': 'Romania',
  'Eslovaquia': 'Slovakia', 'Bosnia y Herz.': 'Bosnia-Herzegovina',
  'Irlanda': 'Ireland', 'Austria': 'Austria',
  'Japón': 'Japan', 'Arabia Saudita': 'Saudi Arabia', 'Irak': 'Iraq',
  'Irán': 'Iran', 'Jordania': 'Jordan', 'Uzbekistán': 'Uzbekistan',
  'Turquía': 'Turkey', 'Australia': 'Australia', 'Nueva Zelanda': 'New Zealand',
  'Marruecos': 'Morocco', 'Senegal': 'Senegal', 'Nigeria': 'Nigeria',
  'Ghana': 'Ghana', 'Argelia': 'Algeria', 'Túnez': 'Tunisia',
  'Egipto': 'Egypt', 'Camerún': 'Cameroon', 'Costa de Marfil': 'Ivory Coast',
  'Cabo Verde': 'Cape Verde', 'Congo RD': 'Congo DR', 'Kenia': 'Kenya',
  'Catar': 'Qatar',
  // pass-through (same in both languages)
  'Portugal': 'Portugal', 'Argentina': 'Argentina', 'Colombia': 'Colombia',
  'Uruguay': 'Uruguay', 'Ecuador': 'Ecuador', 'Paraguay': 'Paraguay',
  'Chile': 'Chile', 'Bolivia': 'Bolivia', 'Venezuela': 'Venezuela',
  'Honduras': 'Honduras', 'Guatemala': 'Guatemala', 'Cuba': 'Cuba',
  'Costa Rica': 'Costa Rica',
}

function norm(name: string) {
  return name.toLowerCase().replace(/[^a-z]/g, '')
}

function formatGoals(goals: ESPNGoal[]): string {
  return goals
    .map(g => `${g.scorer} ${g.minute}`)
    .join(' · ')
}

async function main() {
  const supabase = getServiceClient()

  // Fetch all played matches
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, match_date, scorers')
    .not('home_goals_real', 'is', null)
    .order('match_date')

  if (error) { console.error('DB error:', error.message); process.exit(1) }

  console.log(`Found ${matches!.length} played matches\n`)

  // Build cache: date → ESPN matches (avoid repeated fetches)
  const espnCache: Record<string, Awaited<ReturnType<typeof fetchESPNMatchesByDate>>> = {}

  async function getESPNForDate(dateStr: string) {
    const param = dateStr.replace(/-/g, '').slice(0, 8)
    if (!espnCache[param]) {
      espnCache[param] = await fetchESPNMatchesByDate(param)
      // Also try ±1 day in case of timezone shift
      const d = new Date(dateStr)
      const prev = new Date(d.getTime() - 86400000).toISOString().slice(0,10).replace(/-/g,'')
      const next = new Date(d.getTime() + 86400000).toISOString().slice(0,10).replace(/-/g,'')
      if (!espnCache[prev]) espnCache[prev] = await fetchESPNMatchesByDate(prev)
      if (!espnCache[next]) espnCache[next] = await fetchESPNMatchesByDate(next)
    }
  }

  let updated = 0
  let skipped = 0

  for (const match of matches!) {
    const homeEN = ES_TO_EN[match.home_team] ?? match.home_team
    const awayEN = ES_TO_EN[match.away_team] ?? match.away_team
    const dateStr = match.match_date?.slice(0, 10) ?? ''

    // Pre-load ESPN cache for this date
    await getESPNForDate(dateStr)

    // Search across ±1 day cache
    const param = dateStr.replace(/-/g, '')
    const d = new Date(dateStr)
    const prev = new Date(d.getTime() - 86400000).toISOString().slice(0,10).replace(/-/g,'')
    const next = new Date(d.getTime() + 86400000).toISOString().slice(0,10).replace(/-/g,'')

    const allESPN = [
      ...(espnCache[prev] ?? []),
      ...(espnCache[param] ?? []),
      ...(espnCache[next] ?? []),
    ]

    const espnMatch = allESPN.find(m => {
      const mH = norm(m.homeTeam)
      const mA = norm(m.awayTeam)
      const eH = norm(homeEN)
      const eA = norm(awayEN)
      return (mH.includes(eH) || eH.includes(mH)) && (mA.includes(eA) || eA.includes(mA))
    })

    if (!espnMatch) {
      console.log(`⚠️  No ESPN match found: ${match.home_team} vs ${match.away_team} (${dateStr})`)
      skipped++
      continue
    }

    const goals = await fetchESPNGoals(espnMatch.id)
    const scorersStr = goals.length > 0 ? formatGoals(goals) : null

    if (!scorersStr) {
      console.log(`⚠️  No goals found: ${match.home_team} vs ${match.away_team}`)
      skipped++
      continue
    }

    // Skip if already stored and unchanged
    if (match.scorers === scorersStr) {
      console.log(`✓  Already synced: ${match.id} ${match.home_team} vs ${match.away_team}`)
      skipped++
      continue
    }

    const { error: upErr } = await supabase
      .from('matches')
      .update({ scorers: scorersStr })
      .eq('id', match.id)

    if (upErr) {
      console.log(`❌ ${match.id}: ${upErr.message}`)
    } else {
      console.log(`✅ ${match.id} ${match.home_team} vs ${match.away_team}`)
      console.log(`   ${scorersStr}`)
      updated++
    }

    // Small delay to be polite to ESPN
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped`)
}

main().catch(console.error)
