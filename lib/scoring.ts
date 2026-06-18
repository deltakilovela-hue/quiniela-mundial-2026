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

// Prize amounts for 1st, 2nd, 3rd place (MXN)
export const PRIZE_AMOUNTS = [7500, 4000, 2500]
export const PRIZE_TOTAL = PRIZE_AMOUNTS.reduce((s, p) => s + p, 0)

export type PrizeInfo = { amount: number; tiedWith: number; positions: number[] }

// Distributes the 3 prizes across the standings, honoring the tie rule:
// when N participants tie for a set of prize positions, the prizes for the
// positions they occupy are pooled and split equally. With more people tied
// than remaining prize slots, the pool is still just the remaining prizes.
export function calcPrizes(
  standings: { id: string; points: number }[]
): Map<string, PrizeInfo> {
  const result = new Map<string, PrizeInfo>()
  let i = 0
  let slot = 0
  while (i < standings.length && slot < PRIZE_AMOUNTS.length) {
    if (standings[i].points <= 0) break // no points, no prize
    let j = i
    while (j < standings.length && standings[j].points === standings[i].points) j++
    const n = j - i
    const positions: number[] = []
    let pool = 0
    for (let s = slot; s < Math.min(slot + n, PRIZE_AMOUNTS.length); s++) {
      pool += PRIZE_AMOUNTS[s]
      positions.push(s + 1)
    }
    if (pool > 0) {
      const each = pool / n
      for (let k = i; k < j; k++) result.set(standings[k].id, { amount: each, tiedWith: n, positions })
    }
    slot += n
    i = j
  }
  return result
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
