import { getServiceClient } from '@/lib/supabase'
import { fetchFixtures, FINISHED_STATUSES, LIVE_STATUSES, type APIFixture } from '@/lib/api-football'

export interface SyncResult {
  updated: number
  locked: number
  errors: string[]
  fixtures_fetched: number
}

// Maps API-Football team names to our team names in seed-data
// Add more mappings as needed when the tournament starts
const TEAM_NAME_MAP: Record<string, string> = {
  'United States': 'Estados Unidos',
  'USA': 'Estados Unidos',
  'Mexico': 'México',
  'Germany': 'Alemania',
  'France': 'Francia',
  'Spain': 'España',
  'Portugal': 'Portugal',
  'Netherlands': 'Países Bajos',
  'Holland': 'Países Bajos',
  'Belgium': 'Bélgica',
  'Croatia': 'Croacia',
  'Italy': 'Italia',
  'England': 'Inglaterra',
  'Brazil': 'Brasil',
  'Argentina': 'Argentina',
  'Japan': 'Japón',
  'South Korea': 'Corea del Sur',
  'Korea Republic': 'Corea del Sur',
  'Morocco': 'Marruecos',
  'Senegal': 'Senegal',
  'Nigeria': 'Nigeria',
  'Colombia': 'Colombia',
  'Uruguay': 'Uruguay',
  'Denmark': 'Dinamarca',
  'Switzerland': 'Suiza',
  'Austria': 'Austria',
  'Serbia': 'Serbia',
  'Sweden': 'Suecia',
  'Scotland': 'Escocia',
  'Saudi Arabia': 'Arabia Saudita',
  'Ecuador': 'Ecuador',
  'Ghana': 'Ghana',
  'Canada': 'Canadá',
  'Tunisia': 'Túnez',
  'Peru': 'Perú',
  'Costa Rica': 'Costa Rica',
  'Romania': 'Rumania',
  'Slovakia': 'Eslovaquia',
  'Australia': 'Australia',
  "Ivory Coast": "Costa de Marfil",
  "Côte d'Ivoire": "Costa de Marfil",
  'Algeria': 'Argelia',
  'Kenya': 'Kenia',
  'Iraq': 'Irak',
  'Cuba': 'Cuba',
  'Guatemala': 'Guatemala',
  'Trinidad and Tobago': 'Trinidad y Tobago',
  'Czech Republic': 'República Checa',
  'Cameroon': 'Camerún',
  'Ireland': 'Irlanda',
}

function normalizeTeamName(name: string): string {
  return TEAM_NAME_MAP[name] ?? name
}

export async function syncResults(): Promise<SyncResult> {
  const result: SyncResult = { updated: 0, locked: 0, errors: [], fixtures_fetched: 0 }
  const supabase = getServiceClient()

  try {
    const fixtures = await fetchFixtures()
    result.fixtures_fetched = fixtures.length

    for (const fixture of fixtures) {
      const status = fixture.fixture.status.short
      const isFinished = FINISHED_STATUSES.includes(status)
      const isLive = LIVE_STATUSES.includes(status)

      // Lock match when it goes live
      if (isLive || isFinished) {
        const homeTeam = normalizeTeamName(fixture.teams.home.name)
        const awayTeam = normalizeTeamName(fixture.teams.away.name)

        // Find matching match in our DB by both team names
        const { data: exactMatches } = await supabase
          .from('matches')
          .select('id, is_locked, home_goals_real')
          .eq('home_team', homeTeam)
          .eq('away_team', awayTeam)

        const match = exactMatches?.[0]
        if (!match) continue

        // Lock if going live and not already locked
        if (isLive && !match.is_locked) {
          await supabase.from('matches').update({ is_locked: true }).eq('id', match.id)
          result.locked++
        }

        // Update result if finished
        if (isFinished) {
          const homeGoals = fixture.score.fulltime.home ?? fixture.goals.home
          const awayGoals = fixture.score.fulltime.away ?? fixture.goals.away

          if (homeGoals === null || awayGoals === null) continue

          // Skip if already stored the same result
          if (match.home_goals_real === homeGoals) continue

          const { error } = await supabase
            .from('matches')
            .update({
              home_goals_real: homeGoals,
              away_goals_real: awayGoals,
              is_locked: true,
            })
            .eq('id', match.id)

          if (error) {
            result.errors.push(`${match.id}: ${error.message}`)
          } else {
            result.updated++
          }
        }
      }
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err))
  }

  // Log sync to DB
  await getServiceClient()
    .from('sync_log')
    .insert({
      fixtures_fetched: result.fixtures_fetched,
      updated: result.updated,
      locked: result.locked,
      errors: result.errors,
    })
    .then(() => {})

  return result
}
