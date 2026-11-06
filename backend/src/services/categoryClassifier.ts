import { prisma } from '../lib/prisma';

export const VALID_CATEGORIES = [
  'popular',
  'last_24h',
  'technology',
  'sports',
  'entertainment',
  'science',
  'politics',
  'crime',
  'economics',
  'videogames',
] as const;

export type ValidCategory = (typeof VALID_CATEGORIES)[number];

interface CategoryRule {
  weight: number;
  keywords: string[];
}

const CATEGORY_RULES: Record<string, CategoryRule> = {
  sports: {
    weight: 1.0,
    keywords: [
      'futebol', 'champions league', 'libertadores', 'brasileirao', 'brasileirão',
      'premier league', 'copa do mundo', 'nba', 'basquete', 'formula 1', 'fórmula 1',
      'f1', 'tenis', 'tênis', 'atletismo', 'olimpiadas', 'olimpíadas', 'volei', 'vôlei',
      'atleta', 'tecnico', 'técnico', 'goleiro', 'gol', 'gols', 'goleada', 'rodada',
      'artilheiro', 'scuderia', 'ferrari', 'red bull', 'mclaren', 'corrida', 'piloto',
      'pilotos', 'cristiano ronaldo', 'messi', 'neymar', 'real madrid', 'flamengo',
      'palmeiras', 'corinthians', 'sao paulo fc', 'são paulo fc', 'cruzeiro', 'liverpool',
      'manchester', 'ufc', 'lutador', 'cinturao', 'cinturão', 'nfl', 'touchdown',
      'maracana', 'maracanã', 'estadio', 'estádio', 'campeonato', 'torneio esportivo',
      'transfer market', 'playoffs', 'liga europa', 'liga conferencia', 'liga conferência',
      'duplantis', 'sheilla castro', 'pierre sage', 'crystal palace', 'trabzonspor',
      'freiburg', 'klay thompson', 'wiggins', 'chase center',
    ],
  },
  politics: {
    weight: 1.2, // high priority when political entities/offices appear
    keywords: [
      'lula', 'bolsonaro', 'stf', 'supremo tribunal federal', 'congresso nacional',
      'senado', 'senador', 'camara dos deputados', 'câmara dos deputados', 'deputado',
      'ministerio', 'ministério', 'ministro', 'chanceler', 'eleicoes', 'eleições',
      'eleicao', 'eleição', 'urnas', 'partido', 'partidos', 'pt', 'pl', 'psol',
      'republicanos', 'democratas', 'trump', 'biden', 'obama', 'casa branca',
      'governo federal', 'governo', 'governador', 'prefeito', 'prefeitura',
      'politica', 'política', 'diplomacia', 'relacoes internacionais', 'relações internacionais',
      'geopolitica', 'geopolítica', 'parlamento', 'sancoes', 'sanções', 'tratado',
      'cpi', 'projeto de lei', 'pec', 'planalto', 'reeleicao', 'reeleição',
      'cúpula do mercosul', 'cupula do mercosul', 'mercosul', 'g20', 'brics', 'onu',
      'segundo turno', 'primeiro turno', 'voto', 'votacao', 'votação', 'midterms',
    ],
  },
  economics: {
    weight: 1.1,
    keywords: [
      'banco central', 'bancen', 'bacen', 'selic', 'taxa selic', 'copom', 'juros',
      'taxa de juros', 'inflacao', 'inflação', 'ipca', 'pib', 'divida publica', 'dívida pública',
      'mercado financeiro', 'bovespa', 'ibovespa', 'b3', 'bolsa de valores', 'wall street',
      'fed', 'federal reserve', 'dolar', 'dólar', 'cambio', 'câmbio', 'receita federal',
      'tesouro nacional', 'corte de gastos', 'pacote fiscal', 'arcabouco fiscal', 'arcabouço fiscal',
      'fmi', 'fusao', 'fusão', 'aquisicao', 'aquisição', 'lucro liquido', 'lucro líquido',
      'balanco', 'balanço', 'dividendos', 'startups', 'venture capital', 'fundos de investimento',
      'cripto', 'criptomoedas', 'bitcoin', 'ethereum', 'etf', 'ueno bank', 'cimed',
      'haddad', 'galipolo', 'galípolo', 'lara resende', 'andre lara resende', 'andré lara resende',
      'mercado', 'investidores', 'acoes', 'ações', 'commodities', 'petroleo', 'petróleo',
      'insurtech', 'seguros', 'credito', 'crédito',
    ],
  },
  technology: {
    weight: 1.0,
    keywords: [
      'inteligencia artificial', 'inteligência artificial', 'ia', 'ai', 'llm', 'llms',
      'openai', 'gemini', 'anthropic', 'dario amodei', 'sam altman', 'deepseek', 'chatgpt',
      'claude', 'nvidia', 'chips', 'semicondutores', 'microsoft', 'google', 'apple',
      'meta', 'zuckerberg', 'amazon aws', 'aws', 'azure', 'computacao em nuvem', 'computação em nuvem',
      'cloud', 'software', 'ciberseguranca', 'cibersegurança', 'hacker', 'ransomware',
      'big tech', 'algoritmo', 'wearable', 'wearables', 'smartphone', 'iphone', 'android',
      'nothing phone', 'computacao quantica', 'computação quântica', 'robotica', 'robótica',
      'automacao', 'automação', 'hardware', 'deep learning', 'machine learning',
    ],
  },
  videogames: {
    weight: 1.2,
    keywords: [
      'videogame', 'videogames', 'video game', 'video games', 'jogos eletronicos', 'jogos eletrônicos',
      'playstation', 'ps5', 'ps4', 'sony playstation', 'xbox', 'xbox series', 'nintendo',
      'switch', 'switch 2', 'steam', 'valve', 'gta', 'grand theft auto', 'gta vi',
      'zelda', 'ocarina of time', 'pokemon', 'pokémon', 'epic games', 'unreal engine',
      'gameplay', 'mod', 'rpg', 'esports', 'e-sports', 'counter-strike', 'cs2', 'valorant',
      'league of legends', 'lol', 'dota', 'fortnite', 'roblox', 'ubisoft', 'ea sports',
      'capcom', 'konami', 'game pass', 'black friday do playstation',
    ],
  },
  entertainment: {
    weight: 1.0,
    keywords: [
      'cinema', 'filme', 'filmes', 'serie', 'série', 'series', 'séries', 'streaming',
      'netflix', 'hbo', 'max', 'disney', 'disney+', 'oscar', 'emmy', 'grammy',
      'festival', 'show', 'shows', 'turne', 'turnê', 'musica', 'música', 'album', 'álbum',
      'cantor', 'cantora', 'clipe', 'hollywood', 'ator', 'atriz', 'anitta', 'luiz bacci',
      'ana maria braga', 'luciano huck', 'tv globo', 'novela', 'novela das nove', 'ccxp',
      'stallone', 'samuel l. jackson', 'vingadores', 'celebridade', 'famosos', 'bilheteria',
      'bilheterias', 'taylor swift', 'beyonce', 'beyoncé',
    ],
  },
  science: {
    weight: 1.1,
    keywords: [
      'telescopio', 'telescópio', 'james webb', 'nasa', 'spacex', 'astronomia', 'planeta',
      'exoplaneta', 'galaxia', 'galáxia', 'cosmos', 'universo', 'astrofisica', 'astrofísica',
      'fisica', 'física', 'mecanica quantica', 'mecânica quântica', 'biologia', 'genetica', 'genética',
      'medicina', 'vacina', 'pesquisadores', 'cientistas', 'cern', 'fusao nuclear', 'fusão nuclear',
      'clima', 'meio ambiente', 'aquecimento global', 'mulheres na ciencia', 'mulheres na ciência',
      'plumas de europa', 'encelado', 'encélado', 'telescopio espacial', 'telescópio espacial',
      'nancy grace roman',
    ],
  },
  crime: {
    weight: 1.1,
    keywords: [
      'policia', 'polícia', 'pf', 'policia federal', 'polícia federal', 'policia civil',
      'polícia civil', 'policia militar', 'polícia militar', 'delegado', 'prisao', 'prisão',
      'preso', 'presos', 'mandado de prisao', 'mandado de prisão', 'apreensao', 'apreensão',
      'trafico', 'tráfico', 'homicidio', 'homicídio', 'assassinato', 'estupro', 'agressao',
      'agressão', 'golpe', 'fraude', 'operacao policial', 'operação policial', 'quadrilha',
      'faccao', 'facção', 'cnj', 'tribunal', 'julgamento', 'condenacao', 'condenação',
      'juri', 'júri', 'cadeia', 'penitenciaria', 'penitenciária', 'letalidade policial',
      'russell brand', 'policial civil', 'espionagem', 'investigacao', 'investigação',
    ],
  },
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Accurately classifies the category of a news story based on title, summary, and content.
 * Prevents political/economic news from erroneously leaking into sports, and vice versa.
 */
export function classifyStoryCategory(params: {
  title: string;
  summary?: string;
  content?: string;
  hintCategory?: string;
}): { category: string; confidence: number; detectedReason: string } {
  const { title, summary = '', content = '', hintCategory } = params;
  const fullText = normalizeText(`${title} ${title} ${summary} ${content.slice(0, 1000)}`);

  const scores: Record<string, number> = {
    politics: 0,
    sports: 0,
    economics: 0,
    technology: 0,
    videogames: 0,
    entertainment: 0,
    science: 0,
    crime: 0,
  };

  for (const [cat, rule] of Object.entries(CATEGORY_RULES)) {
    for (const kw of rule.keywords) {
      const normKw = normalizeText(kw);
      if (normKw.length < 3) continue;

      // Exact word boundary matching for high accuracy
      const regex = new RegExp(`\\b${normKw}\\b`, 'g');
      const matches = fullText.match(regex);
      if (matches) {
        scores[cat] += matches.length * rule.weight * (normKw.includes(' ') ? 2.5 : 1.2);
      }
    }
  }

  // Boost hintCategory slightly if it is a valid core category and already has some relevant signal
  if (hintCategory && scores[hintCategory] !== undefined && scores[hintCategory] > 0) {
    scores[hintCategory] *= 1.3;
  }

  // Find top scoring category
  let topCategory = 'technology';
  let topScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topCategory = cat;
    }
  }

  // STRICT DOMAIN SAFEGUARDS:
  const isHardSports =
    fullText.includes('cristiano ronaldo') ||
    fullText.includes('neymar') ||
    fullText.includes('messi') ||
    fullText.includes('futebol') ||
    fullText.includes('formula 1') ||
    fullText.includes('fórmula 1') ||
    fullText.includes('nba') ||
    fullText.includes('ufc') ||
    fullText.includes('libertadores') ||
    fullText.includes('champions league') ||
    fullText.includes('champions') ||
    fullText.includes('volei') ||
    fullText.includes('atletismo');

  const isHardEconomics =
    fullText.includes('selic') ||
    fullText.includes('taxa selic') ||
    fullText.includes('copom') ||
    fullText.includes('inflacao') ||
    fullText.includes('inflação') ||
    fullText.includes('banco central') ||
    fullText.includes('ueno bank') ||
    fullText.includes('divida publica') ||
    fullText.includes('dívida pública') ||
    fullText.includes('mercado financeiro') ||
    fullText.includes('ibovespa') ||
    fullText.includes('bolsa de valores') ||
    fullText.includes('insurtech');

  const isHardEntertainment =
    fullText.includes('novela') ||
    fullText.includes('novela das nove') ||
    fullText.includes('anitta') ||
    fullText.includes('luiz bacci') ||
    fullText.includes('ana maria braga') ||
    fullText.includes('luciano huck') ||
    fullText.includes('ccxp') ||
    fullText.includes('oscar') ||
    fullText.includes('hollywood') ||
    fullText.includes('filme') ||
    fullText.includes('streaming');

  const isHardVideogames =
    fullText.includes('playstation') ||
    fullText.includes('xbox') ||
    fullText.includes('nintendo') ||
    fullText.includes('gta') ||
    fullText.includes('grand theft auto') ||
    fullText.includes('videogame') ||
    fullText.includes('videogames');

  const isHardScience =
    fullText.includes('james webb') ||
    fullText.includes('telescopio') ||
    fullText.includes('telescópio') ||
    fullText.includes('nasa') ||
    fullText.includes('astronomia') ||
    fullText.includes('exoplaneta') ||
    fullText.includes('mulheres na ciencia') ||
    fullText.includes('mulheres na ciência');

  const isHardPolitics =
    fullText.includes('lula') ||
    fullText.includes('bolsonaro') ||
    fullText.includes('trump') ||
    fullText.includes('mercosul') ||
    fullText.includes('stf') ||
    fullText.includes('congresso nacional') ||
    fullText.includes('eleicoes 2026') ||
    fullText.includes('eleições 2026') ||
    fullText.includes('segundo turno') ||
    fullText.includes('senado') ||
    fullText.includes('câmara dos deputados');

  if (isHardSports && !isHardPolitics) {
    topCategory = 'sports';
    topScore = Math.max(topScore, 10);
  } else if (isHardEconomics && !isHardPolitics) {
    topCategory = 'economics';
    topScore = Math.max(topScore, 10);
  } else if (isHardEntertainment) {
    topCategory = 'entertainment';
    topScore = Math.max(topScore, 10);
  } else if (isHardVideogames) {
    topCategory = 'videogames';
    topScore = Math.max(topScore, 10);
  } else if (isHardScience) {
    topCategory = 'science';
    topScore = Math.max(topScore, 10);
  } else if (isHardPolitics && !isHardSports) {
    topCategory = 'politics';
    topScore = Math.max(topScore, 10);
  }

  // 1. If hintCategory was 'sports', but sports score is 0 and politics/economics score is far higher:
  if (hintCategory === 'sports' && !isHardSports && (scores.politics > 3 || scores.economics > 3)) {
    topCategory = scores.politics >= scores.economics ? 'politics' : 'economics';
  }

  // 3. Fallback to hintCategory if no dominant keywords matched
  if (topScore === 0 && hintCategory && hintCategory !== 'popular' && hintCategory !== 'last_24h') {
    topCategory = hintCategory;
  }

  return {
    category: topCategory,
    confidence: topScore,
    detectedReason: `Classified as ${topCategory} (score ${topScore.toFixed(1)})`,
  };
}

/**
 * Cleans and standardizes messy topic tags:
 * - Removes 'Radar: ' prefixes
 * - Fixes truncated strings like 'futebol esportes brasile' -> 'Futebol Brasileiro'
 * - Replaces generic noise like 'top breaking news world'
 * - Capitalizes in editorial Title Case
 */
export function cleanAndStandardizeTopicTag(params: {
  rawTag: string;
  title: string;
  category: string;
  lang?: 'pt' | 'en';
}): string {
  let tag = params.rawTag ? params.rawTag.trim() : '';

  // 1. Strip 'Radar: ' prefix
  tag = tag.replace(/^radar:\s*/i, '').trim();

  // 2. Fix broken or generic tags
  const lowerTag = tag.toLowerCase();
  if (
    lowerTag.includes('top breaking') ||
    lowerTag.includes('world news') ||
    lowerTag.length < 3 ||
    lowerTag.length > 40
  ) {
    // Generate context-based clean tag from title and category
    const titleLower = params.title.toLowerCase();
    if (titleLower.includes('insurtech')) return 'Insurtech & Finanças';
    if (titleLower.includes('cristiano ronaldo')) return 'Cristiano Ronaldo';
    if (titleLower.includes('galipolo') || titleLower.includes('galípolo')) return 'Banco Central & Dívida';
    if (titleLower.includes('lara resende')) return 'Economia & Mercado';
    if (titleLower.includes('lula') || titleLower.includes('mercosul')) return 'Cúpula do Mercosul';
    if (params.category === 'sports') return 'Esportes Globais';
    if (params.category === 'politics') return 'Política Nacional';
    if (params.category === 'economics') return 'Mercado Financeiro';
    if (params.category === 'videogames') return 'Games & Lançamentos';
    if (params.category === 'technology') return 'Inovação & Tech';
    return params.category.charAt(0).toUpperCase() + params.category.slice(1);
  }

  if (lowerTag.includes('futebol esportes brasile') || lowerTag.includes('futebol brasile')) {
    return 'Futebol Brasileiro';
  }

  // Capitalize nicely
  return tag
    .split(' ')
    .filter((w) => w.length > 0)
    .map((w) => {
      const low = w.toLowerCase();
      if (['de', 'da', 'do', 'dos', 'das', 'e', 'em', 'no', 'na', 'nos', 'nas', 'of', 'in', 'and', 'the'].includes(low)) {
        return low;
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

/**
 * Reclassifies all existing stories in the database to fix any previously misclassified items
 * (e.g., Lula/Mercosul in sports, Cristiano Ronaldo in technology, Lara Resende in technology, etc.)
 */
export async function reclassifyAllExistingStories(): Promise<{ reclassifiedCount: number; fixedTagsCount: number }> {
  try {
    const stories = await prisma.story.findMany({
      select: {
        id: true,
        category: true,
        topicTagPt: true,
        titlePt: true,
        summaryPt: true,
        fullArticlePt: true,
      },
    });

    let reclassifiedCount = 0;
    let fixedTagsCount = 0;

    for (const story of stories) {
      const classification = classifyStoryCategory({
        title: story.titlePt,
        summary: story.summaryPt,
        content: story.fullArticlePt,
        hintCategory: story.category,
      });

      const cleanTag = cleanAndStandardizeTopicTag({
        rawTag: story.topicTagPt,
        title: story.titlePt,
        category: classification.category,
      });

      const needsCatUpdate = classification.category !== story.category && classification.confidence >= 2.0;
      const needsTagUpdate = cleanTag !== story.topicTagPt;

      if (needsCatUpdate || needsTagUpdate) {
        await prisma.story.update({
          where: { id: story.id },
          data: {
            ...(needsCatUpdate ? { category: classification.category } : {}),
            ...(needsTagUpdate ? { topicTagPt: cleanTag } : {}),
          },
        });

        if (needsCatUpdate) {
          console.log(
            `[Category Classifier] Reclassified "${story.titlePt.slice(0, 50)}...": ${story.category} -> ${classification.category}`
          );
          reclassifiedCount++;
        }
        if (needsTagUpdate) {
          fixedTagsCount++;
        }
      }
    }

    console.log(
      `[Category Classifier] Audit completed: ${reclassifiedCount} stories reclassified, ${fixedTagsCount} topic tags standardized.`
    );
    return { reclassifiedCount, fixedTagsCount };
  } catch (err) {
    console.error('[Category Classifier] Reclassification warning:', (err as Error).message);
    return { reclassifiedCount: 0, fixedTagsCount: 0 };
  }
}
