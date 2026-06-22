import { fetchNews } from '@/lib/espn-news'
import { Newspaper } from 'lucide-react'

function timeAgo(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diffH = Math.floor((Date.now() - d.getTime()) / 3_600_000)
  if (diffH < 1) return 'hace un momento'
  if (diffH < 24) return `hace ${diffH} h`
  const days = Math.floor(diffH / 24)
  return days === 1 ? 'ayer' : `hace ${days} días`
}

export default async function NewsFeed() {
  const news = await fetchNews(6)
  if (news.length === 0) return null

  const [lead, ...rest] = news

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Newspaper size={16} className="text-cyan-400" />
        <h2 className="text-base font-semibold text-white">Noticias del Mundial</h2>
      </div>

      {/* Lead story */}
      <a
        href={lead.link || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl border border-white/8 bg-slate-900/50 overflow-hidden hover:border-cyan-700/40 transition-colors"
      >
        {lead.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lead.image} alt="" className="w-full h-40 sm:h-48 object-cover" />
        )}
        <div className="p-4">
          <p className="text-sm sm:text-base font-semibold text-white leading-snug">{lead.headline}</p>
          {lead.description && (
            <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{lead.description}</p>
          )}
          <p className="text-[11px] text-slate-600 mt-2">{timeAgo(lead.published)} · ESPN</p>
        </div>
      </a>

      {/* Other headlines */}
      <div className="rounded-xl border border-white/6 bg-slate-900/40 divide-y divide-white/5">
        {rest.map((n, i) => (
          <a
            key={i}
            href={n.link || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 px-4 py-3 hover:bg-white/3 transition-colors"
          >
            <span className="text-cyan-600 text-xs mt-0.5 shrink-0">▸</span>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-slate-200 leading-snug">{n.headline}</p>
              <p className="text-[11px] text-slate-600 mt-0.5">{timeAgo(n.published)}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
