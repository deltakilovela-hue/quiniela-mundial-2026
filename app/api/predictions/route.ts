import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { participant_id, match_id, home_goals, away_goals, pin } = await req.json()

  // Validate PIN
  const { data: participant } = await supabase
    .from('participants')
    .select('id, pin')
    .eq('id', participant_id)
    .single()

  if (!participant || participant.pin !== pin) {
    return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
  }

  // Check match is not locked
  const { data: match } = await supabase
    .from('matches')
    .select('is_locked, match_date')
    .eq('id', match_id)
    .single()

  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })
  if (match.is_locked || new Date(match.match_date) <= new Date()) {
    return NextResponse.json({ error: 'El partido ya inició, no se aceptan cambios' }, { status: 403 })
  }

  const { error } = await supabase.from('predictions').upsert(
    { participant_id, match_id, home_goals, away_goals, updated_at: new Date().toISOString() },
    { onConflict: 'participant_id,match_id' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
