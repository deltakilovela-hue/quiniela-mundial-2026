'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcStandings } from '@/lib/scoring'
import Link from 'next/link'

type Standing = {
  id: string
  name: string
  points: number
  exact: number
  correct: number
}

type Match = { id: string; home_goals_real: number | null; away_goals_real: number | null }
type Prediction = { participant_id: string; match_id: string; home_goals: number; away_goals: number }
type Participant = { id: string; name: string }

export default function RealtimeStandings({
  initialStandings,
  initialPlayed,
}: {
  initialStandings: Standing[]
  initialPlayed: number
}) {
  const [standings, setStandings] = useState(initialStandings)
  const [played, setPlayed] = useState(initialPlayed)
  const [flash, setFlash] = useState(false)

  async function refresh() {
    const [{ data: participants }, { data: matches }, { data: predictions }] = await Promise.all([
      supabase.from('participants').select('id, name'),
      supabase.from('matches').select('id, home_goals_real, away_goals_real'),
      supabase.from('predictions').select('participant_id, match_id, home_goals, away_goals'),
    ])
    const newStandings = calcStandings(
      (participants as Participant[]) ?? [],
      (matches as Match[]) ?? [],
      (predictions as Prediction[]) ?? []
    )
    setStandings(newStandings)
    setPlayed((matches ?? []).filter((m: Match) => m.home_goals_real !== null).length)
    setFlash(true)
    setTimeout(() => setFlash(false), 1500)
  }

  useEffect(() => {
    const channel = supabase
      .channel('standings-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => {
        refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const prizes = ['$7,500', '$4,000', '$2,500']

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-slate-400 text-xs sm:text-sm">
          <span className={`transition-colors ${flash ? 'text-teal-400' : ''}`}>
            {played}/72 jugados
          </span>{' '}
          · 28 participantes
        </p>
        <span className={`text-xs px-2 py-1 rounded-full border transition-colors shrink-0 ${
          flash ? 'border-teal-500 text-teal-400' : 'border-slate-700 text-slate-600'
        }`}>
          {flash ? '⚡ Actualizado' : '● En vivo'}
        </span>
      </div>

      <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
              <th className="text-left px-2 sm:px-4 py-3 w-8 sm:w-10">#</th>
              <th className="text-left px-2 sm:px-4 py-3">Participante</th>
              <th className="text-center px-2 py-3 hidden sm:table-cell">Exactos</th>
              <th className="text-center px-2 py-3 hidden sm:table-cell">Correctos</th>
              <th className="text-right px-2 sm:px-4 py-3">Pts</th>
              <th className="text-right px-2 sm:px-4 py-3 hidden sm:table-cell">Premio</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((p, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
              const isTop3 = i < 3
              return (
                <tr
                  key={p.id}
                  className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${isTop3 ? 'bg-slate-700/20' : ''}`}
                >
                  <td className="px-2 sm:px-4 py-2.5 text-slate-500 font-mono text-xs text-center">{medal ?? i + 1}</td>
                  <td className="px-2 sm:px-4 py-2.5">
                    <Link
                      href={`/participante/${p.id}`}
                      className={`font-medium hover:text-teal-400 transition-colors text-sm ${isTop3 ? 'text-white' : 'text-slate-200'}`}
                    >
                      {p.name}
                    </Link>
                    {/* Show exactos/correctos inline on mobile */}
                    <span className="sm:hidden text-xs text-slate-500 ml-2">
                      🎯{p.exact} ✓{p.correct}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-center text-slate-400 hidden sm:table-cell">{p.exact}</td>
                  <td className="px-2 py-2.5 text-center text-slate-400 hidden sm:table-cell">{p.correct}</td>
                  <td className="px-2 sm:px-4 py-2.5 text-right font-bold font-mono text-base sm:text-lg text-teal-400">{p.points}</td>
                  <td className="px-2 sm:px-4 py-2.5 text-right text-green-400 font-semibold text-sm hidden sm:table-cell">
                    {prizes[i] ?? ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
