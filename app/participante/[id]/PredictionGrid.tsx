'use client'

import { useState } from 'react'
import { calcMatchScore } from '@/lib/scoring'
import type { Match, Prediction } from '@/lib/supabase'

type PredEntry = { home_goals: number; away_goals: number }

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
  })
}

export default function PredictionGrid({
  participantId,
  participantName,
  pin,
  matches,
  predMap,
  allPredictions,
}: {
  participantId: string
  participantName: string
  pin: string
  matches: Match[]
  predMap: Record<string, PredEntry>
  allPredictions: Omit<Prediction, 'id'>[]
}) {
  const [preds, setPreds] = useState<Record<string, PredEntry>>(predMap)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  function isLocked(match: Match) {
    return match.is_locked || new Date(match.match_date) <= new Date()
  }

  async function savePrediction(matchId: string) {
    const pred = preds[matchId]
    if (!pred) return
    setSaving(matchId)
    setErrors((e) => ({ ...e, [matchId]: '' }))

    const res = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: participantId,
        match_id: matchId,
        home_goals: pred.home_goals,
        away_goals: pred.away_goals,
        pin,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setErrors((e) => ({ ...e, [matchId]: data.error ?? 'Error' }))
    } else {
      setSaved((s) => ({ ...s, [matchId]: true }))
      setTimeout(() => setSaved((s) => ({ ...s, [matchId]: false })), 2000)
    }
    setSaving(null)
  }

  function updatePred(matchId: string, field: 'home_goals' | 'away_goals', value: string) {
    const num = parseInt(value)
    if (isNaN(num) || num < 0 || num > 20) return
    setPreds((p) => ({
      ...p,
      [matchId]: { ...(p[matchId] ?? { home_goals: 0, away_goals: 0 }), [field]: num },
    }))
    setSaved((s) => ({ ...s, [matchId]: false }))
  }

  function getScoreInfo(match: Match) {
    if (match.home_goals_real === null || match.away_goals_real === null) return null
    const myPred = preds[match.id]
    if (!myPred) return null
    const matchPreds = allPredictions.filter((p) => p.match_id === match.id)
    return calcMatchScore(myPred, { home_goals: match.home_goals_real!, away_goals: match.away_goals_real! }, matchPreds)
  }

  return (
    <div className="space-y-4">
      {!pin && (
        <div className="p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg text-yellow-300 text-sm">
          ⚠️ Vista de solo lectura. Para editar pronósticos, ingresa desde <a href="/participante" className="underline">Mi Quiniela</a> con tu PIN.
        </div>
      )}

      {groups.map((group) => {
        const groupMatches = matches.filter((m) => m.group === group)
        if (!groupMatches.length) return null
        return (
          <div key={group} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-2 bg-slate-700/50 border-b border-slate-700">
              <span className="font-bold text-slate-200 text-sm">Grupo {group}</span>
            </div>

            {groupMatches.map((match) => {
              const locked = isLocked(match)
              const pred = preds[match.id]
              const scoreInfo = getScoreInfo(match)
              const played = match.home_goals_real !== null && match.away_goals_real !== null

              return (
                <div key={match.id} className="border-b border-slate-700/50 last:border-0 px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-slate-500 text-xs font-mono w-6">{match.id}</span>
                    <span className="text-xs text-slate-500">{formatDate(match.match_date)}</span>
                    {locked && !played && <span className="text-xs text-red-400">🔒 Iniciado</span>}
                    {played && scoreInfo && (
                      <span className={`ml-auto text-sm font-bold font-mono ${scoreInfo.total > 0 ? 'text-teal-400' : 'text-slate-500'}`}>
                        +{scoreInfo.total} pts
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Home team */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-lg shrink-0">{match.home_flag}</span>
                      <span className="text-sm text-slate-200 truncate">{match.home_team}</span>
                    </div>

                    {/* Score inputs */}
                    <div className="flex items-center gap-1 shrink-0">
                      {locked || !pin ? (
                        <div className="flex items-center gap-1 font-mono font-bold">
                          <span className={`px-2 py-1 rounded text-sm ${played ? 'text-white' : 'text-slate-400'} bg-slate-700`}>
                            {pred?.home_goals ?? '–'}
                          </span>
                          <span className="text-slate-500">–</span>
                          <span className={`px-2 py-1 rounded text-sm ${played ? 'text-white' : 'text-slate-400'} bg-slate-700`}>
                            {pred?.away_goals ?? '–'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={pred?.home_goals ?? ''}
                            onChange={(e) => updatePred(match.id, 'home_goals', e.target.value)}
                            className="w-10 text-center py-1 bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm focus:outline-none focus:border-teal-500"
                          />
                          <span className="text-slate-500">–</span>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={pred?.away_goals ?? ''}
                            onChange={(e) => updatePred(match.id, 'away_goals', e.target.value)}
                            className="w-10 text-center py-1 bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm focus:outline-none focus:border-teal-500"
                          />
                          <button
                            onClick={() => savePrediction(match.id)}
                            disabled={saving === match.id || pred === undefined}
                            className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                              saved[match.id]
                                ? 'bg-green-700 text-green-100'
                                : 'bg-teal-700 hover:bg-teal-600 text-white disabled:opacity-40'
                            }`}
                          >
                            {saved[match.id] ? '✓' : saving === match.id ? '...' : 'Guardar'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Away team */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                      <span className="text-sm text-slate-200 truncate text-right">{match.away_team}</span>
                      <span className="text-lg shrink-0">{match.away_flag}</span>
                    </div>
                  </div>

                  {/* Real result row */}
                  {played && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>Resultado real:</span>
                      <span className="font-mono font-bold text-white bg-teal-700 px-2 py-0.5 rounded">
                        {match.home_goals_real} – {match.away_goals_real}
                      </span>
                      {scoreInfo && scoreInfo.breakdown.length > 0 && (
                        <span className="text-teal-400">{scoreInfo.breakdown.join(' · ')}</span>
                      )}
                      {scoreInfo && scoreInfo.total === 0 && (
                        <span className="text-slate-600">Sin puntos</span>
                      )}
                    </div>
                  )}

                  {errors[match.id] && (
                    <p className="text-red-400 text-xs mt-1">{errors[match.id]}</p>
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
