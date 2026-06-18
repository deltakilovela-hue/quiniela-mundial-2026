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

  // Scoring matches the official Excel calculator exactly. The three base
  // components are INDEPENDENT and additive (a goal can match even if the
  // overall result is wrong):
  //   +2  correct result (winner or draw)
  //   +1  at least one goal matches exactly (home OR away)
  //   +2  exact score (both goals)
  // Then a single bonus tier applies only when the score is exact, based on
  // how many people (including you) nailed the exact score:
  //   exactCount == 1  → +5  (you were the only one)
  //   exactCount <= 5  → +3  (hard score, few got it)
  const predResult = getResult(pred.home_goals, pred.away_goals)
  const realResult = getResult(real.home_goals, real.away_goals)

  const correctResult = predResult === realResult
  const homeGoalCorrect = pred.home_goals === real.home_goals
  const awayGoalCorrect = pred.away_goals === real.away_goals
  const exactScore = homeGoalCorrect && awayGoalCorrect

  if (correctResult) {
    base += 2
    breakdown.push('+2 resultado correcto')
  }

  if (homeGoalCorrect || awayGoalCorrect) {
    base += 1
    breakdown.push('+1 un gol exacto')
  }

  if (exactScore) {
    base += 2
    breakdown.push('+2 marcador exacto')
  }

  // Bonus tiers apply only on an exact score (mutually exclusive).
  if (exactScore) {
    const exactCount = allPreds.filter(
      (p) => p.home_goals === real.home_goals && p.away_goals === real.away_goals
    ).length
    if (exactCount === 1) {
      bonus += 5
      breakdown.push('+5 bono único (solo tú)')
    } else if (exactCount <= 5) {
      bonus += 3
      breakdown.push(`+3 bono difícil (${exactCount} aciertan)`)
    }
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
