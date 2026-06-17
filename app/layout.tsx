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
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <Link href="/" className="font-bold text-base sm:text-lg text-white flex items-center gap-1.5 shrink-0">
              ⚽ <span className="hidden sm:inline">Quiniela</span> Mundial 2026
            </Link>
            <nav className="flex gap-2 sm:gap-4 text-xs sm:text-sm text-slate-300 overflow-x-auto">
              <Link href="/" className="hover:text-white transition-colors whitespace-nowrap px-1 py-0.5">Tabla</Link>
              <Link href="/partidos" className="hover:text-white transition-colors whitespace-nowrap px-1 py-0.5">Partidos</Link>
              <Link href="/participante" className="hover:text-white transition-colors whitespace-nowrap px-1 py-0.5">Mi Quiniela</Link>
              <Link href="/admin" className="hover:text-white transition-colors whitespace-nowrap px-1 py-0.5 text-slate-500">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 w-full">
          {children}
        </main>
        <footer className="text-center text-slate-600 text-xs py-4 mt-8">
          Gran Quiniela Familiar · Mundial 2026 · 72 partidos · 28 participantes
        </footer>
      </body>
    </html>
  )
}
