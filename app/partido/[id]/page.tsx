import { supabase } from '@/lib/supabase'
import { calcMatchScore } from '@/lib/scoring'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AutoRefresh from '@/components/AutoRefresh'

export const revalidate = 30

function liveLabel(s: string): string {
  const map: Record<string, string> = {
    'Halftime': 'Medio tiempo', 'HT': 'Medio tiempo',
    '1st Half': '1er tiempo', '2nd Half': '2do tiempo',
    'First Half': '1er tiempo', 'Second Half': '2do tiempo',
  }
  return map[s] ?? s
}

export default async function PartidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ data: match }, { data: preds }, { data: participants }] = await Promise.all([
    supabase.from('matches').select('*').eq('id', id).single(),
    supabase.from('predictions').select('participant_id, home_goals, away_goals').eq('match_id', id),
    supabase.from('participants').select('id, name'),
  ])
  if (!match) notFound()

  const nameOf = new Map((participants ?? []).map(p => [p.id, p.name]))
  const finished = match.home_goals_real !== null && match.away_goals_real !== null
  const live = !finished && match.live_status != null
  const score = finished
    ? { home_goals: match.home_goals_real!, away_goals: match.away_goals_real! }
    : live
    ? { home_goals: match.live_home ?? 0, away_goals: match.live_away ?? 0 }
    : null

  const allPreds = (preds ?? []).map(p => ({ home_goals: p.home_goals, away_goals: p.away_goals }))
  const rows = (preds ?? [])
    .map(p => ({
      name: nameOf.get(p.participant_id) ?? '?',
      home: p.home_goals,
      away: p.away_goals,
      info: score ? calcMatchScore({ home_goals: p.home_goals, away_goals: p.away_goals }, score, allPreds) : null,
    }))
    .sort((a, b) => (b.info?.total ?? 0) - (a.info?.total ?? 0) || a.name.localeCompare(b.name))

  const scoringCount = rows.filter(r => (r.info?.total ?? 0) > 0).length

  return (
    <div className="space-y-5">
      <AutoRefresh hasLiveMatches={live} />

      <Link href="/resultados" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm transition-colors">
        <ArrowLeft size={14} /> Resultados
      </Link>

      {/* Scoreboard */}
      <div className={`rounded-2xl border p-5 ${live ? 'border-red-700/40 bg-red-950/15' : 'border-white/8 bg-slate-900/50'}`}>
        <div className="flex items-center justify-center gap-3 mb-3">
          {live
            ? <span className="text-xs font-bold text-red-400 animate-pulse">🔴 EN VIVO · {liveLabel(match.live_status!)}</span>
            : finished
            ? <span className="text-xs font-semibold text-slate-500">Final</span>
            : <span className="text-xs text-slate-600">Por jugar</span>}
        </div>
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <div className="flex-1 text-right min-w-0">
            <div className="text-2xl sm:text-3xl">{match.home_flag}</div>
            <div className="text-sm sm:text-base font-semibold text-white truncate">{match.home_team}</div>
          </div>
          <div className="shrink-0 font-mono font-bold text-3xl sm:text-4xl text-white tabular-nums">
            {score ? `${score.home_goals}–${score.away_goals}` : 'vs'}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-2xl sm:text-3xl">{match.away_flag}</div>
            <div className="text-sm sm:text-base font-semibold text-white truncate">{match.away_team}</div>
          </div>
        </div>
        {match.scorers && (
          <div className="mt-3 flex justify-center gap-1 flex-wrap">
            {match.scorers.split(' · ').map((s: string, i: number) => (
              <span key={i} className="text-[11px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full border border-white/5">⚽ {s}</span>
            ))}
          </div>
        )}
      </div>

      {/* Predictions + provisional points */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-sm font-semibold text-white">Pronósticos de todos</h2>
          {live && <span className="text-[11px] text-red-400">puntos si termina así</span>}
        </div>

        {!score && (
          <p className="text-xs text-slate-600 px-1 mb-2">El partido aún no empieza — los puntos se calcularán con el marcador.</p>
        )}

        <div className="rounded-xl border border-white/6 bg-slate-900/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-slate-600 text-xs uppercase tracking-wider">
                <th className="text-left px-3 sm:px-4 py-2.5">Participante</th>
                <th className="text-center px-2 py-2.5">Pronóstico</th>
                <th className="text-right px-3 sm:px-4 py-2.5">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pts = r.info?.total ?? 0
                return (
                  <tr key={i} className={`border-b border-white/4 last:border-0 ${pts > 0 ? 'bg-cyan-950/15' : ''}`}>
                    <td className="px-3 sm:px-4 py-2.5">
                      <span className="text-slate-200 font-medium">{r.name}</span>
                      {r.info && r.info.breakdown.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.info.breakdown.map((b, j) => (
                            <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/30">{b}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="text-center px-2 py-2.5 font-mono text-slate-300">{r.home}–{r.away}</td>
                    <td className={`text-right px-3 sm:px-4 py-2.5 font-mono font-bold ${pts > 0 ? 'text-cyan-400' : 'text-slate-600'}`}>
                      {score ? `+${pts}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {score && (
          <p className="text-xs text-slate-600 mt-2 px-1">{scoringCount} de {rows.length} participantes suman puntos con este marcador.</p>
        )}
      </div>
    </div>
  )
}
