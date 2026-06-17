'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Match } from '@/lib/supabase'

export default function AdminPage() {
  const [pin, setPin] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [results, setResults] = useState<Record<string, { h: string; a: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [pinError, setPinError] = useState('')

  const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? ''

  function login(e: React.FormEvent) {
    e.preventDefault()
    if (pin === (process.env.NEXT_PUBLIC_ADMIN_PIN || 'admin2026')) {
      setAuthenticated(true)
      loadMatches()
    } else {
      setPinError('PIN incorrecto')
    }
  }

  async function loadMatches() {
    const { data } = await supabase.from('matches').select('*').order('match_date')
    setMatches(data ?? [])
    const init: Record<string, { h: string; a: string }> = {}
    for (const m of data ?? []) {
      init[m.id] = {
        h: m.home_goals_real !== null ? String(m.home_goals_real) : '',
        a: m.away_goals_real !== null ? String(m.away_goals_real) : '',
      }
    }
    setResults(init)
  }

  async function saveResult(matchId: string) {
    const r = results[matchId]
    if (!r || r.h === '' || r.a === '') return
    setSaving(matchId)

    const res = await fetch('/api/admin/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_id: matchId,
        home_goals: parseInt(r.h),
        away_goals: parseInt(r.a),
        pin: pin,
      }),
    })

    const data = await res.json()
    setMessages((m) => ({ ...m, [matchId]: res.ok ? '✓ Guardado' : data.error }))
    if (res.ok) {
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? { ...m, home_goals_real: parseInt(r.h), away_goals_real: parseInt(r.a), is_locked: true }
            : m
        )
      )
    }
    setSaving(null)
    setTimeout(() => setMessages((m) => ({ ...m, [matchId]: '' })), 3000)
  }

  async function toggleLock(matchId: string, lock: boolean) {
    await fetch('/api/admin/results', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: matchId, is_locked: lock, pin }),
    })
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, is_locked: lock } : m)))
  }

  if (!authenticated) {
    return (
      <div className="max-w-sm mx-auto mt-20">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Panel Admin</h1>
        <form onSubmit={login} className="space-y-4">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN de administrador"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
          />
          {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
          <button
            type="submit"
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 rounded-lg font-semibold text-white transition-colors"
          >
            Entrar
          </button>
        </form>
        <p className="text-slate-600 text-xs text-center mt-4">
          Configura NEXT_PUBLIC_ADMIN_PIN y ADMIN_PIN en las variables de entorno
        </p>
      </div>
    )
  }

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Panel Admin · Resultados</h1>
        <button
          onClick={() => { setAuthenticated(false); setPin('') }}
          className="text-slate-500 hover:text-slate-300 text-sm"
        >
          Salir
        </button>
      </div>

      <div className="space-y-4">
        {groups.map((group) => {
          const gm = matches.filter((m) => m.group === group)
          if (!gm.length) return null
          return (
            <div key={group} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-2 bg-slate-700/50 border-b border-slate-700">
                <span className="font-bold text-slate-200 text-sm">Grupo {group}</span>
              </div>
              {gm.map((match) => {
                const r = results[match.id] ?? { h: '', a: '' }
                const played = match.home_goals_real !== null
                return (
                  <div key={match.id} className="border-b border-slate-700/50 last:border-0 px-4 py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-slate-500 font-mono text-xs w-6 shrink-0">{match.id}</span>
                      <span className="text-slate-200 text-sm flex-1 min-w-0">
                        {match.home_flag} {match.home_team} vs {match.away_team} {match.away_flag}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number" min={0} max={20}
                          value={r.h}
                          onChange={(e) => setResults((p) => ({ ...p, [match.id]: { ...p[match.id], h: e.target.value } }))}
                          className="w-12 text-center py-1 bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm focus:outline-none focus:border-teal-500"
                          placeholder="0"
                        />
                        <span className="text-slate-500">–</span>
                        <input
                          type="number" min={0} max={20}
                          value={r.a}
                          onChange={(e) => setResults((p) => ({ ...p, [match.id]: { ...p[match.id], a: e.target.value } }))}
                          className="w-12 text-center py-1 bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm focus:outline-none focus:border-teal-500"
                          placeholder="0"
                        />
                        <button
                          onClick={() => saveResult(match.id)}
                          disabled={saving === match.id}
                          className="px-3 py-1 bg-teal-700 hover:bg-teal-600 disabled:opacity-40 rounded text-xs font-semibold text-white transition-colors"
                        >
                          {saving === match.id ? '...' : played ? 'Actualizar' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => toggleLock(match.id, !match.is_locked)}
                          className={`px-2 py-1 rounded text-xs transition-colors ${
                            match.is_locked
                              ? 'bg-red-900/50 text-red-300 hover:bg-red-900'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                        >
                          {match.is_locked ? '🔒' : '🔓'}
                        </button>
                      </div>
                      {messages[match.id] && (
                        <span className="text-green-400 text-xs">{messages[match.id]}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
