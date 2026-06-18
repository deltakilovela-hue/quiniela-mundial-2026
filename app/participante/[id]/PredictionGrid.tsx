'use client'

import { useState } from 'react'
import { calcMatchScore } from '@/lib/scoring'
import type { Match, Prediction } from '@/lib/supabase'
import { Save, Check } from 'lucide-react'

type PredEntry = { home_goals: number; away_goals: number }

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']

export default function PredictionGrid({
  participantId, matches, predMap, allPredictions,
}: {
  participantId: string
  participantName: string
  pin?: string
  matches: Match[]
  predMap: Record<string, PredEntry>
  allPredictions: Omit<Prediction, 'id'>[]
}) {
  const [preds, setPreds] = useState<Record<string, PredEntry>>(predMap)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  function isLocked(match: Match) {
    return match.is_locked || new Date(match.match_date) <= new Date()
  }

  function updatePred(matchId: string, field: 'home_goals' | 'away_goals', value: string) {
    const num = parseInt(value)
    if (isNaN(num) || num < 0 || num > 20) return
    setPreds(p => ({ ...p, [matchId]: { ...(p[matchId] ?? { home_goals: 0, away_goals: 0 }), [field]: num } }))
    setSaved(s => ({ ...s, [matchId]: false }))
  }

  async function savePrediction(matchId: string) {
    const pred = preds[matchId]
    if (!pred) return
    setSaving(matchId)
    setErrors(e => ({ ...e, [matchId]: '' }))
    const res = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: participantId, match_id: matchId, home_goals: pred.home_goals, away_goals: pred.away_goals }),
    })
    const data = await res.json()
    if (!res.ok) {
      setErrors(e => ({ ...e, [matchId]: data.error ?? 'Error' }))
    } else {
      setSaved(s => ({ ...s, [matchId]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [matchId]: false })), 2000)
    }
    setSaving(null)
  }

  function getScoreInfo(match: Match) {
    if (match.home_goals_real === null || match.away_goals_real === null) return null
    const myPred = preds[match.id]
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
              const locked = isLocked(match)
              const pred = preds[match.id]
              const scoreInfo = getScoreInfo(match)
              const played = match.home_goals_real !== null && match.away_goals_real !== null

              return (
                <div key={match.id} className="border-b border-white/4 last:border-0 px-3 sm:px-4 py-3">
                  {/* Top info row */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-slate-700 text-xs font-mono">{match.id}</span>
                    {locked && !played && <span className="text-xs text-red-500/80">🔒 Bloqueado</span>}
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

                    {/* Score inputs */}
                    <div className="shrink-0">
                      {locked ? (
                        <div className="flex items-center gap-1 font-mono font-bold">
                          <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                            played ? 'bg-slate-700 text-white' : 'bg-slate-800/60 text-slate-500'
                          }`}>
                            {pred?.home_goals ?? '–'}
                          </span>
                          <span className="text-slate-700 text-xs">–</span>
                          <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                            played ? 'bg-slate-700 text-white' : 'bg-slate-800/60 text-slate-500'
                          }`}>
                            {pred?.away_goals ?? '–'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="number" inputMode="numeric" min={0} max={20}
                            value={pred?.home_goals ?? ''}
                            onChange={e => updatePred(match.id, 'home_goals', e.target.value)}
                            className="w-10 h-10 text-center bg-slate-800/80 border border-white/10 rounded-lg text-white font-mono text-base focus:outline-none focus:border-cyan-500/60 transition-colors"
                          />
                          <span className="text-slate-700 text-xs">–</span>
                          <input
                            type="number" inputMode="numeric" min={0} max={20}
                            value={pred?.away_goals ?? ''}
                            onChange={e => updatePred(match.id, 'away_goals', e.target.value)}
                            className="w-10 h-10 text-center bg-slate-800/80 border border-white/10 rounded-lg text-white font-mono text-base focus:outline-none focus:border-cyan-500/60 transition-colors"
                          />
                          <button
                            onClick={() => savePrediction(match.id)}
                            disabled={saving === match.id || pred === undefined}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                              saved[match.id]
                                ? 'bg-green-700/60 border border-green-600/40 text-green-300'
                                : 'bg-cyan-700/50 hover:bg-cyan-600/60 border border-cyan-600/30 text-cyan-300 disabled:opacity-30'
                            }`}
                          >
                            {saved[match.id] ? <Check size={16} /> : saving === match.id ? <span className="text-xs animate-spin">⟳</span> : <Save size={15} />}
                          </button>
                        </div>
                      )}
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
                  {played && scoreInfo && scoreInfo.total === 0 && (
                    <p className="text-xs text-slate-700 mt-1.5">Sin puntos en este partido</p>
                  )}
                  {errors[match.id] && <p className="text-red-400 text-xs mt-1.5">{errors[match.id]}</p>}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
