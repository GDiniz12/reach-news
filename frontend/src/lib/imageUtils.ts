/**
 * Utility to accurately resolve image source / photo credit for news stories.
 * Matches CDNs, original publishers, and fallbacks cleanly.
 */

export interface ImageCredit {
  name: string;
  domain?: string;
  url?: string;
}

const FRONTEND_CATEGORY_FALLBACKS: Record<string, string[]> = {
  sports: [
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=85',
  ],
  technology: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=85',
  ],
  science: [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=85',
  ],
  politics: [
    'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1555848962-6e79363ec58f?auto=format&fit=crop&w=1200&q=85',
  ],
  economics: [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=85',
  ],
  entertainment: [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=85',
  ],
  videogames: [
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=85',
  ],
  crime: [
    'https://images.unsplash.com/photo-1453873531674-2151bcd01707?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=85',
  ],
};

export function getFallbackStoryImage(category?: string, seed?: string): string {
  const cat = (category || 'technology').toLowerCase();
  const pool = FRONTEND_CATEGORY_FALLBACKS[cat] || FRONTEND_CATEGORY_FALLBACKS.technology;
  if (!seed) return pool[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

export function getSafeStoryImageUrl(
  imageUrl: string | undefined | null,
  category?: string,
  seed?: string
): string {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return getFallbackStoryImage(category, seed);
  }
  const lower = imageUrl.toLowerCase();
  if (
    lower.includes('placeholder') ||
    lower.includes('default-image') ||
    lower.includes('no-image') ||
    lower.includes('sem-foto') ||
    lower.includes('backup-capa') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.ico')
  ) {
    return getFallbackStoryImage(category, seed);
  }
  return imageUrl;
}

export function resolveImageCredit(
  imageUrl: string | undefined | null,
  sources?: Array<{ name: string; domain?: string; url?: string }>,
  lang: 'pt' | 'en' = 'pt'
): ImageCredit {
  if (!imageUrl) {
    return { name: lang === 'pt' ? 'Divulgação / Imprensa' : 'Press / Media' };
  }

  const urlLow = imageUrl.toLowerCase();

  // 1. Unsplash library
  if (urlLow.includes('unsplash.com')) {
    return {
      name: 'Unsplash',
      domain: 'unsplash.com',
      url: 'https://unsplash.com',
    };
  }

  // 2. Wikimedia Commons
  if (urlLow.includes('wikimedia.org') || urlLow.includes('wikipedia.org')) {
    return {
      name: 'Wikimedia Commons',
      domain: 'wikimedia.org',
      url: 'https://commons.wikimedia.org',
    };
  }

  // 3. Known publisher image CDNs
  if (urlLow.includes('glbimg.com') || urlLow.includes('globo.com')) {
    const gSource = sources?.find(
      (s) =>
        s.domain?.includes('globo') ||
        s.name.toLowerCase().includes('globo') ||
        s.name.toLowerCase().includes('valor') ||
        s.name.toLowerCase().includes('ge')
    );
    return {
      name: gSource?.name || 'Grupo Globo / Divulgação',
      domain: gSource?.domain || 'globo.com',
      url: gSource?.url,
    };
  }

  if (urlLow.includes('reuters.com') || urlLow.includes('reutersmedia.net')) {
    return { name: 'Reuters', domain: 'reuters.com', url: 'https://www.reuters.com' };
  }
  if (urlLow.includes('bloomberg.com')) {
    return { name: 'Bloomberg', domain: 'bloomberg.com', url: 'https://www.bloomberg.com' };
  }
  if (urlLow.includes('ft.com')) {
    return { name: 'Financial Times', domain: 'ft.com', url: 'https://www.ft.com' };
  }
  if (urlLow.includes('theverge.com') || urlLow.includes('vox-cdn.com')) {
    return { name: 'The Verge', domain: 'theverge.com', url: 'https://www.theverge.com' };
  }
  if (urlLow.includes('techcrunch.com')) {
    return { name: 'TechCrunch', domain: 'techcrunch.com', url: 'https://techcrunch.com' };
  }
  if (urlLow.includes('folha.uol.com.br') || urlLow.includes('uol.com.br')) {
    return { name: 'Folha de S.Paulo / UOL', domain: 'uol.com.br', url: 'https://www.uol.com.br' };
  }
  if (urlLow.includes('estadao.com.br')) {
    return { name: 'Estadão', domain: 'estadao.com.br', url: 'https://www.estadao.com.br' };
  }
  if (urlLow.includes('cnn.com') || urlLow.includes('cnnbrasil.com.br')) {
    return { name: 'CNN', domain: 'cnnbrasil.com.br', url: 'https://www.cnnbrasil.com.br' };
  }
  if (urlLow.includes('gazetadopovo.com.br')) {
    return { name: 'Gazeta do Povo', domain: 'gazetadopovo.com.br', url: 'https://www.gazetadopovo.com.br' };
  }
  if (urlLow.includes('nasa.gov')) {
    return { name: 'NASA', domain: 'nasa.gov', url: 'https://www.nasa.gov' };
  }
  if (urlLow.includes('nature.com')) {
    return { name: 'Nature', domain: 'nature.com', url: 'https://www.nature.com' };
  }
  if (urlLow.includes('apnews.com')) {
    return { name: 'Associated Press', domain: 'apnews.com', url: 'https://apnews.com' };
  }

  // 4. Match domain with original news sources
  if (sources && sources.length > 0) {
    try {
      const parsedUrl = new URL(imageUrl);
      const host = parsedUrl.hostname.replace(/^www\./, '');
      const match = sources.find(
        (s) => s.domain && (s.domain.includes(host) || host.includes(s.domain))
      );
      if (match) {
        return {
          name: match.name,
          domain: match.domain,
          url: match.url,
        };
      }
    } catch {
      // ignore
    }

    // When the photo is original journalism from the primary source reporting:
    const primary = sources[0];
    if (primary && primary.name) {
      return {
        name: primary.name,
        domain: primary.domain,
        url: primary.url,
      };
    }
  }

  // 5. Fallback extracting host from URL
  try {
    const parsed = new URL(imageUrl);
    const host = parsed.hostname.replace(/^www\./, '');
    return { name: host, domain: host, url: `https://${host}` };
  } catch {
    return { name: lang === 'pt' ? 'Acervo / Divulgação' : 'Press Archive' };
  }
}
