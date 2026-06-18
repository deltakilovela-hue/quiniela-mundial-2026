'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Refreshes the page every `intervalMs` while there are live/upcoming matches today.
// Shows a subtle "live" indicator in the corner.
export default function AutoRefresh({ hasLiveMatches }: { hasLiveMatches: boolean }) {
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!hasLiveMatches) return

    intervalRef.current = setInterval(() => {
      router.refresh()
    }, 60_000) // every 60 seconds

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [hasLiveMatches, router])

  if (!hasLiveMatches) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-white/8 text-xs text-slate-400 backdrop-blur">
      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      En vivo · actualizando
    </div>
  )
}
