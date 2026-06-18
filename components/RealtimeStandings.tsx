'use client'

import { useEffect, useState } from 'react'
import { supabase, fetchAllPredictions } from '@/lib/supabase'
import { calcStandings, calcPrizes } from '@/lib/scoring'
import Link from 'next/link'
import { Zap } from 'lucide-react'

type Standing = { id: string; name: string; points: number; exact: number; correct: number }
type Match = { id: string; home_goals_real: number | null; away_goals_real: number | null }
type Prediction = { participant_id: string; match_id: string; home_goals: number; away_goals: number }
type Participant = { id: string; name: string }

function formatMoney(n: number): string {
  return '$' + n.toLocaleString('es-MX', { maximumFractionDigits: 2 })
}

const MEDAL_COLORS = [
  'from-yellow-500/20 border-yellow-500/30',
  'from-slate-400/15 border-slate-400/20',
  'from-amber-700/15 border-amber-700/20',
]
const MEDAL_TEXT = ['text-yellow-400', 'text-slate-300', 'text-amber-600']
const MEDALS = ['🥇', '🥈', '🥉']

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
    const [{ data: participants }, { data: matches }, predictions] = await Promise.all([
      supabase.from('participants').select('id, name'),
      supabase.from('matches').select('id, home_goals_real, away_goals_real'),
      fetchAllPredictions(),
    ])
    setStandings(calcStandings(
      (participants as Participant[]) ?? [],
      (matches as Match[]) ?? [],
      predictions as Prediction[]
    ))
    setPlayed((matches ?? []).filter((m: Match) => m.home_goals_real !== null).length)
    setFlash(true)
    setTimeout(() => setFlash(false), 1500)
  }

  useEffect(() => {
    const ch = supabase.channel('standings-rt')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const top3 = standings.slice(0, 3)
  const rest  = standings.slice(3)
  const prizes = calcPrizes(standings)
  const hasTie = Array.from(prizes.values()).some(p => p.tiedWith > 1)

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Clasificación</h2>
        <div className="flex items-center gap-2">
          <span className="text-slate-600 text-xs">{played}/72 jugados</span>
          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all ${
            flash
              ? 'border-cyan-500/60 text-cyan-400 bg-cyan-950/40'
              : 'border-white/8 text-slate-600'
          }`}>
            <Zap size={10} />
            {flash ? 'Actualizado' : 'En vivo'}
          </span>
        </div>
      </div>

      {/* Top 3 podium cards */}
      <div className="grid grid-cols-3 gap-2">
        {top3.map((p, i) => {
          const prize = prizes.get(p.id)
          return (
            <Link
              key={p.id}
              href={`/participante/${p.id}`}
              className={`rounded-xl border bg-gradient-to-b ${MEDAL_COLORS[i]} to-transparent p-3 sm:p-4 text-center cursor-pointer hover:scale-[1.02] transition-transform`}
            >
              <div className="text-xl sm:text-2xl mb-1">{MEDALS[i]}</div>
              <div className="text-xs sm:text-sm font-semibold text-white truncate">{p.name}</div>
              <div className={`text-xl sm:text-2xl font-bold font-mono mt-1 text-glow-teal ${MEDAL_TEXT[i]}`}>
                {p.points}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">pts</div>
              <div className={`text-xs font-semibold mt-2 ${MEDAL_TEXT[i]}`}>
                {prize ? formatMoney(prize.amount) : '—'}
              </div>
              {prize && prize.tiedWith > 1 && (
                <div className="text-[10px] text-slate-500 mt-0.5">empate ×{prize.tiedWith}</div>
              )}
            </Link>
          )
        })}
      </div>

      {/* Tie rule notice (shown when a prize position is currently tied) */}
      {hasTie && (
        <div className="rounded-xl border border-yellow-700/30 bg-yellow-950/20 p-3 text-xs text-yellow-200/80 flex items-start gap-2">
          <span className="shrink-0">⚖️</span>
          <span>
            <strong className="text-yellow-300">Empate en premios:</strong> cuando 2 o más participantes
            empatan en puntos, los premios de esos lugares se suman y se reparten en partes iguales.
            Los montos de arriba ya reflejan el reparto.
          </span>
        </div>
      )}

      {/* Rest of standings */}
      <div className="rounded-xl border border-white/6 bg-slate-900/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-600 text-xs uppercase tracking-wider">
              <th className="text-left px-3 sm:px-4 py-2.5 w-8">#</th>
              <th className="text-left px-3 sm:px-4 py-2.5">Participante</th>
              <th className="text-center px-2 py-2.5 hidden sm:table-cell">🎯</th>
              <th className="text-center px-2 py-2.5 hidden sm:table-cell">✓</th>
              <th className="text-right px-3 sm:px-4 py-2.5">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rest.map((p, i) => (
              <tr key={p.id} className="border-b border-white/4 hover:bg-white/3 transition-colors">
                <td className="px-3 sm:px-4 py-2.5 text-slate-600 text-xs font-mono">{i + 4}</td>
                <td className="px-3 sm:px-4 py-2.5">
                  <Link href={`/participante/${p.id}`} className="text-slate-300 hover:text-white transition-colors text-sm font-medium cursor-pointer">
                    {p.name}
                  </Link>
                  <span className="sm:hidden text-xs text-slate-600 ml-2">🎯{p.exact} ✓{p.correct}</span>
                </td>
                <td className="px-2 py-2.5 text-center text-slate-500 text-xs hidden sm:table-cell">{p.exact}</td>
                <td className="px-2 py-2.5 text-center text-slate-500 text-xs hidden sm:table-cell">{p.correct}</td>
                <td className="px-3 sm:px-4 py-2.5 text-right font-bold font-mono text-cyan-400">{p.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
