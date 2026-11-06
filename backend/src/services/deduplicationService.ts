import OpenAI from 'openai';
import { prisma } from '../lib/prisma';

const PT_EN_STOP_WORDS = new Set([
  'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'nao', 'uma', 'os', 'no',
  'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'seu',
  'sua', 'ou', 'ser', 'quando', 'muito', 'ha', 'nos', 'ja', 'esta', 'eu', 'tambem', 'so', 'pelo',
  'pela', 'ate', 'isso', 'ela', 'entre', 'era', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus',
  'quem', 'nas', 'me', 'esse', 'eles', 'estao', 'voce', 'tinha', 'foram', 'essa', 'num', 'nem',
  'suas', 'meu', 'minha', 'numa', 'pelos', 'elas', 'havia', 'seja', 'qual', 'sera', 'tenho',
  'lhe', 'deles', 'essas', 'esses', 'pelas', 'este', 'fosse', 'dele', 'tu', 'te', 'voces', 'vos',
  'lhes', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas', 'nosso', 'nossa', 'nossos', 'nossas',
  'dela', 'delas', 'esta', 'estes', 'estas', 'aquele', 'aquela', 'aqueles', 'aquelas', 'isto',
  'aquilo', 'sobre', 'apos', 'durante', 'contra', 'segundo', 'ainda', 'assim', 'desde', 'apenas',
  // Common English stop words
  'the', 'and', 'for', 'with', 'from', 'about', 'after', 'before', 'this', 'that', 'have', 'been',
  'will', 'over', 'into', 'under', 'amid', 'says', 'said', 'new', 'post', 'news', 'live', 'real',
  'today', 'hoje', 'ontem', 'agora', 'mes', 'ano', 'dias', 'horas', 'brasil', 'mundo'
]);

/**
 * Extracts normalized, significant entity & keyword tokens from a title or summary
 */
export function extractSignificantTokens(text: string): Set<string> {
  const clean = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');

  const words = clean.split(/\s+/).filter((w) => w.length >= 3 && !PT_EN_STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Computes the token overlap score (intersection over smaller set, with fuzzy prefix matching)
 */
export function computeTokenOverlapScore(tokensA: Set<string>, tokensB: Set<string>): number {
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersectionCount = 0;

  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionCount += 1.0;
    } else {
      // Fuzzy stem check for plurals or inflections (e.g. "policial" vs "policiais", "estreia" vs "estreias")
      for (const tB of tokensB) {
        if (
          (token.length >= 5 && tB.startsWith(token.slice(0, 5))) ||
          (tB.length >= 5 && token.startsWith(tB.slice(0, 5)))
        ) {
          intersectionCount += 0.85;
          break;
        }
      }
    }
  }

  const minSize = Math.min(tokensA.size, tokensB.size);
  return intersectionCount / minSize;
}

/**
 * Checks if candidate story shares one or more source URLs with an existing story
 */
export function hasOverlappingSources(
  candidateSources: Array<{ url: string }>,
  existingSources: Array<{ url: string }>
): boolean {
  if (!candidateSources?.length || !existingSources?.length) return false;
  const existingUrls = new Set(
    existingSources.map((s) =>
      s.url
        .replace(/^https?:\/\/(www\.)?/, '')
        .split('?')[0]
        .replace(/\/+$/, '')
        .toLowerCase()
    )
  );

  for (const src of candidateSources) {
    const cleanUrl = src.url
      .replace(/^https?:\/\/(www\.)?/, '')
      .split('?')[0]
      .replace(/\/+$/, '')
      .toLowerCase();
    // Exclude generic root homepage searches like reuters.com or bing.com
    if (
      cleanUrl.length > 15 &&
      !cleanUrl.includes('site-search') &&
      !cleanUrl.endsWith('.com') &&
      !cleanUrl.endsWith('.br') &&
      existingUrls.has(cleanUrl)
    ) {
      return true; // Single identical source URL indicates same event
    }
  }
  return false;
}

/**
 * AI-powered semantic deduplication analyzer:
 * Compares the candidate story against borderline existing stories to determine
 * whether they cover the exact same underlying news event.
 */
export async function checkStoryDuplicationWithAi(params: {
  candidateTitle: string;
  candidateSummary?: string;
  existingStories: Array<{ id: string; titlePt: string; summaryPt: string }>;
  client: OpenAI;
  model: string;
}): Promise<{ isDuplicate: boolean; duplicateStoryId?: string; reason?: string }> {
  const { candidateTitle, candidateSummary = '', existingStories, client, model } = params;
  if (existingStories.length === 0) {
    return { isDuplicate: false };
  }

  const candidateContext = `CANDIDATA A NOVA NOTÍCIA:
Título: "${candidateTitle}"
Resumo: "${candidateSummary}"`;

  const existingList = existingStories
    .slice(0, 8)
    .map((s, idx) => `[NOTÍCIA ${idx + 1} - ID: ${s.id}]\nTítulo: "${s.titlePt}"\nResumo: "${s.summaryPt}"`)
    .join('\n\n');

  const prompt = `Você é o Editor de Controle de Qualidade e Desduplicação Editorial do reach.news.
Sua missão é analisar com rigor absoluto se a notícia candidata trata do MESMO FATO, MESMO ACONTECIMENTO ou MESMO TEMA CENTRAL já coberto por qualquer notícia existente no portal.

${candidateContext}

NOTÍCIAS JÁ PUBLICADAS NO BANCO:
${existingList}

DIRETRIZ DE TOLERÂNCIA ZERO PARA NOTÍCIAS REPETIDAS:
- EM NENHUMA HIPÓTESE repita notícias no portal.
- Retorne "isDuplicate": true se a notícia candidata aborda o MESMO evento, mesmo anúncio de produto, mesma votação/decisão judicial, mesmo relatório, mesmo jogo ou mesmo acontecimento político, mesmo que redigida com palavras, manchetes ou ângulos diferentes.
- Retorne "isDuplicate": false APENAS E EXCLUSIVAMENTE se for um fato jornalístico comprovadamente diferente e novo.
- Na dúvida, considere SEMPRE "isDuplicate": true para blindar o leitor contra repetições.

Retorne APENAS um JSON válido (sem markdown \`\`\`json):
{
  "isDuplicate": boolean,
  "duplicateStoryId": string | null,
  "reason": "explicação curta em 1 frase"
}`;

  try {
    const res = await client.chat.completions.create({
      model: model || 'antigravity/gemini-3.8-flash-low',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const content = res.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isDuplicate: Boolean(parsed.isDuplicate),
        duplicateStoryId: parsed.duplicateStoryId || undefined,
        reason: parsed.reason || '',
      };
    }
  } catch (err) {
    console.warn('[Deduplication AI] AI semantic check warning:', (err as Error).message);
  }

  return { isDuplicate: false };
}

export interface ExistingStoryComparisonItem {
  id: string;
  titlePt: string;
  summaryPt: string;
  category: string;
  publishedAt: Date;
  sources?: Array<{ url: string }>;
}

function normalizeTitleForComparison(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Full deduplication pipeline:
 * 1. Checks source URL overlap (>=1 matching source -> duplicate).
 * 2. Checks exact normalized title match.
 * 3. Checks title token overlap and combined token overlap:
 *    - titleScore >= 0.40 or (titleScore >= 0.28 && combinedScore >= 0.20) -> definite duplicate.
 *    - titleScore >= 0.16 or combinedScore >= 0.14 -> borderline match, delegates to AI semantic analysis.
 *    - below threshold -> unique story.
 */
export async function analyzeCandidateForDuplicates(params: {
  candidateTitle: string;
  candidateSummary?: string;
  candidateSources?: Array<{ url: string }>;
  existingStories: ExistingStoryComparisonItem[];
  client: OpenAI;
  model: string;
}): Promise<{
  isDuplicate: boolean;
  duplicateOf?: ExistingStoryComparisonItem;
  reason?: string;
  overlapScore?: number;
}> {
  const {
    candidateTitle,
    candidateSummary = '',
    candidateSources = [],
    existingStories,
    client,
    model,
  } = params;

  if (!existingStories || !existingStories.length) {
    return { isDuplicate: false };
  }

  const candidateNorm = normalizeTitleForComparison(candidateTitle);
  const candidateTitleTokens = extractSignificantTokens(candidateTitle);
  const candidateAllTokens = extractSignificantTokens(candidateTitle + ' ' + candidateSummary);
  const borderlineMatches: Array<{ story: ExistingStoryComparisonItem; score: number }> = [];

  for (const existing of existingStories) {
    // 0. Exact normalized title match
    const existingNorm = normalizeTitleForComparison(existing.titlePt);
    if (candidateNorm.length > 15 && candidateNorm === existingNorm) {
      return {
        isDuplicate: true,
        duplicateOf: existing,
        reason: `Título idêntico à notícia já existente "${existing.titlePt}"`,
        overlapScore: 1.0,
      };
    }

    // 1. Check sources URL overlap
    if (existing.sources && candidateSources.length > 0) {
      if (hasOverlappingSources(candidateSources, existing.sources)) {
        return {
          isDuplicate: true,
          duplicateOf: existing,
          reason: `Fontes coincidentes com a matéria "${existing.titlePt}"`,
          overlapScore: 1.0,
        };
      }
    }

    // 2. Compute token overlap scores (Title-only and Combined)
    const existingTitleTokens = extractSignificantTokens(existing.titlePt);
    const existingAllTokens = extractSignificantTokens(existing.titlePt + ' ' + existing.summaryPt);

    const titleScore = computeTokenOverlapScore(candidateTitleTokens, existingTitleTokens);
    const combinedScore = computeTokenOverlapScore(candidateAllTokens, existingAllTokens);
    const effectiveScore = Math.max(titleScore, combinedScore * 1.2);

    // 3. Check for definite duplicate (tightened threshold to prevent any duplicate news)
    if (titleScore >= 0.40 || (titleScore >= 0.28 && combinedScore >= 0.20)) {
      return {
        isDuplicate: true,
        duplicateOf: existing,
        reason: `Alta sobreposição de pauta (Título: ${Math.round(titleScore * 100)}%, Conteúdo: ${Math.round(combinedScore * 100)}%) com "${existing.titlePt}"`,
        overlapScore: Math.max(titleScore, combinedScore),
      };
    }

    // Borderline match -> Collect for AI verification
    if (titleScore >= 0.16 || combinedScore >= 0.14) {
      borderlineMatches.push({ story: existing, score: Math.max(titleScore, combinedScore) });
    }
  }

  // 4. If borderline matches exist, use AI semantic analyzer to resolve
  if (borderlineMatches.length > 0) {
    borderlineMatches.sort((a, b) => b.score - a.score);
    const topCandidates = borderlineMatches.slice(0, 5).map((m) => m.story);

    const aiRes = await checkStoryDuplicationWithAi({
      candidateTitle,
      candidateSummary,
      existingStories: topCandidates,
      client,
      model,
    });

    if (aiRes.isDuplicate) {
      const match =
        topCandidates.find((s) => s.id === aiRes.duplicateStoryId) || topCandidates[0];
      return {
        isDuplicate: true,
        duplicateOf: match,
        reason: aiRes.reason || `A IA identificou que o fato já foi coberto em "${match.titlePt}"`,
        overlapScore: borderlineMatches[0]?.score || 0.45,
      };
    } else if (borderlineMatches[0]?.score >= 0.32) {
      // Conservative defensive safeguard: if overlap score is already 32%+ and AI failed or hesitated, treat as duplicate
      const match = borderlineMatches[0].story;
      return {
        isDuplicate: true,
        duplicateOf: match,
        reason: `Sobreposição temática preventiva (${Math.round(borderlineMatches[0].score * 100)}%) com "${match.titlePt}"`,
        overlapScore: borderlineMatches[0].score,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Routine to scan existing stories in the database, identify duplicated pairs,
 * and purge redundant duplicate stories (keeping the primary/oldest one).
 */
export async function cleanExistingDuplicateStories(): Promise<{
  inspectedCount: number;
  deletedCount: number;
  deletedTitles: string[];
}> {
  console.log('[Deduplication Cleanup] Scanning database for duplicate stories...');
  const allStories = await prisma.story.findMany({
    orderBy: { publishedAt: 'asc' }, // oldest first so we keep original
    select: {
      id: true,
      titlePt: true,
      summaryPt: true,
      category: true,
      publishedAt: true,
    },
  });

  const seenStories: ExistingStoryComparisonItem[] = [];
  const duplicateIdsToDelete: string[] = [];
  const deletedTitles: string[] = [];

  for (const story of allStories) {
    const candidateNorm = normalizeTitleForComparison(story.titlePt);
    const candidateTitleTokens = extractSignificantTokens(story.titlePt);
    const candidateAllTokens = extractSignificantTokens(story.titlePt + ' ' + story.summaryPt);
    let isDupe = false;

    for (const existing of seenStories) {
      const existingNorm = normalizeTitleForComparison(existing.titlePt);
      if (candidateNorm.length > 15 && candidateNorm === existingNorm) {
        console.log(`[Deduplication Cleanup] Exact duplicate title: "${story.titlePt}"`);
        isDupe = true;
        duplicateIdsToDelete.push(story.id);
        deletedTitles.push(story.titlePt);
        break;
      }

      const existingTitleTokens = extractSignificantTokens(existing.titlePt);
      const existingAllTokens = extractSignificantTokens(existing.titlePt + ' ' + existing.summaryPt);

      const titleScore = computeTokenOverlapScore(candidateTitleTokens, existingTitleTokens);
      const combinedScore = computeTokenOverlapScore(candidateAllTokens, existingAllTokens);

      if (titleScore >= 0.40 || (titleScore >= 0.28 && combinedScore >= 0.20)) {
        console.log(
          `[Deduplication Cleanup] Found duplicate (Title: ${Math.round(titleScore * 100)}%, Combined: ${Math.round(combinedScore * 100)}%): "${story.titlePt}" duplicates "${existing.titlePt}"`
        );
        isDupe = true;
        duplicateIdsToDelete.push(story.id);
        deletedTitles.push(story.titlePt);
        break;
      }
    }

    if (!isDupe) {
      seenStories.push(story);
    }
  }

  if (duplicateIdsToDelete.length > 0) {
    await prisma.story.deleteMany({
      where: { id: { in: duplicateIdsToDelete } },
    });
    console.log(`[Deduplication Cleanup] Successfully purged ${duplicateIdsToDelete.length} duplicate stories!`);
  } else {
    console.log('[Deduplication Cleanup] No duplicate stories found.');
  }

  return {
    inspectedCount: allStories.length,
    deletedCount: duplicateIdsToDelete.length,
    deletedTitles,
  };
}
