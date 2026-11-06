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
    pt: 'principais notícias Brasil e mundo tecnologia ciência economia hoje',
    en: 'top breaking news world technology science business today',
  },
  artificial_intelligence: {
    pt: 'inteligência artificial modelos LLM OpenAI Google Gemini Anthropic agentes IA',
    en: 'artificial intelligence LLM models OpenAI Google Gemini Anthropic AI agents',
  },
  technology: {
    pt: 'tecnologia inovação big tech software computação em nuvem',
    en: 'enterprise technology big tech software cloud computing innovation',
  },
  startups: {
    pt: 'startups venture capital investimentos unicórnios empreendedorismo tecnologia',
    en: 'startups venture capital funding unicorns tech entrepreneurship',
  },
  cybersecurity: {
    pt: 'cibersegurança hackers vazamento de dados proteção digital ataques cibernéticos',
    en: 'cybersecurity hackers data breach digital security cyber attacks',
  },
  hardware: {
    pt: 'semicondutores chips Nvidia processadores placas de vídeo smartphones hardware',
    en: 'semiconductors chips Nvidia processors GPUs smartphones hardware',
  },
  science: {
    pt: 'ciência descobertas científicas física biologia pesquisas laboratório',
    en: 'scientific discoveries physics biology laboratory research breakthroughs',
  },
  space: {
    pt: 'exploração espacial NASA SpaceX astronomia telescópio James Webb planetas',
    en: 'space exploration NASA SpaceX astronomy James Webb telescope exoplanets',
  },
  health: {
    pt: 'medicina saúde biotecnologia longevidade novos tratamentos neurociência',
    en: 'medicine healthcare biotechnology longevity clinical trials neuroscience',
  },
  climate: {
    pt: 'mudanças climáticas transição energética energia limpa sustentabilidade meio ambiente',
    en: 'climate change clean energy transition renewable energy sustainability environment',
  },
  economics: {
    pt: 'economia macroeconomia PIB inflação taxa Selic banco central comércio global',
    en: 'global economy macroeconomics inflation interest rates central banks trade',
  },
  finance: {
    pt: 'mercado financeiro bolsa de valores Ibovespa Wall Street ações investimentos',
    en: 'stock market Wall Street S&P 500 equities investment banking',
  },
  crypto: {
    pt: 'criptomoedas Bitcoin Ethereum blockchain Web3 ativos digitais ETFs cripto',
    en: 'cryptocurrency Bitcoin Ethereum blockchain Web3 digital assets crypto ETFs',
  },
  business: {
    pt: 'negócios grandes empresas fusões e aquisições varejo executivos corporativo',
    en: 'corporate business mergers and acquisitions retail CEOs strategy',
  },
  politics: {
    pt: 'política Brasil governo congresso STF eleições políticas públicas',
    en: 'national politics government congress supreme court elections public policy',
  },
  geopolitics: {
    pt: 'geopolítica diplomacia relações internacionais conflitos globais ONU alianças',
    en: 'geopolitics international relations global diplomacy foreign policy UN',
  },
  crime: {
    pt: 'segurança pública justiça investigações operações policiais tribunais',
    en: 'law enforcement justice system investigations court rulings public safety',
  },
  sports: {
    pt: 'esportes olimpíadas basquete NBA tênis atletismo competições mundiais',
    en: 'sports NBA basketball tennis athletics global championships',
  },
  football: {
    pt: 'futebol Brasileirão Copa Libertadores Champions League seleção brasileira mercado da bola',
    en: 'football soccer Champions League Premier League transfer market World Cup',
  },
  motorsport: {
    pt: 'Fórmula 1 automobilismo corridas pilotos construtores GP',
    en: 'Formula 1 motorsport racing F1 Grand Prix drivers championship',
  },
  entertainment: {
    pt: 'cinema filmes séries streaming Hollywood premiações Oscar TV',
    en: 'movies television series streaming Hollywood box office awards',
  },
  music: {
    pt: 'música shows festivais lançamentos álbuns indústria fonográfica artistas',
    en: 'music industry concerts festivals album releases artists streaming',
  },
  videogames: {
    pt: 'videogames jogos lançamentos PlayStation Xbox Nintendo PC gaming',
    en: 'video games gaming releases PlayStation Xbox Nintendo PC gaming',
  },
  esports: {
    pt: 'eSports campeonatos League of Legends Counter-Strike Valorant competitivo',
    en: 'esports tournaments League of Legends Counter-Strike Valorant pro gaming',
  },
  automotive: {
    pt: 'carros elétricos indústria automotiva veículos autônomos BYD Tesla montadoras',
    en: 'electric vehicles automotive industry autonomous driving EVs Tesla BYD',
  },
  education: {
    pt: 'educação universidades ensino superior futuro do trabalho carreira',
    en: 'higher education universities EdTech future of work careers',
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
  timeframe: '24h' | 'all' = 'all'
): Promise<RawNewsItem[]> {
  const items: RawNewsItem[] = [];
  const cutoffTime = timeframe === '24h' ? Date.now() - 24 * 60 * 60 * 1000 : 0;

  // 1. Primary: Bing News RSS (provides real high-res News:Image for the topic & clean descriptions)
  try {
    const mkt = lang === 'pt' ? 'pt-BR' : 'en-US';
    const cc = lang === 'pt' ? 'BR' : 'US';
    const enhancedQuery =
      timeframe === '24h' && !query.includes('24') && !query.includes('hoje')
        ? `${query} ${lang === 'pt' ? 'últimas 24 horas hoje' : 'today last 24 hours breaking'}`
        : query;
    const encodedQuery = encodeURIComponent(enhancedQuery);
    const bingUrl = `https://www.bing.com/news/search?q=${encodedQuery}&setlang=${mkt}&cc=${cc}&format=rss`;

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

      // Check 24-hour cutoff if timeframe === '24h'
      if (timeframe === '24h' && item.pubDate) {
        const itemTs = new Date(item.pubDate).getTime();
        if (!isNaN(itemTs) && itemTs < cutoffTime) {
          continue; // skip older than 24h
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

  // 2. Secondary supplement: Google News RSS if we need more sources (uses native 'when:24h' filter)
  if (items.length < 5) {
    try {
      const hl = lang === 'pt' ? 'pt-BR' : 'en-US';
      const gl = lang === 'pt' ? 'BR' : 'US';
      const ceid = lang === 'pt' ? 'BR:pt-419' : 'US:en';
      const googleQuery =
        timeframe === '24h'
          ? `${encodeURIComponent(query)}+when:24h`
          : encodeURIComponent(query);
      const rssUrl = `https://news.google.com/rss/search?q=${googleQuery}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

      const feed = await parser.parseURL(rssUrl);
      for (const item of (feed.items || []).slice(0, (limit - items.length) + 6)) {
        if (timeframe === '24h' && item.pubDate) {
          const itemTs = new Date(item.pubDate).getTime();
          if (!isNaN(itemTs) && itemTs < cutoffTime) {
            continue; // skip older than 24h
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
      $('meta[name="twitter:image"]').attr('content') ||
      undefined;

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
 * Finds the best real photograph for a topic from the collected news items or scrapes og:image from the top URLs
 */
export async function resolveTopicImage(items: RawNewsItem[], fallbackCategory: string): Promise<string> {
  // 1. Try scraping og:image from the top 3 real article URLs first (highest resolution original journalism photo)
  for (const item of items.slice(0, 3)) {
    if (item.url && !item.url.includes('news.google.com')) {
      const scraped = await fetchUrlContent(item.url);
      if (
        scraped.imageUrl &&
        scraped.imageUrl.startsWith('http') &&
        !scraped.imageUrl.includes('logo') &&
        !scraped.imageUrl.includes('favicon')
      ) {
        return scraped.imageUrl;
      }
    }
  }

  // 2. Use Bing News high-res article image if present on any item
  const itemWithImg = items.find((i) => i.imageUrl && i.imageUrl.startsWith('http'));
  if (itemWithImg?.imageUrl) {
    return itemWithImg.imageUrl;
  }

  // 3. Category-specific fallback
  const categoryMap: Record<string, string> = {
    sports: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=85',
    football: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=85',
    motorsport: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=85',
    technology: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85',
    artificial_intelligence: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=85',
    startups: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1200&q=85',
    cybersecurity: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=85',
    hardware: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=1200&q=85',
    science: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=85',
    space: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=85',
    health: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=85',
    climate: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1200&q=85',
    politics: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=85',
    geopolitics: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=85',
    economics: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=85',
    finance: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=85',
    crypto: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=1200&q=85',
    business: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=85',
    entertainment: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85',
    music: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=85',
    videogames: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=85',
    esports: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=1200&q=85',
    crime: 'https://images.unsplash.com/photo-1453873531674-2151bcd01707?auto=format&fit=crop&w=1200&q=85',
    automotive: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=1200&q=85',
    education: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=85',
  };

  return (
    categoryMap[fallbackCategory] ||
    'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=85'
  );
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
  const newsItems = await searchWebNews(baseQuery, lang, 18);

  const excludedTokenSets = excludeHeadlines.map((h) => extractSignificantTokens(h));
  const isCovered = (text: string) => {
    if (!excludedTokenSets.length) return false;
    const tokens = extractSignificantTokens(text);
    return excludedTokenSets.some((ex) => computeTokenOverlapScore(tokens, ex) >= 0.38);
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

  while (distinctHeadlines.length < count) {
    distinctHeadlines.push(`${baseQuery} (Destaque ${distinctHeadlines.length + 1})`);
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

