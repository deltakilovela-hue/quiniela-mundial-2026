import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function getServiceClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
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
}

export type Prediction = {
  id: string
  participant_id: string
  match_id: string
  home_goals: number
  away_goals: number
}
