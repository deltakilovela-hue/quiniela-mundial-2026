import { NextRequest, NextResponse } from 'next/server'
import { syncResults } from '@/lib/sync-results'
import { getServiceClient } from '@/lib/supabase'

// Called by:
//  - Vercel Cron (once/day on Hobby plan)
//  - Admin panel "Sincronizar ahora" button
//  - BackgroundSync component (while anyone has the app open)
//
// To avoid many concurrent viewers each triggering a full sync, pass
// ?minInterval=SECONDS — if a sync ran more recently than that, this skips
// the work and returns immediately.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Throttle: skip if a sync ran within the last `minInterval` seconds
  const minInterval = Number(req.nextUrl.searchParams.get('minInterval') ?? 0)
  if (minInterval > 0) {
    const { data: last } = await getServiceClient()
      .from('sync_log')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (last?.synced_at) {
      const ageMs = Date.now() - new Date(last.synced_at).getTime()
      if (ageMs < minInterval * 1000) {
        return NextResponse.json({ ok: true, skipped: true, ageSeconds: Math.round(ageMs / 1000) })
      }
    }
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
