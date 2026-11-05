import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'reach-news-super-secret-jwt-key-2026';

export interface AuthRequest extends Request {
  userId?: string;
}

export function authenticateToken(req: AuthRequest, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Token não fornecido / Unauthorized' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido / Invalid token' });
  }
}

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { name, email, password, interests } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
      return;
    }

    const initialInterests: string[] = Array.isArray(interests)
      ? interests.map((i) => String(i).trim()).filter(Boolean)
      : [];

    // Seed initial affinity scores (+15 pts for each explicitly selected onboarding interest)
    const initialAffinity: Record<string, number> = {};
    for (const topic of initialInterests) {
      initialAffinity[topic] = 15;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        interests: initialInterests,
        affinityMap: initialAffinity,
      } as any,
    });

    const uAny = user as any;
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '14d' });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        interests: uAny.interests || initialInterests,
        affinityMap: uAny.affinityMap || initialAffinity,
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    const uAny = user as any;
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '14d' });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        interests: Array.isArray(uAny.interests) ? uAny.interests : [],
        affinityMap: uAny.affinityMap || {},
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        savedStories: {
          include: {
            story: {
              include: { sources: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const uAny = user as any;
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        interests: Array.isArray(uAny.interests) ? uAny.interests : [],
        affinityMap: uAny.affinityMap || {},
        savedStories: user.savedStories.map((s) => s.story),
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/auth/interests - Update explicit user interests and recalculate affinity baseline
router.put('/interests', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { interests } = req.body;
    const cleanInterests: string[] = Array.isArray(interests)
      ? interests.map((i) => String(i).trim()).filter(Boolean)
      : [];

    const existingUser = (await prisma.user.findUnique({
      where: { id: req.userId },
    })) as any;

    if (!existingUser) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const currentAffinity: Record<string, number> =
      existingUser.affinityMap && typeof existingUser.affinityMap === 'object'
        ? { ...existingUser.affinityMap }
        : {};

    // Ensure every explicitly chosen interest has at least 15 base affinity points
    for (const topic of cleanInterests) {
      currentAffinity[topic] = Math.max(currentAffinity[topic] || 0, 15);
    }

    const updated = (await prisma.user.update({
      where: { id: req.userId },
      data: {
        interests: cleanInterests,
        affinityMap: currentAffinity,
      } as any,
    })) as any;

    res.json({
      interests: updated.interests || cleanInterests,
      affinityMap: updated.affinityMap || currentAffinity,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/auth/interactions - Record behavioral telemetry signal to adapt the "For You" algorithm
router.post('/interactions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { storyId, category, topicTag, eventType } = req.body;
    if (!category || !eventType) {
      res.status(400).json({ error: 'category e eventType são obrigatórios.' });
      return;
    }

    const WEIGHT_MAP: Record<string, number> = {
      view: 2,
      dwell: 4,
      chat: 5,
      radar: 5,
      bookmark: 6,
    };

    const points = WEIGHT_MAP[String(eventType)] || 2;
    const catKey = String(category).toLowerCase().trim();
    const tagKey = topicTag ? String(topicTag).toLowerCase().trim() : '';

    const user = (await prisma.user.findUnique({ where: { id: req.userId } })) as any;
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const currentAffinity: Record<string, number> =
      user.affinityMap && typeof user.affinityMap === 'object' ? { ...user.affinityMap } : {};

    currentAffinity[catKey] = Math.round(((currentAffinity[catKey] || 0) + points) * 10) / 10;
    if (tagKey && tagKey.length >= 2 && tagKey !== catKey) {
      currentAffinity[`tag:${tagKey}`] =
        Math.round(((currentAffinity[`tag:${tagKey}`] || 0) + points * 0.8) * 10) / 10;
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: { affinityMap: currentAffinity } as any,
    });

    try {
      await (prisma as any).userInteraction.create({
        data: {
          userId: req.userId!,
          storyId: storyId ? String(storyId) : null,
          category: catKey,
          topicTag: tagKey || null,
          eventType: String(eventType),
          weight: points,
        },
      });
    } catch {
      // Non-blocking if prisma client wasn't regenerated in memory yet
    }

    res.json({ affinityMap: currentAffinity, addedPoints: points });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
