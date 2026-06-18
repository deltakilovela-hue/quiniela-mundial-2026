import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data } = await supabase
    .from('matches')
    .select('id, "group", home_team, away_team, home_goals_real, away_goals_real, is_locked, match_date')
    .order('match_date')

  console.log('=== Matches WITHOUT result (unplayed) ===')
  for (const m of data ?? []) {
    if (m.home_goals_real === null) {
      console.log(`${m.id} [${m.group}] ${m.home_team} vs ${m.away_team}  | locked=${m.is_locked} | ${m.match_date}`)
    }
  }
  console.log(`\nTotal played: ${(data ?? []).filter(m => m.home_goals_real !== null).length}`)
}

main().catch(console.error)
