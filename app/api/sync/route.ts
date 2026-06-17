import { NextRequest, NextResponse } from 'next/server'
import { syncResults } from '@/lib/sync-results'

// Called by Vercel Cron every 5 minutes during the tournament
// Also callable manually from the admin panel
export async function GET(req: NextRequest) {
  // Protect with CRON_SECRET (set in Vercel env vars)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncResults()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
