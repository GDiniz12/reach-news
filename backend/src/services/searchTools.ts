import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { extractSignificantTokens, computeTokenOverlapScore } from './deduplicationService';

const parser = new Parser({
  timeout: 8000,
  customFields: {
    item: [
      ['News:Image', 'newsImage'],
      ['News:Source', 'newsSource'],
    ],
  },
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ReachNewsBot/1.0',
  },
});

export interface RawNewsItem {
  title: string;
  url: string;
  sourceName: string;
  domain: string;
  publishedAt: string;
  snippet: string;
  imageUrl?: string;
}

export const CATEGORY_QUERIES: Record<string, { pt: string; en: string }> = {
  last_24h: {
    pt: 'plantão últimas notícias Brasil mundo últimas 24 horas fatos urgentes hoje',
    en: 'breaking news top headlines world today last 24 hours live updates',
  },
  popular: {
    pt: 'principais notícias Brasil mundo tecnologia ciência economia hoje recentes',
    en: 'top breaking news world technology science business today recent',
  },
  artificial_intelligence: {
    pt: 'inteligência artificial modelos LLM OpenAI Google Gemini Anthropic agentes IA novidades hoje',
    en: 'artificial intelligence LLM models OpenAI Google Gemini Anthropic AI agents today recent',
  },
  technology: {
    pt: 'tecnologia inovação big tech software computação nuvem lançamentos hoje recentes',
    en: 'enterprise technology big tech software cloud computing innovation today recent',
  },
  startups: {
    pt: 'startups venture capital investimentos captação rodadas tecnologia hoje recentes',
    en: 'startups venture capital funding unicorns tech entrepreneurship today recent',
  },
  cybersecurity: {
    pt: 'cibersegurança hackers vazamento dados proteção digital ataques hoje recentes',
    en: 'cybersecurity hackers data breach digital security cyber attacks today recent',
  },
  hardware: {
    pt: 'semicondutores chips Nvidia processadores placas vídeo smartphones hardware hoje recentes',
    en: 'semiconductors chips Nvidia processors GPUs smartphones hardware today recent',
  },
  science: {
    pt: 'ciência descobertas científicas astronomia física pesquisas laboratório hoje recentes',
    en: 'scientific discoveries physics biology laboratory research breakthroughs today recent',
  },
  space: {
    pt: 'exploração espacial NASA SpaceX astronomia telescópio James Webb lançamentos hoje recentes',
    en: 'space exploration NASA SpaceX astronomy James Webb telescope launches today recent',
  },
  health: {
    pt: 'medicina saúde biotecnologia novos tratamentos pesquisas clínicas hoje recentes',
    en: 'medicine healthcare biotechnology longevity clinical trials neuroscience today recent',
  },
  climate: {
    pt: 'mudanças climáticas transição energética energia limpa sustentabilidade meio ambiente hoje recentes',
    en: 'climate change clean energy transition renewable energy sustainability today recent',
  },
  economics: {
    pt: 'economia macroeconomia inflação IPCA taxa Selic Banco Central mercado financeiro hoje recentes',
    en: 'global economy macroeconomics inflation interest rates central banks trade today recent',
  },
  finance: {
    pt: 'mercado financeiro bolsa valores Ibovespa Wall Street ações investimentos hoje recentes',
    en: 'stock market Wall Street S&P 500 equities investment banking today recent',
  },
  crypto: {
    pt: 'criptomoedas Bitcoin Ethereum blockchain Web3 ativos digitais cotação hoje recentes',
    en: 'cryptocurrency Bitcoin Ethereum blockchain Web3 digital assets price today recent',
  },
  business: {
    pt: 'negócios grandes empresas fusões aquisições balanços corporativo hoje recentes',
    en: 'corporate business mergers and acquisitions earnings CEOs strategy today recent',
  },
  politics: {
    pt: 'política Brasil governo federal Congresso STF decisões eleições hoje recentes',
    en: 'national politics government congress supreme court elections public policy today recent',
  },
  geopolitics: {
    pt: 'geopolítica diplomacia relações internacionais conflitos globais ONU hoje recentes',
    en: 'geopolitics international relations global diplomacy foreign policy UN today recent',
  },
  crime: {
    pt: 'segurança pública investigações Polícia Federal operações policiais prisões hoje recentes',
    en: 'law enforcement justice system investigations police operations court rulings today recent',
  },
  sports: {
    pt: 'esportes futebol Brasileirão Champions League basquete NBA F1 resultados hoje recentes',
    en: 'sports soccer NBA basketball tennis athletics F1 championships today recent',
  },
  football: {
    pt: 'futebol Brasileirão Libertadores Champions League mercado bola jogos hoje recentes',
    en: 'football soccer Champions League Premier League transfer market matches today recent',
  },
  motorsport: {
    pt: 'Fórmula 1 automobilismo corridas pilotos Ferrari GP treinos hoje recentes',
    en: 'Formula 1 motorsport racing F1 Grand Prix drivers qualifying today recent',
  },
  entertainment: {
    pt: 'cinema filmes séries streaming estreias Hollywood premiações música hoje recentes',
    en: 'movies television series streaming Hollywood box office music releases today recent',
  },
  music: {
    pt: 'música shows festivais lançamentos álbuns turnês artistas hoje recentes',
    en: 'music industry concerts festivals album releases artists tours today recent',
  },
  videogames: {
    pt: 'videogames jogos lançamentos PlayStation Xbox Nintendo PC games hoje recentes',
    en: 'video games gaming releases PlayStation Xbox Nintendo PC gaming updates today recent',
  },
  esports: {
    pt: 'eSports campeonatos League of Legends CS2 Valorant torneios hoje recentes',
    en: 'esports tournaments League of Legends CS2 Valorant pro gaming today recent',
  },
  automotive: {
    pt: 'carros elétricos veículos autônomos indústria automotiva BYD Tesla montadoras hoje recentes',
    en: 'electric vehicles automotive industry autonomous driving EVs Tesla BYD today recent',
  },
  education: {
    pt: 'educação universidades ensino superior mercado trabalho futuro carreira hoje recentes',
    en: 'higher education universities EdTech future of work careers today recent',
  },
};

function extractRealUrlFromBing(bingLink: string): string {
  try {
    const parsed = new URL(bingLink);
    const realUrl = parsed.searchParams.get('url');
    if (realUrl) return decodeURIComponent(realUrl);
    return bingLink;
  } catch {
    return bingLink;
  }
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'news.com';
  }
}

/**
 * Tool 1: Search Bing News RSS (with real article photos & clean URLs) + Google News RSS fallback
 * Supports timeframe === '24h' for strict 24-hour news focus
 */
export async function searchWebNews(
  query: string,
  lang: 'pt' | 'en' = 'pt',
  limit = 12,
  timeframe: '24h' | 'recent' | 'all' = 'recent'
): Promise<RawNewsItem[]> {
  const items: RawNewsItem[] = [];
  // Recency cutoff: 24 hours for '24h', 72 hours (3 days) for 'recent', or unrestricted for 'all'
  const cutoffTime =
    timeframe === '24h'
      ? Date.now() - 24 * 60 * 60 * 1000
      : timeframe === 'recent'
      ? Date.now() - 72 * 60 * 60 * 1000
      : 0;

  // 1. Primary: Bing News RSS (provides real high-res News:Image for the topic & clean descriptions)
  try {
    const mkt = lang === 'pt' ? 'pt-BR' : 'en-US';
    const cc = lang === 'pt' ? 'BR' : 'US';
    const enhancedQuery =
      timeframe === '24h' && !query.includes('24') && !query.includes('hoje')
        ? `${query} ${lang === 'pt' ? 'últimas 24 horas hoje' : 'today last 24 hours breaking'}`
        : timeframe === 'recent' && !query.includes('hoje') && !query.includes('recent')
        ? `${query} ${lang === 'pt' ? 'notícias recentes hoje' : 'latest news today'}`
        : query;
    const encodedQuery = encodeURIComponent(enhancedQuery);
    // Interval 4 = past 24 hours, Interval 7 = past 7 days (paired with in-code cutoff validation)
    const intervalParam =
      timeframe === '24h' ? '&qft=interval%3d"4"' : timeframe === 'recent' ? '&qft=interval%3d"7"' : '';
    const bingUrl = `https://www.bing.com/news/search?q=${encodedQuery}&setlang=${mkt}&cc=${cc}${intervalParam}&format=rss`;

    const feed = await parser.parseURL(bingUrl);
    for (const item of (feed.items || []).slice(0, limit + 6)) {
      const anyItem = item as unknown as Record<string, string>;
      const rawUrl = item.link || '';
      const cleanUrl = extractRealUrlFromBing(rawUrl);
      const sourceName = anyItem.newsSource || item.creator || extractDomain(cleanUrl);
      const rawImage = anyItem.newsImage;
      // Upgrade Bing thumbnail to high-res 1200x675
      const hiResImage = rawImage
        ? rawImage.replace(/^http:\/\//i, 'https://') + '&w=1200&h=675&c=7&rs=1'
        : undefined;

      const cleanSnippet = (item.contentSnippet || item.content || '')
        .replace(/<[^>]*>?/gm, '')
        .trim()
        .slice(0, 400);

      // Enforce recency cutoff: discard stale articles older than cutoffTime
      if (cutoffTime > 0 && item.pubDate) {
        const itemTs = new Date(item.pubDate).getTime();
        if (!isNaN(itemTs) && itemTs < cutoffTime) {
          continue; // strictly skip older stories!
        }
      }

      if (item.title && cleanUrl) {
        items.push({
          title: item.title.trim(),
          url: cleanUrl,
          sourceName: String(sourceName).trim(),
          domain: extractDomain(cleanUrl),
          publishedAt: item.pubDate || new Date().toISOString(),
          snippet: cleanSnippet || item.title.trim(),
          imageUrl: hiResImage,
        });
      }

      if (items.length >= limit) break;
    }
  } catch (err) {
    console.warn(`[SearchTool] Bing RSS warning for "${query}":`, (err as Error).message);
  }

  // 2. Secondary supplement: Google News RSS with native 'when:24h' or 'when:48h' recency filters
  if (items.length < 5) {
    try {
      const hl = lang === 'pt' ? 'pt-BR' : 'en-US';
      const gl = lang === 'pt' ? 'BR' : 'US';
      const ceid = lang === 'pt' ? 'BR:pt-419' : 'US:en';
      const recencyFilter =
        timeframe === '24h' ? '+when:24h' : timeframe === 'recent' ? '+when:48h' : '';
      const googleQuery = `${encodeURIComponent(query)}${recencyFilter}`;
      const rssUrl = `https://news.google.com/rss/search?q=${googleQuery}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

      const feed = await parser.parseURL(rssUrl);
      for (const item of (feed.items || []).slice(0, (limit - items.length) + 6)) {
        if (cutoffTime > 0 && item.pubDate) {
          const itemTs = new Date(item.pubDate).getTime();
          if (!isNaN(itemTs) && itemTs < cutoffTime) {
            continue; // strictly skip older than cutoff
          }
        }

        const rawTitle = item.title || 'Untitled';
        const parts = rawTitle.split(' - ');
        const sourceName = parts.length > 1 ? parts.pop()!.trim() : item.creator || 'News Source';
        const cleanTitle = parts.join(' - ').trim() || rawTitle;
        const link = item.link || '';

        const rawSnippet = item.contentSnippet || item.content || '';
        const cleanSnippet = rawSnippet.replace(/<[^>]*>?/gm, '').trim().slice(0, 350);

        items.push({
          title: cleanTitle,
          url: link,
          sourceName,
          domain: sourceName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
          publishedAt: item.pubDate || new Date().toISOString(),
          snippet: cleanSnippet || cleanTitle,
        });

        if (items.length >= limit) break;
      }
    } catch (error) {
      console.warn(`[SearchTool] Google RSS warning for "${query}":`, (error as Error).message);
    }
  }

  return items;
}

/**
 * Tool 2: Scrape article metadata, og:image & full paragraphs from a real article URL
 */
export async function fetchUrlContent(url: string): Promise<{
  title: string;
  description: string;
  imageUrl?: string;
  bodyExcerpt: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').text() ||
      '';
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';
    let imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[property="og:image:secure_url"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[name="twitter:image:src"]').attr('content') ||
      $('link[rel="image_src"]').attr('href') ||
      undefined;

    // Fallback to JSON-LD NewsArticle image if meta tags are missing or generic
    if (!imageUrl || isLowQualityOrPlaceholderImage(imageUrl)) {
      $('script[type="application/ld+json"]').each((_, el) => {
        if (imageUrl && !isLowQualityOrPlaceholderImage(imageUrl)) return;
        try {
          const rawJson = $(el).html();
          if (!rawJson) return;
          const parsed = JSON.parse(rawJson);
          const nodes = Array.isArray(parsed)
            ? parsed
            : parsed?.['@graph'] && Array.isArray(parsed['@graph'])
            ? parsed['@graph']
            : [parsed];
          for (const node of nodes) {
            const nodeType = String(node?.['@type'] || '').toLowerCase();
            // Never extract images from Person, Author, Organization, or WebSite nodes (avoids author avatars/logos!)
            if (
              nodeType.includes('person') ||
              nodeType.includes('organization') ||
              nodeType.includes('website') ||
              nodeType.includes('imageobject')
            ) {
              continue;
            }
            const imgField = node?.image || node?.thumbnailUrl;
            if (!imgField) continue;
            if (typeof imgField === 'string' && imgField.startsWith('http')) {
              if (!isLowQualityOrPlaceholderImage(imgField)) {
                imageUrl = imgField;
                break;
              }
            } else if (Array.isArray(imgField)) {
              const firstValid = imgField
                .map((x: any) => (typeof x === 'string' ? x : x?.url))
                .find((u: any) => typeof u === 'string' && u.startsWith('http') && !isLowQualityOrPlaceholderImage(u));
              if (firstValid) {
                imageUrl = firstValid;
                break;
              }
            } else if (typeof imgField === 'object' && typeof imgField.url === 'string') {
              if (!isLowQualityOrPlaceholderImage(imgField.url)) {
                imageUrl = imgField.url;
                break;
              }
            }
          }
        } catch {
          // ignore malformed JSON-LD
        }
      });
    }

    if (imageUrl && imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }

    const paragraphs: string[] = [];
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 60 && paragraphs.length < 18) {
        paragraphs.push(text);
      }
    });

    return {
      title: title.trim(),
      description: description.trim(),
      imageUrl,
      bodyExcerpt: paragraphs.join('\n\n').slice(0, 5000),
    };
  } catch {
    return {
      title: '',
      description: '',
      bodyExcerpt: '',
    };
  }
}

/**
 * Normalizes an image URL so we can accurately detect duplicates even when CDNs
 * attach different resize/crop/timestamp query parameters.
 */
export function normalizeImageUrlForComparison(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    // Bing News thumbnails identify the image via the `id` query param
    if (host.includes('bing.com') && parsed.pathname.includes('/th')) {
      const bingId = parsed.searchParams.get('id');
      if (bingId) return `bing:${bingId}`;
    }

    // Globo / Thumbor URLs embed the original S3 path at the end
    const internalIdx = trimmed.indexOf('/internal_photos/');
    if (internalIdx !== -1) {
      return `glb:${trimmed.slice(internalIdx).split('?')[0].toLowerCase()}`;
    }

    // General normalization: strip resize/quality query params
    return `${host}${parsed.pathname.toLowerCase().replace(/\/+$/, '')}`;
  } catch {
    return trimmed.split('?')[0].toLowerCase();
  }
}

/**
 * Detects generic placeholders, site logos, avatars, social share banners, or broken patterns
 * that must never be selected as a reportage cover photo.
 */
export function isLowQualityOrPlaceholderImage(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return true;

  const lower = trimmed.toLowerCase();

  const badSubstrings = [
    'placeholder',
    'default-image',
    'default_image',
    'default-share',
    'default_share',
    'no-image',
    'no_image',
    'noimage',
    'sem-foto',
    'sem_foto',
    'favicon',
    'apple-touch-icon',
    'site-logo',
    'logo-default',
    'logo_default',
    'share-default',
    'og-default',
    'og_default',
    'fallback',
    'backup-capa',
    'gravatar.com',
    '/avatar/',
    'avatar-default',
    'blank.',
    '1x1',
    'pixel.',
    'spacer.',
    '/static/placeholder',
    'google.com/images/branding',
    'gstatic.com',
    'lh3.googleusercontent.com/J6_coFbogxhRI9iM864NL_liGXvsQp2AupsKei7z0cNNfDvGUmWUy20nuUhkREQyrpY4bEeIBuc',
  ];

  for (const pat of badSubstrings) {
    if (lower.includes(pat)) return true;
  }

  // Reject SVG or ICO files which are almost always vector logos/icons
  const pathOnly = lower.split('?')[0];
  if (pathOnly.endsWith('.svg') || pathOnly.endsWith('.ico') || pathOnly.endsWith('.gif')) {
    return true;
  }

  // Reject URLs where a path segment is literally "logo" or "logos" or "icons"
  if (/\/(logo|logos|icon|icons|brand|branding|avatars)\b/i.test(pathOnly)) {
    return true;
  }

  // Reject tiny explicit dimensions in URL (e.g. 150x150, 300x150, 430x323 small thumbs when better exists)
  const dimMatch = lower.match(/[/_-](\d{2,4})x(\d{2,4})(?=[._/-]|$)/);
  if (dimMatch) {
    const w = parseInt(dimMatch[1], 10);
    const h = parseInt(dimMatch[2], 10);
    if ((w > 0 && w < 360) || (h > 0 && h < 200)) {
      return true;
    }
  }

  return false;
}

const CATEGORY_IMAGE_POOLS: Record<string, string[]> = {
  sports: [
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=85',
  ],
  football: [
    'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=85',
  ],
  motorsport: [
    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1541447271487-09612b3f49f7?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85',
  ],
  technology: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=85',
  ],
  artificial_intelligence: [
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1655720828018-edd2daec9349?auto=format&fit=crop&w=1200&q=85',
  ],
  science: [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=1200&q=85',
  ],
  politics: [
    'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1555848962-6e79363ec58f?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1575320181282-9afab399332c?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=85',
  ],
  economics: [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=1200&q=85',
  ],
  entertainment: [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?auto=format&fit=crop&w=1200&q=85',
  ],
  videogames: [
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=1200&q=85',
  ],
  crime: [
    'https://images.unsplash.com/photo-1453873531674-2151bcd01707?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1568992687947-868a62a9f521?auto=format&fit=crop&w=1200&q=85',
  ],
};

/**
 * Finds the best real photograph for a topic from the collected news items or scrapes og:image from the top URLs.
 * Strictly ranks candidates by semantic relevance to the synthesized headline/query and prevents reusing images
 * already assigned to other stories in the database.
 */
export async function resolveTopicImage(
  items: RawNewsItem[],
  fallbackCategory: string,
  options?: {
    targetHeadline?: string;
    query?: string;
    usedImageUrls?: Iterable<string>;
  }
): Promise<string> {
  const usedNormalized = new Set<string>();
  if (options?.usedImageUrls) {
    for (const u of options.usedImageUrls) {
      const norm = normalizeImageUrlForComparison(u);
      if (norm) usedNormalized.add(norm);
    }
  }

  const isAlreadyUsed = (url: string): boolean => {
    const norm = normalizeImageUrlForComparison(url);
    return norm ? usedNormalized.has(norm) : false;
  };

  const referenceText = `${options?.targetHeadline || ''} ${options?.query || ''}`.trim();
  const refTokens: Set<string> = referenceText
    ? extractSignificantTokens(referenceText)
    : new Set<string>();

  // Score and sort items so we inspect the articles that most closely match the actual story headline first!
  const scoredItems = items.map((item, idx) => {
    let relevance = 0;
    if (refTokens.size > 0) {
      const itemTokens = extractSignificantTokens(`${item.title} ${item.snippet || ''}`);
      relevance = computeTokenOverlapScore(refTokens, itemTokens);
    }
    const hasDirectUrl = item.url && !item.url.includes('news.google.com') ? 0.15 : 0;
    // Slight preference for earlier items when relevance is tied
    const positionBonus = Math.max(0, (12 - idx) * 0.01);
    return {
      item,
      score: relevance + hasDirectUrl + positionBonus,
      relevance,
    };
  });

  scoredItems.sort((a, b) => b.score - a.score);

  // 1. Try scraping og:image from the top relevant real article URLs (up to 6 candidates)
  let bestUnusedBingImage: string | undefined;
  let fallbackUsedRealImage: string | undefined;

  const scrapeCandidates = scoredItems
    .filter((entry) => entry.item.url && !entry.item.url.includes('news.google.com'))
    .slice(0, 6);

  for (const { item, relevance } of scrapeCandidates) {
    // If we have a target headline and this source has 0 token overlap with it, skip scraping its photo
    // unless we have no other relevant sources.
    if (refTokens.size >= 3 && relevance === 0 && scrapeCandidates.some((c) => c.relevance > 0)) {
      continue;
    }

    const scraped = await fetchUrlContent(item.url);
    const candidateImg = scraped.imageUrl;

    if (candidateImg && !isLowQualityOrPlaceholderImage(candidateImg)) {
      // Also check if the image filename itself is a known mismatch (e.g. generic portal banner)
      if (!isAlreadyUsed(candidateImg)) {
        return candidateImg;
      }
      if (!fallbackUsedRealImage) {
        fallbackUsedRealImage = candidateImg;
      }
    }

    if (item.imageUrl && !isLowQualityOrPlaceholderImage(item.imageUrl)) {
      if (!isAlreadyUsed(item.imageUrl) && !bestUnusedBingImage) {
        bestUnusedBingImage = item.imageUrl;
      }
    }
  }

  // 2. If direct og:image scraping didn't yield an unused photo, check Bing News high-res images on relevant items
  if (bestUnusedBingImage) {
    return bestUnusedBingImage;
  }

  for (const { item, relevance } of scoredItems) {
    if (refTokens.size >= 3 && relevance === 0 && scoredItems.some((c) => c.relevance > 0)) {
      continue;
    }
    if (item.imageUrl && !isLowQualityOrPlaceholderImage(item.imageUrl)) {
      if (!isAlreadyUsed(item.imageUrl)) {
        return item.imageUrl;
      }
      if (!fallbackUsedRealImage) {
        fallbackUsedRealImage = item.imageUrl;
      }
    }
  }

  // 3. Active Bing News Image Search by specific headline/query if all items were Google News links or lacked photos
  const searchTopic = (options?.targetHeadline || options?.query || '').trim();
  if (searchTopic.length > 5) {
    try {
      const encoded = encodeURIComponent(searchTopic.split(/\s+/).slice(0, 8).join(' '));
      const bingImgRss = `https://www.bing.com/news/search?q=${encoded}&setlang=pt-BR&cc=BR&format=rss`;
      const feed = await parser.parseURL(bingImgRss);
      for (const feedItem of (feed.items || []).slice(0, 6)) {
        const anyItem = feedItem as unknown as Record<string, string>;
        const rawImage = anyItem.newsImage;
        if (rawImage) {
          const hiRes = rawImage.replace(/^http:\/\//i, 'https://') + '&w=1200&h=675&c=7&rs=1';
          if (!isLowQualityOrPlaceholderImage(hiRes) && !isAlreadyUsed(hiRes)) {
            return hiRes;
          }
        }
        const realLink = extractRealUrlFromBing(feedItem.link || '');
        if (realLink && !realLink.includes('news.google.com')) {
          const scraped = await fetchUrlContent(realLink);
          if (
            scraped.imageUrl &&
            !isLowQualityOrPlaceholderImage(scraped.imageUrl) &&
            !isAlreadyUsed(scraped.imageUrl)
          ) {
            return scraped.imageUrl;
          }
        }
      }
    } catch {
      // ignore fallback search errors
    }
  }

  // 4. Category-specific diversified pool (picks an UNUSED photo from the category pool first)
  const pool =
    CATEGORY_IMAGE_POOLS[fallbackCategory] ||
    CATEGORY_IMAGE_POOLS.technology;

  for (const poolUrl of pool) {
    if (!isAlreadyUsed(poolUrl)) {
      return poolUrl;
    }
  }

  // Deterministic hash pick based on headline so even when pool is exhausted, consecutive stories vary
  const hashSource = referenceText || String(Date.now());
  let hash = 0;
  for (let i = 0; i < hashSource.length; i++) {
    hash = (hash * 31 + hashSource.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

/**
 * Tool 3: Discover the top 5 most talked-about trending topics right now
 * Combines Google Trends Daily RSS (BR + US), X/Twitter Trends24 live scrape, and Google News Top Stories
 * Filters out topics that match already covered headlines.
 */
export async function fetchTrendingTopics(
  limit = 5,
  excludeHeadlines: string[] = []
): Promise<string[]> {
  const candidates: string[] = [];
  const excludedTokenSets = excludeHeadlines.map((h) => extractSignificantTokens(h));

  const isCovered = (text: string) => {
    if (!excludedTokenSets.length) return false;
    const tokens = extractSignificantTokens(text);
    return excludedTokenSets.some((ex) => computeTokenOverlapScore(tokens, ex) >= 0.38);
  };

  // 1. Google Trends Daily RSS (Brazil - real-time search spikes)
  try {
    const trendsFeedBr = await parser.parseURL('https://trends.google.com/trending/rss?geo=BR');
    for (const item of (trendsFeedBr.items || []).slice(0, 10)) {
      if (item.title && item.title.trim().length > 2) {
        const clean = item.title.trim();
        if (!isCovered(clean)) {
          candidates.push(clean);
        }
      }
    }
  } catch (err) {
    console.warn('[TrendingTool] Google Trends BR RSS warning:', (err as Error).message);
  }

  // 2. X / Twitter Live Trending Topics (via Trends24 Brazil / Worldwide)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://trends24.in/brazil/', {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      $('.trend-card__list li a').each((_, el) => {
        const text = $(el).text().trim().replace(/^#/, '');
        if (text.length > 3 && candidates.length < 20) {
          if (!isCovered(text)) {
            candidates.push(text);
          }
        }
      });
    }
  } catch (err) {
    console.warn('[TrendingTool] X/Trends24 warning:', (err as Error).message);
  }

  // 3. Google News Top Headlines RSS (Headline clusters with highest media coverage)
  try {
    const topNewsFeed = await parser.parseURL(
      'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419'
    );
    for (const item of (topNewsFeed.items || []).slice(0, 10)) {
      if (item.title) {
        const cleanHeadline = item.title.split(' - ')[0].trim();
        if (cleanHeadline.length > 10 && !isCovered(cleanHeadline)) {
          candidates.push(cleanHeadline);
        }
      }
    }
  } catch (err) {
    console.warn('[TrendingTool] Google News Top Stories warning:', (err as Error).message);
  }

  // Deduplicate by normalized prefix
  const uniqueTopics: string[] = [];
  const seen = new Set<string>();
  for (const topic of candidates) {
    const norm = topic
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 18);
    if (norm.length >= 3 && !seen.has(norm)) {
      seen.add(norm);
      uniqueTopics.push(topic);
    }
    if (uniqueTopics.length >= limit) break;
  }

  return uniqueTopics.slice(0, limit);
}

const CATEGORY_SUBQUERIES: Record<string, string[]> = {
  technology: [
    'inteligência artificial modelos agentes IA novidades hoje',
    'big tech semicondutores chips Nvidia software novidades hoje',
    'cibersegurança computação em nuvem startups inovações hoje',
  ],
  sports: [
    'futebol brasileiro Brasileirão rodada mercado da bola hoje',
    'futebol europeu Champions League Premier League hoje',
    'Fórmula 1 basquete NBA automobilismo resultados hoje',
  ],
  economics: [
    'Banco Central taxa Selic inflação IPCA juros Copom hoje',
    'bolsa de valores Ibovespa Wall Street ações câmbio dólar hoje',
    'política fiscal pacote gastos dívida pública PIB hoje',
  ],
  politics: [
    'Congresso Nacional Senado Câmara dos Deputados votações hoje',
    'STF Supremo Tribunal Federal decisões governo federal hoje',
    'relações internacionais diplomacia Mercosul geopolítica hoje',
  ],
  science: [
    'astronomia NASA telescópio James Webb espaço descobertas hoje',
    'pesquisa científica medicina genética laboratório descobertas hoje',
    'energia limpa clima física quântica estudos recentes hoje',
  ],
  videogames: [
    'lançamentos games PlayStation 5 Xbox Nintendo Switch hoje',
    'GTA VI novidades estúdios indústria gamer atualizações hoje',
    'eSports campeonatos Steam Valve jogos eletrônicos hoje',
  ],
  entertainment: [
    'cinema filmes estreias bilheteria Hollywood premiações hoje',
    'streaming séries Netflix novidades elenco hoje',
    'música álbuns shows festivais artistas lançamentos hoje',
  ],
  crime: [
    'Polícia Federal operações policiais mandados prisões hoje',
    'segurança pública investigações delegacia inquéritos hoje',
    'justiça julgamento tribunais combate a fraudes hoje',
  ],
};

/**
 * Tool 4: Discover distinct breaking news topics for a specific platform category
 * Filters out topics matching already covered stories.
 */
export async function fetchDistinctCategoryTopics(
  category: string,
  count = 2,
  lang: 'pt' | 'en' = 'pt',
  excludeHeadlines: string[] = []
): Promise<string[]> {
  const queryObj = CATEGORY_QUERIES[category] || CATEGORY_QUERIES.popular;
  const baseQuery = lang === 'pt' ? queryObj.pt : queryObj.en;
  // Always use 'recent' to prevent digging up old articles
  const newsItems = await searchWebNews(baseQuery, lang, 24, 'recent');

  const excludedTokenSets = excludeHeadlines.map((h) => extractSignificantTokens(h));
  const isCovered = (text: string) => {
    if (!excludedTokenSets.length) return false;
    const tokens = extractSignificantTokens(text);
    return excludedTokenSets.some((ex) => computeTokenOverlapScore(tokens, ex) >= 0.28);
  };

  const distinctHeadlines: string[] = [];
  const seenTokens = new Set<string>();

  for (const item of newsItems) {
    const cleanTitle = item.title.split(' - ')[0].trim();
    if (isCovered(cleanTitle)) {
      continue; // Skip topic if it matches an existing story!
    }

    const words = cleanTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 3)
      .join('_');

    if (words && !seenTokens.has(words) && cleanTitle.length > 15) {
      seenTokens.add(words);
      distinctHeadlines.push(cleanTitle);
    }
    if (distinctHeadlines.length >= count) break;
  }

  // If still need more distinct topics, query category-specific subqueries instead of repeating the base query!
  if (distinctHeadlines.length < count) {
    const subqueries = CATEGORY_SUBQUERIES[category] || [];
    for (const subq of subqueries) {
      if (distinctHeadlines.length >= count) break;
      const subItems = await searchWebNews(subq, lang, 10, 'recent');
      for (const item of subItems) {
        const cleanTitle = item.title.split(' - ')[0].trim();
        if (cleanTitle.length > 15 && !isCovered(cleanTitle) && !distinctHeadlines.includes(cleanTitle)) {
          distinctHeadlines.push(cleanTitle);
          break;
        }
      }
    }
  }

  return distinctHeadlines.slice(0, count);
}

/**
 * Tool 5: Discover breaking news topics specifically restricted to the last 24 hours
 * Focuses on urgent real-time headlines with Google News when:24h filter and live trends,
 * strictly skipping any already covered headlines.
 */
export async function fetch24hBreakingTopics(
  limit = 5,
  lang: 'pt' | 'en' = 'pt',
  excludeHeadlines: string[] = []
): Promise<string[]> {
  const queryObj = CATEGORY_QUERIES.last_24h || CATEGORY_QUERIES.popular;
  const baseQuery = lang === 'pt' ? queryObj.pt : queryObj.en;
  
  // Search with strict timeframe === '24h'
  const newsItems = await searchWebNews(baseQuery, lang, 20, '24h');
  const candidates: string[] = [];
  const seenTokens = new Set<string>();

  const excludedTokenSets = excludeHeadlines.map((h) => extractSignificantTokens(h));
  const isCovered = (text: string) => {
    if (!excludedTokenSets.length) return false;
    const tokens = extractSignificantTokens(text);
    return excludedTokenSets.some((ex) => computeTokenOverlapScore(tokens, ex) >= 0.38);
  };

  for (const item of newsItems) {
    const cleanTitle = item.title.split(' - ')[0].trim();
    if (isCovered(cleanTitle)) {
      continue; // Skip already covered topic!
    }

    const token = cleanTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 3)
      .join('_');

    if (token && !seenTokens.has(token) && cleanTitle.length > 15) {
      seenTokens.add(token);
      candidates.push(cleanTitle);
    }
    if (candidates.length >= limit) break;
  }

  // Supplement with top trending topics if needed
  if (candidates.length < limit) {
    const trending = await fetchTrendingTopics(limit, excludeHeadlines);
    for (const t of trending) {
      if (!candidates.includes(t) && !isCovered(t)) {
        candidates.push(t);
      }
      if (candidates.length >= limit) break;
    }
  }

  return candidates.slice(0, limit);
}

