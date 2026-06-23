'use client'

import type { Match } from '@/lib/supabase'
import Link from 'next/link'

function MatchCard({ match }: { match: Match }) {
  const played = match.home_goals_real !== null && match.away_goals_real !== null
  const live = match.is_locked && !played
  const hasLiveScore = live && match.live_status != null

  return (
    <Link href={`/partido/${match.id}`} className={`block rounded-xl border p-3 sm:p-4 transition-colors cursor-pointer ${
      live
        ? 'border-red-500/40 bg-red-950/20 hover:bg-red-950/30'
        : played
        ? 'border-green-500/25 bg-green-950/10 hover:bg-green-950/20'
        : 'border-white/6 bg-slate-900/60 hover:bg-slate-900/80'
    }`}>
      {live && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-2 h-2 rounded-full bg-red-500 pulse-soft" />
          <span className="text-red-400 text-xs font-semibold uppercase tracking-wide">
            En vivo{hasLiveScore && match.live_status !== 'En vivo' ? ` · ${match.live_status}` : ''}
          </span>
        </div>
      )}
      {played && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-green-500 text-xs font-semibold">FT</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Home */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-lg shrink-0">{match.home_flag}</span>
          <span className="text-xs sm:text-sm font-medium text-slate-200 truncate">{match.home_team}</span>
        </div>

        {/* Score */}
        <div className="shrink-0 px-2">
          {played ? (
            <span className="font-bold text-white text-sm sm:text-base font-mono">
              {match.home_goals_real} – {match.away_goals_real}
            </span>
          ) : hasLiveScore ? (
            <span className="font-bold text-red-300 text-sm sm:text-base font-mono animate-pulse">
              {match.live_home ?? 0} – {match.live_away ?? 0}
            </span>
          ) : (
            <span className="text-slate-600 text-xs">vs</span>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 justify-end">
          <span className="text-xs sm:text-sm font-medium text-slate-200 truncate text-right">{match.away_team}</span>
          <span className="text-lg shrink-0">{match.away_flag}</span>
        </div>
      </div>

      <div className="mt-2 text-xs text-slate-600 text-center">Grupo {match.group} · ver pronósticos</div>
    </Link>
  )
}

export default function TodayMatches({
  todayMatches,
  tomorrowMatches,
}: {
  todayMatches: Match[]
  tomorrowMatches: Match[]
}) {
  if (todayMatches.length === 0 && tomorrowMatches.length === 0) return null

  return (
    <div className="space-y-4">
      {todayMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Hoy</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {todayMatches.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </div>
      )}

      {tomorrowMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Mañana</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tomorrowMatches.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </div>
      )}
    </div>
  )
}
