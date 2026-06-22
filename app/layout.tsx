import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { Trophy, Calendar, User, Shield, CheckCircle, GitFork } from 'lucide-react'
import BackgroundSync from '@/components/BackgroundSync'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Gran Quiniela Familiar · Mundial 2026',
  description: 'Quiniela familiar para la fase de grupos del Mundial 2026',
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className={`${inter.className} min-h-full`} style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <BackgroundSync />

        {/* Nav */}
        <header className="sticky top-0 z-50 border-b border-white/5" style={{ background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(16px)' }}>
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-white shrink-0">
              <span className="text-xl">⚽</span>
              <span className="hidden sm:inline text-sm font-semibold tracking-tight">Quiniela</span>
              <span className="text-sm font-semibold tracking-tight text-cyan-400">Mundial 2026</span>
            </Link>
            <nav className="flex items-center gap-1">
              {[
                { href: '/', icon: Trophy, label: 'Tabla' },
                { href: '/resultados', icon: CheckCircle, label: 'Resultados' },
                { href: '/eliminatorias', icon: GitFork, label: 'Eliminatorias' },
                { href: '/programa', icon: Calendar, label: 'Programa' },
                { href: '/participante', icon: User, label: 'Mi Quiniela' },
                { href: '/admin', icon: Shield, label: 'Admin', dim: true },
              ].map(({ href, icon: Icon, label, dim }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    dim
                      ? 'text-slate-600 hover:text-slate-400'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-3 sm:px-4 py-5 sm:py-8 w-full">
          {children}
        </main>

        <footer className="border-t border-white/5 mt-12 py-6 text-center text-slate-700 text-xs">
          Gran Quiniela Familiar · Mundial 2026 · 72 partidos · 28 participantes
        </footer>
      </body>
    </html>
  )
}
