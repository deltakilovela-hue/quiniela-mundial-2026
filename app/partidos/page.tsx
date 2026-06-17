import { supabase } from '@/lib/supabase'
import type { Match } from '@/lib/supabase'

export const revalidate = 60

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
  })
}

function MatchRow({ match, exactCount, correctCount }: {
  match: Match
  exactCount: number
  correctCount: number
}) {
  const played = match.home_goals_real !== null && match.away_goals_real !== null

  return (
    <div className="py-2.5 px-3 sm:px-4 border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
      {/* Teams row */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="text-slate-500 text-xs font-mono w-5 shrink-0">{match.id}</span>

        {/* Home */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-sm shrink-0">{match.home_flag}</span>
          <span className="text-xs sm:text-sm font-medium text-slate-200 truncate">{match.home_team}</span>
        </div>

        {/* Score or vs */}
        <div className="shrink-0">
          {played ? (
            <span className="font-bold text-white px-1.5 py-0.5 bg-teal-600 rounded text-xs font-mono whitespace-nowrap">
              {match.home_goals_real}–{match.away_goals_real}
            </span>
          ) : (
            <span className="text-slate-600 text-xs">vs</span>
          )}
        </div>

        {/* Away */}
        <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
          <span className="text-xs sm:text-sm font-medium text-slate-200 truncate text-right">{match.away_team}</span>
          <span className="text-sm shrink-0">{match.away_flag}</span>
        </div>

        {/* Stats / lock */}
        {played && (
          <div className="text-right text-xs shrink-0 ml-1">
            <div className="text-yellow-400">🎯{exactCount}</div>
            <div className="text-teal-400">✓{correctCount}</div>
          </div>
        )}
        {!played && match.is_locked && (
          <span className="text-xs text-red-400 shrink-0 ml-1">🔒</span>
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

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  function getMatchStats(match: Match) {
    const mp = (predictions ?? []).filter((p) => p.match_id === match.id)
    const exactCount = mp.filter(
      (p) => p.home_goals === match.home_goals_real && p.away_goals === match.away_goals_real
    ).length
    const getResult = (h: number, a: number) => h > a ? 'H' : h < a ? 'A' : 'D'
    const realResult = match.home_goals_real !== null ? getResult(match.home_goals_real!, match.away_goals_real!) : null
    const correctCount = realResult
      ? mp.filter((p) => getResult(p.home_goals, p.away_goals) === realResult).length
      : 0
    return { exactCount, correctCount }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Partidos — Fase de Grupos</h1>

      <div className="space-y-4">
        {groups.map((group) => {
          const groupMatches = (matches ?? []).filter((m) => m.group === group)
          if (groupMatches.length === 0) return null
          return (
            <div key={group} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-2 bg-slate-700/50 border-b border-slate-700">
                <span className="font-bold text-slate-200 text-sm">Grupo {group}</span>
              </div>
              {groupMatches.map((match) => {
                const stats = getMatchStats(match)
                return <MatchRow key={match.id} match={match} {...stats} />
              })}
            </div>
          )
        })}
      </div>

      <p className="text-slate-500 text-xs mt-4 text-center">
        🎯 = marcadores exactos · ✓ = resultados correctos · 🔒 = partido iniciado
      </p>
    </div>
  )
}
