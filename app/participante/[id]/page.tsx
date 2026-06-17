import { supabase } from '@/lib/supabase'
import { calcMatchScore } from '@/lib/scoring'
import { notFound } from 'next/navigation'
import PredictionGrid from './PredictionGrid'

export const revalidate = 30

export default async function ParticipantePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ pin?: string }>
}) {
  const { id } = await params
  const { pin } = await searchParams

  const [{ data: participant }, { data: matches }, { data: allPredictions }] = await Promise.all([
    supabase.from('participants').select('id, name').eq('id', id).single(),
    supabase.from('matches').select('*').order('match_date'),
    supabase.from('predictions').select('participant_id, match_id, home_goals, away_goals'),
  ])

  if (!participant) notFound()

  const myPredictions = (allPredictions ?? []).filter((p) => p.participant_id === id)

  // Calculate total points
  let totalPoints = 0
  for (const match of matches ?? []) {
    if (match.home_goals_real === null || match.away_goals_real === null) continue
    const myPred = myPredictions.find((p) => p.match_id === match.id)
    if (!myPred) continue
    const matchPreds = (allPredictions ?? []).filter((p) => p.match_id === match.id)
    const { total } = calcMatchScore(myPred, match, matchPreds)
    totalPoints += total
  }

  const predMap = Object.fromEntries(myPredictions.map((p) => [p.match_id, p]))

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{participant.name}</h1>
          <p className="text-slate-400 text-sm mt-1">Mis pronósticos · Mundial 2026</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-teal-400 font-mono">{totalPoints}</div>
          <div className="text-slate-400 text-xs">puntos totales</div>
        </div>
      </div>

      <PredictionGrid
        participantId={id}
        participantName={participant.name}
        pin={pin ?? ''}
        matches={matches ?? []}
        predMap={predMap}
        allPredictions={allPredictions ?? []}
      />
    </div>
  )
}
