import { supabase } from '@/lib/supabase'
import type { Match } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 60

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']

function getResult(h: number, a: number) { return h > a ? 'H' : h < a ? 'A' : 'D' }

function MatchRow({ match, exactCount, correctCount }: {
  match: Match; exactCount: number; correctCount: number
}) {
  const played = match.home_goals_real !== null && match.away_goals_real !== null
  const locked = match.is_locked && !played

  return (
    <div className="px-3 sm:px-4 py-3 border-b border-white/4 last:border-0 hover:bg-white/3 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-slate-700 font-mono text-xs w-5 shrink-0 hidden sm:block">{match.id}</span>

        {/* Home */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-base shrink-0">{match.home_flag}</span>
          <span className="text-xs sm:text-sm text-slate-200 font-medium truncate">{match.home_team}</span>
        </div>

        {/* Score */}
        <div className="shrink-0">
          {played ? (
            <span className="inline-block px-2 py-0.5 rounded bg-cyan-900/50 text-cyan-300 font-bold font-mono text-sm border border-cyan-700/30">
              {match.home_goals_real}–{match.away_goals_real}
            </span>
          ) : locked ? (
            <span className="text-red-500 text-xs">🔒</span>
          ) : (
            <span className="text-slate-700 text-xs">vs</span>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 justify-end">
          <span className="text-xs sm:text-sm text-slate-200 font-medium truncate text-right">{match.away_team}</span>
          <span className="text-base shrink-0">{match.away_flag}</span>
        </div>

        {/* Stats */}
        {played && (
          <div className="shrink-0 text-right pl-1 space-y-0.5">
            <div className="text-xs text-yellow-500 font-mono">🎯{exactCount}</div>
            <div className="text-xs text-cyan-600 font-mono">✓{correctCount}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default async function PartidosPage() {
  const [{ data: matches }, { data: predictions }] = await Promise.all([
    supabase.from('matches').select('*').order('match_date'),
    supabase.from('predictions').select('match_id, home_goals, away_goals'),
  ])

  const played = (matches ?? []).filter(m => m.home_goals_real !== null).length

  function getStats(match: Match) {
    const mp = (predictions ?? []).filter(p => p.match_id === match.id)
    const exactCount = mp.filter(p =>
      p.home_goals === match.home_goals_real && p.away_goals === match.away_goals_real
    ).length
    const realResult = match.home_goals_real !== null
      ? getResult(match.home_goals_real!, match.away_goals_real!)
      : null
    const correctCount = realResult
      ? mp.filter(p => getResult(p.home_goals, p.away_goals) === realResult).length
      : 0
    return { exactCount, correctCount }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Partidos
          <span className="text-cyan-400"> · Fase de Grupos</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1">{played} de 72 jugados</p>
      </div>

      {/* Quick-nav by group */}
      <div className="flex flex-wrap gap-1.5">
        {GROUPS.map(g => (
          <a
            key={g}
            href={`#grupo-${g}`}
            className="w-8 h-8 rounded-lg border border-white/8 bg-slate-900/60 text-slate-400 hover:text-white hover:border-cyan-500/40 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
          >
            {g}
          </a>
        ))}
      </div>

      <div className="space-y-4">
        {GROUPS.map(group => {
          const gm = (matches ?? []).filter(m => m.group === group)
          if (!gm.length) return null
          return (
            <div id={`grupo-${group}`} key={group} className="rounded-xl border border-white/6 bg-slate-900/40 overflow-hidden scroll-mt-20">
              <div className="px-4 py-2.5 border-b border-white/5 bg-slate-900/60 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-cyan-900/50 border border-cyan-700/30 text-cyan-400 font-bold text-xs flex items-center justify-center">
                  {group}
                </span>
                <span className="text-slate-400 text-xs font-semibold">Grupo {group}</span>
                <span className="ml-auto text-slate-600 text-xs">
                  {gm.filter(m => m.home_goals_real !== null).length}/{gm.length}
                </span>
              </div>
              {gm.map(match => {
                const stats = getStats(match)
                return <MatchRow key={match.id} match={match} {...stats} />
              })}
            </div>
          )
        })}
      </div>

      <p className="text-slate-700 text-xs text-center">
        🎯 marcadores exactos · ✓ resultados correctos
      </p>
    </div>
  )
}
