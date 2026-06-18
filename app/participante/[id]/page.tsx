import { supabase } from '@/lib/supabase'
import { calcMatchScore } from '@/lib/scoring'
import { notFound } from 'next/navigation'
import PredictionGrid from './PredictionGrid'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const revalidate = 30

export default async function ParticipantePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [{ data: participant }, { data: matches }, { data: allPredictions }] = await Promise.all([
    supabase.from('participants').select('id, name').eq('id', id).single(),
    supabase.from('matches').select('*').order('match_date'),
    supabase.from('predictions').select('participant_id, match_id, home_goals, away_goals'),
  ])

  if (!participant) notFound()

  const myPredictions = (allPredictions ?? []).filter(p => p.participant_id === id)

  let totalPoints = 0
  let exactCount = 0
  let correctCount = 0

  for (const match of matches ?? []) {
    if (match.home_goals_real === null || match.away_goals_real === null) continue
    const myPred = myPredictions.find(p => p.match_id === match.id)
    if (!myPred) continue
    const matchPreds = (allPredictions ?? []).filter(p => p.match_id === match.id)
    const { total, base } = calcMatchScore(myPred, match, matchPreds)
    totalPoints += total
    if (myPred.home_goals === match.home_goals_real && myPred.away_goals === match.away_goals_real) exactCount++
    if (base >= 2) correctCount++
  }

  const predMap = Object.fromEntries(myPredictions.map(p => [p.match_id, p]))
  const playedMatches = (matches ?? []).filter(m => m.home_goals_real !== null).length

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/participante" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm transition-colors cursor-pointer">
        <ArrowLeft size={14} />
        Participantes
      </Link>

      {/* Header card */}
      <div className="rounded-2xl border border-white/8 bg-slate-900/50 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{participant.name}</h1>
            <p className="text-slate-500 text-sm mt-0.5">Mis pronósticos · Mundial 2026</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl sm:text-4xl font-bold text-cyan-400 font-mono text-glow-teal">
              {totalPoints}
            </div>
            <div className="text-slate-500 text-xs">puntos totales</div>
          </div>
        </div>

        {playedMatches > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Exactos', value: exactCount, color: 'text-yellow-400' },
              { label: 'Correctos', value: correctCount, color: 'text-cyan-400' },
              { label: 'Partidos', value: `${playedMatches}/72`, color: 'text-slate-400' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
                <div className="text-slate-600 text-xs">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PredictionGrid
        participantId={id}
        participantName={participant.name}
        matches={matches ?? []}
        predMap={predMap}
        allPredictions={allPredictions ?? []}
      />
    </div>
  )
}
