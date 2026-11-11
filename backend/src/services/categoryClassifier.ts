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
    weight: 1.2,
    keywords: [
      'futebol', 'champions league', 'libertadores', 'brasileirao', 'brasileirão',
      'premier league', 'copa do mundo', 'nba', 'basquete', 'formula 1', 'fórmula 1',
      'f1', 'tenis', 'tênis', 'atletismo', 'olimpiadas', 'olimpíadas', 'volei', 'vôlei',
      'atleta', 'atletas', 'tecnico de futebol', 'técnico de futebol', 'goleiro', 'gols da partida',
      'goleada', 'rodada do campeonato', 'artilheiro', 'scuderia', 'ferrari', 'red bull racing',
      'mclaren', 'corrida de f1', 'piloto da f1', 'piloto de formula 1', 'cristiano ronaldo',
      'messi', 'neymar', 'real madrid', 'flamengo', 'palmeiras', 'corinthians',
      'sao paulo fc', 'são paulo fc', 'cruzeiro', 'liverpool fc', 'manchester city',
      'manchester united', 'ufc', 'mma', 'lutador', 'cinturao', 'cinturão', 'nfl', 'touchdown',
      'maracana', 'maracanã', 'estadio', 'estádio', 'torneio esportivo', 'transfer market',
      'playoffs', 'liga europa', 'liga conferencia', 'liga conferência', 'duplantis',
      'sheilla castro', 'pierre sage', 'crystal palace', 'trabzonspor', 'freiburg',
      'klay thompson', 'wiggins', 'chase center', 'mundial indoor', 'campeonato de futebol',
    ],
  },
  crime: {
    weight: 1.3,
    keywords: [
      'policia', 'polícia', 'pf', 'policia federal', 'polícia federal', 'policia civil',
      'polícia civil', 'policia militar', 'polícia militar', 'delegado', 'delegacia',
      'prisao', 'prisão', 'preso', 'presos', 'mandado de prisao', 'mandado de prisão',
      'apreensao', 'apreensão', 'trafico', 'tráfico', 'homicidio', 'homicídio', 'assassinato',
      'estupro', 'agressao sexual', 'agressão sexual', 'golpe financeiro', 'fraude contra',
      'operacao policial', 'operação policial', 'quadrilha', 'faccao criminosa', 'facção',
      'tribunal do juri', 'tribunal do júri', 'condenacao criminal', 'condenação criminal',
      'julgamento criminal', 'penitenciaria', 'penitenciária', 'cadeia', 'letalidade policial',
      'morte acidental', 'queda de hotel', 'inquerito policial', 'inquérito policial',
      'espionar dados', 'pericia policial', 'perícia', 'desvio milionario', 'desvio milionário',
      'lavagem de dinheiro', 'cativeiro', 'sequestro',
    ],
  },
  economics: {
    weight: 1.25,
    keywords: [
      'banco central', 'bacen', 'selic', 'taxa selic', 'copom', 'juros', 'taxa de juros',
      'inflacao', 'inflação', 'ipca', 'pib', 'divida publica', 'dívida pública',
      'mercado financeiro', 'bovespa', 'ibovespa', 'b3', 'bolsa de valores', 'wall street',
      'fed', 'federal reserve', 'dolar', 'dólar', 'cambio', 'câmbio', 'receita federal',
      'tesouro nacional', 'corte de gastos', 'pacote fiscal', 'arcabouco fiscal', 'arcabouço fiscal',
      'meta fiscal', 'fmi', 'fusao', 'fusão', 'aquisicao', 'aquisição', 'lucro liquido',
      'lucro líquido', 'balanco trimestral', 'balanço', 'dividendos', 'venture capital',
      'fundos de investimento', 'cripto', 'criptomoedas', 'bitcoin', 'ethereum', 'etf',
      'ueno bank', 'haddad', 'galipolo', 'galípolo', 'lara resende', 'andre lara resende',
      'andré lara resende', 'investidores', 'acoes', 'ações', 'commodities', 'petroleo brent',
      'petróleo brent', 'insurtech', 'fintech', 'seguros', 'credito', 'crédito',
      'receita da microsoft', 'vendas da azure', 'mercado de capitais', 'politica fiscal',
    ],
  },
  videogames: {
    weight: 1.25,
    keywords: [
      'videogame', 'videogames', 'video game', 'video games', 'jogos eletronicos', 'jogos eletrônicos',
      'playstation', 'ps5', 'ps4', 'sony playstation', 'xbox', 'xbox series', 'nintendo',
      'nintendo switch', 'switch 2', 'steam', 'valve', 'gta vi', 'grand theft auto',
      'zelda', 'ocarina of time', 'pokemon', 'pokémon', 'epic games', 'unreal engine',
      'gameplay', 'minigames', 'minigame', 'esports', 'e-sports', 'counter-strike', 'cs2',
      'valorant', 'league of legends', 'lol', 'dota', 'fortnite', 'roblox', 'ubisoft',
      'capcom', 'konami', 'game pass', 'black friday do playstation', 'jogos em novembro',
      'renderizacao neural', 'renderização neural', 'npcs cognitivos',
    ],
  },
  science: {
    weight: 1.2,
    keywords: [
      'telescopio', 'telescópio', 'james webb', 'nasa', 'spacex', 'astronomia', 'planeta',
      'exoplaneta', 'galaxia', 'galáxia', 'cosmos', 'universo', 'astrofisica', 'astrofísica',
      'fisica', 'física', 'mecanica quantica', 'mecânica quântica', 'biologia', 'genetica',
      'genética', 'pesquisa cientifica', 'pesquisa científica', 'cientistas', 'cern',
      'fusao nuclear', 'fusão nuclear', 'mulheres na ciencia', 'mulheres na ciência',
      'mulheres cientistas', 'meninas na ciencia', 'meninas na ciência', 'plumas de europa',
      'encelado', 'encélado', 'telescopio espacial', 'telescópio espacial', 'nancy grace roman',
      'falcon heavy', 'descoberta cientifica', 'descoberta científica', 'laboratorio',
    ],
  },
  entertainment: {
    weight: 1.1,
    keywords: [
      'cinema', 'filme', 'filmes', 'serie', 'série', 'series', 'séries', 'streaming',
      'netflix', 'hbo max', 'disney+', 'oscar', 'emmy', 'grammy', 'festival de cinema',
      'show musical', 'shows', 'turne', 'turnê', 'musica', 'música', 'album', 'álbum',
      'cantor', 'cantora', 'hollywood', 'ator', 'atriz', 'anitta', 'luiz bacci',
      'ana maria braga', 'luciano huck', 'tv globo', 'novela', 'novela das nove', 'ccxp',
      'stallone', 'samuel l. jackson', 'vingadores', 'celebridade', 'famosos', 'bilheteria',
      'taylor swift', 'beyonce', 'beyoncé', 'quem ama cuida', 'treta', 'oscar isaac',
      'cineastas', 'cadela pacoca', 'cadela paçoca',
    ],
  },
  politics: {
    weight: 1.15,
    keywords: [
      'lula', 'bolsonaro', 'stf', 'supremo tribunal federal', 'congresso nacional',
      'senado', 'senador', 'camara dos deputados', 'câmara dos deputados', 'deputado',
      'eleicoes', 'eleições', 'eleicao', 'eleição', 'urnas', 'partido', 'partidos',
      'trump', 'biden', 'obama', 'casa branca', 'governo federal', 'planalto',
      'palacio do planalto', 'diplomacia', 'relacoes internacionais', 'relações internacionais',
      'geopolitica', 'geopolítica', 'parlamento', 'sancoes', 'sanções', 'cpi',
      'projeto de lei', 'pec', 'reeleicao', 'reeleição', 'cupula do mercosul',
      'cúpula do mercosul', 'mercosul', 'g20', 'brics', 'onu', 'segundo turno',
      'primeiro turno', 'midterms', 'derrota republicana', 'vitoria democrata',
      'governabilidade', 'novo congresso',
    ],
  },
  technology: {
    weight: 1.1,
    keywords: [
      'inteligencia artificial', 'inteligência artificial', 'ia', 'ai', 'llm', 'llms',
      'openai', 'gemini', 'anthropic', 'dario amodei', 'sam altman', 'deepseek', 'chatgpt',
      'claude', 'nvidia', 'chips', 'semicondutores', 'microsoft', 'google', 'apple',
      'meta', 'amazon aws', 'computacao em nuvem', 'computação em nuvem', 'cloud computing',
      'software', 'ciberseguranca', 'cibersegurança', 'hacker', 'ransomware', 'big tech',
      'wearable', 'wearables', 'smartphone', 'iphone', 'android', 'nothing phone',
      'computacao quantica', 'computação quântica', 'robotica', 'robótica', 'deep learning',
      'machine learning', 'startups tech', 'roteadores de ia', 'agentes autonomos',
      'calendario tech', 'agenda tech',
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
 * Prioritizes the Title heavily (multiplier 4.0), followed by Summary (2.0),
 * and enforces strict domain rules to prevent cross-contamination.
 */
export function classifyStoryCategory(params: {
  title: string;
  summary?: string;
  content?: string;
  hintCategory?: string;
}): { category: string; confidence: number; detectedReason: string } {
  const { title, summary = '', content = '', hintCategory } = params;
  const normTitle = normalizeText(title);
  const normSummary = normalizeText(summary);
  const normContent = normalizeText(content.slice(0, 800));

  // STEP 1: ABSOLUTE HARD TITLE SAFEGUARDS (Highest Editorial Authority)
  // If the headline explicitly defines the core fact, do not let tangential keywords override it!

  // 1.1 CRIME HARD RULES: Arrests, trials, rapes, murders, police raids, police lethality
  if (
    normTitle.includes('estupro') ||
    normTitle.includes('agressao sexual') ||
    normTitle.includes('homicidio') ||
    normTitle.includes('assassinato') ||
    normTitle.includes('chacina') ||
    normTitle.includes('latrocinio') ||
    normTitle.includes('preso') ||
    normTitle.includes('prisao') ||
    normTitle.includes('mandado de prisao') ||
    normTitle.includes('operacao da pf') ||
    normTitle.includes('policia federal investiga') ||
    normTitle.includes('policia investiga') ||
    normTitle.includes('pf investiga') ||
    normTitle.includes('letalidade policial') ||
    normTitle.includes('acoes policiais') ||
    normTitle.includes('golpe financeiro') ||
    normTitle.includes('esquema de fraude') ||
    normTitle.includes('trafico de drogas') ||
    normTitle.includes('faccao criminosa') ||
    (normTitle.includes('russell brand') && (normTitle.includes('culpado') || normTitle.includes('estupro')))
  ) {
    return { category: 'crime', confidence: 15, detectedReason: 'Hard title rule: Crime & Law Enforcement' };
  }

  // 1.2 ECONOMICS HARD RULES: Selic, Copom, Banco Central, Inflation, Stock Exchange, Forex, Fiscal
  if (
    normTitle.includes('selic') ||
    normTitle.includes('taxa selic') ||
    normTitle.includes('copom') ||
    normTitle.includes('banco central') ||
    normTitle.includes('inflacao') ||
    normTitle.includes('ipca') ||
    normTitle.includes('pib') ||
    normTitle.includes('taxa de juros') ||
    normTitle.includes('divida publica') ||
    normTitle.includes('pacote fiscal') ||
    normTitle.includes('corte de gastos') ||
    normTitle.includes('arcabouco fiscal') ||
    normTitle.includes('ibovespa') ||
    normTitle.includes('bolsa de valores') ||
    normTitle.includes('wall street') ||
    normTitle.includes('dolar') ||
    normTitle.includes('cambio') ||
    normTitle.includes('ueno bank') ||
    normTitle.includes('insurtech') ||
    normTitle.includes('andre lara resende') ||
    (normTitle.includes('receita') && normTitle.includes('bilhoes')) ||
    (normTitle.includes('lucro liquido') && !normTitle.includes('futebol'))
  ) {
    return { category: 'economics', confidence: 15, detectedReason: 'Hard title rule: Economics & Financial Markets' };
  }

  // 1.3 SPORTS HARD RULES: Clubs, athletes, matches, cups, tournaments
  if (
    normTitle.includes('futebol') ||
    normTitle.includes('brasileirao') ||
    normTitle.includes('libertadores') ||
    normTitle.includes('champions league') ||
    normTitle.includes('premier league') ||
    normTitle.includes('copa do mundo') ||
    normTitle.includes('formula 1') ||
    normTitle.includes('f1') ||
    normTitle.includes('nba') ||
    normTitle.includes('ufc') ||
    normTitle.includes('atletismo') ||
    normTitle.includes('mundial indoor') ||
    normTitle.includes('olimpiadas') ||
    normTitle.includes('cristiano ronaldo') ||
    normTitle.includes('messi') ||
    normTitle.includes('neymar') ||
    normTitle.includes('flamengo') ||
    normTitle.includes('palmeiras') ||
    normTitle.includes('corinthians') ||
    normTitle.includes('cruzeiro') ||
    normTitle.includes('real madrid') ||
    normTitle.includes('barcelona') ||
    normTitle.includes('warriors') ||
    normTitle.includes('chase center') ||
    normTitle.includes('duplantis') ||
    normTitle.includes('sheilla castro') ||
    normTitle.includes('pierre sage') ||
    normTitle.includes('crystal palace') ||
    normTitle.includes('trabzonspor') ||
    normTitle.includes('freiburg') ||
    normTitle.includes('goleada')
  ) {
    return { category: 'sports', confidence: 15, detectedReason: 'Hard title rule: Sports' };
  }

  // 1.4 VIDEOGAMES HARD RULES: Consoles, game franchises, gaming engines
  if (
    normTitle.includes('playstation') ||
    normTitle.includes('ps5') ||
    normTitle.includes('ps4') ||
    normTitle.includes('xbox') ||
    normTitle.includes('nintendo') ||
    normTitle.includes('switch') ||
    normTitle.includes('gta') ||
    normTitle.includes('grand theft auto') ||
    normTitle.includes('zelda') ||
    normTitle.includes('videogame') ||
    normTitle.includes('videogames') ||
    normTitle.includes('minigames') ||
    normTitle.includes('minigame') ||
    normTitle.includes('game pass') ||
    normTitle.includes('steam') ||
    normTitle.includes('esports') ||
    normTitle.includes('npcs cognitivos') ||
    normTitle.includes('renderizacao neural')
  ) {
    return { category: 'videogames', confidence: 15, detectedReason: 'Hard title rule: Videogames' };
  }

  // 1.5 SCIENCE HARD RULES: Astronomy, NASA, space, biology, scientific discoveries
  if (
    normTitle.includes('james webb') ||
    normTitle.includes('telescopio') ||
    normTitle.includes('nasa') ||
    normTitle.includes('spacex') ||
    normTitle.includes('astronomia') ||
    normTitle.includes('exoplaneta') ||
    normTitle.includes('mulheres na ciencia') ||
    normTitle.includes('mulheres cientistas') ||
    normTitle.includes('descoberta cientifica') ||
    normTitle.includes('descobertas cientificas') ||
    normTitle.includes('pesquisa cientifica') ||
    normTitle.includes('nancy grace roman') ||
    normTitle.includes('plumas de europa') ||
    normTitle.includes('encelado')
  ) {
    return { category: 'science', confidence: 15, detectedReason: 'Hard title rule: Science & Astronomy' };
  }

  // 1.6 ENTERTAINMENT HARD RULES: Movies, series, awards, music, celebrities
  if (
    normTitle.includes('cinema') ||
    normTitle.includes('filme') ||
    normTitle.includes('oscar') ||
    normTitle.includes('emmy') ||
    normTitle.includes('grammy') ||
    normTitle.includes('ccxp') ||
    normTitle.includes('hollywood') ||
    normTitle.includes('vingadores') ||
    normTitle.includes('stallone') ||
    normTitle.includes('samuel l jackson') ||
    normTitle.includes('novela') ||
    normTitle.includes('ana maria braga') ||
    normTitle.includes('luiz bacci') ||
    normTitle.includes('luciano huck') ||
    normTitle.includes('anitta') ||
    normTitle.includes('quem ama cuida')
  ) {
    return { category: 'entertainment', confidence: 15, detectedReason: 'Hard title rule: Entertainment' };
  }

  // 1.7 POLITICS HARD RULES: Elections, Congress, Supreme Court, Diplomacy
  if (
    normTitle.includes('eleicoes') ||
    normTitle.includes('eleicao') ||
    normTitle.includes('urnas') ||
    normTitle.includes('stf') ||
    normTitle.includes('congresso nacional') ||
    normTitle.includes('senado') ||
    normTitle.includes('camara dos deputados') ||
    normTitle.includes('mercosul') ||
    normTitle.includes('cupula do mercosul') ||
    normTitle.includes('segundo turno') ||
    normTitle.includes('midterms') ||
    normTitle.includes('obama') ||
    (normTitle.includes('trump') && !normTitle.includes('jogo')) ||
    (normTitle.includes('lula') && !normTitle.includes('selic') && !normTitle.includes('juros'))
  ) {
    return { category: 'politics', confidence: 15, detectedReason: 'Hard title rule: Politics' };
  }

  // STEP 2: WEIGHTED MULTI-FIELD SCORING (Title 4.0x, Summary 2.0x, Content Excerpt 0.3x)
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

      const regex = new RegExp(`\\b${normKw}\\b`, 'g');
      const isCompound = normKw.includes(' ');
      const baseWeight = isCompound ? 2.5 : 1.0;

      // Title match (heavy 4.0 multiplier)
      const titleMatches = normTitle.match(regex);
      if (titleMatches) {
        scores[cat] += titleMatches.length * rule.weight * baseWeight * 4.0;
      }

      // Summary match (2.0 multiplier)
      const summaryMatches = normSummary.match(regex);
      if (summaryMatches) {
        scores[cat] += summaryMatches.length * rule.weight * baseWeight * 2.0;
      }

      // Content excerpt match (low 0.3 multiplier to avoid peripheral text hijacking)
      const contentMatches = normContent.match(regex);
      if (contentMatches) {
        scores[cat] += contentMatches.length * rule.weight * baseWeight * 0.3;
      }
    }
  }

  // Boost hintCategory slightly if it already has supporting signal
  if (hintCategory && scores[hintCategory] !== undefined && scores[hintCategory] > 1.5) {
    scores[hintCategory] *= 1.25;
  }

  let topCategory = 'technology';
  let topScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topCategory = cat;
    }
  }

  // Fallback to hintCategory if no dominant keywords matched
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
      },
    });

    let reclassifiedCount = 0;
    let fixedTagsCount = 0;

    for (const story of stories) {
      const classification = classifyStoryCategory({
        title: story.titlePt,
        summary: story.summaryPt,
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
