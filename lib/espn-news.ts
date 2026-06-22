// Fetches World Cup news headlines from ESPN's public API (Spanish, no key).

const NEWS_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?lang=es&region=mx'

export interface NewsItem {
  headline: string
  description: string
  published: string
  link: string
  image?: string
}

export async function fetchNews(limit = 6): Promise<NewsItem[]> {
  try {
    const res = await fetch(NEWS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 1800 }, // refresh every 30 min
    })
    if (!res.ok) return []
    const json = await res.json()
    const articles: unknown[] = json.articles ?? []

    return articles.slice(0, limit).map((a: unknown) => {
      const art = a as Record<string, unknown>
      const links = art.links as Record<string, unknown> | undefined
      const web = links?.web as Record<string, unknown> | undefined
      const images = art.images as Record<string, unknown>[] | undefined
      return {
        headline: String(art.headline ?? ''),
        description: String(art.description ?? ''),
        published: String(art.published ?? ''),
        link: String(web?.href ?? ''),
        image: images?.[0]?.url ? String(images[0].url) : undefined,
      }
    }).filter(n => n.headline)
  } catch {
    return []
  }
}
