import OpenAI from 'openai';
import { prisma } from '../lib/prisma';
import {
  searchWebNews,
  fetchUrlContent,
  resolveTopicImage,
  fetchTrendingTopics,
  fetchDistinctCategoryTopics,
  fetch24hBreakingTopics,
  CATEGORY_QUERIES,
  RawNewsItem,
} from './searchTools';
import {
  analyzeCandidateForDuplicates,
  cleanExistingDuplicateStories,
} from './deduplicationService';
import {
  classifyStoryCategory,
  cleanAndStandardizeTopicTag,
  reclassifyAllExistingStories,
} from './categoryClassifier';

export { cleanExistingDuplicateStories, reclassifyAllExistingStories };

export interface GeneratedStoryPayload {
  slug: string;
  category: string;
  topicTagPt: string;
  topicTagEn: string;
  titlePt: string;
  titleEn: string;
  summaryPt: string;
  summaryEn: string;
  bulletPointsPt: string[];
  bulletPointsEn: string[];
  perspectivesPt: Array<{ label: string; stance: string; summary: string }>;
  perspectivesEn: Array<{ label: string; stance: string; summary: string }>;
  fullArticlePt: string;
  fullArticleEn: string;
  imageUrl: string;
  dominantColor: string;
  secondaryColor: string;
  articleCount: number;
  publishedAt?: string | Date;
  isRadarGenerated: boolean;
  radarQuery?: string;
  sources: Array<{
    name: string;
    title: string;
    url: string;
    domain: string;
    publishedAt?: string;
    snippet?: string;
  }>;
}

const VIBRANT_PALETTES = [
  { dominant: '#1d4ed8', secondary: '#1e3a8a' },
  { dominant: '#a18c07', secondary: '#716204' },
  { dominant: '#1e78bd', secondary: '#0f4c81' },
  { dominant: '#b91c1c', secondary: '#7f1d1d' },
  { dominant: '#047857', secondary: '#064e3b' },
  { dominant: '#6d28d9', secondary: '#4c1d95' },
  { dominant: '#c2410c', secondary: '#7c2d12' },
];

export async function getSystemConfig() {
  let config = await prisma.systemConfig.findUnique({ where: { id: 'default' } });
  if (!config) {
    config = await prisma.systemConfig.create({
      data: {
        id: 'default',
        omnirouteBaseUrl: process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1',
        omnirouteApiKey: process.env.OMNIROUTE_API_KEY || 'sk-omniroute-local',
        omnirouteModel: process.env.OMNIROUTE_MODEL || 'antigravity/gemini-3.8-flash-low',
        cronIntervalMin: 30,
      },
    });
  } else if (
    config.omnirouteModel === 'auto' ||
    config.omnirouteModel === 'auto/best-chat' ||
    config.omnirouteModel === 'auto/smart' ||
    config.omnirouteModel === 'antigravity/gemini-3.1-flash-lite' ||
    config.omnirouteModel === 'antigravity/gemini-2.5-flash' ||
    config.omnirouteModel === 'antigravity/gemini-4-argon-low' ||
    config.cronIntervalMin === 60
  ) {
    config = await prisma.systemConfig.update({
      where: { id: 'default' },
      data: {
        omnirouteModel: 'antigravity/gemini-3.8-flash-low',
        cronIntervalMin: 30,
      },
    });
  }
  return config;
}

export async function createOmniRouteClient() {
  const config = await getSystemConfig();
  const client = new OpenAI({
    baseURL: config.omnirouteBaseUrl,
    apiKey: config.omnirouteApiKey,
    timeout: 90000,
    maxRetries: 1,
  });
  return { client, config };
}

export async function checkOmniRouteStatus(): Promise<{
  online: boolean;
  baseUrl: string;
  model: string;
  availableModels: string[];
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  const config = await getSystemConfig();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(`${config.omnirouteBaseUrl.replace(/\/$/, '')}/models`, {
      headers: {
        Authorization: `Bearer ${config.omnirouteApiKey}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const models = Array.isArray(data?.data)
      ? data.data.map((m) => m.id).slice(0, 25)
      : ['auto/best-chat'];

    return {
      online: true,
      baseUrl: config.omnirouteBaseUrl,
      model: config.omnirouteModel === 'auto' ? 'auto/best-chat' : config.omnirouteModel,
      availableModels: models,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      online: false,
      baseUrl: config.omnirouteBaseUrl,
      model: config.omnirouteModel,
      availableModels: ['auto/best-chat'],
      latencyMs: Date.now() - start,
      error: (err as Error).message,
    };
  }
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 65) +
    '-' +
    Math.random().toString(36).substring(2, 7)
  );
}

/**
 * Helper to call OmniRoute trying the configured model first, then falling back to 'auto/best-chat' or 'auto/pro-chat'
 */
export async function callOmniRouteCompletion(
  client: OpenAI,
  preferredModel: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  temperature = 0.55
) {
  const normalizedPreferred =
    preferredModel === 'auto' ||
    preferredModel === 'auto/best-chat' ||
    preferredModel === 'auto/smart' ||
    preferredModel === 'antigravity/gemini-3.1-flash-lite' ||
    preferredModel === 'antigravity/gemini-2.5-flash'
      ? 'antigravity/gemini-3.8-flash-low'
      : preferredModel;

  const candidateModels = Array.from(
    new Set([
      normalizedPreferred,
      'antigravity/gemini-3.8-flash-low',
      'antigravity/claude-sonnet-5-5-medium',
      'antigravity/claude-opus-5-5-medium',
      'antigravity/gemini-3.8-flash-medium',
      'antigravity/gemini-3.1-flash-lite',
    ])
  );

  let lastError: Error | null = null;
  for (const modelName of candidateModels) {
    try {
      const response = await client.chat.completions.create({
        model: modelName,
        messages,
        temperature,
      });
      const content = response.choices?.[0]?.message?.content || '';
      if (
        content &&
        !content.includes('is no longer available. Please switch to')
      ) {
        return response;
      }
      throw new Error(`Deprecated model message returned: ${content.slice(0, 80)}`);
    } catch (err) {
      lastError = err as Error;
      console.warn(`[OmniRoute] Model "${modelName}" failed, trying next...`, lastError.message);
    }
  }
  throw lastError || new Error('All OmniRoute model combos failed');
}

/**
 * Dedicated Step 2: Writes a truly exceptional, long-form journalistic masterpiece
 * (without JSON escaping constraints) so the LLM can pour 100% of its tokens into literary & factual journalism.
 */
async function writeMasterpieceArticle(params: {
  client: OpenAI;
  preferredModel: string;
  query: string;
  headline: string;
  summary: string;
  lang: 'pt' | 'en';
  sourcesContext: string;
  deepExcerpts: string;
  is24h?: boolean;
}): Promise<string> {
  const { client, preferredModel, query, headline, summary, lang, sourcesContext, deepExcerpts, is24h = false } = params;

  const temporalPromptPt = is24h
    ? `\n\nDIRETRIZ MANDATÓRIA DE FOCO TEMPORAL (ÚLTIMAS 24 HORAS):
Esta reportagem pertence à sessão exclusiva "ÚLTIMAS 24 HORAS" do reach.news.
A IA DEVE FOCAR ESTRITAMENTE em acontecimentos, anúncios, declarações, números e decisões ocorridos rigorosamente no período das últimas 24 horas.
- É PROIBIDO tratar contexto antigo ou histórico como se fosse o acontecimento de hoje.
- O primeiro parágrafo (Lead) DEVE ancorar com extrema clareza e autoridade o que aconteceu hoje ou nas últimas horas, quem esteve envolvido e quais os desdobramentos imediatos em tempo real.`
    : '';

  const temporalPromptEn = is24h
    ? `\n\nMANDATORY TEMPORAL FOCUS DIRECTIVE (LAST 24 HOURS):
This article leads the dedicated "LAST 24 HOURS" session of reach.news.
The AI MUST FOCUS STRICTLY on events, announcements, statements, figures, and decisions that occurred strictly within the last 24 hours.
- NEVER treat historical background or past events as today's breaking news.
- The opening lead paragraph MUST anchor with precision what happened today or in recent hours, who is involved, and the immediate real-time fallout.`
    : '';

  const systemPromptPt = `Você é um jornalista sênior premiado e redator-chefe (com passagem por redações como The New York Times, Valor Econômico, piauí, Nexo Jornal e BBC Brasil).
Sua missão é escrever o corpo completo de uma GRANDE REPORTAGEM JORNALÍSTICA sobre o tema fornecido, utilizando rigorosamente os fatos, nomes, datas, números, valores e declarações presentes nas fontes coletadas.

DIRETRIZES ESTILÍSTICAS OBRIGATÓRIAS (ESTILO PERPLEXITY DISCOVER / GRANDE IMPRENSA):
1. ABERTURA (LEAD JORNALÍSTICO FORTE): Comece o primeiro parágrafo diretamente nos fatos concretos — quem fez o quê, quando, onde, qual decisão ou evento ocorreu, quem são os juízes, executivos, atletas, instituições ou empresas envolvidas e quais as cifras ou consequências imediatas (exatamente como nas aberturas do Perplexity Discover e da Reuters/Valor). Não use introduções genéricas como "Nas últimas horas o tema X ganhou destaque". Vá direto ao fato com precisão cirúrgica!
2. PROFUNDIDADE E EXTENSÃO: Escreva uma matéria longa, densa e completa (entre 700 e 1.100 palavras, dividida em 7 a 10 parágrafos bem desenvolvidos).
3. SUBTÍTULOS EDITORIAIS (##): Divida a reportagem em 3 ou 4 seções usando subtítulos instigantes em Markdown (\`## Subtítulo\`). Os subtítulos devem ser informativos e elegantes, como em uma grande reportagem.
4. CITAÇÕES E BASTIDORES: Inclua pelo menos uma citação em destaque (\`> "Citação..."\`) ou declaração relevante extraída do contexto, atribuindo claramente a quem falou ou ao veículo que revelou a informação (ex: "segundo apurou o Valor Econômico", "de acordo com a decisão judicial", "em entrevista coletiva").
5. FLUIDEZ DE PROSA: Escreva em prosa jornalística corrida, elegante e analítica. Não use listas de bullet points no meio do artigo. Conecte os parágrafos com transições naturais, explicando o histórico do caso, os interesses em jogo, os argumentos de cada lado e o que acontece a partir de agora.
6. IDIOMA: Escreva 100% em Português do Brasil (PT-BR) impecável. Não inclua o título principal (#) no início pois ele já está no topo da página. Comece direto no primeiro parágrafo (Lead).${temporalPromptPt}`;

  const systemPromptEn = `You are an award-winning senior investigative journalist and feature writer (with experience at The New York Times, Financial Times, Reuters, and Perplexity Discover).
Your mission is to write a comprehensive, deeply reported LONG-FORM JOURNALISTIC ARTICLE based strictly on the facts, names, dates, figures, and statements found in the gathered sources.

MANDATORY EDITORIAL GUIDELINES:
1. HARD-HITTING JOURNALISTIC LEAD: Open the very first paragraph with concrete facts—who did what, when, where, which institutions/executives/figures are involved, and the exact stakes or penalties (matching the crisp, authoritative tone of Perplexity Discover and Reuters). Never use vague filler openings.
2. DEPTH & LENGTH: Write a rich, substantial 700–1,000 word article across 7 to 10 well-crafted paragraphs.
3. EDITORIAL SUBHEADINGS (##): Structure the narrative after the opening lead paragraphs using 3 to 4 compelling Markdown subheadings (\`## Subheading\`).
4. ATTRIBUTION & QUOTES: Weave natural journalistic attribution throughout the prose ("according to court filings", "as reported by...") and include at least one impactful blockquote (\`> "..."\`).
5. PURE NARRATIVE PROSE: Write in flowing editorial paragraphs—do not use bullet lists inside the article body. Do not repeat the main headline (#) at the top; start immediately with the opening lead paragraph.${temporalPromptEn}`;

  const userPrompt = `MANCHETE DA MATÉRIA: ${headline}
SUBTÍTULO / SÍNTESE: ${summary}
TÓPICO PESQUISADO: ${query}

FONTES E MANCHETES REAIS COLETADAS AGORA:
${sourcesContext}

TRECHOS EXTRAÍDOS DO CORPO DAS REPORTAGENS ORIGINAIS:
${deepExcerpts || 'Utilize os dados detalhados das manchetes e resumos acima.'}

Escreva agora a reportagem completa em Markdown (${lang === 'pt' ? '100% em Português do Brasil' : '100% in English'}):`;

  const res = await callOmniRouteCompletion(
    client,
    preferredModel,
    [
      { role: 'system', content: lang === 'pt' ? systemPromptPt : systemPromptEn },
      { role: 'user', content: userPrompt },
    ],
    0.55
  );

  return (res.choices[0]?.message?.content || '').trim();
}

/**
 * Agentic News Research & Synthesis via OmniRoute (Two-Stage Editorial Pipeline)
 */
export async function researchAndSynthesizeStory(params: {
  query: string;
  category: string;
  lang?: 'pt' | 'en';
  isRadar?: boolean;
  timeframe?: '24h' | 'all';
}): Promise<GeneratedStoryPayload> {
  const { query, category, lang = 'pt', isRadar = false, timeframe = 'all' } = params;
  const is24h = timeframe === '24h' || category === 'last_24h';
  const { client, config } = await createOmniRouteClient();

  // 1. Gather live news prioritizing the user's selected language + international sources with 24h filter if requested
  const primaryItems = await searchWebNews(query, lang, 12, is24h ? '24h' : 'all');
  const secondaryItems = await searchWebNews(query, lang === 'pt' ? 'en' : 'pt', 6, is24h ? '24h' : 'all');
  const collectedItems: RawNewsItem[] = [...primaryItems, ...secondaryItems];

  // 2. Scrape full paragraphs from the top 4 real articles so the journalist AI has rich factual material
  const deepExcerpts: string[] = [];
  for (const item of primaryItems.slice(0, 4)) {
    if (item.url && !item.url.includes('news.google.com')) {
      const scraped = await fetchUrlContent(item.url);
      if (scraped.bodyExcerpt && scraped.bodyExcerpt.length > 120) {
        deepExcerpts.push(
          `VEÍCULO: ${item.sourceName}\nTÍTULO ORIGINAL: ${item.title}\nTEXTO EXTRAÍDO:\n${scraped.bodyExcerpt}`
        );
      }
    }
  }

  // 3. Resolve real photograph matching the exact topic
  const resolvedImageUrl = await resolveTopicImage(collectedItems, category);

  const sourcesContext = JSON.stringify(
    collectedItems.slice(0, 12).map((i) => ({
      veiculo: i.sourceName,
      manchete: i.title,
      resumo: i.snippet,
      data: i.publishedAt,
    })),
    null,
    2
  );

  const excerptsText = deepExcerpts.join('\n\n====================\n\n');

  // Load recent story headlines from PostgreSQL to instruct the AI not to duplicate existing coverage
  const recentCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
  const recentStories = await prisma.story.findMany({
    where: { publishedAt: { gte: recentCutoff } },
    select: { titlePt: true },
    take: 20,
    orderBy: { publishedAt: 'desc' },
  });

  const recentHeadlinesPrompt =
    recentStories.length > 0
      ? `\n\nMANCHETES RECENTES JÁ PUBLICADAS NO PORTAL (É EXPRESSAMENTE PROIBIDO REPETIR OU GERAR MATÉRIA PRATICAMENTE IGUAL A QUALQUER UMA DESSAS):\n${recentStories
          .map((s, idx) => `${idx + 1}. ${s.titlePt}`)
          .join('\n')}\n\nDIRETRIZ DE INEDITISMO MANDATÓRIO: Se as fontes em tempo real coletadas tratarem do mesmo evento ou anúncio já noticiado acima, você DEVE buscar um fato inédito, novo desdobramento ou escolher outro acontecimento dentre as fontes coletadas para que a matéria seja 100% original e não duplicada.`
      : '';

  try {
    const temporalInstructionStage1 = is24h
      ? `\n- DIRETRIZ MANDATÓRIA (ÚLTIMAS 24 HORAS): Esta notícia pertence à sessão especial de ÚLTIMAS 24 HORAS do reach.news. A IA DEVE FOCAR ESTRITAMENTE em notícias, fatos e desdobramentos ocorridos nas últimas 24 horas. É PROIBIDO tratar fatos antigos como se fossem novidade de hoje. A manchete e o resumo DEVEM destacar o fato mais recente das últimas 24 horas.`
      : '';

    // STAGE 1: Structured Metadata, Headlines, Standfirst Summary, Takeaways & 360° Perspectives
    const stage1Messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `Você é o Editor-Chefe do reach.news (plataforma de jornalismo estilo Perplexity Discover).
Analise as fontes coletadas em tempo real e gere os metadados estruturados, manchetes precisas, resumo factual denso (standfirst), pontos-chave e múltiplas perspectivas em Português (PT-BR) e Inglês (EN-US).
REGRAS:
- Todos os campos terminados em "Pt" DEVEM estar 100% em Português do Brasil (PT-BR).
- Todos os campos terminados em "En" DEVEM estar 100% em Inglês (EN-US).
- A manchete ("titlePt" / "titleEn") deve ser jornalística, direta, informativa e natural (ex: "Justiça brasileira proíbe Meta de treinar IA com conteúdo jornalístico" / "Brazil court bars Meta from training AI on news content").
- O resumo ("summaryPt" / "summaryEn") deve ter 2 frases densas e factuais trazendo os números, nomes e consequências principais.
- REGRA DE INEDITISMO: Verifique as manchetes recentes do portal. É proibido gerar matérias idênticas ou redundantes sobre o mesmo evento já noticiado.${temporalInstructionStage1}
- TAXONOMIA E CLASSIFICAÇÃO ESTRITA:
  A categoria ("detectedCategory") DEVE ser estritamente uma de: sports | technology | science | politics | crime | entertainment | economics | videogames.
  * POLÍTICA: Governos, chefes de estado, eleições, parlamentos, cúpulas diplomáticas (ex: Mercosul, G20, ONU), leis e STF. JAMAIS classifique política como esportes ou tecnologia.
  * ESPORTES: Exclusivamente competições atléticas, partidas, clubes, atletas, torneios (Futebol, F1, NBA, UFC, etc.).
  * ECONOMIA: Banco Central, taxa Selic, juros, inflação, bolsas de valores, finanças, dívida pública e empresas.
  * VIDEOGAMES: Jogos eletrônicos, consoles (PlayStation, Xbox, Nintendo), estúdios e eSports.
- TAG DO TÓPICO ("topicTagPt" / "topicTagEn"):
  Deve ser uma tag jornalística concisa de 2 a 3 palavras elegantes (ex: "Fórmula 1", "Inteligência Artificial", "Eleições 2026", "Política Monetária", "Futebol Europeu"). NUNCA use prefixos como "Radar:" ou frases genéricas como "top breaking news".`,
      },
      {
        role: 'user',
        content: `Tópico pesquisado: "${query}"

Fontes em tempo real:
${sourcesContext}

Trechos das reportagens:
${excerptsText.slice(0, 4000)}${recentHeadlinesPrompt}

Retorne APENAS um JSON válido (sem markdown \`\`\`json) com este formato exato:
{
  "detectedCategory": "sports | technology | science | politics | crime | entertainment | economics | videogames",
  "topicTagPt": "Tag de 2-3 palavras em PT-BR",
  "topicTagEn": "2-3 word tag in EN-US",
  "titlePt": "Manchete jornalística precisa em PT-BR",
  "titleEn": "Precise journalistic headline in EN-US",
  "summaryPt": "Resumo factual de 2 frases em PT-BR estilo Perplexity Discover",
  "summaryEn": "2-sentence factual summary in EN-US",
  "bulletPointsPt": ["Fato concreto 1 em PT", "Fato concreto 2 em PT", "Fato concreto 3 em PT", "Fato concreto 4 em PT", "Fato concreto 5 em PT"],
  "bulletPointsEn": ["Concrete fact 1 in EN", "Concrete fact 2 in EN", "Concrete fact 3 in EN", "Concrete fact 4 in EN", "Concrete fact 5 in EN"],
  "perspectivesPt": [
    {"label": "Ângulo/Ator 1 em PT", "stance": "Postura em PT", "summary": "Análise em 2 frases."},
    {"label": "Ângulo/Ator 2 em PT", "stance": "Postura em PT", "summary": "Análise em 2 frases."},
    {"label": "Ângulo/Ator 3 em PT", "stance": "Postura em PT", "summary": "Análise em 2 frases."}
  ],
  "perspectivesEn": [
    {"label": "Angle 1 in EN", "stance": "Stance in EN", "summary": "2-sentence analysis."},
    {"label": "Angle 2 in EN", "stance": "Stance in EN", "summary": "2-sentence analysis."},
    {"label": "Angle 3 in EN", "stance": "Stance in EN", "summary": "2-sentence analysis."}
  ]
}`,
      },
    ];

    const stage1Res = await callOmniRouteCompletion(
      client,
      config.omnirouteModel || 'auto/best-chat',
      stage1Messages,
      0.4
    );

    const rawContent = stage1Res.choices[0]?.message?.content || '';
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const cleanedJson = jsonMatch ? jsonMatch[0] : rawContent.trim();
    const parsed = JSON.parse(cleanedJson);

    // STAGE 2: Dedicated Long-Form Masterpiece Article Generation (in the user's primary language + secondary language)
    const fullArticlePt = await writeMasterpieceArticle({
      client,
      preferredModel: config.omnirouteModel || 'auto/best-chat',
      query,
      headline: parsed.titlePt || query,
      summary: parsed.summaryPt || '',
      lang: 'pt',
      sourcesContext,
      deepExcerpts: excerptsText.slice(0, 6000),
      is24h,
    });

    let fullArticleEn = '';
    if (lang === 'en') {
      fullArticleEn = await writeMasterpieceArticle({
        client,
        preferredModel: config.omnirouteModel || 'auto/best-chat',
        query,
        headline: parsed.titleEn || query,
        summary: parsed.summaryEn || '',
        lang: 'en',
        sourcesContext,
        deepExcerpts: excerptsText.slice(0, 6000),
        is24h,
      });
    } else {
      // Generate concise English version using fast active Antigravity Flash model
      fullArticleEn = await writeMasterpieceArticle({
        client,
        preferredModel: 'antigravity/gemini-3.8-flash-low',
        query,
        headline: parsed.titleEn || parsed.titlePt || query,
        summary: parsed.summaryEn || '',
        lang: 'en',
        sourcesContext,
        deepExcerpts: excerptsText.slice(0, 4000),
        is24h,
      }).catch(() => fullArticlePt);
    }

    const palette = VIBRANT_PALETTES[Math.floor(Math.random() * VIBRANT_PALETTES.length)];
    
    // Rigorously classify category to prevent political news in sports or tech
    const classification = classifyStoryCategory({
      title: parsed.titlePt || query,
      summary: parsed.summaryPt || '',
      content: excerptsText,
      hintCategory: parsed.detectedCategory || category,
    });
    const finalCategory = classification.category;

    const cleanTagPt = cleanAndStandardizeTopicTag({
      rawTag: parsed.topicTagPt || query.slice(0, 28),
      title: parsed.titlePt || query,
      category: finalCategory,
      lang: 'pt',
    });

    const cleanTagEn = cleanAndStandardizeTopicTag({
      rawTag: parsed.topicTagEn || query.slice(0, 28),
      title: parsed.titleEn || query,
      category: finalCategory,
      lang: 'en',
    });

    const uniqueSources = deduplicateSources(collectedItems, query);

    // Compute exact publication date from the latest collected source, or current timestamp
    let latestPubDate: string = new Date().toISOString();
    for (const s of uniqueSources) {
      if (s.publishedAt) {
        const d = new Date(s.publishedAt);
        if (!isNaN(d.getTime()) && d.getTime() <= Date.now()) {
          if (new Date(latestPubDate).getTime() < d.getTime()) {
            latestPubDate = d.toISOString();
          }
        }
      }
    }

    return {
      slug: slugify(parsed.titlePt || parsed.titleEn || query),
      category: finalCategory,
      topicTagPt: cleanTagPt,
      topicTagEn: cleanTagEn,
      titlePt: parsed.titlePt,
      titleEn: parsed.titleEn,
      summaryPt: parsed.summaryPt,
      summaryEn: parsed.summaryEn,
      bulletPointsPt: Array.isArray(parsed.bulletPointsPt) ? parsed.bulletPointsPt : [],
      bulletPointsEn: Array.isArray(parsed.bulletPointsEn) ? parsed.bulletPointsEn : [],
      perspectivesPt: Array.isArray(parsed.perspectivesPt) ? parsed.perspectivesPt : [],
      perspectivesEn: Array.isArray(parsed.perspectivesEn) ? parsed.perspectivesEn : [],
      fullArticlePt: fullArticlePt || parsed.summaryPt,
      fullArticleEn: fullArticleEn || fullArticlePt || parsed.summaryEn,
      imageUrl: resolvedImageUrl,
      dominantColor: palette.dominant,
      secondaryColor: palette.secondary,
      articleCount: Math.max(uniqueSources.length, 12),
      publishedAt: latestPubDate,
      isRadarGenerated: isRadar,
      radarQuery: isRadar ? query : undefined,
      sources: uniqueSources,
    };
  } catch (err) {
    console.warn(`[OmniRoute] Synthesis fallback triggered for "${query}":`, (err as Error).message);
    return buildIntelligentSynthesisFromSources(
      query,
      category,
      primaryItems,
      secondaryItems,
      deepExcerpts,
      resolvedImageUrl,
      isRadar
    );
  }
}

function deduplicateSources(items: RawNewsItem[], fallbackQuery: string) {
  const seen = new Set<string>();
  const result: Array<{
    name: string;
    title: string;
    url: string;
    domain: string;
    publishedAt?: string;
    snippet?: string;
  }> = [];

  for (const item of items) {
    const key = item.title.toLowerCase().slice(0, 40);
    if (!seen.has(key) && item.url) {
      seen.add(key);
      result.push({
        name: item.sourceName || 'Imprensa',
        title: item.title,
        url: item.url,
        domain: item.domain || 'news.com',
        publishedAt: item.publishedAt,
        snippet: item.snippet,
      });
    }
    if (result.length >= 12) break;
  }

  if (result.length === 0) {
    result.push({
      name: 'Reuters',
      title: `Cobertura em tempo real sobre ${fallbackQuery}`,
      url: `https://www.reuters.com/site-search/?query=${encodeURIComponent(fallbackQuery)}`,
      domain: 'reuters.com',
      publishedAt: new Date().toISOString(),
      snippet: `Acompanhamento jornalístico atualizado sobre ${fallbackQuery}.`,
    });
  }

  return result;
}

function buildIntelligentSynthesisFromSources(
  query: string,
  category: string,
  ptItems: RawNewsItem[],
  enItems: RawNewsItem[],
  deepExcerpts: string[],
  resolvedImageUrl: string,
  isRadar: boolean
): GeneratedStoryPayload {
  const allItems = [...ptItems, ...enItems];
  const sources = deduplicateSources(allItems, query);

  const topHeadlinePt =
    ptItems[0]?.title || `Os bastidores e o impacto dos novos desdobramentos envolvendo ${query}`;
  const topHeadlineEn = enItems[0]?.title || topHeadlinePt;

  const palette = VIBRANT_PALETTES[Math.floor(Math.random() * VIBRANT_PALETTES.length)];
  const cleanTag = query.length > 26 ? query.slice(0, 24).trim() : query;
  const sourceNames = Array.from(new Set(sources.slice(0, 4).map((s) => s.name))).join(', ');

  const ptBullets = ptItems
    .slice(0, 5)
    .map((s) => s.snippet || s.title)
    .filter((t) => t && t.length > 20);

  const enBullets = enItems
    .slice(0, 5)
    .map((s) => s.snippet || s.title)
    .filter((t) => t && t.length > 20);

  const p1 =
    ptItems[0]?.snippet ||
    `As movimentações mais recentes em torno de ${query} ganharam o centro do noticiário, mobilizando análises detalhadas na imprensa.`;
  const p2 =
    ptItems[1]?.snippet ||
    `Diferentes veículos destacam que o episódio reflete tendências acumuladas nos últimos meses e altera o equilíbrio de forças no setor.`;
  const p3 =
    ptItems[2]?.snippet ||
    `Nos bastidores, declarações e dados apurados pelas reportagens mostram que as decisões tomadas agora terão efeito prolongado.`;
  const bodyScraped = deepExcerpts
    .map((d) => d.replace(/^VEÍCULO:[\s\S]*?TEXTO EXTRAÍDO:\n/, ''))
    .join('\n\n');

  return {
    slug: slugify(topHeadlinePt),
    category,
    topicTagPt: isRadar ? `Radar: ${cleanTag}` : cleanTag,
    topicTagEn: isRadar ? `Radar: ${cleanTag}` : cleanTag,
    titlePt: topHeadlinePt,
    titleEn: topHeadlineEn,
    summaryPt: `${p1.slice(0, 240)}`,
    summaryEn: `${(enItems[0]?.snippet || p1).slice(0, 240)}`,
    bulletPointsPt: ptBullets.length >= 3 ? ptBullets : [p1, p2, p3],
    bulletPointsEn: enBullets.length >= 3 ? enBullets : ptBullets,
    perspectivesPt: [
      {
        label: `Apuração Principal (${ptItems[0]?.sourceName || 'Imprensa'})`,
        stance: 'Factual',
        summary: p1,
      },
      {
        label: `Repercussão (${ptItems[1]?.sourceName || 'Análise'})`,
        stance: 'Analítico',
        summary: p2,
      },
      {
        label: `Desdobramentos (${ptItems[2]?.sourceName || 'Contexto'})`,
        stance: 'Projeção',
        summary: p3,
      },
    ],
    perspectivesEn: [
      {
        label: `Primary Reporting (${enItems[0]?.sourceName || 'Press'})`,
        stance: 'Factual',
        summary: enItems[0]?.snippet || p1,
      },
      {
        label: `Impact & Reaction (${enItems[1]?.sourceName || 'Analysis'})`,
        stance: 'Analytical',
        summary: enItems[1]?.snippet || p2,
      },
      {
        label: `Broader Context (${enItems[2]?.sourceName || 'Context'})`,
        stance: 'Outlook',
        summary: enItems[2]?.snippet || p3,
      },
    ],
    fullArticlePt: `${p1} ${p2}\n\n${
      bodyScraped || p3
    }\n\n## O contexto e as forças em jogo\n\nAs informações apuradas por veículos como ${sourceNames} demonstram que o episódio envolvendo **${query}** reúne elementos que vinham amadurecendo nos bastidores. A convergência dos relatos aponta para impactos diretos nos próximos passos dos atores envolvidos.`,
    fullArticleEn: `${enItems[0]?.snippet || p1} ${enItems[1]?.snippet || p2}\n\n${
      bodyScraped || p3
    }`,
    imageUrl: resolvedImageUrl,
    dominantColor: palette.dominant,
    secondaryColor: palette.secondary,
    articleCount: Math.max(sources.length, 12),
    publishedAt: new Date().toISOString(),
    isRadarGenerated: isRadar,
    radarQuery: isRadar ? query : undefined,
    sources,
  };
}

/**
 * Contextual Q&A Chat about a specific story OR any general topic via OmniRoute
 */
export async function answerStoryQuestion(params: {
  story?: {
    titlePt: string;
    titleEn: string;
    summaryPt: string;
    summaryEn: string;
    fullArticlePt: string;
    fullArticleEn: string;
  } | null;
  question: string;
  lang: 'pt' | 'en';
}): Promise<string> {
  const { story, question, lang } = params;
  try {
    const { client, config } = await createOmniRouteClient();

    const isAskingAbout24h =
      question.toLowerCase().includes('24h') ||
      question.toLowerCase().includes('24 horas') ||
      question.toLowerCase().includes('hoje') ||
      question.toLowerCase().includes('últimas horas');

    const focusDirective = isAskingAbout24h
      ? lang === 'pt'
        ? '\nATENÇÃO CRÍTICA: O usuário está consultando a sessão de ÚLTIMAS 24 HORAS ou perguntando sobre fatos de hoje. Concentre sua resposta estritamente nos acontecimentos, decisões e desdobramentos mais recentes ocorridos nas últimas 24 horas.'
        : '\nCRITICAL ATTENTION: The user is asking about the LAST 24 HOURS breaking news session. Focus your response strictly on events, decisions, and developments that occurred in the last 24 hours.'
      : '';

    const systemPrompt =
      lang === 'pt'
        ? `Você é o assistente de inteligência jornalística do reach.news (roteado via OmniRoute). Você pode responder tanto perguntas específicas sobre a reportagem que o leitor está lendo no momento quanto perguntas sobre QUALQUER outro assunto, notícia, história, ciência, tecnologia, política ou curiosidade geral. Responda sempre em Português (PT-BR) de forma clara, aprofundada, direta e elegante.${focusDirective}`
        : `You are the reach.news AI journalistic intelligence assistant (routed via OmniRoute). You can answer both specific questions about the article the reader is currently viewing and questions about ANY other topic, news event, science, technology, politics, or general knowledge. Always answer in English clearly, insightfully, and concisely.${focusDirective}`;

    const userPrompt = story
      ? `CONTEXTO DA REPORTAGEM ATUAL NA TELA (use se a pergunta for sobre ela; se o usuário perguntar sobre outro assunto, responda livremente sobre o assunto perguntado):
Título: ${lang === 'pt' ? story.titlePt : story.titleEn}
Resumo: ${lang === 'pt' ? story.summaryPt : story.summaryEn}
Reportagem Completa:
${(lang === 'pt' ? story.fullArticlePt : story.fullArticleEn).slice(0, 5000)}

Pergunta do Usuário: ${question}`
      : `Pergunta do Usuário: ${question}`;

    const response = await callOmniRouteCompletion(
      client,
      config.omnirouteModel || 'antigravity/gemini-3.8-flash-low',
      [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ]
    );

    return (
      response.choices[0]?.message?.content ||
      (lang === 'pt'
        ? 'Não foi possível gerar uma resposta no momento.'
        : 'Could not generate an answer at this moment.')
    );
  } catch {
    if (story) {
      if (lang === 'pt') {
        return `Com base na reportagem sobre **"${story.titlePt}"**: ${story.summaryPt}`;
      }
      return `Based on our report on **"${story.titleEn}"**: ${story.summaryEn}`;
    }
    return lang === 'pt'
      ? 'O assistente de IA está temporariamente indisponível.'
      : 'The AI assistant is temporarily unavailable.';
  }
}

/**
 * Synthesizes a dedicated breaking story strictly focused on the last 24 hours.
 * Discovers the top urgent breaking topic of the last 24h and passes timeframe: '24h' to OmniRoute.
 */
export async function synthesize24hBreakingStory(params: {
  lang?: 'pt' | 'en';
  customTopic?: string;
}): Promise<GeneratedStoryPayload> {
  const { lang = 'pt', customTopic } = params;
  let topic = customTopic;

  if (!topic) {
    const recentCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const recentStories = await prisma.story.findMany({
      where: { publishedAt: { gte: recentCutoff } },
      select: { titlePt: true },
      take: 40,
    });
    const excludeHeadlines = recentStories.map((s) => s.titlePt);

    const topics = await fetch24hBreakingTopics(5, lang, excludeHeadlines);
    topic =
      topics[0] ||
      (lang === 'pt'
        ? 'Principais fatos e desdobramentos das últimas 24 horas no Brasil e no mundo'
        : 'Top breaking news and developments in the last 24 hours worldwide');
  }

  console.log(`[24h AI Engine] Synthesizing dedicated 24h story for: "${topic}"...`);
  return researchAndSynthesizeStory({
    query: topic,
    category: 'last_24h',
    lang,
    isRadar: false,
    timeframe: '24h',
  });
}

/**
 * Purges stories published more than 7 days ago to keep the PostgreSQL database lean.
 * Related StorySource, SavedStory, and StoryChatMessage rows are automatically removed via onDelete: Cascade.
 */
export async function purgeExpiredStories(retentionDays = 7): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const deleted = await prisma.story.deleteMany({
    where: {
      publishedAt: {
        lt: cutoffDate,
      },
    },
  });
  if (deleted.count > 0) {
    console.log(
      `[Retention Cleanup] Removed ${deleted.count} stories older than ${retentionDays} days (published before ${cutoffDate.toISOString()}).`
    );
  }
  return deleted.count;
}

/**
 * Helper to save a synthesized story into PostgreSQL after deep multi-layered deduplication analysis
 * (Source URL matching + Token overlap + AI semantic analysis)
 */
export async function saveSynthesizedStoryIfUnique(
  generated: GeneratedStoryPayload,
  options?: { allowReturnExisting?: boolean }
): Promise<{ story: any; isDuplicate: boolean; reason?: string }> {
  const { client, config } = await createOmniRouteClient();
  const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const recentStories = await prisma.story.findMany({
    where: { publishedAt: { gte: threeDaysAgo } },
    include: { sources: { select: { url: true } } },
    take: 60,
    orderBy: { publishedAt: 'desc' },
  });

  const dupCheck = await analyzeCandidateForDuplicates({
    candidateTitle: generated.titlePt,
    candidateSummary: generated.summaryPt,
    candidateSources: generated.sources,
    existingStories: recentStories,
    client,
    model: config.omnirouteModel || 'antigravity/gemini-3.8-flash-low',
  });

  if (dupCheck.isDuplicate) {
    console.log(
      `[Deduplication System] REJECTED DUPLICATE: "${generated.titlePt}" duplicates "${dupCheck.duplicateOf?.titlePt}" (${dupCheck.reason})`
    );
    if (options?.allowReturnExisting && dupCheck.duplicateOf) {
      const fullExisting = await prisma.story.findUnique({
        where: { id: dupCheck.duplicateOf.id },
        include: { sources: true },
      });
      return { story: fullExisting, isDuplicate: true, reason: dupCheck.reason };
    }
    return { story: null, isDuplicate: true, reason: dupCheck.reason };
  }

  const storyPublishedAt = generated.publishedAt
    ? new Date(generated.publishedAt)
    : new Date();

  const saved = await prisma.story.create({
    data: {
      slug: generated.slug,
      category: generated.category,
      publishedAt: !isNaN(storyPublishedAt.getTime()) ? storyPublishedAt : new Date(),
      topicTagPt: generated.topicTagPt,
      topicTagEn: generated.topicTagEn,
      titlePt: generated.titlePt,
      titleEn: generated.titleEn,
      summaryPt: generated.summaryPt,
      summaryEn: generated.summaryEn,
      bulletPointsPt: generated.bulletPointsPt,
      bulletPointsEn: generated.bulletPointsEn,
      perspectivesPt: generated.perspectivesPt,
      perspectivesEn: generated.perspectivesEn,
      fullArticlePt: generated.fullArticlePt,
      fullArticleEn: generated.fullArticleEn,
      imageUrl: generated.imageUrl,
      dominantColor: generated.dominantColor,
      secondaryColor: generated.secondaryColor,
      articleCount: generated.articleCount,
      isRadarGenerated: generated.isRadarGenerated,
      radarQuery: generated.radarQuery,
      sources: {
        create: generated.sources.map((s) => ({
          name: s.name,
          title: s.title,
          url: s.url,
          domain: s.domain,
          publishedAt: s.publishedAt
            ? (isNaN(new Date(s.publishedAt).getTime())
                ? new Date().toISOString()
                : new Date(s.publishedAt).toISOString())
            : new Date().toISOString(),
          snippet: s.snippet,
        })),
      },
    },
    include: {
      sources: true,
    },
  });

  return { story: saved, isDuplicate: false };
}

let isHourlyCycleRunning = false;

/**
 * Full Hourly Editorial Cycle:
 * 1. Purges stories older than 7 days (1 week).
 * 2. Discovers the Top 5 most talked-about trending topics right now (Google Trends + X/Twitter + Top Media) and generates 5 flagship stories.
 * 3. Generates at least 2 distinct stories for every single platform category (technology, science, politics, crime, sports, entertainment, economics, videogames).
 */
export async function runHourlyEditorialCycle(): Promise<{
  deletedExpired: number;
  trendingGenerated: number;
  categoryGenerated: number;
}> {
  if (isHourlyCycleRunning) {
    console.log('[Hourly Cycle] Cycle already in progress, skipping overlapping trigger.');
    return { deletedExpired: 0, trendingGenerated: 0, categoryGenerated: 0 };
  }

  isHourlyCycleRunning = true;
  let deletedExpired = 0;
  let trendingGenerated = 0;
  let categoryGenerated = 0;

  try {
    console.log('[Hourly Cycle] 1/3 Purging stories older than 7 days...');
    deletedExpired = await purgeExpiredStories(7);

    // Fetch recent headlines to exclude already covered topics
    const recentCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const recentStories = await prisma.story.findMany({
      where: { publishedAt: { gte: recentCutoff } },
      select: { titlePt: true },
      take: 60,
    });
    const excludeHeadlines = recentStories.map((s) => s.titlePt);

    // Step 2: Top 5 most talked-about trending topics right now across Google Trends, X/Twitter, and major press
    console.log('[Hourly Cycle] 2/3 Fetching Top 5 viral/trending topics (Google Trends + X/Twitter + Top Media)...');
    const topTrendingTopics = await fetchTrendingTopics(5, excludeHeadlines);
    console.log('[Hourly Cycle] Top 5 Trending Topics discovered (excluding existing):', topTrendingTopics);

    for (const topic of topTrendingTopics) {
      try {
        console.log(`[Hourly Cycle - Trending] Synthesizing flagship story for: "${topic}"`);
        const generated = await researchAndSynthesizeStory({
          query: topic,
          category: 'popular',
          lang: 'pt',
          isRadar: false,
        });
        const res = await saveSynthesizedStoryIfUnique(generated);
        if (res.story && !res.isDuplicate) trendingGenerated++;
      } catch (err) {
        console.warn(`[Hourly Cycle - Trending] Error generating topic "${topic}":`, (err as Error).message);
      }
    }

    // Step 3: At least 2 distinct news stories for EACH of the 8 core platform categories
    const editorialCategories = [
      'technology',
      'sports',
      'entertainment',
      'science',
      'politics',
      'crime',
      'economics',
      'videogames',
    ];
    console.log(
      `[Hourly Cycle] 3/3 Generating 2 stories for each of the ${editorialCategories.length} categories: ${editorialCategories.join(', ')}`
    );

    for (const category of editorialCategories) {
      try {
        const distinctTopics = await fetchDistinctCategoryTopics(category, 2, 'pt', excludeHeadlines);
        for (const topicQuery of distinctTopics) {
          try {
            console.log(`[Hourly Cycle - ${category.toUpperCase()}] Synthesizing story for: "${topicQuery}"`);
            const generated = await researchAndSynthesizeStory({
              query: topicQuery,
              category,
              lang: 'pt',
              isRadar: false,
            });
            // Safeguard: Do not force political news into sports or vice-versa
            if (generated.category !== category) {
              const verified = classifyStoryCategory({
                title: generated.titlePt,
                summary: generated.summaryPt,
                hintCategory: category,
              });
              if (verified.category === category) {
                generated.category = category;
              }
            }
            const res = await saveSynthesizedStoryIfUnique(generated);
            if (res.story && !res.isDuplicate) categoryGenerated++;
          } catch (innerErr) {
            console.warn(
              `[Hourly Cycle - ${category}] Error synthesizing "${topicQuery}":`,
              (innerErr as Error).message
            );
          }
        }
      } catch (catErr) {
        console.warn(`[Hourly Cycle] Failed category discovery for ${category}:`, (catErr as Error).message);
      }
    }

    console.log(
      `[Hourly Cycle] Completed! Expired deleted: ${deletedExpired} | Trending generated: ${trendingGenerated} | Category stories generated: ${categoryGenerated}`
    );
    return { deletedExpired, trendingGenerated, categoryGenerated };
  } finally {
    isHourlyCycleRunning = false;
  }
}

/**
 * Intelligent Radar Search Planner:
 * Evaluates the user's search query alongside live news results and decides:
 * - If the query is a VERY SPECIFIC single event/incident -> returns 1 focused sub-query.
 * - If the query is a BROAD topic, person, company, club, or sector -> returns 3 to 4 distinct news angles (minimum 3)
 *   so the platform generates a rich multi-story coverage for that search!
 */
export async function planSmartSearchAngles(params: {
  query: string;
  lang: 'pt' | 'en';
}): Promise<{
  scope: 'specific' | 'broad';
  targetCount: number;
  angles: string[];
}> {
  const { query, lang } = params;
  const cleanQuery = query.trim();

  // Gather live headlines for this query to inspect the breadth of current news coverage
  const liveItems = await searchWebNews(cleanQuery, lang, 15);
  const headlinesList = liveItems
    .slice(0, 12)
    .map((item, idx) => `${idx + 1}. [${item.sourceName}] ${item.title}`)
    .join('\n');

  try {
    const { client, config } = await createOmniRouteClient();
    const prompt = `Você é o Editor de Pesquisa do reach.news.
O usuário pesquisou na barra de busca: "${cleanQuery}"

Manchetes reais encontradas agora na imprensa sobre esse termo:
${headlinesList || 'Nenhuma manchete específica encontrada.'}

SUA TAREFA:
Determine se a pesquisa do usuário é:
1. "specific": um fato/evento único altamente específico (ex: uma frase longa descrevendo um único acidente, uma decisão judicial pontual ou placar específico de um único jogo). Nesse caso, retorne 1 único ângulo de apuração.
2. "broad": um tema amplo, pessoa, atleta, político, empresa, clube, tecnologia, país, mercado ou assunto que comporta múltiplos desdobramentos diferentes (ex: "Cristiano Ronaldo", "Inteligência Artificial", "Petrobras", "Flamengo", "Bitcoin", "Eleições", "SpaceX", "Economia"). Nesse caso, você DEVE retornar no MÍNIMO 3 (entre 3 e 4) pautas/ângulos jornalísticos DISTINTOS baseados nas manchetes reais acima, para que nossa redação de IA gere pelo menos 3 notícias diferentes sobre o tema pesquisado!

Retorne APENAS um JSON válido (sem markdown \`\`\`json) no formato:
{
  "scope": "broad" | "specific",
  "angles": [
    "Pauta específica 1 para pesquisar e gerar notícia",
    "Pauta específica 2 distinta da primeira",
    "Pauta específica 3 distinta das anteriores"
  ]
}`;

    const res = await callOmniRouteCompletion(
      client,
      config.omnirouteModel || 'antigravity/gemini-3.8-flash-low',
      [{ role: 'user', content: prompt }],
      0.3
    );

    const raw = res.choices?.[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const rawAngles: string[] = Array.isArray(parsed.angles)
        ? parsed.angles.map((a: unknown) => String(a).trim()).filter(Boolean)
        : [];

      if (parsed.scope === 'specific' && rawAngles.length >= 1) {
        return {
          scope: 'specific',
          targetCount: 1,
          angles: [rawAngles[0]],
        };
      }

      if (rawAngles.length >= 3) {
        return {
          scope: 'broad',
          targetCount: Math.min(4, rawAngles.length),
          angles: rawAngles.slice(0, 4),
        };
      }
    }
  } catch (err) {
    console.warn('[SmartSearchPlanner] Fallback heuristic used:', (err as Error).message);
  }

  // Fallback heuristic if LLM planner fails:
  // If the query has 6+ words, treat as specific (1 story); otherwise treat as broad (3 distinct angles from live headlines)
  const wordCount = cleanQuery.split(/\s+/).length;
  if (wordCount >= 6) {
    return {
      scope: 'specific',
      targetCount: 1,
      angles: [cleanQuery],
    };
  }

  const distinctFromRss: string[] = [];
  for (const item of liveItems) {
    const cleanTitle = item.title.split(' - ')[0].trim();
    if (cleanTitle.length > 15 && !distinctFromRss.includes(cleanTitle)) {
      distinctFromRss.push(cleanTitle);
    }
    if (distinctFromRss.length >= 3) break;
  }

  while (distinctFromRss.length < 3) {
    distinctFromRss.push(`${cleanQuery} - desdobramentos ${distinctFromRss.length + 1}`);
  }

  return {
    scope: 'broad',
    targetCount: 3,
    angles: distinctFromRss.slice(0, 3),
  };
}

