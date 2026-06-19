'use client'

import { useEffect } from 'react'

// Silently triggers a results sync while anyone has the app open. The server
// throttles (minInterval) so 28 simultaneous viewers still cause at most one
// real sync per window. This keeps results fresh after each match without a
// paid cron and without manual entry.
export default function BackgroundSync() {
  useEffect(() => {
    const secret = process.env.NEXT_PUBLIC_CRON_SECRET || ''
    const sync = () => {
      fetch('/api/sync?minInterval=120', {
        headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
      }).catch(() => { /* non-fatal */ })
    }
    sync() // on mount
    const id = setInterval(sync, 3 * 60 * 1000) // every 3 min
    return () => clearInterval(id)
  }, [])

  return null
}
