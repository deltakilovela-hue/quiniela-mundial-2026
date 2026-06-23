import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function getServiceClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

// Supabase caps any select at 1000 rows by default. With 28 participants × 72
// matches = 2016 predictions, a plain select silently drops ~1000 rows, leaving
// some participants with no predictions. This paginates through all of them.
export async function fetchAllPredictions(
  client = supabase,
  columns = 'participant_id, match_id, home_goals, away_goals'
): Promise<Array<{ participant_id: string; match_id: string; home_goals: number; away_goals: number }>> {
  const all: Array<{ participant_id: string; match_id: string; home_goals: number; away_goals: number }> = []
  const PAGE = 1000
  let from = 0
  for (;;) {
    const { data, error } = await client.from('predictions').select(columns).range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as unknown as typeof all))
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

export type Participant = {
  id: string
  name: string
  pin: string
}

export type Match = {
  id: string
  group: string
  match_date: string
  home_team: string
  away_team: string
  home_flag: string
  away_flag: string
  home_goals_real: number | null
  away_goals_real: number | null
  is_locked: boolean
  scorers?: string | null
  live_home?: number | null
  live_away?: number | null
  live_status?: string | null
}

export type Prediction = {
  id: string
  participant_id: string
  match_id: string
  home_goals: number
  away_goals: number
}
