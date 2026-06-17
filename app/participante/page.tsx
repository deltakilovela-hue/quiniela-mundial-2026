'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Search, Lock } from 'lucide-react'

export default function ParticipantePicker() {
  const [participants, setParticipants] = useState<{ id: string; name: string }[] | null>(null)
  const [query, setQuery] = useState('')
  const [pin, setPin] = useState('')
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function loadParticipants() {
    setLoading(true)
    const { data } = await supabase.from('participants').select('id, name').order('name')
    setParticipants(data ?? [])
    setLoading(false)
  }

  const filtered = participants?.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  ) ?? []

  if (!participants) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-cyan-900/30 border border-cyan-700/30 flex items-center justify-center text-3xl">
          ⚽
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Mi Quiniela</h1>
          <p className="text-slate-500 text-sm mt-1">Selecciona tu nombre para ver y editar tus pronósticos</p>
        </div>
        <button
          onClick={loadParticipants}
          disabled={loading}
          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl font-semibold text-white transition-colors cursor-pointer min-w-[160px]"
        >
          {loading ? 'Cargando...' : 'Ver participantes'}
        </button>
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-white text-center">¿Quién eres?</h1>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar nombre..."
            className="w-full pl-9 pr-4 py-3 bg-slate-900/60 border border-white/8 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 text-sm transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="px-4 py-3 bg-slate-900/60 hover:bg-slate-800/80 border border-white/6 hover:border-cyan-500/30 rounded-xl text-left text-slate-200 hover:text-white transition-all cursor-pointer text-sm font-medium"
            >
              {p.name}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-slate-600 text-sm text-center py-4">No se encontraron resultados</p>
        )}
      </div>
    )
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { data } = await supabase.from('participants').select('pin').eq('id', selected!.id).single()
    if (data?.pin === pin) {
      router.push(`/participante/${selected!.id}?pin=${pin}`)
    } else {
      setError('PIN incorrecto')
      setPin('')
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-6 sm:p-8 space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-cyan-900/30 border border-cyan-700/30 flex items-center justify-center text-2xl mx-auto mb-3">
            👤
          </div>
          <h1 className="text-xl font-bold text-white">{selected.name}</h1>
          <p className="text-slate-500 text-sm mt-1">Ingresa tu PIN de 4 dígitos</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="• • • •"
              className="w-full text-center text-2xl tracking-[0.8em] py-4 pl-10 bg-slate-800/60 border border-white/8 rounded-xl text-white focus:outline-none focus:border-cyan-500/60 transition-colors placeholder-slate-700"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-950/30 border border-red-800/30 rounded-lg py-2 px-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pin.length !== 4}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 rounded-xl font-semibold text-white transition-colors cursor-pointer"
          >
            Entrar
          </button>

          <button
            type="button"
            onClick={() => { setSelected(null); setPin(''); setError('') }}
            className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors cursor-pointer"
          >
            Cambiar participante
          </button>
        </form>
      </div>
    </div>
  )
}
