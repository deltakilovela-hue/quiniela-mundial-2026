import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: all, count } = await supabase
    .from('participants')
    .select('id, name', { count: 'exact' })
    .order('name')

  console.log(`Total participant rows: ${count}`)

  const byName = new Map<string, string[]>()
  for (const p of all ?? []) {
    if (!byName.has(p.name)) byName.set(p.name, [])
    byName.get(p.name)!.push(p.id)
  }

  console.log(`Distinct names: ${byName.size}`)
  console.log('\n=== Names with duplicates ===')
  for (const [name, ids] of byName) {
    if (ids.length > 1) console.log(`  ${name}: ${ids.length} rows → ${ids.join(', ')}`)
  }

  // Count predictions per participant_id
  const { data: preds } = await supabase.from('predictions').select('participant_id')
  const validIds = new Set((all ?? []).map(p => p.id))
  let orphan = 0
  const predIds = new Set<string>()
  for (const p of preds ?? []) {
    predIds.add(p.participant_id)
    if (!validIds.has(p.participant_id)) orphan++
  }
  console.log(`\nDistinct participant_ids in predictions: ${predIds.size}`)
  console.log(`Orphan predictions (id not in participants): ${orphan}`)
}

main().catch(console.error)
