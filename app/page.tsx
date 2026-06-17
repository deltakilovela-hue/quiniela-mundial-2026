import { supabase } from '@/lib/supabase'
import { calcStandings } from '@/lib/scoring'
import RealtimeStandings from '@/components/RealtimeStandings'

export const revalidate = 60

export default async function StandingsPage() {
  const [{ data: participants }, { data: matches }, { data: predictions }] = await Promise.all([
    supabase.from('participants').select('id, name'),
    supabase.from('matches').select('id, home_goals_real, away_goals_real'),
    supabase.from('predictions').select('participant_id, match_id, home_goals, away_goals'),
  ])

  const standings = calcStandings(
    participants ?? [],
    matches ?? [],
    predictions ?? []
  )

  const played = (matches ?? []).filter(
    (m) => m.home_goals_real !== null && m.away_goals_real !== null
  ).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">⚽ Gran Quiniela Familiar · Mundial 2026</h1>
      </div>

      <RealtimeStandings initialStandings={standings} initialPlayed={played} />

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        {[
          { place: '🥇 1er lugar', prize: '$7,500', color: 'border-yellow-500/40 bg-yellow-500/5' },
          { place: '🥈 2do lugar', prize: '$4,000', color: 'border-slate-400/40 bg-slate-400/5' },
          { place: '🥉 3er lugar', prize: '$2,500', color: 'border-amber-700/40 bg-amber-700/5' },
        ].map((row) => (
          <div key={row.place} className={`rounded-lg border p-3 text-center ${row.color}`}>
            <div className="font-medium text-slate-300">{row.place}</div>
            <div className="text-xl font-bold text-white mt-1">{row.prize}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-slate-400 text-xs space-y-1">
        <p>
          <span className="text-white font-medium">Sistema de puntos:</span>{' '}
          Resultado correcto → 2pts · Un gol exacto → +1pt · Marcador exacto → +2pts adicionales
        </p>
        <p>
          <span className="text-yellow-400">🎯 Bono difícil:</span> Si ≤5 personas aciertan el marcador exacto → +3pts{' '}
          <span className="text-orange-400">🔥 Bono sorpresa:</span> Solo 1 persona acierta el resultado → +5pts
        </p>
      </div>
    </div>
  )
}
