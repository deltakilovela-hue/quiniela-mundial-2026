export interface Prediction {
  participant_id: string
  home_goals: number
  away_goals: number
}

export interface MatchResult {
  home_goals: number
  away_goals: number
}

function getResult(home: number, away: number): 'home' | 'draw' | 'away' {
  if (home > away) return 'home'
  if (home < away) return 'away'
  return 'draw'
}

export function calcMatchScore(
  pred: { home_goals: number; away_goals: number },
  real: MatchResult,
  allPreds: { home_goals: number; away_goals: number }[]
): { base: number; bonus: number; total: number; breakdown: string[] } {
  const breakdown: string[] = []
  let base = 0
  let bonus = 0

  const predResult = getResult(pred.home_goals, pred.away_goals)
  const realResult = getResult(real.home_goals, real.away_goals)

  const correctResult = predResult === realResult
  const exactScore = pred.home_goals === real.home_goals && pred.away_goals === real.away_goals
  const homeGoalCorrect = pred.home_goals === real.home_goals
  const awayGoalCorrect = pred.away_goals === real.away_goals

  if (correctResult) {
    base += 2
    breakdown.push('+2 resultado correcto')
  } else {
    return { base: 0, bonus: 0, total: 0, breakdown: [] }
  }

  if (exactScore) {
    base += 2
    breakdown.push('+2 marcador exacto')
  } else {
    if (homeGoalCorrect || awayGoalCorrect) {
      base += 1
      breakdown.push('+1 un gol exacto')
    }
  }

  // Bono exacto: ≤5 personas aciertan el marcador exacto
  if (exactScore) {
    const exactCount = allPreds.filter(
      (p) => p.home_goals === real.home_goals && p.away_goals === real.away_goals
    ).length
    if (exactCount <= 5) {
      bonus += 3
      breakdown.push(`+3 bono marcador difícil (${exactCount} personas)`)
    }
  }

  // Bono sorpresa: solo 1 persona acierta el resultado
  const correctCount = allPreds.filter(
    (p) => getResult(p.home_goals, p.away_goals) === realResult
  ).length
  if (correctCount === 1 && correctResult) {
    bonus += 5
    breakdown.push('+5 bono sorpresa (única persona)')
  }

  const total = base + bonus
  return { base, bonus, total, breakdown }
}

export function calcStandings(
  participants: { id: string; name: string }[],
  matches: { id: string; home_goals_real: number | null; away_goals_real: number | null }[],
  predictions: { participant_id: string; match_id: string; home_goals: number; away_goals: number }[]
): { id: string; name: string; points: number; exact: number; correct: number }[] {
  const standings = participants.map((p) => {
    let points = 0
    let exact = 0
    let correct = 0

    for (const match of matches) {
      if (match.home_goals_real === null || match.away_goals_real === null) continue

      const real: MatchResult = {
        home_goals: match.home_goals_real,
        away_goals: match.away_goals_real,
      }

      const matchPreds = predictions.filter((pr) => pr.match_id === match.id)
      const myPred = matchPreds.find((pr) => pr.participant_id === p.id)
      if (!myPred) continue

      const { total } = calcMatchScore(myPred, real, matchPreds)
      points += total

      if (myPred.home_goals === real.home_goals && myPred.away_goals === real.away_goals) exact++
      const predResult = getResult(myPred.home_goals, myPred.away_goals)
      const realResult = getResult(real.home_goals, real.away_goals)
      if (predResult === realResult) correct++
    }

    return { ...p, points, exact, correct }
  })

  return standings.sort((a, b) => b.points - a.points)
}
