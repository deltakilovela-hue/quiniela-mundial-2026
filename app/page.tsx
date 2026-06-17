import { supabase } from '@/lib/supabase'
import { calcStandings } from '@/lib/scoring'
import Link from 'next/link'

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

  const prizes = ['$7,500', '$4,000', '$2,500']

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">⚽ Gran Quiniela Familiar · Mundial 2026</h1>
        <p className="text-slate-400 text-sm">
          Fase de grupos · {played} de 72 partidos jugados · 28 participantes
        </p>
      </div>

      <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3 w-10">#</th>
              <th className="text-left px-4 py-3">Participante</th>
              <th className="text-center px-3 py-3">Exactos</th>
              <th className="text-center px-3 py-3">Correctos</th>
              <th className="text-right px-4 py-3">Puntos</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell">Premio</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((p, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
              const isTop3 = i < 3
              return (
                <tr
                  key={p.id}
                  className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${
                    isTop3 ? 'bg-slate-700/20' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                    {medal ?? i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/participante/${p.id}`}
                      className={`font-medium hover:text-teal-400 transition-colors ${
                        isTop3 ? 'text-white' : 'text-slate-200'
                      }`}
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-center text-slate-400">{p.exact}</td>
                  <td className="px-3 py-3 text-center text-slate-400">{p.correct}</td>
                  <td className="px-4 py-3 text-right font-bold font-mono text-lg text-teal-400">
                    {p.points}
                  </td>
                  <td className="px-4 py-3 text-right text-green-400 font-semibold text-sm hidden sm:table-cell">
                    {prizes[i] ?? ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

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
