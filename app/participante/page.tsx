'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export default function ParticipantePicker() {
  const [participants, setParticipants] = useState<{ id: string; name: string }[] | null>(null)
  const [query, setQuery] = useState('')
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
          <p className="text-slate-500 text-sm mt-1">Selecciona tu nombre para ver tus pronósticos</p>
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

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-white text-center">¿Quién eres?</h1>
      <p className="text-slate-500 text-sm text-center">Selecciona tu nombre para ver tus pronósticos</p>

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
            onClick={() => router.push(`/participante/${p.id}`)}
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
