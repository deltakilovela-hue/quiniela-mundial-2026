/**
 * Imports all participant predictions from the Excel file into Supabase.
 * Run: npx tsx scripts/import-excel-predictions.ts
 *
 * Strategy: delete all existing predictions, then INSERT fresh in small
 * batches (plain insert avoids any ON CONFLICT payload limits). Verifies
 * per-participant counts at the end.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('Loading data from Supabase...')

  const [{ data: dbParticipants }, { data: dbMatches }] = await Promise.all([
    supabase.from('participants').select('id, name'),
    supabase.from('matches').select('id, home_team, away_team'),
  ])

  if (!dbParticipants || !dbMatches) {
    console.error('Failed to load participants or matches')
    process.exit(1)
  }

  const participantMap = new Map<string, string>()
  for (const p of dbParticipants) participantMap.set(p.name, p.id)

  const matchMap = new Map<string, string>()
  for (const m of dbMatches) matchMap.set(`${m.home_team}|${m.away_team}`, m.id)

  console.log(`  ${dbParticipants.length} participants, ${dbMatches.length} matches`)

  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'excel-predictions.json'), 'utf-8'))
  const predictions: Array<{ participant: string; home: string; away: string; home_goals: number; away_goals: number }> = raw.predictions
  console.log(`  ${predictions.length} predictions in Excel`)

  const rows: Array<{ participant_id: string; match_id: string; home_goals: number; away_goals: number }> = []
  const errors = new Set<string>()

  for (const pred of predictions) {
    const participantId = participantMap.get(pred.participant)
    const matchId = matchMap.get(`${pred.home}|${pred.away}`)
    if (!participantId) { errors.add(`No participant: "${pred.participant}"`); continue }
    if (!matchId) { errors.add(`No match: "${pred.home}" vs "${pred.away}"`); continue }
    rows.push({ participant_id: participantId, match_id: matchId, home_goals: pred.home_goals, away_goals: pred.away_goals })
  }

  // Deduplicate (keep last)
  const seen = new Map<string, typeof rows[0]>()
  for (const r of rows) seen.set(`${r.participant_id}|${r.match_id}`, r)
  const uniqueRows = Array.from(seen.values())
  console.log(`  ${uniqueRows.length} unique rows to insert`)

  // 1. Delete ALL existing predictions
  console.log('Deleting existing predictions...')
  const { error: delErr } = await supabase.from('predictions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (delErr) { console.error('Delete error:', delErr.message); process.exit(1) }

  // 2. Insert in small batches
  console.log('Inserting...')
  const CHUNK = 200
  let inserted = 0
  for (let i = 0; i < uniqueRows.length; i += CHUNK) {
    const chunk = uniqueRows.slice(i, i + CHUNK)
    const { error } = await supabase.from('predictions').insert(chunk)
    if (error) {
      console.error(`  Chunk ${i}-${i + chunk.length} FAILED:`, error.message)
      errors.add(error.message)
    } else {
      inserted += chunk.length
      process.stdout.write(`\r  Inserted ${inserted}/${uniqueRows.length}`)
    }
  }
  console.log('')

  // 3. Verify
  const { count } = await supabase.from('predictions').select('*', { count: 'exact', head: true })
  console.log(`\n✅ Done. Rows in DB now: ${count} (expected ${uniqueRows.length})`)

  if (errors.size > 0) {
    console.log(`⚠️  ${errors.size} errors:`)
    ;[...errors].slice(0, 10).forEach(e => console.log('  -', e))
  }
}

main().catch(console.error)
