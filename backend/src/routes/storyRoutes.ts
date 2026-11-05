import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import {
  researchAndSynthesizeStory,
  answerStoryQuestion,
  checkOmniRouteStatus,
  getSystemConfig,
  runHourlyEditorialCycle,
  purgeExpiredStories,
  planSmartSearchAngles,
} from '../services/omnirouteService';
import { CATEGORY_QUERIES } from '../services/searchTools';
import { authenticateToken, AuthRequest } from './authRoutes';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'reach-news-super-secret-jwt-key-2026';

const activeRecommendationJobs = new Set<string>();

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

    // 1. Load authenticated user's interests & affinityMap from PostgreSQL
    const user = (await prisma.user.findUnique({ where: { id: req.userId } })) as any;
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

    // 3. Fetch recent stories from PostgreSQL
    const allStories = await prisma.story.findMany({
      include: { sources: true },
      orderBy: { publishedAt: 'desc' },
      take: 80,
    });

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

    if (sortedAffinities.length > 0) {
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
          .then((generated) =>
            prisma.story.create({
              data: {
                slug: generated.slug,
                category: topCategory,
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
                isRadarGenerated: false,
                sources: {
                  create: generated.sources,
                },
              },
            })
          )
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

// GET /api/stories - List stories with optional category or search filter
router.get('/stories', async (req: Request, res: Response) => {
  try {
    const { category, q, limit = '30' } = req.query;

    const where: Record<string, unknown> = {};
    if (category && category !== 'popular' && category !== 'all') {
      where.category = String(category);
    }
    if (q && String(q).trim().length > 0) {
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

    const stories = await prisma.story.findMany({
      where,
      include: {
        sources: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: Number(limit),
    });

    res.json({ stories });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/stories/:idOrSlug - Single story details + sources + chat history
router.get('/stories/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const idOrSlug = String(req.params.idOrSlug);
    const story = await prisma.story.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        sources: true,
        chatMessages: {
          orderBy: { createdAt: 'asc' },
          take: 30,
        },
      },
    });

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
          category: String(category) === 'popular' ? 'technology' : String(category),
          lang: targetLang,
          isRadar: true,
        });

        const saved = await prisma.story.create({
          data: {
            slug: generated.slug,
            category: generated.category,
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
            isRadarGenerated: true,
            radarQuery: cleanQuery,
            sources: {
              create: generated.sources.map((s) => ({
                name: s.name,
                title: s.title,
                url: s.url,
                domain: s.domain,
                publishedAt: s.publishedAt,
                snippet: s.snippet,
              })),
            },
          },
          include: {
            sources: true,
          },
        });

        createdStories.push(saved);
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

// POST /api/stories/refresh-category - Trigger category news refresh via OmniRoute
router.post('/stories/refresh-category', async (req: Request, res: Response) => {
  try {
    const { category = 'technology', customTopic, lang = 'pt' } = req.body;
    const catKey = String(category).toLowerCase();
    const queryObj = CATEGORY_QUERIES[catKey] || CATEGORY_QUERIES.popular;
    const targetLang = lang === 'en' ? 'en' : 'pt';
    const searchTopic = customTopic
      ? String(customTopic)
      : targetLang === 'pt'
      ? queryObj.pt
      : queryObj.en;

    const generated = await researchAndSynthesizeStory({
      query: searchTopic,
      category: catKey === 'popular' ? 'technology' : catKey,
      lang: targetLang,
      isRadar: false,
    });

    const saved = await prisma.story.create({
      data: {
        slug: generated.slug,
        category: generated.category,
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
        isRadarGenerated: false,
        sources: {
          create: generated.sources.map((s) => ({
            name: s.name,
            title: s.title,
            url: s.url,
            domain: s.domain,
            publishedAt: s.publishedAt,
            snippet: s.snippet,
          })),
        },
      },
      include: {
        sources: true,
      },
    });

    res.status(201).json({ story: saved });
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

    const status = await checkOmniRouteStatus();
    res.json({ config: updated, status });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/stories/run-hourly-cycle - Trigger the full hourly cycle (7-day cleanup + 5 trending + 2 per category)
router.post('/stories/run-hourly-cycle', async (_req: Request, res: Response) => {
  try {
    const deletedExpired = await purgeExpiredStories(7);
    // Run the full synthesis batch asynchronously so the HTTP request returns immediately
    runHourlyEditorialCycle().catch((err) =>
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
