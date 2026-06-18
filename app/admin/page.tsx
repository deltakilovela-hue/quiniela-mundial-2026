'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Match } from '@/lib/supabase'

interface SyncLog {
  id: string
  synced_at: string
  fixtures_fetched: number
  updated: number
  locked: number
  errors: string[]
}

export default function AdminPage() {
  const [pin, setPin] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [syncLog, setSyncLog] = useState<SyncLog[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [pinError, setPinError] = useState('')
  const [tab, setTab] = useState<'sync' | 'manual'>('sync')
  const [manualResults, setManualResults] = useState<Record<string, { h: string; a: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    const [{ data: m }, { data: log }] = await Promise.all([
      supabase.from('matches').select('*').order('match_date'),
      supabase.from('sync_log').select('*').order('synced_at', { ascending: false }).limit(10),
    ])
    setMatches(m ?? [])
    setSyncLog(log ?? [])
    const init: Record<string, { h: string; a: string }> = {}
    for (const match of m ?? []) {
      init[match.id] = {
        h: match.home_goals_real !== null ? String(match.home_goals_real) : '',
        a: match.away_goals_real !== null ? String(match.away_goals_real) : '',
      }
    }
    setManualResults(init)
  }, [])

  function login(e: React.FormEvent) {
    e.preventDefault()
    if (pin === (process.env.NEXT_PUBLIC_ADMIN_PIN || 'admin2026')) {
      setAuthenticated(true)
      loadData()
    } else {
      setPinError('PIN incorrecto')
    }
  }

  async function triggerSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync', {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}` },
      })
      const data = await res.json()
      if (data.ok) {
        setSyncResult(`✓ Sync OK — ${data.fixtures_fetched} partidos consultados, ${data.updated} resultados actualizados, ${data.locked} partidos bloqueados`)
      } else {
        setSyncResult(`⚠️ Error: ${data.error}`)
      }
      await loadData()
    } catch (err) {
      setSyncResult(`Error: ${err}`)
    }
    setSyncing(false)
  }

  async function saveManualResult(matchId: string) {
    const r = manualResults[matchId]
    if (!r || r.h === '' || r.a === '') return
    setSaving(matchId)
    const res = await fetch('/api/admin/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_id: matchId,
        home_goals: parseInt(r.h),
        away_goals: parseInt(r.a),
        pin,
      }),
    })
    const data = await res.json()
    setSaveMsg((m) => ({ ...m, [matchId]: res.ok ? '✓' : data.error }))
    if (res.ok) await loadData()
    setSaving(null)
    setTimeout(() => setSaveMsg((m) => ({ ...m, [matchId]: '' })), 3000)
  }

  async function toggleLock(matchId: string, lock: boolean) {
    await fetch('/api/admin/results', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: matchId, is_locked: lock, pin }),
    })
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, is_locked: lock } : m)))
  }

  // Real-time: subscribe to matches changes
  useEffect(() => {
    if (!authenticated) return
    const channel = supabase
      .channel('admin-matches')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => {
        loadData()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [authenticated, loadData])

  if (!authenticated) {
    return (
      <div className="max-w-sm mx-auto mt-20">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">Panel Admin</h1>
        <p className="text-slate-500 text-sm text-center mb-6">Quiniela Mundial 2026</p>
        <form onSubmit={login} className="space-y-4">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN de administrador"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
          />
          {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
          <button type="submit" className="w-full py-3 bg-teal-600 hover:bg-teal-500 rounded-lg font-semibold text-white transition-colors">
            Entrar
          </button>
        </form>
      </div>
    )
  }

  const played = matches.filter((m) => m.home_goals_real !== null).length
  const locked = matches.filter((m) => m.is_locked).length
  const lastSync = syncLog[0]
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Panel Admin</h1>
        <button onClick={() => { setAuthenticated(false); setPin('') }} className="text-slate-500 hover:text-slate-300 text-sm">
          Salir
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Jugados', value: played, total: 72 },
          { label: 'Bloqueados', value: locked, total: 72 },
          { label: 'Pendientes', value: 72 - played, total: 72 },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-center">
            <div className="text-2xl font-bold text-teal-400 font-mono">{s.value}</div>
            <div className="text-slate-400 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-800 rounded-lg p-1 border border-slate-700">
        {([['sync', '🔄 Sync Automático'], ['manual', '✏️ Captura Manual']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === id ? 'bg-teal-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'sync' && (
        <div className="space-y-4">
          {/* Sync card */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h2 className="font-semibold text-white mb-1">API-Football · Sync Automático</h2>
            <p className="text-slate-400 text-sm mb-4">
              Vercel Cron corre cada 5 minutos automáticamente. Puedes forzar una sincronización manual aquí.
            </p>

            {lastSync && (
              <div className="mb-4 p-3 bg-slate-700/50 rounded-lg text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Último sync:</span>
                  <span className="text-slate-200">{new Date(lastSync.synced_at).toLocaleString('es-MX', { timeZone: 'America/Regina' })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Partidos consultados:</span>
                  <span className="text-teal-400">{lastSync.fixtures_fetched}</span>
                </div>
                <div className="flex justify-between">
                  <span>Resultados actualizados:</span>
                  <span className="text-green-400">{lastSync.updated}</span>
                </div>
                <div className="flex justify-between">
                  <span>Partidos bloqueados:</span>
                  <span className="text-yellow-400">{lastSync.locked}</span>
                </div>
                {lastSync.errors.length > 0 && (
                  <div className="text-red-400">Errores: {lastSync.errors.join(', ')}</div>
                )}
              </div>
            )}

            <button
              onClick={triggerSync}
              disabled={syncing}
              className="w-full py-3 bg-teal-700 hover:bg-teal-600 disabled:opacity-50 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2"
            >
              {syncing ? (
                <>
                  <span className="animate-spin">⟳</span> Sincronizando...
                </>
              ) : (
                '🔄 Sincronizar ahora'
              )}
            </button>

            {syncResult && (
              <p className={`mt-3 text-sm text-center ${syncResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                {syncResult}
              </p>
            )}
          </div>

          {/* Sync history */}
          {syncLog.length > 1 && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-2 bg-slate-700/50 border-b border-slate-700">
                <span className="text-sm font-semibold text-slate-200">Historial de syncs</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-500">
                    <th className="text-left px-4 py-2">Hora</th>
                    <th className="text-center px-3 py-2">Partidos</th>
                    <th className="text-center px-3 py-2">Actualizados</th>
                    <th className="text-center px-3 py-2">Errores</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLog.map((log) => (
                    <tr key={log.id} className="border-b border-slate-700/50">
                      <td className="px-4 py-2 text-slate-400">
                        {new Date(log.synced_at).toLocaleTimeString('es-MX', { timeZone: 'America/Regina', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-300">{log.fixtures_fetched}</td>
                      <td className="px-3 py-2 text-center text-green-400">{log.updated}</td>
                      <td className="px-3 py-2 text-center text-red-400">{log.errors.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Setup instructions */}
          <div className="p-4 bg-blue-950/40 border border-blue-800 rounded-xl text-sm text-blue-300 space-y-2">
            <p className="font-semibold text-blue-200">⚙️ Configuración requerida en Vercel</p>
            <p>Variables de entorno:</p>
            <code className="block bg-slate-900 rounded p-2 text-xs font-mono text-slate-300 space-y-1">
              <span className="block">RAPIDAPI_KEY=tu_key_de_rapidapi</span>
              <span className="block">WC_LEAGUE_ID=1</span>
              <span className="block">WC_SEASON=2026</span>
              <span className="block">CRON_SECRET=un_string_secreto</span>
            </code>
            <p className="text-xs text-blue-400">
              El Cron de Vercel corre automáticamente cada 5 min. También puedes forzarlo con el botón de arriba.
            </p>
          </div>
        </div>
      )}

      {tab === 'manual' && (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">Ingresa resultados manualmente como respaldo si el sync automático falla.</p>
          {groups.map((group) => {
            const gm = matches.filter((m) => m.group === group)
            if (!gm.length) return null
            return (
              <div key={group} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-slate-700/50 border-b border-slate-700">
                  <span className="font-bold text-slate-200 text-sm">Grupo {group}</span>
                </div>
                {gm.map((match) => {
                  const r = manualResults[match.id] ?? { h: '', a: '' }
                  const played = match.home_goals_real !== null
                  return (
                    <div key={match.id} className="border-b border-slate-700/50 last:border-0 px-3 sm:px-4 py-3">
                      {/* Team names row */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-slate-500 font-mono text-xs shrink-0">{match.id}</span>
                        <span className="text-slate-200 text-xs sm:text-sm flex-1 min-w-0 truncate">
                          {match.home_flag} {match.home_team} vs {match.away_team} {match.away_flag}
                        </span>
                        {played && (
                          <span className="text-xs text-green-400 font-mono shrink-0">
                            {match.home_goals_real}–{match.away_goals_real} ✓
                          </span>
                        )}
                      </div>
                      {/* Controls row */}
                      <div className="flex items-center gap-1.5 ml-7">
                        <input
                          type="number" inputMode="numeric" min={0} max={20} value={r.h}
                          onChange={(e) => setManualResults((p) => ({ ...p, [match.id]: { ...p[match.id], h: e.target.value } }))}
                          className="w-11 h-9 text-center bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm focus:outline-none focus:border-teal-500"
                          placeholder="0"
                        />
                        <span className="text-slate-500 text-xs">–</span>
                        <input
                          type="number" inputMode="numeric" min={0} max={20} value={r.a}
                          onChange={(e) => setManualResults((p) => ({ ...p, [match.id]: { ...p[match.id], a: e.target.value } }))}
                          className="w-11 h-9 text-center bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm focus:outline-none focus:border-teal-500"
                          placeholder="0"
                        />
                        <button
                          onClick={() => saveManualResult(match.id)}
                          disabled={saving === match.id}
                          className="h-9 px-3 bg-teal-700 hover:bg-teal-600 disabled:opacity-40 rounded text-xs font-semibold text-white transition-colors"
                        >
                          {saving === match.id ? '…' : played ? 'Update' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => toggleLock(match.id, !match.is_locked)}
                          className={`h-9 px-2.5 rounded text-sm transition-colors ${
                            match.is_locked ? 'bg-red-900/50 text-red-300 hover:bg-red-900' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                        >
                          {match.is_locked ? '🔒' : '🔓'}
                        </button>
                        {saveMsg[match.id] && <span className="text-green-400 text-xs">{saveMsg[match.id]}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
