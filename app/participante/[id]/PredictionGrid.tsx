'use client'

import { calcMatchScore } from '@/lib/scoring'
import type { Match, Prediction } from '@/lib/supabase'

type PredEntry = { home_goals: number; away_goals: number }

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']

export default function PredictionGrid({
  matches, predMap, allPredictions,
}: {
  participantId: string
  participantName: string
  matches: Match[]
  predMap: Record<string, PredEntry>
  allPredictions: Omit<Prediction, 'id'>[]
}) {
  function getScoreInfo(match: Match) {
    if (match.home_goals_real === null || match.away_goals_real === null) return null
    const myPred = predMap[match.id]
    if (!myPred) return null
    const matchPreds = allPredictions.filter(p => p.match_id === match.id)
    return calcMatchScore(myPred, { home_goals: match.home_goals_real!, away_goals: match.away_goals_real! }, matchPreds)
  }

  return (
    <div className="space-y-4">
      {GROUPS.map(group => {
        const groupMatches = matches.filter(m => m.group === group)
        if (!groupMatches.length) return null
        return (
          <div key={group} className="rounded-xl border border-white/6 bg-slate-900/40 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/5 bg-slate-900/60 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-cyan-900/50 border border-cyan-700/30 text-cyan-400 font-bold text-xs flex items-center justify-center shrink-0">
                {group}
              </span>
              <span className="text-slate-400 text-xs font-semibold">Grupo {group}</span>
            </div>

            {groupMatches.map(match => {
              const pred = predMap[match.id]
              const scoreInfo = getScoreInfo(match)
              const played = match.home_goals_real !== null && match.away_goals_real !== null
              const locked = match.is_locked && !played

              return (
                <div key={match.id} className="border-b border-white/4 last:border-0 px-3 sm:px-4 py-3">
                  {/* Top info row */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-slate-700 text-xs font-mono">{match.id}</span>
                    {locked && <span className="text-xs text-red-500/80">🔒 Bloqueado</span>}
                    {played && (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-cyan-900/50 text-cyan-300 font-bold font-mono text-xs border border-cyan-700/30">
                        {match.home_goals_real}–{match.away_goals_real}
                      </span>
                    )}
                    {played && scoreInfo && (
                      <span className={`ml-auto text-xs font-bold font-mono ${scoreInfo.total > 0 ? 'text-cyan-400' : 'text-slate-600'}`}>
                        +{scoreInfo.total} pts
                      </span>
                    )}
                  </div>

                  {/* Match row */}
                  <div className="flex items-center gap-2">
                    {/* Home */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-base shrink-0">{match.home_flag}</span>
                      <span className="text-xs sm:text-sm text-slate-200 truncate font-medium">{match.home_team}</span>
                    </div>

                    {/* Prediction display (always read-only) */}
                    <div className="shrink-0 flex items-center gap-1 font-mono font-bold">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                        pred !== undefined
                          ? played ? 'bg-slate-700 text-white' : 'bg-slate-800/80 text-slate-300'
                          : 'bg-slate-800/30 text-slate-700'
                      }`}>
                        {pred !== undefined ? pred.home_goals : '–'}
                      </span>
                      <span className="text-slate-700 text-xs">–</span>
                      <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                        pred !== undefined
                          ? played ? 'bg-slate-700 text-white' : 'bg-slate-800/80 text-slate-300'
                          : 'bg-slate-800/30 text-slate-700'
                      }`}>
                        {pred !== undefined ? pred.away_goals : '–'}
                      </span>
                    </div>

                    {/* Away */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                      <span className="text-xs sm:text-sm text-slate-200 truncate text-right font-medium">{match.away_team}</span>
                      <span className="text-base shrink-0">{match.away_flag}</span>
                    </div>
                  </div>

                  {/* Score breakdown */}
                  {played && scoreInfo && scoreInfo.breakdown.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {scoreInfo.breakdown.map((b, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/30">
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                  {played && pred && scoreInfo && scoreInfo.total === 0 && (
                    <p className="text-xs text-slate-700 mt-1.5">Sin puntos en este partido</p>
                  )}
                  {played && !pred && (
                    <p className="text-xs text-red-900/60 mt-1.5">Sin pronóstico</p>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
