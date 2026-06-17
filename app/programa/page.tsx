import { supabase } from '@/lib/supabase'
import type { Match } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 60

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Mexico_City',
  })
}


function MatchRow({ match }: { match: Match }) {
  const played = match.home_goals_real !== null && match.away_goals_real !== null
  const locked = match.is_locked && !played

  return (
    <div className={`px-3 sm:px-4 py-3 border-b border-white/4 last:border-0 hover:bg-white/3 transition-colors ${
      played ? 'opacity-80' : ''
    }`}>
      <div className="flex items-center gap-2">
        {/* Time / status */}
        <div className="w-12 sm:w-16 shrink-0 text-right">
          {played ? (
            <span className="text-xs font-semibold text-green-500">FT</span>
          ) : locked ? (
            <span className="text-xs text-red-400">🔒</span>
          ) : (
            <span className="text-xs text-slate-600">—</span>
          )}
        </div>

        {/* Home */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 justify-end">
          <span className="text-xs sm:text-sm text-slate-300 font-medium truncate text-right">{match.home_team}</span>
          <span className="text-base shrink-0">{match.home_flag}</span>
        </div>

        {/* Score / vs */}
        <div className="shrink-0 w-12 sm:w-16 text-center">
          {played ? (
            <span className="inline-block px-2 py-0.5 rounded bg-cyan-900/50 text-cyan-300 font-bold font-mono text-sm border border-cyan-700/30">
              {match.home_goals_real}–{match.away_goals_real}
            </span>
          ) : (
            <span className="text-slate-700 text-xs">vs</span>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-base shrink-0">{match.away_flag}</span>
          <span className="text-xs sm:text-sm text-slate-300 font-medium truncate">{match.away_team}</span>
        </div>

        {/* Match ID */}
        <div className="w-6 text-slate-700 text-xs font-mono shrink-0 hidden sm:block">{match.id}</div>
      </div>
    </div>
  )
}

function GroupCard({ group, matches }: { group: string; matches: Match[] }) {
  const played = matches.filter(m => m.home_goals_real !== null).length
  const dates = [...new Set(matches.map(m => m.match_date?.slice(0, 10)))].sort()

  // Get teams in this group
  const teams = new Set<string>()
  matches.forEach(m => { teams.add(m.home_team); teams.add(m.away_team) })

  return (
    <div className="rounded-xl border border-white/6 bg-slate-900/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-cyan-900/50 border border-cyan-700/30 text-cyan-400 font-bold text-sm flex items-center justify-center">
            {group}
          </span>
          <span className="text-slate-400 text-xs hidden sm:inline">
            {[...teams].join(' · ')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {dates.map(d => (
            <span key={d} className="text-slate-600 text-xs hidden sm:inline">
              {d && formatDate(d)}
            </span>
          )).slice(0,1)}
          <span className="text-xs text-slate-600">{played}/{matches.length}</span>
        </div>
      </div>
      {matches.map(m => <MatchRow key={m.id} match={m} />)}
    </div>
  )
}

export default async function ProgramaPage() {
  const { data: matches } = await supabase.from('matches').select('*').order('match_date')

  const played = (matches ?? []).filter(m => m.home_goals_real !== null).length
  const pending = (matches ?? []).length - played

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Programa
          <span className="text-cyan-400"> · Fase de Grupos</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {played} partidos jugados · {pending} pendientes · 12 grupos (A–L)
        </p>
      </div>

      {/* Summary bar */}
      <div className="rounded-xl border border-white/6 bg-slate-900/40 p-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs text-slate-500">Progreso fase de grupos</span>
          <span className="text-xs text-cyan-400 font-mono ml-auto">{played}/72</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all"
            style={{ width: `${(played / 72) * 100}%` }}
          />
        </div>
      </div>

      {/* Group cards */}
      <div className="space-y-4">
        {GROUPS.map(group => {
          const groupMatches = (matches ?? []).filter(m => m.group === group)
          if (!groupMatches.length) return null
          return <GroupCard key={group} group={group} matches={groupMatches} />
        })}
      </div>

      <p className="text-slate-700 text-xs text-center">
        FT = finalizado · 🔒 = en curso (sin pronósticos) · vs = pendiente
      </p>
    </div>
  )
}
