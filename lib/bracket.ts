// Computes group standings and resolves the Round-of-32 bracket slots for the
// 2026 World Cup format (12 groups → top 2 of each + 8 best third-placed teams).

import type { Match } from '@/lib/supabase'

export type TeamRow = {
  team: string
  flag: string
  group: string
  played: number
  W: number; D: number; L: number
  GF: number; GA: number; GD: number
  Pts: number
}

export type GroupTables = Record<string, TeamRow[]>

export function computeGroupTables(matches: Match[]): GroupTables {
  const groups: Record<string, Map<string, TeamRow>> = {}
  const ensure = (g: string, team: string, flag: string) => {
    groups[g] ??= new Map()
    if (!groups[g].has(team)) {
      groups[g].set(team, { team, flag, group: g, played: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 })
    }
    return groups[g].get(team)!
  }

  for (const m of matches) {
    const h = ensure(m.group, m.home_team, m.home_flag)
    const a = ensure(m.group, m.away_team, m.away_flag)
    if (m.home_goals_real === null || m.away_goals_real === null) continue
    const hg = m.home_goals_real, ag = m.away_goals_real
    h.played++; a.played++
    h.GF += hg; h.GA += ag; a.GF += ag; a.GA += hg
    if (hg > ag) { h.W++; a.L++; h.Pts += 3 }
    else if (hg < ag) { a.W++; h.L++; a.Pts += 3 }
    else { h.D++; a.D++; h.Pts++; a.Pts++ }
  }

  const tables: GroupTables = {}
  for (const g of Object.keys(groups)) {
    const rows = [...groups[g].values()]
    rows.forEach(r => { r.GD = r.GF - r.GA })
    rows.sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || x.team.localeCompare(y.team))
    tables[g] = rows
  }
  return tables
}

export function groupComplete(rows: TeamRow[] | undefined): boolean {
  return !!rows && rows.length > 0 && rows.every(r => r.played >= 3)
}

// Ranked list of all 3rd-placed teams (best first).
export function rankThirds(tables: GroupTables): TeamRow[] {
  const thirds = Object.values(tables).map(rows => rows[2]).filter(Boolean) as TeamRow[]
  thirds.sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || x.team.localeCompare(y.team))
  return thirds
}

export type Slot = {
  code: string                 // e.g. '1E', '2B', '3ABCDF'
  label: string                // human label, e.g. '1° E' or '3° (A/B/C/D/F)'
  team?: TeamRow               // resolved team (provisional or confirmed)
  confirmed: boolean           // true once the source group(s) finished
}

export type R32Match = { left: Slot; right: Slot }

// Round-of-32 pairings (official 2026 bracket layout).
const LEFT_CODES: [string, string][] = [
  ['1E', '3ABCDF'], ['1I', '3CDFGH'], ['2A', '2B'], ['1F', '2C'],
  ['2K', '2L'], ['1H', '2J'], ['1D', '3BEFIJ'], ['1G', '3AEHIJ'],
]
const RIGHT_CODES: [string, string][] = [
  ['1C', '2F'], ['2E', '2I'], ['1A', '3CEFHI'], ['1L', '3EHIJK'],
  ['1J', '2H'], ['2D', '2G'], ['1B', '3EFGIJ'], ['1K', '3DEIJL'],
]

// Manual overrides for teams that have mathematically clinched a position
// before their group formally ends. Format: 'group:pos' (pos 1 = winner, 2 = runner-up).
// Example: '1A' = group A winner is locked. Edit as more teams clinch.
const CLINCHED = new Set<string>([
  '1A', // México
  '1D', // EE.UU.
  '1E', // Alemania
  '1J', // Argentina
])

function resolveWinnerRunnerUp(code: string, tables: GroupTables): Slot {
  const pos = code[0] === '1' ? 0 : 1
  const group = code.slice(1)
  const rows = tables[group]
  const confirmed = groupComplete(rows) || CLINCHED.has(code)
  return {
    code,
    label: `${pos === 0 ? '1°' : '2°'} Grupo ${group}`,
    // Only show a team once it's officially decided (group finished or clinched). No provisionals.
    team: confirmed ? rows?.[pos] : undefined,
    confirmed,
  }
}

// Greedily assign the best-ranked qualified thirds to the third-slots,
// respecting each slot's eligible group set (shown in the bracket).
function buildThirdSlots(tables: GroupTables): Record<string, Slot> {
  const ranked = rankThirds(tables)
  const qualified = ranked.slice(0, 8)            // best 8 advance
  const thirdCodes = [...LEFT_CODES, ...RIGHT_CODES].map(p => p[1]).filter(c => c[0] === '3')
  const allGroupsDone = Object.values(tables).every(groupComplete)

  const used = new Set<string>()
  const slots: Record<string, Slot> = {}
  for (const code of thirdCodes) {
    const eligible = code.slice(1).split('')      // e.g. 'ABCDF'
    const pick = qualified.find(t => eligible.includes(t.group) && !used.has(t.team))
    if (pick) used.add(pick.team)
    slots[code] = {
      code,
      label: '3° mejor',
      // Thirds are only official once every group has finished.
      team: allGroupsDone ? pick : undefined,
      confirmed: allGroupsDone,
    }
  }
  return slots
}

export function buildBracket(matches: Match[]): { left: R32Match[]; right: R32Match[]; tables: GroupTables; thirds: TeamRow[] } {
  const tables = computeGroupTables(matches)
  const thirdSlots = buildThirdSlots(tables)

  const resolve = (code: string): Slot =>
    code[0] === '3' ? thirdSlots[code] : resolveWinnerRunnerUp(code, tables)

  const toMatches = (codes: [string, string][]): R32Match[] =>
    codes.map(([l, r]) => ({ left: resolve(l), right: resolve(r) }))

  return {
    left: toMatches(LEFT_CODES),
    right: toMatches(RIGHT_CODES),
    tables,
    thirds: rankThirds(tables),
  }
}
