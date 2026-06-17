import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

const ADMIN_PIN = process.env.ADMIN_PIN || 'admin2026'

export async function POST(req: NextRequest) {
  const { match_id, home_goals, away_goals, pin } = await req.json()

  if (pin !== ADMIN_PIN) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = getServiceClient()
  const { error } = await supabase
    .from('matches')
    .update({ home_goals_real: home_goals, away_goals_real: away_goals, is_locked: true })
    .eq('id', match_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const { match_id, is_locked, pin } = await req.json()

  if (pin !== ADMIN_PIN) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = getServiceClient()
  const { error } = await supabase
    .from('matches')
    .update({ is_locked })
    .eq('id', match_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
