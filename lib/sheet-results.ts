// Reads match results directly from the family's Google Sheet, published to
// the web as CSV. The Sheet is the source of truth for scores; ESPN is only
// used for goal scorers.
//
// Expected layout (the "Quiniela" tab of the calculator):
//   row 1: PARTIDO ...            (title)
//   row 2: section + participant names
//   row 3: Grp | Fecha | Local | Visitante | G.L Real | G.V Real | ...
//   rows 4+: one match per row
// Column indices (0-based): 0=Grp, 2=Local, 3=Visitante, 4=G.L Real, 5=G.V Real

export interface SheetResult {
  home: string
  away: string
  homeGoals: number
  awayGoals: number
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines).
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else field += c
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

export async function fetchSheetResults(csvUrl: string): Promise<SheetResult[]> {
  const res = await fetch(csvUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 30 },
  })
  if (!res.ok) throw new Error(`Sheet CSV fetch failed: ${res.status}`)
  const text = await res.text()
  const rows = parseCSV(text)

  const results: SheetResult[] = []
  for (const row of rows) {
    const home = (row[2] ?? '').trim()
    const away = (row[3] ?? '').trim()
    const gl = (row[4] ?? '').trim()
    const gv = (row[5] ?? '').trim()
    if (!home || !away) continue           // header / blank rows
    if (gl === '' || gv === '') continue    // not played yet
    const h = Number(gl)
    const a = Number(gv)
    if (!Number.isInteger(h) || !Number.isInteger(a)) continue
    results.push({ home, away, homeGoals: h, awayGoals: a })
  }
  return results
}
