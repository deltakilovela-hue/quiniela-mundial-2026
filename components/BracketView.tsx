'use client'

import { useState } from 'react'
import type { R32Match, Slot } from '@/lib/bracket'

const ROUNDS = [
  { key: 'r32', name: 'Dieciseisavos', short: '16avos' },
  { key: 'r16', name: 'Octavos', short: 'Octavos' },
  { key: 'qf', name: 'Cuartos', short: 'Cuartos' },
  { key: 'sf', name: 'Semifinal', short: 'Semis' },
  { key: 'final', name: 'Final', short: 'Final' },
] as const

const LATER_COUNTS: Record<string, number> = { r16: 8, qf: 4, sf: 2, final: 1 }

function SlotRow({ slot }: { slot?: Slot }) {
  if (slot?.team) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="text-base shrink-0">{slot.team.flag}</span>
        <span className="text-sm font-semibold text-white truncate">{slot.team.team}</span>
        <span className="ml-auto text-[10px] text-green-400 shrink-0">✓</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <span className="w-5 h-5 rounded-full bg-slate-800 shrink-0" />
      <span className="text-sm text-slate-600">
        Por definir{slot?.label ? <span className="text-slate-700"> · {slot.label}</span> : ''}
      </span>
    </div>
  )
}

function MatchCard({ left, right }: { left?: Slot; right?: Slot }) {
  return (
    <div className="rounded-xl border border-white/8 bg-slate-900/50 overflow-hidden divide-y divide-white/5">
      <SlotRow slot={left} />
      <SlotRow slot={right} />
    </div>
  )
}

export default function BracketView({ r32 }: { r32: R32Match[] }) {
  const [active, setActive] = useState<string>('r32')

  return (
    <div className="space-y-4">
      {/* Round tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {ROUNDS.map(r => (
          <button
            key={r.key}
            onClick={() => setActive(r.key)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              active === r.key
                ? 'bg-cyan-600/30 border border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900/60 border border-white/5 text-slate-500 hover:text-slate-300'
            }`}
          >
            {r.short}
          </button>
        ))}
      </div>

      {/* Matches — single column, mobile friendly */}
      <div className="space-y-2.5 max-w-md mx-auto">
        {active === 'r32'
          ? r32.map((m, i) => <MatchCard key={i} left={m.left} right={m.right} />)
          : Array.from({ length: LATER_COUNTS[active] ?? 0 }).map((_, i) => (
              <MatchCard key={i} />
            ))}
      </div>

      {active !== 'r32' && (
        <p className="text-center text-xs text-slate-600">
          Se define cuando avancen las rondas anteriores.
        </p>
      )}
    </div>
  )
}
