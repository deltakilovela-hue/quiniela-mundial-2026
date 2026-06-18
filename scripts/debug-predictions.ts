import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: dbMatches } = await supabase.from('matches').select('id, "group", home_team, away_team')
  const { data: preds } = await supabase.from('predictions').select('match_id')

  const countByMatch = new Map<string, number>()
  for (const p of preds ?? []) countByMatch.set(p.match_id, (countByMatch.get(p.match_id) ?? 0) + 1)

  console.log('=== DB matches and prediction counts ===')
  for (const m of (dbMatches ?? []).sort((a, b) => a.id.localeCompare(b.id))) {
    const c = countByMatch.get(m.id) ?? 0
    const flag = c === 0 ? '  ❌ ZERO' : c < 28 ? `  ⚠️ ${c}/28` : '  ✅'
    console.log(`${m.id.padEnd(4)} [${m.group}] ${m.home_team} vs ${m.away_team} → ${c} preds${flag}`)
  }

  // Compare Excel keys to DB keys
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'excel-predictions.json'), 'utf-8'))
  const dbKeys = new Set((dbMatches ?? []).map(m => `${m.home_team}|${m.away_team}`))
  const excelKeys = new Set<string>(raw.predictions.map((p: any) => `${p.home}|${p.away}`))

  console.log('\n=== Excel match keys NOT found in DB ===')
  for (const k of excelKeys) {
    if (!dbKeys.has(k)) console.log('  MISSING:', k)
  }
}

main().catch(console.error)
