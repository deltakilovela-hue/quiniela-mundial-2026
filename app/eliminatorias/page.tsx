import { supabase } from '@/lib/supabase'
import { buildBracket, groupComplete, type Slot, type R32Match, type TeamRow } from '@/lib/bracket'
import AutoRefresh from '@/components/AutoRefresh'

export const revalidate = 30

function SlotRow({ slot }: { slot: Slot }) {
  const t = slot.team
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 min-w-0">
      {t ? (
        <>
          <span className="text-sm shrink-0">{t.flag}</span>
          <span className={`text-xs sm:text-sm truncate ${slot.confirmed ? 'text-white font-semibold' : 'text-slate-300'}`}>
            {t.team}
          </span>
          {!slot.confirmed && <span className="ml-auto text-[9px] text-slate-600 shrink-0">prov.</span>}
        </>
      ) : (
        <span className="text-xs text-slate-600 italic truncate">{slot.label}</span>
      )}
    </div>
  )
}

function MatchCard({ m }: { m: R32Match }) {
  return (
    <div className="rounded-lg border border-white/8 bg-slate-900/50 overflow-hidden divide-y divide-white/5 w-full">
      <SlotRow slot={m.left} />
      <SlotRow slot={m.right} />
    </div>
  )
}

function GroupMini({ g, rows }: { g: string; rows: TeamRow[] }) {
  const done = groupComplete(rows)
  return (
    <div className="rounded-xl border border-white/6 bg-slate-900/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-white/5 bg-slate-900/60 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-cyan-900/50 border border-cyan-700/30 text-cyan-400 font-bold text-[10px] flex items-center justify-center">{g}</span>
          <span className="text-slate-400 text-xs font-semibold">Grupo {g}</span>
        </span>
        {done
          ? <span className="text-[10px] text-green-400">cerrado</span>
          : <span className="text-[10px] text-slate-600">J{Math.max(...rows.map(r => r.played))}/3</span>}
      </div>
      {rows.map((r, i) => (
        <div key={r.team} className={`flex items-center gap-2 px-3 py-1.5 text-xs ${i < 2 ? 'bg-cyan-950/20' : i === 2 ? 'bg-yellow-950/10' : ''}`}>
          <span className="w-4 text-slate-600 font-mono">{i + 1}</span>
          <span>{r.flag}</span>
          <span className={`truncate ${i < 2 ? 'text-white' : i === 2 ? 'text-yellow-200/80' : 'text-slate-500'}`}>{r.team}</span>
          <span className="ml-auto text-slate-500 font-mono shrink-0">{r.Pts}pts</span>
          <span className="text-slate-700 font-mono shrink-0 w-8 text-right">{r.GD >= 0 ? '+' : ''}{r.GD}</span>
        </div>
      ))}
    </div>
  )
}

export default async function EliminatoriasPage() {
  const { data: matches } = await supabase.from('matches').select('*').order('id')
  const { left, right, tables, thirds } = buildBracket(matches ?? [])
  const hasLive = (matches ?? []).some(m => m.is_locked && m.home_goals_real === null)
  const groups = Object.keys(tables).sort()

  return (
    <div className="space-y-8">
      <AutoRefresh hasLiveMatches={hasLive} />

      <div className="text-center space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Eliminatorias</h1>
        <p className="text-slate-500 text-sm">Dieciseisavos de final · Mundial 2026</p>
        <p className="text-slate-700 text-xs">Se llena solo conforme terminan los grupos · <span className="text-slate-500">prov.</span> = líder provisional</p>
      </div>

      {/* Bracket: two columns of Round-of-32 matches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
        <div className="space-y-2.5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Llave izquierda</h2>
          {left.map((m, i) => <MatchCard key={i} m={m} />)}
        </div>
        <div className="space-y-2.5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Llave derecha</h2>
          {right.map((m, i) => <MatchCard key={i} m={m} />)}
        </div>
      </div>

      {/* Best thirds ranking */}
      <div className="rounded-xl border border-white/6 bg-slate-900/40 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/5 bg-slate-900/60">
          <span className="text-slate-300 text-sm font-semibold">Mejores terceros</span>
          <span className="text-slate-600 text-xs ml-2">(los 8 mejores clasifican)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-white/4">
          {thirds.map((t, i) => (
            <div key={t.team} className={`flex items-center gap-2 px-4 py-2 text-xs ${i < 8 ? '' : 'opacity-50'}`}>
              <span className="w-5 text-slate-600 font-mono">{i + 1}</span>
              <span>{t.flag}</span>
              <span className="text-slate-300 truncate">{t.team}</span>
              <span className="text-slate-600 ml-1">({t.group})</span>
              <span className="ml-auto font-mono text-slate-500">{t.Pts}pts</span>
              <span className="shrink-0">{i < 8 ? '✅' : '❌'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Group tables */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Tablas de grupos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map(g => <GroupMini key={g} g={g} rows={tables[g]} />)}
        </div>
      </div>
    </div>
  )
}
