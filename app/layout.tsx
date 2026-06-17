import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '⚽ Gran Quiniela Familiar · Mundial 2026',
  description: 'Quiniela familiar para la fase de grupos del Mundial 2026',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className={`${inter.className} min-h-full bg-slate-900 text-slate-100`}>
        <header className="border-b border-slate-700 bg-slate-800/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-bold text-lg text-white flex items-center gap-2">
              ⚽ Quiniela Mundial 2026
            </Link>
            <nav className="flex gap-4 text-sm text-slate-300">
              <Link href="/" className="hover:text-white transition-colors">Tabla</Link>
              <Link href="/partidos" className="hover:text-white transition-colors">Partidos</Link>
              <Link href="/participante" className="hover:text-white transition-colors">Mi Quiniela</Link>
              <Link href="/admin" className="hover:text-white transition-colors text-slate-500">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-6 w-full">
          {children}
        </main>
        <footer className="text-center text-slate-600 text-xs py-4 mt-8">
          Gran Quiniela Familiar · Mundial 2026 · 72 partidos · 28 participantes
        </footer>
      </body>
    </html>
  )
}
