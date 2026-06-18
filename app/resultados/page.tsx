import { supabase } from '@/lib/supabase'
import type { Match } from '@/lib/supabase'

export const revalidate = 60

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Mexico_City',
  })
}

function winner(m: Match): 'home' | 'away' | 'draw' {
  if (m.home_goals_real! > m.away_goals_real!) return 'home'
  if (m.away_goals_real! > m.home_goals_real!) return 'away'
  return 'draw'
}

function MatchResult({ match: m }: { match: Match }) {
  const w = winner(m)
  return (
    <div className="px-3 sm:px-5 py-4 border-b border-white/4 last:border-0 hover:bg-white/2 transition-colors">
      <div className="flex items-center gap-3">

        {/* Home team */}
        <div className="flex-1 min-w-0 flex items-center gap-2 justify-end">
          <span className={`text-xs sm:text-sm font-semibold truncate text-right ${w === 'home' ? 'text-white' : 'text-slate-500'}`}>
            {m.home_team}
          </span>
          <span className="text-lg sm:text-xl shrink-0">{m.home_flag}</span>
        </div>

        {/* Score */}
        <div className="shrink-0 flex items-center gap-1.5">
          <span className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${w === 'home' ? 'text-white' : 'text-slate-400'}`}>
            {m.home_goals_real}
          </span>
          <span className="text-slate-600 text-sm font-mono">–</span>
          <span className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${w === 'away' ? 'text-white' : 'text-slate-400'}`}>
            {m.away_goals_real}
          </span>
        </div>

        {/* Away team */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-lg sm:text-xl shrink-0">{m.away_flag}</span>
          <span className={`text-xs sm:text-sm font-semibold truncate ${w === 'away' ? 'text-white' : 'text-slate-500'}`}>
            {m.away_team}
          </span>
        </div>

      </div>

      {/* Scorers row (shown when data is available) */}
      {(m as Match & { scorers?: string }).scorers && (
        <div className="mt-2 flex justify-center">
          <span className="text-xs text-slate-500 text-center">{(m as Match & { scorers?: string }).scorers}</span>
        </div>
      )}

      {/* Date */}
      <div className="mt-1.5 text-center">
        <span className="text-xs text-slate-700">{formatDate(m.match_date)}</span>
      </div>
    </div>
  )
}

function GroupResults({ group, matches }: { group: string; matches: Match[] }) {
  const played = matches.filter(m => m.home_goals_real !== null)
  if (played.length === 0) return null

  const totalGoals = played.reduce((s, m) => s + m.home_goals_real! + m.away_goals_real!, 0)

  return (
    <div className="rounded-xl border border-white/6 bg-slate-900/40 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-cyan-900/50 border border-cyan-700/30 text-cyan-400 font-bold text-sm flex items-center justify-center">
            {group}
          </span>
          <span className="text-slate-400 text-xs">{played.length} partido{played.length !== 1 ? 's' : ''} jugado{played.length !== 1 ? 's' : ''}</span>
        </div>
        <span className="text-xs text-slate-600">{totalGoals} gol{totalGoals !== 1 ? 'es' : ''}</span>
      </div>
      {played.map(m => <MatchResult key={m.id} match={m} />)}
    </div>
  )
}

export default async function ResultadosPage() {
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .not('home_goals_real', 'is', null)
    .order('match_date')

  const all = matches ?? []
  const totalGoals = all.reduce((s, m) => s + (m.home_goals_real ?? 0) + (m.away_goals_real ?? 0), 0)
  const avgGoals = all.length > 0 ? (totalGoals / all.length).toFixed(1) : '—'

  const groupMatches = (g: string) => all.filter(m => m.group === g)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Resultados</h1>
        <p className="text-slate-500 text-sm">Fase de grupos · Mundial 2026</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Partidos jugados', value: all.length, sub: 'de 72' },
          { label: 'Goles totales', value: totalGoals, sub: 'en la fase de grupos' },
          { label: 'Promedio de goles', value: avgGoals, sub: 'por partido' },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl p-3 sm:p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{s.value}</div>
            <div className="text-xs text-slate-400 mt-0.5 font-medium leading-tight">{s.label}</div>
            <div className="text-xs text-slate-700 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Group results */}
      {all.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <div className="text-4xl mb-3">⏳</div>
          <p>Aún no hay resultados registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {GROUPS.map(g => (
            <GroupResults key={g} group={g} matches={groupMatches(g)} />
          ))}
        </div>
      )}
    </div>
  )
}
