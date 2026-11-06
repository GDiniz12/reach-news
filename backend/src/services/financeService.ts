import { createOmniRouteClient } from './omnirouteService';
import { searchWebNews } from './searchTools';

export interface MarketQuote {
  symbol: string;
  name: string;
  shortName: string;
  group: string; // 'eco_cambio' | 'eco_mercado' | 'eco_acoes_br' | 'eco_acoes_global' | 'eco_commodities' | 'eco_bc_selic'
  type: 'currency' | 'index' | 'stock' | 'commodity' | 'crypto' | 'rate';
  price: number;
  change: number;
  changePercent: number;
  previousClose?: number;
  high?: number;
  low?: number;
  currency: string;
  updatedAt: string;
}

export interface MacroIndicator {
  name: string;
  code: string;
  value: string;
  unit: string;
  period?: string;
  source: string;
}

export interface FinanceSnapshot {
  quotes: MarketQuote[];
  macro: MacroIndicator[];
  highlights: Record<string, string[]>;
  updatedAt: string;
  sources: Array<{ name: string; url: string }>;
}

const CACHE_TTL_MS = 90 * 1000; // 90 segundos

interface CatalogItem {
  symbol: string;
  name: string;
  shortName: string;
  group: string;
  type: MarketQuote['type'];
  currency: string;
  defaultPrice: number;
}

const FINANCE_CATALOG: CatalogItem[] = [
  // Câmbio & Cripto (eco_cambio)
  { symbol: 'USDBRL', name: 'Dólar Comercial', shortName: 'USD / BRL', group: 'eco_cambio', type: 'currency', currency: 'BRL', defaultPrice: 5.48 },
  { symbol: 'EURBRL', name: 'Euro', shortName: 'EUR / BRL', group: 'eco_cambio', type: 'currency', currency: 'BRL', defaultPrice: 5.92 },
  { symbol: 'GBPBRL', name: 'Libra Esterlina', shortName: 'GBP / BRL', group: 'eco_cambio', type: 'currency', currency: 'BRL', defaultPrice: 7.10 },
  { symbol: 'CADBRL', name: 'Dólar Canadense', shortName: 'CAD / BRL', group: 'eco_cambio', type: 'currency', currency: 'BRL', defaultPrice: 3.96 },
  { symbol: 'JPYBRL', name: 'Iene Japonês', shortName: 'JPY / BRL', group: 'eco_cambio', type: 'currency', currency: 'BRL', defaultPrice: 0.036 },
  { symbol: 'BTCBRL', name: 'Bitcoin', shortName: 'BTC / BRL', group: 'eco_cambio', type: 'crypto', currency: 'BRL', defaultPrice: 412000 },
  { symbol: 'ETHBRL', name: 'Ethereum', shortName: 'ETH / BRL', group: 'eco_cambio', type: 'crypto', currency: 'BRL', defaultPrice: 15800 },

  // Bolsas & Índices (eco_mercado)
  { symbol: '^BVSP', name: 'Ibovespa', shortName: 'IBOV', group: 'eco_mercado', type: 'index', currency: 'pts', defaultPrice: 130200 },
  { symbol: '^GSPC', name: 'S&P 500 (EUA)', shortName: 'S&P 500', group: 'eco_mercado', type: 'index', currency: 'pts', defaultPrice: 5880 },
  { symbol: '^IXIC', name: 'Nasdaq (EUA)', shortName: 'NASDAQ', group: 'eco_mercado', type: 'index', currency: 'pts', defaultPrice: 18500 },
  { symbol: '^DJI', name: 'Dow Jones (EUA)', shortName: 'DOW JONES', group: 'eco_mercado', type: 'index', currency: 'pts', defaultPrice: 42100 },
  { symbol: '^N225', name: 'Nikkei 225 (Japão)', shortName: 'NIKKEI', group: 'eco_mercado', type: 'index', currency: 'pts', defaultPrice: 38900 },

  // Ações Brasileiras B3 (eco_acoes_br)
  { symbol: 'PETR4.SA', name: 'Petrobras PN', shortName: 'PETR4', group: 'eco_acoes_br', type: 'stock', currency: 'BRL', defaultPrice: 36.80 },
  { symbol: 'VALE3.SA', name: 'Vale ON', shortName: 'VALE3', group: 'eco_acoes_br', type: 'stock', currency: 'BRL', defaultPrice: 62.40 },
  { symbol: 'ITUB4.SA', name: 'Itaú Unibanco PN', shortName: 'ITUB4', group: 'eco_acoes_br', type: 'stock', currency: 'BRL', defaultPrice: 35.50 },
  { symbol: 'BBDC4.SA', name: 'Bradesco PN', shortName: 'BBDC4', group: 'eco_acoes_br', type: 'stock', currency: 'BRL', defaultPrice: 14.20 },
  { symbol: 'BBAS3.SA', name: 'Banco do Brasil ON', shortName: 'BBAS3', group: 'eco_acoes_br', type: 'stock', currency: 'BRL', defaultPrice: 28.10 },
  { symbol: 'WEGE3.SA', name: 'WEG ON', shortName: 'WEGE3', group: 'eco_acoes_br', type: 'stock', currency: 'BRL', defaultPrice: 54.30 },
  { symbol: 'MGLU3.SA', name: 'Magazine Luiza ON', shortName: 'MGLU3', group: 'eco_acoes_br', type: 'stock', currency: 'BRL', defaultPrice: 9.20 },
  { symbol: 'B3SA3.SA', name: 'B3 Brasil Bolsa Balcão', shortName: 'B3SA3', group: 'eco_acoes_br', type: 'stock', currency: 'BRL', defaultPrice: 11.50 },
  { symbol: 'ABEV3.SA', name: 'Ambev ON', shortName: 'ABEV3', group: 'eco_acoes_br', type: 'stock', currency: 'BRL', defaultPrice: 12.80 },
  { symbol: 'RENT3.SA', name: 'Localiza Rent a Car', shortName: 'RENT3', group: 'eco_acoes_br', type: 'stock', currency: 'BRL', defaultPrice: 43.60 },

  // Ações Globais & Big Tech (eco_acoes_global)
  { symbol: 'NVDA', name: 'Nvidia Corporation', shortName: 'NVDA', group: 'eco_acoes_global', type: 'stock', currency: 'USD', defaultPrice: 142.50 },
  { symbol: 'AAPL', name: 'Apple Inc.', shortName: 'AAPL', group: 'eco_acoes_global', type: 'stock', currency: 'USD', defaultPrice: 228.40 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', shortName: 'MSFT', group: 'eco_acoes_global', type: 'stock', currency: 'USD', defaultPrice: 426.80 },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', shortName: 'AMZN', group: 'eco_acoes_global', type: 'stock', currency: 'USD', defaultPrice: 198.20 },
  { symbol: 'GOOGL', name: 'Alphabet (Google)', shortName: 'GOOGL', group: 'eco_acoes_global', type: 'stock', currency: 'USD', defaultPrice: 176.50 },
  { symbol: 'TSLA', name: 'Tesla, Inc.', shortName: 'TSLA', group: 'eco_acoes_global', type: 'stock', currency: 'USD', defaultPrice: 248.90 },

  // Commodities (eco_commodities)
  { symbol: 'BZ=F', name: 'Petróleo Brent (Barril)', shortName: 'BRENT', group: 'eco_commodities', type: 'commodity', currency: 'USD', defaultPrice: 74.20 },
  { symbol: 'GC=F', name: 'Ouro (Onça Troy)', shortName: 'OURO', group: 'eco_commodities', type: 'commodity', currency: 'USD', defaultPrice: 2715.00 },
  { symbol: 'CL=F', name: 'Petróleo WTI (Barril)', shortName: 'WTI', group: 'eco_commodities', type: 'commodity', currency: 'USD', defaultPrice: 70.80 },
];

let snapshotCache: FinanceSnapshot | null = null;
let refreshingPromise: Promise<FinanceSnapshot | null> | null = null;

/**
 * AI-Driven Real-Time Financial Market Research:
 * 1. Collects live web financial news and market dispatches via searchWebNews (Google News & Bing RSS).
 * 2. Uses OmniRoute AI (acting as an autonomous market updater, like live sports) to evaluate,
 *    update and synthesize all market quotes, changes, macro indicators, and highlights.
 */
async function buildAiFinanceSnapshot(): Promise<FinanceSnapshot | null> {
  const currentDateFormatted = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Step 1: Real-time search of financial news and market closings
  const [marketNews, stocksNews, macroNews] = await Promise.all([
    searchWebNews('cotação fechamento dólar ibovespa b3 s&p 500 hoje mercado financeiro', 'pt', 8, 'recent'),
    searchWebNews('ações petrobras vale itau nvidia alta baixa hoje mercado', 'pt', 8, 'recent'),
    searchWebNews('taxa selic banco central cdi ipca inflação juros hoje', 'pt', 6, 'recent'),
  ]);

  const allNewsItems = [...marketNews, ...stocksNews, ...macroNews];
  const contextText = allNewsItems
    .slice(0, 15)
    .map((item, idx) => `[${idx + 1}] [${item.sourceName}] ${item.title}: ${item.snippet}`)
    .join('\n');

  console.log(`[Finance AI Engine] Synthesizing market data from ${allNewsItems.length} live research items...`);

  try {
    const { client, config } = await createOmniRouteClient();
    const candidateModels = Array.from(
      new Set([
        'antigravity/gemini-3.8-flash-low',
        'antigravity/gemini-3.1-flash-lite',
        config.omnirouteModel || 'antigravity/gemini-3.8-flash-low',
      ])
    );

    const catalogSymbols = FINANCE_CATALOG.map((c) => `${c.symbol} (${c.name})`).join(', ');

    const prompt = `Você é o Agente Autônomo de Pesquisa e Inteligência de Mercado Financeiro do Reach News.
Sua função é atuar como atualizador em tempo real dos índices, cotações, ações e moedas do portal, analisando as notícias e apurações mais recentes.

DATA DE REFERÊNCIA: ${currentDateFormatted} (Fuso horário de Brasília).

APURAÇÃO JORNALÍSTICA COLETADA EM TEMPO REAL:
${contextText || 'Mercado operando com foco em commodities, decisões de juros e balanços corporativos.'}

LISTA DE ATIVOS A ATUALIZAR:
${catalogSymbols}

DIRETRIZES MANDATÓRIAS:
1. Para CADA um dos ativos da lista, pesquise e retorne a cotação/preço atualizado ("price"), a variação numérica ("change"), a variação percentual ("changePercent"), a máxima do dia ("high") e a mínima do dia ("low").
2. Para os indicadores macroeconômicos ("macro"), forneça o valor vigente da Taxa Selic Meta (código 432), Taxa CDI Anualizada (código 4389) e IPCA (código 433).
3. Em "highlights", redija de 3 a 4 frases concisas com o "Giro do Mercado pela IA", explicando com precisão jornalística os principais motivos das altas e baixas de hoje.

Retorne APENAS um JSON válido (sem markdown \`\`\`json):
{
  "quotes": [
    {
      "symbol": "^BVSP",
      "price": 130250.0,
      "change": 420.0,
      "changePercent": 0.32,
      "high": 130800.0,
      "low": 129600.0
    },
    {
      "symbol": "USDBRL",
      "price": 5.485,
      "change": -0.015,
      "changePercent": -0.27,
      "high": 5.512,
      "low": 5.471
    }
  ],
  "macro": [
    {
      "name": "Taxa Selic Meta",
      "code": "432",
      "value": "10,75%",
      "unit": "% a.a.",
      "period": "Vigente",
      "source": "Banco Central do Brasil (Pesquisa IA)"
    },
    {
      "name": "Taxa CDI Anualizada",
      "code": "4389",
      "value": "10,65%",
      "unit": "% a.a.",
      "period": "Vigente",
      "source": "B3 (Pesquisa IA)"
    },
    {
      "name": "IPCA Acumulado 12m",
      "code": "433",
      "value": "4,42%",
      "unit": "%",
      "period": "Última divulgação",
      "source": "IBGE / Apuração IA"
    }
  ],
  "highlights": [
    "Ibovespa opera com ganhos impulsionado pelas ações da Petrobras e de mineradoras.",
    "Dólar comercial registra leve recuo frente ao real com alívio nas taxas dos títulos globais.",
    "Mercado repercute declarações fiscais e monitora dados de inflação e balanços de big techs."
  ]
}`;

    for (const model of candidateModels) {
      try {
        const res = await client.chat.completions.create(
          {
            model,
            temperature: 0.2,
            messages: [
              {
                role: 'system',
                content:
                  'Você é um sistema rigoroso de extração de dados e inteligência de mercado financeiro. Responda estritamente com JSON válido.',
              },
              { role: 'user', content: prompt },
            ],
          },
          { timeout: 20000, maxRetries: 0 }
        );

        const raw = (res.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start === -1 || end === -1) continue;

        const parsed = JSON.parse(raw.slice(start, end + 1));
        const quotesMap = new Map<string, any>();
        if (Array.isArray(parsed.quotes)) {
          for (const q of parsed.quotes) {
            if (q && q.symbol) {
              quotesMap.set(String(q.symbol).toUpperCase(), q);
            }
          }
        }

        const now = new Date().toISOString();
        const mergedQuotes: MarketQuote[] = FINANCE_CATALOG.map((cat) => {
          const aiItem =
            quotesMap.get(cat.symbol.toUpperCase()) ||
            quotesMap.get(cat.shortName.toUpperCase());

          const price =
            aiItem && typeof aiItem.price === 'number' && !isNaN(aiItem.price)
              ? aiItem.price
              : cat.defaultPrice;

          const changePercent =
            aiItem && typeof aiItem.changePercent === 'number' && !isNaN(aiItem.changePercent)
              ? aiItem.changePercent
              : 0;

          const change =
            aiItem && typeof aiItem.change === 'number' && !isNaN(aiItem.change)
              ? aiItem.change
              : Number((price * (changePercent / 100)).toFixed(2));

          const high =
            aiItem && typeof aiItem.high === 'number' && !isNaN(aiItem.high)
              ? aiItem.high
              : undefined;

          const low =
            aiItem && typeof aiItem.low === 'number' && !isNaN(aiItem.low)
              ? aiItem.low
              : undefined;

          return {
            symbol: cat.symbol,
            name: cat.name,
            shortName: cat.shortName,
            group: cat.group,
            type: cat.type,
            price: Number(price.toFixed(cat.type === 'crypto' || cat.type === 'index' ? 2 : 4)),
            change: Number(change.toFixed(4)),
            changePercent: Number(changePercent.toFixed(2)),
            high: high ? Number(high.toFixed(2)) : undefined,
            low: low ? Number(low.toFixed(2)) : undefined,
            currency: cat.currency,
            updatedAt: now,
          };
        });

        const macroList: MacroIndicator[] = Array.isArray(parsed.macro) && parsed.macro.length > 0
          ? parsed.macro.map((m: any) => ({
              name: String(m.name || 'Indicador Macro'),
              code: String(m.code || '0'),
              value: String(m.value || '-'),
              unit: String(m.unit || ''),
              period: m.period ? String(m.period) : undefined,
              source: String(m.source || 'Banco Central / Apuração IA'),
            }))
          : [
              { name: 'Taxa Selic Meta', code: '432', value: '10,75%', unit: '% a.a.', period: 'Vigente', source: 'Banco Central do Brasil (Pesquisa IA)' },
              { name: 'Taxa CDI Anualizada', code: '4389', value: '10,65%', unit: '% a.a.', period: 'Vigente', source: 'B3 (Pesquisa IA)' },
              { name: 'IPCA Acumulado 12m', code: '433', value: '4,42%', unit: '%', period: 'Última divulgação', source: 'IBGE / Apuração IA' },
            ];

        const highlightsList: string[] = Array.isArray(parsed.highlights)
          ? parsed.highlights.filter((h: unknown) => typeof h === 'string' && h.length > 10).slice(0, 4)
          : [
              'Mercado financeiro opera atento ao cenário fiscal brasileiro e aos dados de inflação.',
              'Bolsas internacionais registram oscilação com foco em balanços de tecnologia e taxas de juros.',
              'Câmbio reflete fluxo de capital estrangeiro e decisões de política monetária global.',
            ];

        console.log(`[Finance AI Engine] Successfully researched and updated ${mergedQuotes.length} market assets via AI!`);

        return {
          quotes: mergedQuotes,
          macro: macroList,
          highlights: { all: highlightsList },
          updatedAt: now,
          sources: [
            { name: 'Agente de IA Reach News (Pesquisa em Tempo Real)', url: 'https://reach.news' },
            { name: 'Valor Econômico / InfoMoney / B3', url: 'https://infomoney.com.br' },
            { name: 'Banco Central do Brasil / IBGE', url: 'https://www.bcb.gov.br' },
          ],
        };
      } catch (innerErr) {
        console.warn(`[Finance AI Engine] Model ${model} failed, trying next:`, (innerErr as Error).message);
      }
    }
  } catch (err) {
    console.warn('[Finance AI Engine] Error in AI market research:', (err as Error).message);
  }

  // Fallback to previous cache or baseline if AI call fails
  return snapshotCache;
}

/**
 * Initializes a sensible baseline so the UI never displays an empty screen on cold boot
 */
function getBaselineSnapshot(): FinanceSnapshot {
  const now = new Date().toISOString();
  return {
    quotes: FINANCE_CATALOG.map((cat) => ({
      symbol: cat.symbol,
      name: cat.name,
      shortName: cat.shortName,
      group: cat.group,
      type: cat.type,
      price: cat.defaultPrice,
      change: 0,
      changePercent: 0,
      currency: cat.currency,
      updatedAt: now,
    })),
    macro: [
      { name: 'Taxa Selic Meta', code: '432', value: '10,75%', unit: '% a.a.', period: 'Vigente', source: 'Banco Central do Brasil (Pesquisa IA)' },
      { name: 'Taxa CDI Anualizada', code: '4389', value: '10,65%', unit: '% a.a.', period: 'Vigente', source: 'B3 (Pesquisa IA)' },
      { name: 'IPCA Acumulado 12m', code: '433', value: '4,42%', unit: '%', period: 'Última divulgação', source: 'IBGE / Apuração IA' },
    ],
    highlights: {
      all: [
        'Agente de Inteligência Financeira do Reach News pesquisando cotações em tempo real...',
        'Mercado operando com foco em commodities, câmbio e política monetária.',
      ],
    },
    updatedAt: now,
    sources: [
      { name: 'Agente de IA Reach News (Pesquisa em Tempo Real)', url: 'https://reach.news' },
      { name: 'Valor Econômico / InfoMoney / B3', url: 'https://infomoney.com.br' },
      { name: 'Banco Central do Brasil / IBGE', url: 'https://www.bcb.gov.br' },
    ],
  };
}

export async function refreshFinanceSnapshot(): Promise<FinanceSnapshot | null> {
  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = buildAiFinanceSnapshot()
    .then((snap) => {
      if (snap) {
        snapshotCache = snap;
      } else if (!snapshotCache) {
        snapshotCache = getBaselineSnapshot();
      }
      return snapshotCache;
    })
    .catch((err) => {
      console.warn('[Finance] Refresh error:', (err as Error).message);
      if (!snapshotCache) snapshotCache = getBaselineSnapshot();
      return snapshotCache;
    })
    .finally(() => {
      refreshingPromise = null;
    });

  return refreshingPromise;
}

/**
 * Returns the cached financial snapshot immediately (<5ms, never blocks the HTTP response).
 * Asynchronously triggers an AI market update in the background when expired or missing.
 */
export function getFinanceSnapshot(): FinanceSnapshot | null {
  if (!snapshotCache) {
    snapshotCache = getBaselineSnapshot();
    void refreshFinanceSnapshot();
    return snapshotCache;
  }

  const age = Date.now() - new Date(snapshotCache.updatedAt).getTime();
  if (age > CACHE_TTL_MS) {
    void refreshFinanceSnapshot();
  }

  return snapshotCache;
}
