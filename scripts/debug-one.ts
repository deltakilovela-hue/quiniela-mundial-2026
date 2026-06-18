import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const id = 'f516e107-2755-41c1-bf66-9e8711bb9801'
  const { data: p } = await supabase.from('participants').select('id, name').eq('id', id).single()
  console.log('Participant:', p?.name)

  const { data: preds } = await supabase
    .from('predictions')
    .select('match_id, home_goals, away_goals')
    .eq('participant_id', id)
    .order('match_id')

  console.log(`Total predictions: ${preds?.length}`)
  console.log('Group K/L predictions:')
  for (const pr of preds ?? []) {
    if (pr.match_id.startsWith('K') || pr.match_id.startsWith('L')) {
      console.log(`  ${pr.match_id}: ${pr.home_goals}-${pr.away_goals}`)
    }
  }

  // List which match_ids exist
  const ids = (preds ?? []).map(p => p.match_id).sort()
  console.log('\nAll match_ids:', ids.join(', '))
}

main().catch(console.error)
