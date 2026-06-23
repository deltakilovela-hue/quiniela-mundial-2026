import { supabase } from '@/lib/supabase'
import type { Match } from '@/lib/supabase'
import AutoRefresh from '@/components/AutoRefresh'
import Link from 'next/link'

export const revalidate = 30

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Regina',
  })
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  // Check if time is a placeholder (midnight UTC = 6pm/7pm MX but unlikely for real kickoffs at exactly 00:00 UTC)
  // We detect placeholder times seeded as T18:00:00+00:00 or T12:00:00
  return d.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Regina',
  })
}

function hasRealTime(dateStr: string): boolean {
  // Placeholder times were set to T18:00:00+00:00 (= noon MX) or similar round hours
  // ESPN gives real times — any non-placeholder will have minutes != :00 or varied hours
  // Simple heuristic: if the UTC time is exactly T18:00:00 or T12:00:00 it's a placeholder
  return !dateStr.includes('T18:00:00') && !dateStr.includes('T12:00:00') && !dateStr.includes('T00:00:00')
}

function winner(m: Match): 'home' | 'away' | 'draw' {
  if (m.home_goals_real! > m.away_goals_real!) return 'home'
  if (m.away_goals_real! > m.home_goals_real!) return 'away'
  return 'draw'
}

function MatchRow({ match: m }: { match: Match }) {
  const played = m.home_goals_real !== null && m.away_goals_real !== null
  const live = m.is_locked && !played
  const hasLiveScore = live && m.live_status != null
  const w = played ? winner(m) : null
  const showTime = hasRealTime(m.match_date)

  return (
    <Link href={`/partido/${m.id}`} className={`block px-3 sm:px-5 py-3.5 border-b border-white/4 last:border-0 transition-colors cursor-pointer ${live ? 'bg-red-950/20 hover:bg-red-950/30' : 'hover:bg-white/4'}`}>

      {/* Date + time row */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="text-xs text-slate-600">{formatDate(m.match_date)}</span>
        {showTime && (
          <>
            <span className="text-slate-800 text-xs">·</span>
            <span className={`text-xs font-medium ${live ? 'text-red-400' : 'text-slate-500'}`}>
              {live ? '🔴 En vivo' : formatTime(m.match_date)}
            </span>
          </>
        )}
        {!showTime && live && (
          <span className="text-xs font-medium text-red-400">🔴 En vivo</span>
        )}
        {!showTime && !live && !played && (
          <span className="text-xs text-slate-700">Hora por confirmar</span>
        )}
      </div>

      {/* Teams + score */}
      <div className="flex items-center gap-2">
        {/* Home */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 justify-end">
          <span className={`text-xs sm:text-sm font-semibold truncate text-right leading-tight ${
            w === 'home' ? 'text-white' : played ? 'text-slate-500' : 'text-slate-300'
          }`}>{m.home_team}</span>
          <span className="text-lg sm:text-xl shrink-0">{m.home_flag}</span>
        </div>

        {/* Score / vs */}
        <div className="shrink-0 flex items-center gap-1.5 w-16 justify-center">
          {played ? (
            <>
              <span className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${w === 'home' ? 'text-white' : 'text-slate-400'}`}>
                {m.home_goals_real}
              </span>
              <span className="text-slate-600 font-mono">–</span>
              <span className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${w === 'away' ? 'text-white' : 'text-slate-400'}`}>
                {m.away_goals_real}
              </span>
            </>
          ) : hasLiveScore ? (
            <>
              <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-red-300 animate-pulse">{m.live_home ?? 0}</span>
              <span className="text-red-700 font-mono">–</span>
              <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-red-300 animate-pulse">{m.live_away ?? 0}</span>
            </>
          ) : live ? (
            <span className="text-red-400 font-bold text-sm animate-pulse">vs</span>
          ) : (
            <span className="text-slate-700 text-xs">vs</span>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-lg sm:text-xl shrink-0">{m.away_flag}</span>
          <span className={`text-xs sm:text-sm font-semibold truncate leading-tight ${
            w === 'away' ? 'text-white' : played ? 'text-slate-500' : 'text-slate-300'
          }`}>{m.away_team}</span>
        </div>
      </div>

      {/* Scorers */}
      {m.scorers && (
        <div className="mt-2 flex justify-center gap-1 flex-wrap px-1">
          {m.scorers.split(' · ').map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full border border-white/5">
              <span className="text-slate-600 text-xs">⚽</span>{s}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}

function GroupCard({ group, matches }: { group: string; matches: Match[] }) {
  const played = matches.filter(m => m.home_goals_real !== null).length
  const total = matches.length
  const totalGoals = matches.reduce((s, m) => s + (m.home_goals_real ?? 0) + (m.away_goals_real ?? 0), 0)
  const hasLive = matches.some(m => m.is_locked && m.home_goals_real === null)

  return (
    <div className="rounded-xl border border-white/6 bg-slate-900/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-cyan-900/50 border border-cyan-700/30 text-cyan-400 font-bold text-sm flex items-center justify-center shrink-0">
            {group}
          </span>
          {hasLive && <span className="text-xs text-red-400 font-medium animate-pulse">● En vivo</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          {totalGoals > 0 && <span>{totalGoals} goles</span>}
          <span>{played}/{total}</span>
        </div>
      </div>
      {matches.map(m => <MatchRow key={m.id} match={m} />)}
    </div>
  )
}

export default async function ResultadosPage() {
  // Fetch ALL matches — played, live, and upcoming (so we show the full picture)
  const { data: allMatches } = await supabase
    .from('matches')
    .select('*')
    .order('match_date')

  const all = allMatches ?? []
  const played = all.filter(m => m.home_goals_real !== null)
  const totalGoals = played.reduce((s, m) => s + (m.home_goals_real ?? 0) + (m.away_goals_real ?? 0), 0)
  const avgGoals = played.length > 0 ? (totalGoals / played.length).toFixed(1) : '—'
  const hasLiveMatches = all.some(m => m.is_locked && m.home_goals_real === null)

  const groupMatches = (g: string) => all.filter(m => m.group === g)

  return (
    <div className="space-y-6">
      <AutoRefresh hasLiveMatches={hasLiveMatches} />

      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Resultados</h1>
        <p className="text-slate-500 text-sm">Fase de grupos · Mundial 2026</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Partidos jugados', value: played.length, sub: `de ${all.length}` },
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

      {/* All groups */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {GROUPS.map(g => {
          const gMatches = groupMatches(g)
          if (gMatches.length === 0) return null
          return <GroupCard key={g} group={g} matches={gMatches} />
        })}
      </div>
    </div>
  )
}
