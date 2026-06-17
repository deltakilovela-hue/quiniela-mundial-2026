/**
 * Run: npx tsx scripts/seed-predictions.ts
 * Reads the Excel file, re-seeds matches with Excel teams, imports all predictions.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import path from 'path'

const EXCEL_PATH = path.join(
  'C:\\Users\\Usuario\\Downloads',
  'Quiniela_Completa_2026_Calculadora.xlsx'
)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Flag emoji map for teams in the Excel
const FLAG_MAP: Record<string, string> = {
  'México': '🇲🇽',
  'Sudáfrica': '🇿🇦',
  'Corea del Sur': '🇰🇷',
  'Rep. Checa': '🇨🇿',
  'República Checa': '🇨🇿',
  'Canadá': '🇨🇦',
  'Bosnia y Herz.': '🇧🇦',
  'Bosnia y Herzegovina': '🇧🇦',
  'Catar': '🇶🇦',
  'Qatar': '🇶🇦',
  'Suiza': '🇨🇭',
  'Brasil': '🇧🇷',
  'Marruecos': '🇲🇦',
  'Haití': '🇭🇹',
  'Haiti': '🇭🇹',
  'Escocia': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'EE.UU.': '🇺🇸',
  'Estados Unidos': '🇺🇸',
  'Australia': '🇦🇺',
  'Turquía': '🇹🇷',
  'Paraguay': '🇵🇾',
  'Alemania': '🇩🇪',
  'Ecuador': '🇪🇨',
  'Costa de Marfil': '🇨🇮',
  'Curazao': '🇨🇼',
  'Japón': '🇯🇵',
  'Países Bajos': '🇳🇱',
  'Suecia': '🇸🇪',
  'Túnez': '🇹🇳',
  'Bélgica': '🇧🇪',
  'Egipto': '🇪🇬',
  'Irán': '🇮🇷',
  'Nueva Zelanda': '🇳🇿',
  'Arabia Saudita': '🇸🇦',
  'Uruguay': '🇺🇾',
  'Cabo Verde': '🇨🇻',
  'España': '🇪🇸',
  'Francia': '🇫🇷',
  'Irak': '🇮🇶',
  'Iraq': '🇮🇶',
  'Noruega': '🇳🇴',
  'Senegal': '🇸🇳',
  'Argelia': '🇩🇿',
  'Austria': '🇦🇹',
  'Jordania': '🇯🇴',
  'Argentina': '🇦🇷',
  'Colombia': '🇨🇴',
  'Portugal': '🇵🇹',
  'Congo RD': '🇨🇩',
  'Uzbekistán': '🇺🇿',
  'Croacia': '🇭🇷',
  'Ghana': '🇬🇭',
  'Panamá': '🇵🇦',
  'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
}

function getFlag(team: string): string {
  return FLAG_MAP[team] ?? '🏳️'
}

async function main() {
  const wb = XLSX.readFile(EXCEL_PATH)
  const ws = wb.Sheets['Quiniela']
  const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]

  // --- Parse participants from row 1 (index 1), every 3 cols starting at col 8 ---
  const participantCols: Array<{ col: number; name: string }> = []
  const headerRow = raw[1]
  for (let col = 8; col < headerRow.length; col += 3) {
    const name = headerRow[col]
    if (name && String(name).trim()) {
      participantCols.push({ col, name: String(name).trim() })
    }
  }
  console.log(`Found ${participantCols.length} participants`)

  // --- Parse matches from rows 3-74 (index 3..74) ---
  interface MatchRow {
    group: string
    home_team: string
    away_team: string
    rowIdx: number
  }

  const matchRows: MatchRow[] = []
  const matchKeySet = new Set<string>()

  for (let i = 3; i < Math.min(75, raw.length); i++) {
    const row = raw[i]
    if (!row) continue
    const group = row[0]
    const home = row[2]
    const away = row[3]
    if (!group || !home || !away) continue
    const key = `${group}|${home}|${away}`
    if (!matchKeySet.has(key)) {
      matchKeySet.add(key)
      matchRows.push({
        group: String(group).trim(),
        home_team: String(home).trim(),
        away_team: String(away).trim(),
        rowIdx: i,
      })
    }
  }
  console.log(`Found ${matchRows.length} unique matches`)

  // Assign IDs: sort by group, then by order of appearance → A1..A6, B1..B6, etc.
  const groupCounters: Record<string, number> = {}
  const matchIdMap = new Map<string, string>() // "group|home|away" → "A1"

  for (const m of matchRows) {
    groupCounters[m.group] = (groupCounters[m.group] ?? 0) + 1
    const id = `${m.group}${groupCounters[m.group]}`
    matchIdMap.set(`${m.group}|${m.home_team}|${m.away_team}`, id)
  }

  // --- Step 1: Delete existing predictions and matches ---
  console.log('\nClearing existing predictions...')
  const { error: delPredErr } = await supabase.from('predictions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (delPredErr) throw new Error(`Delete predictions: ${delPredErr.message}`)

  console.log('Clearing existing matches...')
  const { error: delMatchErr } = await supabase.from('matches').delete().neq('id', 'NONE')
  if (delMatchErr) throw new Error(`Delete matches: ${delMatchErr.message}`)

  // --- Step 2: Insert matches ---
  console.log('Inserting matches...')
  const matchInserts = matchRows.map((m) => {
    const id = matchIdMap.get(`${m.group}|${m.home_team}|${m.away_team}`)!
    return {
      id,
      group: m.group,
      match_date: '2026-06-11T00:00:00-06:00',
      home_team: m.home_team,
      away_team: m.away_team,
      home_flag: getFlag(m.home_team),
      away_flag: getFlag(m.away_team),
      is_locked: false,
    }
  })

  const { error: matchErr } = await supabase.from('matches').insert(matchInserts)
  if (matchErr) throw new Error(`Insert matches: ${matchErr.message}`)
  console.log(`✓ ${matchInserts.length} matches inserted`)

  // --- Step 3: Fetch participant UUIDs from DB ---
  const { data: dbParticipants, error: partErr } = await supabase
    .from('participants')
    .select('id, name')
  if (partErr) throw new Error(`Fetch participants: ${partErr.message}`)

  const participantIdMap = new Map<string, string>()
  for (const p of dbParticipants ?? []) {
    participantIdMap.set(p.name.trim(), p.id)
  }

  // Normalize name mismatches
  const nameAliases: Record<string, string> = {
    'Álvaro': 'Álvaro',
    'José Luis Hernández': 'José Luis Hernández',
    'Christian López': 'Christian López',
    'José Miguel Gutiérrez': 'José Miguel Gutiérrez',
    'Ricky Cadena Cortés': 'Ricky Cadena Cortés',
    'Miguel Alcántar': 'Miguel Alcántar',
  }

  // --- Step 4: Parse and collect all predictions ---
  const predictions: Array<{
    participant_id: string
    match_id: string
    home_goals: number
    away_goals: number
  }> = []

  let skipped = 0

  for (let i = 3; i < Math.min(75, raw.length); i++) {
    const row = raw[i]
    if (!row) continue
    const group = row[0]
    const home = row[2]
    const away = row[3]
    if (!group || !home || !away) continue

    const matchKey = `${String(group).trim()}|${String(home).trim()}|${String(away).trim()}`
    const matchId = matchIdMap.get(matchKey)
    if (!matchId) continue

    for (const { col, name } of participantCols) {
      const gl = row[col]
      const gv = row[col + 1]
      if (gl === undefined || gl === null || gl === '' || gv === undefined || gv === null || gv === '') {
        skipped++
        continue
      }
      const homeGoals = parseInt(String(gl), 10)
      const awayGoals = parseInt(String(gv), 10)
      if (isNaN(homeGoals) || isNaN(awayGoals)) { skipped++; continue }

      // Find participant ID - try exact, then aliases, then partial
      let participantId = participantIdMap.get(name)
      if (!participantId) {
        const alias = nameAliases[name]
        if (alias) participantId = participantIdMap.get(alias)
      }
      if (!participantId) {
        // Try case-insensitive match
        for (const [dbName, dbId] of participantIdMap.entries()) {
          if (dbName.toLowerCase() === name.toLowerCase()) {
            participantId = dbId
            break
          }
        }
      }
      if (!participantId) {
        console.warn(`  ⚠ No participant found for: "${name}"`)
        skipped++
        continue
      }

      predictions.push({ participant_id: participantId, match_id: matchId, home_goals: homeGoals, away_goals: awayGoals })
    }
  }

  console.log(`\nPrepared ${predictions.length} predictions (${skipped} skipped)`)

  // --- Step 5: Batch insert predictions ---
  const BATCH = 200
  let inserted = 0
  for (let i = 0; i < predictions.length; i += BATCH) {
    const batch = predictions.slice(i, i + BATCH)
    const { error } = await supabase.from('predictions').insert(batch)
    if (error) throw new Error(`Insert predictions batch ${i}: ${error.message}`)
    inserted += batch.length
    process.stdout.write(`\r  Inserted ${inserted}/${predictions.length}...`)
  }
  console.log(`\n✓ ${inserted} predictions inserted`)
  console.log('\n🎉 Done! All data imported successfully.')
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
