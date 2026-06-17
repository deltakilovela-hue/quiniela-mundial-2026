import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import path from 'path'

const EXCEL_PATH = path.join('C:\\Users\\Usuario\\Downloads', 'Quiniela_Completa_2026_Calculadora.xlsx')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const wb = XLSX.readFile(EXCEL_PATH)
  const ws = wb.Sheets['Quiniela']
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 }) as (string | number)[][]

  const { data: matches } = await supabase.from('matches').select('id, home_team, away_team')
  const matchMap = new Map<string, string>()
  for (const m of matches ?? []) {
    matchMap.set(`${m.home_team.trim()}|${m.away_team.trim()}`, m.id)
  }

  let updated = 0
  for (let i = 3; i < 75; i++) {
    const row = raw[i]
    if (!row) continue
    const home = row[2] != null ? String(row[2]).trim() : ''
    const away = row[3] != null ? String(row[3]).trim() : ''
    const h = row[4]
    const a = row[5]
    if (!home || !away || h == null || h === '' || a == null || a === '') continue
    if (isNaN(Number(h)) || isNaN(Number(a))) continue

    const matchId = matchMap.get(`${home}|${away}`)
    if (!matchId) { console.warn(`No match found: "${home}" vs "${away}"`); continue }

    const { error } = await supabase
      .from('matches')
      .update({ home_goals_real: Number(h), away_goals_real: Number(a), is_locked: true })
      .eq('id', matchId)
    if (error) console.error(`Error ${matchId}:`, error.message)
    else { console.log(`✓ ${matchId}: ${home} ${h}-${a} ${away}`); updated++ }
  }
  console.log(`\n✓ ${updated} results imported`)
}

main().catch(console.error)
