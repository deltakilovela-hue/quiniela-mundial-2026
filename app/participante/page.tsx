'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ParticipantePicker() {
  const [participants, setParticipants] = useState<{ id: string; name: string }[] | null>(null)
  const [pin, setPin] = useState('')
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()

  async function loadParticipants() {
    const { data } = await supabase.from('participants').select('id, name').order('name')
    setParticipants(data ?? [])
  }

  if (!participants) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h1 className="text-2xl font-bold text-white">Mi Quiniela</h1>
        <p className="text-slate-400 text-sm">Selecciona tu nombre para ver y editar tus pronósticos</p>
        <button
          onClick={loadParticipants}
          className="px-6 py-3 bg-teal-600 hover:bg-teal-500 rounded-lg font-semibold text-white transition-colors"
        >
          Ver participantes
        </button>
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">¿Quién eres?</h1>
        <div className="grid grid-cols-2 gap-2">
          {participants.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-left text-slate-200 hover:text-white transition-colors text-sm font-medium"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { data } = await supabase
      .from('participants')
      .select('pin')
      .eq('id', selected!.id)
      .single()

    if (data?.pin === pin) {
      router.push(`/participante/${selected!.id}?pin=${pin}`)
    } else {
      setError('PIN incorrecto')
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2 text-center">Hola, {selected.name}</h1>
      <p className="text-slate-400 text-sm text-center mb-6">Ingresa tu PIN de 4 dígitos</p>
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••"
          className="w-full text-center text-2xl tracking-[0.5em] py-4 bg-slate-800 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-teal-500"
        />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={pin.length !== 4}
          className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 rounded-lg font-semibold text-white transition-colors"
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => { setSelected(null); setPin('') }}
          className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm"
        >
          Cambiar participante
        </button>
      </form>
    </div>
  )
}
