import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getResult(h: number, a: number) { return h > a ? 'H' : h < a ? 'A' : 'D' }

async function fetchAll(table: string, cols: string) {
  const all: any[] = []
  let from = 0
  for (;;) {
    const { data } = await supabase.from(table).select(cols).range(from, from + 999)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return all
}

async function main() {
  // K6 = Uzbekistán (home) vs Colombia (away). Colombia won 3-1 → home 1, away 3
  const { error } = await supabase
    .from('matches')
    .update({ home_goals_real: 1, away_goals_real: 3, is_locked: true })
    .eq('id', 'K6')
  if (error) { console.error('Update error:', error.message); process.exit(1) }
  console.log('✅ K6 set: Uzbekistán 1 - 3 Colombia')

  // Recompute standings
  const participants = await fetchAll('participants', 'id, name')
  const matches = await fetchAll('matches', 'id, home_goals_real, away_goals_real')
  const preds = await fetchAll('predictions', 'participant_id, match_id, home_goals, away_goals')
  const played = matches.filter((m: any) => m.home_goals_real !== null && m.away_goals_real !== null)

  const standings = participants.map((p: any) => {
    let points = 0
    for (const m of played) {
      const myPred = preds.find((pr: any) => pr.match_id === m.id && pr.participant_id === p.id)
      if (!myPred) continue
      const matchPreds = preds.filter((pr: any) => pr.match_id === m.id)
      const cr = getResult(myPred.home_goals, myPred.away_goals) === getResult(m.home_goals_real, m.away_goals_real)
      const hE = myPred.home_goals === m.home_goals_real
      const aE = myPred.away_goals === m.away_goals_real
      const exact = hE && aE
      let s = 0
      if (cr) s += 2
      if (hE || aE) s += 1
      if (exact) s += 2
      if (exact) {
        const ec = matchPreds.filter((pr: any) => pr.home_goals === m.home_goals_real && pr.away_goals === m.away_goals_real).length
        if (ec === 1) s += 5
        else if (ec <= 5) s += 3
      }
      points += s
    }
    return { name: p.name, points }
  }).sort((a, b) => b.points - a.points)

  console.log(`\nPlayed: ${played.length}`)
  console.log('=== APP standings now ===')
  standings.forEach((s, i) => console.log(`${(i + 1 + '').padStart(2)}. ${(s.points + '').padStart(3)}  ${s.name}`))
}

main().catch(console.error)
