import { supabase } from '@/lib/supabase'
import { buildBracket } from '@/lib/bracket'
import BracketView from '@/components/BracketView'
import AutoRefresh from '@/components/AutoRefresh'

export const revalidate = 30

export default async function EliminatoriasPage() {
  const { data: matches } = await supabase.from('matches').select('*').order('id')
  const { left, right } = buildBracket(matches ?? [])
  const r32 = [...left, ...right]
  const hasLive = (matches ?? []).some(m => m.is_locked && m.home_goals_real === null)
  const qualified = r32.reduce((n, m) => n + (m.left.team ? 1 : 0) + (m.right.team ? 1 : 0), 0)

  return (
    <div className="space-y-6">
      <AutoRefresh hasLiveMatches={hasLive} />

      <div className="text-center space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Eliminatorias</h1>
        <p className="text-slate-500 text-sm">Mundial 2026</p>
        <p className="text-slate-700 text-xs">
          {qualified === 0
            ? 'Aún no hay grupos cerrados — se llena conforme terminen.'
            : `${qualified} equipos clasificados oficialmente`}
        </p>
      </div>

      <BracketView r32={r32} />
    </div>
  )
}
