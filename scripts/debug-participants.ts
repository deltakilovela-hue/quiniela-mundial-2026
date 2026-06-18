import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fetchAllPredictions() {
  const all: { participant_id: string }[] = []
  let from = 0
  const PAGE = 1000
  for (;;) {
    const { data, error } = await supabase
      .from('predictions')
      .select('participant_id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

async function main() {
  const { data: dbParticipants } = await supabase.from('participants').select('id, name').order('name')
  const preds = await fetchAllPredictions()
  console.log(`Total predictions fetched (paginated): ${preds.length}`)

  const countById = new Map<string, number>()
  for (const p of preds) countById.set(p.participant_id, (countById.get(p.participant_id) ?? 0) + 1)

  console.log(`\n=== ${dbParticipants?.length} participants ===`)
  let missing = 0
  for (const p of dbParticipants ?? []) {
    const c = countById.get(p.id) ?? 0
    if (c !== 72) missing++
    console.log(`${(c + '').padStart(3)} preds  | ${p.name}${c !== 72 ? '  ⚠️' : ''}`)
  }
  console.log(`\n${missing} participants with != 72 predictions`)
}

main().catch(console.error)
