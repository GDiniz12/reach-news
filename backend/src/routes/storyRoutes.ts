import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import {
  researchAndSynthesizeStory,
  synthesize24hBreakingStory,
  saveSynthesizedStoryIfUnique,
  cleanExistingDuplicateStories,
  answerStoryQuestion,
  checkOmniRouteStatus,
  getSystemConfig,
  runHourlyEditorialCycle,
  purgeExpiredStories,
  planSmartSearchAngles,
  getStoriesCacheVersion,
  bumpStoriesCacheVersion,
  invalidateSystemConfigCache,
} from '../services/omnirouteService';
import { CATEGORY_QUERIES, fetchDistinctCategoryTopics } from '../services/searchTools';
import { ensureSeededStories } from '../services/seedService';
import { isAiRestPeriod } from '../services/aiScheduleService';
import { authenticateToken, AuthRequest } from './authRoutes';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'reach-news-super-secret-jwt-key-2026';

const activeRecommendationJobs = new Set<string>();

// In-memory cache for feed queries to prevent redundant PostgreSQL Egress on page loads & tab switches
const FEED_CACHE_TTL_MS = 60 * 1000; // 60 seconds (auto-invalidated immediately whenever a story is created/updated/deleted)
const feedListCache = new Map<string, { at: number; version: number; data: any[] }>();
let forYouCandidateCache: { at: number; version: number; data: any[] } | null = null;

// Feed list selection fields (omits giant fullArticle markdown to maximize performance and prevent database Egress spikes)
export const FEED_STORY_SELECT = {
  id: true,
  slug: true,
  category: true,
  topicTagPt: true,
  topicTagEn: true,
  titlePt: true,
  titleEn: true,
  summaryPt: true,
  summaryEn: true,
  bulletPointsPt: true,
  bulletPointsEn: true,
  perspectivesPt: true,
  perspectivesEn: true,
  imageUrl: true,
  dominantColor: true,
  secondaryColor: true,
  articleCount: true,
  isRadarGenerated: true,
  radarQuery: true,
  publishedAt: true,
  sources: true,
} as const;

const SUBINTEREST_TO_PARENT_CATEGORY: Record<string, string> = {
  artificial_intelligence: 'technology',
  startups: 'technology',
  cybersecurity: 'technology',
  hardware: 'technology',
  automotive: 'technology',
  space: 'science',
  health: 'science',
  climate: 'science',
  finance: 'economics',
  crypto: 'economics',
  business: 'economics',
  geopolitics: 'politics',
  education: 'politics',
  football: 'sports',
  motorsport: 'sports',
  music: 'entertainment',
  esports: 'videogames',
};

// GET /api/stories/for-you - Personalized Adaptive Feed ("Para Você" - Exclusive to logged-in users)
router.get('/stories/for-you', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { localAffinity, lang = 'pt', limit = '30' } = req.query;

    let userInterests: string[] = [];
    let affinityMap: Record<string, number> = {};

    // 1. Load authenticated user's interests & affinityMap from PostgreSQL (minimal select)
    const user = (await prisma.user.findUnique({
      where: { id: req.userId },
      select: { interests: true, affinityMap: true },
    })) as any;
    if (user) {
      userInterests = Array.isArray(user.interests) ? user.interests : [];
      affinityMap =
        user.affinityMap && typeof user.affinityMap === 'object' ? { ...user.affinityMap } : {};
    }

    // 2. Merge localAffinity from browser if present
    if (localAffinity && typeof localAffinity === 'string') {
      try {
        const parsedLocal = JSON.parse(localAffinity) as Record<string, number>;
        for (const [k, v] of Object.entries(parsedLocal)) {
          if (typeof v === 'number') {
            affinityMap[k] = Math.max(affinityMap[k] || 0, v);
          }
        }
      } catch {
        // ignore invalid JSON
      }
    }

    // Ensure every explicit interest (and its parent platform category) has baseline affinity points
    for (const interest of userInterests) {
      const key = interest.toLowerCase();
      affinityMap[key] = Math.max(affinityMap[key] || 0, 15);
      const parentCat = SUBINTEREST_TO_PARENT_CATEGORY[key];
      if (parentCat) {
        affinityMap[parentCat] = Math.max(affinityMap[parentCat] || 0, 12);
      }
    }

    // 3. Fetch recent stories using FEED_STORY_SELECT (omits fullArticlePt/En) + 60s in-memory cache
    const currentVersion = getStoriesCacheVersion();
    let allStories: any[];
    if (
      forYouCandidateCache &&
      forYouCandidateCache.version === currentVersion &&
      Date.now() - forYouCandidateCache.at < FEED_CACHE_TTL_MS
    ) {
      allStories = forYouCandidateCache.data;
    } else {
      allStories = await prisma.story.findMany({
        select: FEED_STORY_SELECT,
        orderBy: { publishedAt: 'desc' },
        take: 45,
      });
      forYouCandidateCache = {
        at: Date.now(),
        version: currentVersion,
        data: allStories,
      };
    }

    // 4. Score and rank every story using our Adaptive Recommendation Algorithm
    const now = Date.now();
    const scoredStories = allStories.map((story) => {
      const catKey = story.category.toLowerCase();
      const tagPtKey = `tag:${story.topicTagPt.toLowerCase()}`;
      const tagEnKey = `tag:${story.topicTagEn.toLowerCase()}`;

      let affinityScore = 0;
      let matchReasonPt = '';
      let matchReasonEn = '';

      // Direct category affinity
      const catPoints = affinityMap[catKey] || 0;
      if (catPoints > 0) {
        affinityScore += catPoints * 2.2;
      }

      // Specific topic tag affinity
      const tagPoints = Math.max(affinityMap[tagPtKey] || 0, affinityMap[tagEnKey] || 0);
      if (tagPoints > 0) {
        affinityScore += tagPoints * 2.5;
      }

      // Keyword / custom interest match inside title or summary
      for (const [key, pts] of Object.entries(affinityMap)) {
        if (pts <= 0) continue;
        const cleanTerm = key.replace(/^tag:/, '').toLowerCase();
        if (
          cleanTerm.length >= 3 &&
          cleanTerm !== catKey &&
          (story.titlePt.toLowerCase().includes(cleanTerm) ||
            story.summaryPt.toLowerCase().includes(cleanTerm) ||
            story.topicTagPt.toLowerCase().includes(cleanTerm))
        ) {
          affinityScore += pts * 1.5;
        }
      }

      // Freshness score (decays smoothly over 48 hours so breaking news stays high)
      const ageHours = Math.max(0.2, (now - new Date(story.publishedAt).getTime()) / (1000 * 60 * 60));
      const freshnessBoost = Math.max(0, 28 - ageHours * 0.9);

      const totalScore = Math.round((affinityScore + freshnessBoost) * 10) / 10;

      if (userInterests.includes(catKey) && catPoints <= 18) {
        matchReasonPt = `Seu interesse escolhido`;
        matchReasonEn = `Your selected interest`;
      } else if (affinityScore >= 25) {
        matchReasonPt = `Alta afinidade com seu perfil`;
        matchReasonEn = `High match with your profile`;
      } else if (affinityScore > 0) {
        matchReasonPt = `Baseado no que você lê`;
        matchReasonEn = `Based on your reading`;
      } else {
        matchReasonPt = `Destaque em alta`;
        matchReasonEn = `Trending highlight`;
      }

      return {
        ...story,
        recommendationScore: totalScore,
        affinityScore: Math.round(affinityScore),
        matchReasonPt,
        matchReasonEn,
      };
    });

    scoredStories.sort((a, b) => b.recommendationScore - a.recommendationScore);

    // 5. Proactive AI Synthesis: If the user's #1 interest has < 2 stories in the database, synthesize a fresh one in background!
    const sortedAffinities = Object.entries(affinityMap)
      .filter(([k, pts]) => !k.startsWith('tag:') && pts >= 10 && CATEGORY_QUERIES[k])
      .sort((a, b) => b[1] - a[1]);

    if (sortedAffinities.length > 0 && !isAiRestPeriod()) {
      const topCategory = sortedAffinities[0][0];
      const countForTopCategory = allStories.filter((s) => s.category === topCategory).length;

      if (countForTopCategory < 2 && !activeRecommendationJobs.has(topCategory)) {
        activeRecommendationJobs.add(topCategory);
        const queryObj = CATEGORY_QUERIES[topCategory];
        const targetLang = lang === 'en' ? 'en' : 'pt';
        const searchTopic = targetLang === 'pt' ? queryObj.pt : queryObj.en;

        console.log(
          `[ForYou AI Engine] User's top interest "${topCategory}" has only ${countForTopCategory} stories. Synthesizing fresh story in background...`
        );

        researchAndSynthesizeStory({
          query: searchTopic,
          category: topCategory,
          lang: targetLang,
          isRadar: false,
        })
          .then((generated) => saveSynthesizedStoryIfUnique(generated))
          .catch((e) => console.warn('[ForYou AI Engine] Background synthesis warning:', e.message))
          .finally(() => activeRecommendationJobs.delete(topCategory));
      }
    }

    res.json({
      stories: scoredStories.slice(0, Number(limit)),
      affinityMap,
      userInterests,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/stories - List stories with optional category, 24h timeframe, or search filter
router.get('/stories', async (req: Request, res: Response) => {
  try {
    const { category, q, limit = '30', timeframe, lang = 'pt' } = req.query;

    const catKey = category ? String(category).toLowerCase().trim() : undefined;
    const is24h = catKey === 'last_24h' || timeframe === '24h';
    const hasSearchQuery = Boolean(q && String(q).trim().length > 0);
    const cacheKey = `${catKey || 'popular'}:${is24h ? '24h' : 'all'}:${limit}`;
    const currentVersion = getStoriesCacheVersion();

    // Serve from in-memory cache if available and not a custom search query
    if (!hasSearchQuery) {
      const cached = feedListCache.get(cacheKey);
      if (cached && cached.version === currentVersion && Date.now() - cached.at < FEED_CACHE_TTL_MS && cached.data.length > 0) {
        res.json({ stories: cached.data });
        return;
      }
    }

    const where: Record<string, unknown> = {};

    if (is24h) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      where.publishedAt = { gte: twentyFourHoursAgo };
      if (catKey && catKey !== 'last_24h' && catKey !== 'popular' && catKey !== 'all') {
        where.category = catKey;
      }
    } else if (catKey && catKey !== 'popular' && catKey !== 'all') {
      where.category = catKey;
    }

    if (hasSearchQuery) {
      const search = String(q).trim();
      const keywords = search
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 3);

      const orConditions: Array<Record<string, unknown>> = [
        { titlePt: { contains: search, mode: 'insensitive' } },
        { titleEn: { contains: search, mode: 'insensitive' } },
        { summaryPt: { contains: search, mode: 'insensitive' } },
        { summaryEn: { contains: search, mode: 'insensitive' } },
        { topicTagPt: { contains: search, mode: 'insensitive' } },
        { topicTagEn: { contains: search, mode: 'insensitive' } },
        { radarQuery: { contains: search, mode: 'insensitive' } },
      ];

      for (const kw of keywords) {
        orConditions.push(
          { titlePt: { contains: kw, mode: 'insensitive' } },
          { summaryPt: { contains: kw, mode: 'insensitive' } },
          { topicTagPt: { contains: kw, mode: 'insensitive' } }
        );
      }

      where.OR = orConditions;
    }

    let stories = await prisma.story.findMany({
      where,
      select: FEED_STORY_SELECT,
      orderBy: { publishedAt: 'desc' },
      take: Number(limit),
    });

    // Self-healing fallback: If popular/initial feed has 0 stories, auto-seed and return stories
    if (stories.length === 0 && (!catKey || catKey === 'popular' || catKey === 'all') && !hasSearchQuery) {
      const count = await prisma.story.count();
      if (count === 0) {
        console.log('[GET /stories] Database empty on popular feed. Auto-populating initial seed stories...');
        await ensureSeededStories();
        bumpStoriesCacheVersion();
        stories = await prisma.story.findMany({
          select: FEED_STORY_SELECT,
          orderBy: { publishedAt: 'desc' },
          take: Number(limit),
        });
      }
    }

    if (!hasSearchQuery && stories.length > 0) {
      feedListCache.set(cacheKey, {
        at: Date.now(),
        version: getStoriesCacheVersion(),
        data: stories,
      });
    }

    // Proactive AI synthesis: if 24h session is requested and has fewer than 2 stories, synthesize fresh 24h news in background (outside 00h-05h rest period)
    if (is24h && !isAiRestPeriod() && stories.length < 2 && !activeRecommendationJobs.has('last_24h')) {
      activeRecommendationJobs.add('last_24h');
      synthesize24hBreakingStory({ lang: lang === 'en' ? 'en' : 'pt' })
        .then((generated) => saveSynthesizedStoryIfUnique(generated))
        .catch((e) => console.warn('[24h AI Engine] Background synthesis warning:', e.message))
        .finally(() => activeRecommendationJobs.delete('last_24h'));
    }

    res.json({ stories });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/stories/:idOrSlug - Single story details + sources + chat history
// Enhanced with multi-tier resilient lookup: handles URL decoding, case-insensitivity,
// collapsed dashes, random hash prefixes, and keyword fallbacks.
router.get('/stories/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const rawParam = String(req.params.idOrSlug || '').trim();
    let decodedParam = rawParam;
    try {
      decodedParam = decodeURIComponent(rawParam).trim();
    } catch {
      // Keep rawParam if decodeURIComponent fails
    }

    const lowered = decodedParam.toLowerCase();
    const normalizedDashes = lowered.replace(/-+/g, '-');
    const withoutTrailingSlash = decodedParam.replace(/\/+$/, '');

    // Tier 1: Direct ID or exact slug lookup (case-insensitive)
    let story = await prisma.story.findFirst({
      where: {
        OR: [
          { id: rawParam },
          { id: decodedParam },
          { id: withoutTrailingSlash },
          { slug: { equals: rawParam, mode: 'insensitive' } },
          { slug: { equals: decodedParam, mode: 'insensitive' } },
          { slug: { equals: lowered, mode: 'insensitive' } },
          { slug: { equals: normalizedDashes, mode: 'insensitive' } },
          { slug: { equals: withoutTrailingSlash, mode: 'insensitive' } },
        ],
      },
      include: {
        sources: true,
        chatMessages: {
          orderBy: { createdAt: 'asc' },
          take: 30,
        },
      },
    });

    // Tier 2: Match by core slug prefix (without random 5-char hash like '-rg9m5')
    if (!story && lowered.length > 8) {
      const coreSlug = lowered.replace(/-[a-z0-9]{4,7}$/i, '');
      if (coreSlug.length > 5) {
        story = await prisma.story.findFirst({
          where: {
            slug: { startsWith: coreSlug, mode: 'insensitive' },
          },
          include: {
            sources: true,
            chatMessages: {
              orderBy: { createdAt: 'asc' },
              take: 30,
            },
          },
        });
      }
    }

    // Tier 3: Keyword fallback on title if the URL was partially truncated by an external app
    if (!story && lowered.length > 10) {
      const keywords = lowered
        .split('-')
        .map((w) => w.trim())
        .filter((w) => w.length >= 4)
        .slice(0, 4);

      if (keywords.length >= 2) {
        story = await prisma.story.findFirst({
          where: {
            AND: keywords.map((kw) => ({
              OR: [
                { titlePt: { contains: kw, mode: 'insensitive' } },
                { titleEn: { contains: kw, mode: 'insensitive' } },
              ],
            })),
          },
          include: {
            sources: true,
            chatMessages: {
              orderBy: { createdAt: 'asc' },
              take: 30,
            },
          },
        });
      }
    }

    if (!story) {
      res.status(404).json({ error: 'Notícia não encontrada.' });
      return;
    }

    res.json({ story });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/radar/research - On-demand AI Radar investigation & multi-story synthesis via OmniRoute
// Interprets query breadth: if specific event -> generates 1 story; if broad topic -> generates at least 3 distinct stories!
router.post('/radar/research', async (req: Request, res: Response) => {
  try {
    const { query, category = 'popular', lang = 'pt' } = req.body;
    if (!query || String(query).trim().length < 2) {
      res.status(400).json({ error: 'Informe um tópico, empresa ou pessoa para pesquisar no Radar.' });
      return;
    }

    const cleanQuery = String(query).trim();
    const targetLang = lang === 'en' ? 'en' : 'pt';

    // 1. AI Planner interprets whether the search is specific (1 story) or broad (3+ stories)
    const plan = await planSmartSearchAngles({
      query: cleanQuery,
      lang: targetLang,
    });

    const createdStories = [];

    // 2. Synthesize each distinct angle identified by the AI Planner
    for (const angleQuery of plan.angles) {
      try {
        const generated = await researchAndSynthesizeStory({
          query: angleQuery,
          category: String(category || 'popular'),
          lang: targetLang,
          isRadar: true,
        });

        const res = await saveSynthesizedStoryIfUnique(generated, { allowReturnExisting: true });
        if (res.story) {
          createdStories.push(res.story);
        }
      } catch (angleErr) {
        console.warn(`[Radar Research] Angle "${angleQuery}" failed:`, (angleErr as Error).message);
      }
    }

    if (createdStories.length === 0) {
      throw new Error('Não foi possível sintetizar as notícias para esta pesquisa no momento.');
    }

    res.status(201).json({
      story: createdStories[0],
      stories: createdStories,
      scope: plan.scope,
      generatedCount: createdStories.length,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/stories/refresh-category - Trigger category news refresh via OmniRoute (with AI anti-duplication)
router.post('/stories/refresh-category', async (req: Request, res: Response) => {
  try {
    const { category = 'technology', customTopic, lang = 'pt' } = req.body;
    const catKey = String(category).toLowerCase();
    const targetLang = lang === 'en' ? 'en' : 'pt';

    // Special handler for 24h Breaking News session
    if (catKey === 'last_24h') {
      const generated = await synthesize24hBreakingStory({
        lang: targetLang,
        customTopic: customTopic ? String(customTopic) : undefined,
      });

      const resUnique = await saveSynthesizedStoryIfUnique(generated, { allowReturnExisting: true });
      res.status(201).json({ story: resUnique.story });
      return;
    }

    const queryObj = CATEGORY_QUERIES[catKey] || CATEGORY_QUERIES.popular;

    // Load recent headlines to find a guaranteed distinct, non-duplicate topic
    const recentStories = await prisma.story.findMany({
      select: { titlePt: true },
      take: 60,
      orderBy: { publishedAt: 'desc' },
    });
    const excludeHeadlines = recentStories.map((s) => s.titlePt);

    const candidates = customTopic
      ? [String(customTopic)]
      : await fetchDistinctCategoryTopics(catKey, 2, targetLang, excludeHeadlines);

    if (candidates.length === 0) {
      candidates.push(targetLang === 'pt' ? queryObj.pt : queryObj.en);
    }

    let finalStory = null;
    for (const searchTopic of candidates) {
      const generated = await researchAndSynthesizeStory({
        query: searchTopic,
        category: catKey === 'popular' ? 'technology' : catKey,
        lang: targetLang,
        isRadar: false,
        timeframe: 'recent',
      });

      const resUnique = await saveSynthesizedStoryIfUnique(generated, { allowReturnExisting: false });
      if (resUnique.story && !resUnique.isDuplicate) {
        finalStory = resUnique.story;
        break;
      }
    }

    // If all distinct candidates were duplicates of existing coverage, fetch the latest story from this category
    if (!finalStory) {
      finalStory = await prisma.story.findFirst({
        where: catKey !== 'popular' && catKey !== 'all' ? { category: catKey } : {},
        select: FEED_STORY_SELECT,
        orderBy: { publishedAt: 'desc' },
      });
    }

    res.status(201).json({ story: finalStory });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/stories/refresh-24h - Explicit endpoint to synthesize breaking news strictly for the last 24h (with anti-duplication)
router.post('/stories/refresh-24h', async (req: Request, res: Response) => {
  try {
    const { customTopic, lang = 'pt' } = req.body;
    const targetLang = lang === 'en' ? 'en' : 'pt';

    const generated = await synthesize24hBreakingStory({
      lang: targetLang,
      customTopic: customTopic ? String(customTopic) : undefined,
    });

    const resUnique = await saveSynthesizedStoryIfUnique(generated, { allowReturnExisting: true });
    res.status(201).json({ story: resUnique.story });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/stories/deduplicate - Scans and removes any existing duplicate stories from the database
router.post('/stories/deduplicate', async (_req: Request, res: Response) => {
  try {
    const result = await cleanExistingDuplicateStories();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/stories/:id/chat - Ask OmniRoute AI about a specific story
router.post('/stories/:id/chat', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { question, lang = 'pt' } = req.body;

    if (!question || String(question).trim().length === 0) {
      res.status(400).json({ error: 'Pergunta vazia.' });
      return;
    }

    const story = await prisma.story.findUnique({ where: { id } });
    if (!story) {
      res.status(404).json({ error: 'Notícia não encontrada.' });
      return;
    }

    await prisma.storyChatMessage.create({
      data: {
        storyId: story.id,
        role: 'user',
        content: String(question).trim(),
      },
    });

    const answer = await answerStoryQuestion({
      story,
      question: String(question).trim(),
      lang: lang === 'en' ? 'en' : 'pt',
    });

    const assistantMsg = await prisma.storyChatMessage.create({
      data: {
        storyId: story.id,
        role: 'assistant',
        content: answer,
      },
    });

    res.json({ answer, message: assistantMsg });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/chat - Ask OmniRoute AI about any topic or current story
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { question, storyId, lang = 'pt' } = req.body;
    if (!question || String(question).trim().length === 0) {
      res.status(400).json({ error: 'Pergunta vazia.' });
      return;
    }

    const story = storyId
      ? await prisma.story.findUnique({ where: { id: String(storyId) } })
      : null;

    if (story) {
      await prisma.storyChatMessage.create({
        data: {
          storyId: story.id,
          role: 'user',
          content: String(question).trim(),
        },
      });
    }

    const answer = await answerStoryQuestion({
      story,
      question: String(question).trim(),
      lang: lang === 'en' ? 'en' : 'pt',
    });

    if (story) {
      const assistantMsg = await prisma.storyChatMessage.create({
        data: {
          storyId: story.id,
          role: 'assistant',
          content: answer,
        },
      });
      res.json({ answer, message: assistantMsg });
      return;
    }

    res.json({
      answer,
      message: {
        id: 'gen-' + Date.now(),
        storyId: '',
        role: 'assistant',
        content: answer,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/stories/:id/bookmark - Toggle saved story for logged-in user
router.post('/stories/:id/bookmark', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = req.userId!;

    const existing = await prisma.savedStory.findUnique({
      where: {
        userId_storyId: { userId, storyId: id },
      },
    });

    if (existing) {
      await prisma.savedStory.delete({ where: { id: existing.id } });
      res.json({ saved: false });
      return;
    }

    await prisma.savedStory.create({
      data: { userId, storyId: id },
    });
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/omniroute/status - Check OmniRoute gateway status & configuration
router.get('/omniroute/status', async (_req: Request, res: Response) => {
  try {
    const status = await checkOmniRouteStatus();
    const config = await getSystemConfig();
    res.json({
      ...status,
      config: {
        omnirouteBaseUrl: config.omnirouteBaseUrl,
        omnirouteModel: config.omnirouteModel,
        cronEnabled: config.cronEnabled,
        cronIntervalMin: config.cronIntervalMin,
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/omniroute/config - Update OmniRoute endpoint, API Key, Model, or Cron settings
router.put('/omniroute/config', async (req: Request, res: Response) => {
  try {
    const { omnirouteBaseUrl, omnirouteApiKey, omnirouteModel, cronEnabled, cronIntervalMin } = req.body;
    const current = await getSystemConfig();

    const updated = await prisma.systemConfig.update({
      where: { id: current.id },
      data: {
        omnirouteBaseUrl: omnirouteBaseUrl ?? current.omnirouteBaseUrl,
        omnirouteApiKey: omnirouteApiKey ? omnirouteApiKey : current.omnirouteApiKey,
        omnirouteModel: omnirouteModel ?? current.omnirouteModel,
        cronEnabled: typeof cronEnabled === 'boolean' ? cronEnabled : current.cronEnabled,
        cronIntervalMin: cronIntervalMin ? Number(cronIntervalMin) : current.cronIntervalMin,
      },
    });
    invalidateSystemConfigCache();

    const status = await checkOmniRouteStatus();
    res.json({ config: updated, status });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/stories/run-hourly-cycle - Trigger the full hourly cycle (7-day cleanup + 5 trending + 2 per category)
router.post('/stories/run-hourly-cycle', async (_req: Request, res: Response) => {
  try {
    if (isAiRestPeriod()) {
      res.status(403).json({
        error: 'A IA está em período de descanso (00h às 05h). Tente novamente a partir das 05h01.',
      });
      return;
    }
    const deletedExpired = await purgeExpiredStories(7);
    // Run the full synthesis batch asynchronously so the HTTP request returns immediately
    runHourlyEditorialCycle({ force: true }).catch((err) =>
      console.warn('[Manual Hourly Cycle] Error:', (err as Error).message)
    );
    res.json({
      message:
        'Ciclo horário iniciado! Limpeza de notícias (+7 dias) concluída e geração de 5 Top Assuntos + 2 por categoria em andamento.',
      deletedExpired,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
