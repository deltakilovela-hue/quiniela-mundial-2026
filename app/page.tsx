import { supabase, fetchAllPredictions } from '@/lib/supabase'
import { calcStandings } from '@/lib/scoring'
import RealtimeStandings from '@/components/RealtimeStandings'
import TodayMatches from '@/components/TodayMatches'

export const revalidate = 60

export default async function StandingsPage() {
  // Use Mexico City date (not UTC) so "Hoy" matches what users actually see on their clock
  const nowMX = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Regina' }) // YYYY-MM-DD
  const tomorrowMX = new Date(new Date().getTime() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Regina' })

  const todayStr = nowMX
  const tomorrowStr = tomorrowMX

  const [{ data: participants }, { data: matches }, predictions] = await Promise.all([
    supabase.from('participants').select('id, name'),
    supabase.from('matches').select('*').order('match_date'),
    fetchAllPredictions(),
  ])

  const standings = calcStandings(participants ?? [], matches ?? [], predictions)
  const played = (matches ?? []).filter(m => m.home_goals_real !== null).length

  const todayMatches    = (matches ?? []).filter(m => m.match_date?.startsWith(todayStr))
  const tomorrowMatches = (matches ?? []).filter(m => m.match_date?.startsWith(tomorrowStr))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Gran Quiniela Familiar
          <span className="text-cyan-400"> · Mundial 2026</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1">Fase de grupos · 28 participantes · 72 partidos</p>
      </div>

      {/* Prize cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { place: '1°', prize: '$7,500', gradient: 'from-yellow-500/20 to-yellow-600/5', border: 'border-yellow-500/30', text: 'text-yellow-400', medal: '🥇' },
          { place: '2°', prize: '$4,000', gradient: 'from-slate-400/15 to-slate-500/5', border: 'border-slate-400/25', text: 'text-slate-300', medal: '🥈' },
          { place: '3°', prize: '$2,500', gradient: 'from-amber-700/15 to-amber-800/5', border: 'border-amber-700/25', text: 'text-amber-600', medal: '🥉' },
        ].map(({ place, prize, gradient, border, text, medal }) => (
          <div key={place} className={`rounded-xl border bg-gradient-to-b ${gradient} ${border} p-3 sm:p-4 text-center`}>
            <div className="text-lg sm:text-xl mb-0.5">{medal}</div>
            <div className={`text-xs font-medium ${text} mb-1`}>{place} lugar</div>
            <div className="text-base sm:text-xl font-bold text-white">{prize}</div>
          </div>
        ))}
      </div>

      {/* Tie rule */}
      <details className="rounded-xl border border-white/5 bg-slate-900/50 p-4 text-xs text-slate-400">
        <summary className="cursor-pointer text-slate-300 font-semibold text-sm flex items-center gap-2 select-none">
          <span>⚖️</span> ¿Qué pasa en caso de empate?
        </summary>
        <div className="mt-3 space-y-2 text-slate-400 leading-relaxed">
          <p>
            Si al final de la fase de grupos dos o más participantes terminan con los mismos puntos en los
            primeros lugares, los premios de esos lugares <strong className="text-slate-200">se suman y se
            reparten en partes iguales</strong> entre ellos.
          </p>
          <ul className="space-y-1.5 mt-2">
            <li className="flex gap-2"><span className="text-cyan-500">🔹</span><span><strong className="text-slate-200">2 empatan en 1°</strong> → se suman 1° y 2° ($11,500) → <strong className="text-cyan-400">$5,750</strong> c/u</span></li>
            <li className="flex gap-2"><span className="text-cyan-500">🔹</span><span><strong className="text-slate-200">3 empatan en 1°</strong> → se suman los 3 premios ($14,000) → <strong className="text-cyan-400">$4,666.66</strong> c/u</span></li>
            <li className="flex gap-2"><span className="text-cyan-500">🔹</span><span><strong className="text-slate-200">4 o más en 1°</strong> → se suman los 3 premios ($14,000) y se dividen entre todas por igual</span></li>
            <li className="flex gap-2"><span className="text-cyan-500">🔹</span><span><strong className="text-slate-200">2 empatan en 2°</strong> → se suman 2° y 3° ($6,500) → <strong className="text-cyan-400">$3,250</strong> c/u</span></li>
          </ul>
        </div>
      </details>

      {/* Today / Tomorrow matches */}
      <TodayMatches todayMatches={todayMatches} tomorrowMatches={tomorrowMatches} />

      {/* Standings */}
      <RealtimeStandings initialStandings={standings} initialPlayed={played} />

      {/* Scoring rules */}
      <div className="rounded-xl border border-white/5 bg-slate-900/50 p-4 text-xs text-slate-500 space-y-1.5">
        <p className="text-slate-400 font-semibold text-sm mb-2">Sistema de puntos</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-cyan-900/60 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">2</span>
            <span>Resultado correcto (ganador o empate)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-cyan-900/60 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">+1</span>
            <span>Un gol exacto</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-cyan-900/60 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">+2</span>
            <span>Marcador exacto (ambos goles)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-yellow-900/60 text-yellow-400 flex items-center justify-center font-bold text-xs shrink-0">+3</span>
            <span>Bono difícil: ≤5 personas aciertan exacto</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-orange-900/60 text-orange-400 flex items-center justify-center font-bold text-xs shrink-0">+5</span>
            <span>Bono único: solo 1 acierta el marcador exacto</span>
          </div>
        </div>
      </div>
    </div>
  )
}
