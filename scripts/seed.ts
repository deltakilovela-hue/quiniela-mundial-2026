/**
 * Run: npx tsx scripts/seed.ts
 * Seeds matches and participants into Supabase.
 * Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { MATCHES, PARTICIPANTS } from '../lib/seed-data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seed() {
  console.log('Seeding matches...')
  const { error: matchErr } = await supabase.from('matches').upsert(
    MATCHES.map((m) => ({
      id: m.id,
      group: m.group,
      match_date: m.match_date,
      home_team: m.home_team,
      away_team: m.away_team,
      home_flag: m.home_flag,
      away_flag: m.away_flag,
    }))
  )
  if (matchErr) throw matchErr
  console.log(`✓ ${MATCHES.length} matches inserted`)

  console.log('Seeding participants...')
  for (const p of PARTICIPANTS) {
    const { error } = await supabase
      .from('participants')
      .insert({ name: p.name, pin: p.id.padStart(4, '0') })
    if (error) console.error(`Error inserting ${p.name}:`, error.message)
  }
  console.log(`✓ ${PARTICIPANTS.length} participants inserted`)
  console.log('\nDefault PINs: participant number padded to 4 digits (e.g. Memo JR = 0001)')
}

seed().catch(console.error)
