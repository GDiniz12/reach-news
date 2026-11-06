/**
 * Utility to accurately resolve image source / photo credit for news stories.
 * Matches CDNs, original publishers, and fallbacks cleanly.
 */

export interface ImageCredit {
  name: string;
  domain?: string;
  url?: string;
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
