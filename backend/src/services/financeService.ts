import { createOmniRouteClient } from './omnirouteService';

export interface MarketQuote {
  symbol: string;
  name: string;
  shortName: string;
  group: string; // id do subtema: 'eco_cambio' | 'eco_mercado' | 'eco_acoes_br' | 'eco_acoes_global' | 'eco_commodities' | 'eco_bc_selic'
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

const CACHE_TTL_MS = 60 * 1000; // 1 minuto
const HIGHLIGHTS_TTL_MS = 10 * 60 * 1000; // 10 minutos

let snapshotCache: FinanceSnapshot | null = null;
let refreshing: Promise<FinanceSnapshot | null> | null = null;
const highlightsCache = new Map<string, { at: number; key: string; data: string[] }>();

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

interface YahooItemConfig {
  symbol: string;
  name: string;
  shortName: string;
  group: string;
  type: MarketQuote['type'];
  currency: string;
}

const YAHOO_ITEMS: YahooItemConfig[] = [
  // Índices & Bolsas
  { symbol: '^BVSP', name: 'Ibovespa', shortName: 'IBOV', group: 'eco_mercado', type: 'index', currency: 'pts' },
  { symbol: '^GSPC', name: 'S&P 500 (EUA)', shortName: 'S&P 500', group: 'eco_mercado', type: 'index', currency: 'pts' },
  { symbol: '^IXIC', name: 'Nasdaq (EUA)', shortName: 'NASDAQ', group: 'eco_mercado', type: 'index', currency: 'pts' },
  { symbol: '^DJI', name: 'Dow Jones (EUA)', shortName: 'DOW JONES', group: 'eco_mercado', type: 'index', currency: 'pts' },
  { symbol: '^N225', name: 'Nikkei 225 (Japão)', shortName: 'NIKKEI', group: 'eco_mercado', type: 'index', currency: 'pts' },

  // Ações Brasileiras B3
  { symbol: 'PETR4.SA', name: 'Petrobras PN', shortName: 'PETR4', group: 'eco_acoes_br', type: 'stock', currency: 'BRL' },
  { symbol: 'VALE3.SA', name: 'Vale ON', shortName: 'VALE3', group: 'eco_acoes_br', type: 'stock', currency: 'BRL' },
  { symbol: 'ITUB4.SA', name: 'Itaú Unibanco PN', shortName: 'ITUB4', group: 'eco_acoes_br', type: 'stock', currency: 'BRL' },
  { symbol: 'BBDC4.SA', name: 'Bradesco PN', shortName: 'BBDC4', group: 'eco_acoes_br', type: 'stock', currency: 'BRL' },
  { symbol: 'BBAS3.SA', name: 'Banco do Brasil ON', shortName: 'BBAS3', group: 'eco_acoes_br', type: 'stock', currency: 'BRL' },
  { symbol: 'WEGE3.SA', name: 'WEG ON', shortName: 'WEGE3', group: 'eco_acoes_br', type: 'stock', currency: 'BRL' },
  { symbol: 'MGLU3.SA', name: 'Magazine Luiza ON', shortName: 'MGLU3', group: 'eco_acoes_br', type: 'stock', currency: 'BRL' },
  { symbol: 'B3SA3.SA', name: 'B3 Brasil Bolsa Balcão', shortName: 'B3SA3', group: 'eco_acoes_br', type: 'stock', currency: 'BRL' },
  { symbol: 'ABEV3.SA', name: 'Ambev ON', shortName: 'ABEV3', group: 'eco_acoes_br', type: 'stock', currency: 'BRL' },
  { symbol: 'RENT3.SA', name: 'Localiza Rent a Car', shortName: 'RENT3', group: 'eco_acoes_br', type: 'stock', currency: 'BRL' },

  // Ações Globais & Big Tech
  { symbol: 'NVDA', name: 'Nvidia Corporation', shortName: 'NVDA', group: 'eco_acoes_global', type: 'stock', currency: 'USD' },
  { symbol: 'AAPL', name: 'Apple Inc.', shortName: 'AAPL', group: 'eco_acoes_global', type: 'stock', currency: 'USD' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', shortName: 'MSFT', group: 'eco_acoes_global', type: 'stock', currency: 'USD' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', shortName: 'AMZN', group: 'eco_acoes_global', type: 'stock', currency: 'USD' },
  { symbol: 'GOOGL', name: 'Alphabet (Google)', shortName: 'GOOGL', group: 'eco_acoes_global', type: 'stock', currency: 'USD' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', shortName: 'TSLA', group: 'eco_acoes_global', type: 'stock', currency: 'USD' },

  // Commodities
  { symbol: 'BZ=F', name: 'Petróleo Brent (Barril)', shortName: 'BRENT', group: 'eco_commodities', type: 'commodity', currency: 'USD' },
  { symbol: 'GC=F', name: 'Ouro (Onça Troy)', shortName: 'OURO', group: 'eco_commodities', type: 'commodity', currency: 'USD' },
  { symbol: 'CL=F', name: 'Petróleo WTI (Barril)', shortName: 'WTI', group: 'eco_commodities', type: 'commodity', currency: 'USD' },
];

async function fetchYahooQuote(cfg: YahooItemConfig): Promise<MarketQuote | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cfg.symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: YAHOO_HEADERS, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return null;

    const price = Number(meta.regularMarketPrice.toFixed(2));
    const previousClose = typeof meta.chartPreviousClose === 'number' ? Number(meta.chartPreviousClose.toFixed(2)) : price;
    const change = Number((price - previousClose).toFixed(2));
    const changePercent = previousClose !== 0 ? Number(((change / previousClose) * 100).toFixed(2)) : 0;

    return {
      symbol: cfg.symbol,
      name: cfg.name,
      shortName: cfg.shortName,
      group: cfg.group,
      type: cfg.type,
      price,
      change,
      changePercent,
      previousClose,
      high: meta.regularMarketDayHigh ? Number(meta.regularMarketDayHigh.toFixed(2)) : undefined,
      low: meta.regularMarketDayLow ? Number(meta.regularMarketDayLow.toFixed(2)) : undefined,
      currency: cfg.currency,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchAwesomeCurrencies(): Promise<MarketQuote[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const url = 'https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,GBP-BRL,BTC-BRL,ETH-BRL,CAD-BRL,JPY-BRL';
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const json = (await res.json()) as Record<string, any>;

    const defs: Array<{ key: string; name: string; short: string; type: MarketQuote['type'] }> = [
      { key: 'USDBRL', name: 'Dólar Comercial', short: 'USD / BRL', type: 'currency' },
      { key: 'EURBRL', name: 'Euro', short: 'EUR / BRL', type: 'currency' },
      { key: 'GBPBRL', name: 'Libra Esterlina', short: 'GBP / BRL', type: 'currency' },
      { key: 'CADBRL', name: 'Dólar Canadense', short: 'CAD / BRL', type: 'currency' },
      { key: 'JPYBRL', name: 'Iene Japonês', short: 'JPY / BRL', type: 'currency' },
      { key: 'BTCBRL', name: 'Bitcoin', short: 'BTC / BRL', type: 'crypto' },
      { key: 'ETHBRL', name: 'Ethereum', short: 'ETH / BRL', type: 'crypto' },
    ];

    const now = new Date().toISOString();
    const quotes: MarketQuote[] = [];

    for (const d of defs) {
      const item = json[d.key];
      if (!item) continue;
      const price = parseFloat(item.bid || item.ask || '0');
      const change = parseFloat(item.varBid || '0');
      const changePercent = parseFloat(item.pctChange || '0');
      const high = parseFloat(item.high || '0');
      const low = parseFloat(item.low || '0');

      quotes.push({
        symbol: d.key,
        name: d.name,
        shortName: d.short,
        group: 'eco_cambio',
        type: d.type,
        price: Number(price.toFixed(d.type === 'crypto' ? 0 : 4)),
        change: Number(change.toFixed(4)),
        changePercent: Number(changePercent.toFixed(2)),
        high: high ? Number(high.toFixed(d.type === 'crypto' ? 0 : 4)) : undefined,
        low: low ? Number(low.toFixed(d.type === 'crypto' ? 0 : 4)) : undefined,
        currency: 'BRL',
        updatedAt: now,
      });
    }

    return quotes;
  } catch {
    return [];
  }
}

async function fetchBcbIndicators(): Promise<MacroIndicator[]> {
  const indicators: MacroIndicator[] = [];

  const series = [
    { code: '432', name: 'Taxa Selic Meta', unit: '% a.a.' },
    { code: '4389', name: 'Taxa CDI Anualizada', unit: '% a.a.' },
    { code: '433', name: 'IPCA Mensal', unit: '%' },
  ];

  for (const s of series) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${s.code}/dados/ultimos/1?formato=json`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json[0]?.valor) {
          indicators.push({
            name: s.name,
            code: s.code,
            value: `${json[0].valor}${s.unit}`,
            unit: s.unit,
            period: json[0].data,
            source: 'Banco Central do Brasil',
          });
        }
      }
    } catch {
      // Ignora erro isolado do BCB
    }
  }

  return indicators;
}

/** IA analisa cotações do dia e narra destaques objetivos */
async function buildFinancialHighlights(
  quotes: MarketQuote[],
  macro: MacroIndicator[]
): Promise<Record<string, string[]>> {
  const summaryLines: string[] = [];
  for (const q of quotes.slice(0, 20)) {
    const sign = q.changePercent >= 0 ? '+' : '';
    summaryLines.push(`${q.shortName} (${q.name}): ${q.price} ${q.currency} (${sign}${q.changePercent}%)`);
  }
  for (const m of macro) {
    summaryLines.push(`${m.name}: ${m.value} (${m.period || ''})`);
  }

  const key = summaryLines.join('|');
  const cached = highlightsCache.get('all');
  if (cached && cached.key === key && Date.now() - cached.at < HIGHLIGHTS_TTL_MS) {
    return { all: cached.data };
  }

  try {
    const { client, config } = await createOmniRouteClient();
    const models = Array.from(
      new Set(['antigravity/gemini-3.8-flash-low', 'antigravity/gemini-3.1-flash-lite', config.omnirouteModel])
    );

    for (const model of models) {
      try {
        const res = await client.chat.completions.create(
          {
            model,
            temperature: 0.3,
            messages: [
              {
                role: 'system',
                content:
                  'Você é um analista financeiro sênior brasileiro do Reach News. Escreva um briefing conciso e profissional sobre o pregão de hoje usando SOMENTE os dados fornecidos. Responda estritamente com JSON no formato: {"highlights":["...","...","..."]}. Máximo 4 frases pontuais e diretas.',
              },
              {
                role: 'user',
                content: `Dados de Mercado de Hoje:\n${summaryLines.join('\n')}\n\nEscreva de 3 a 4 destaques relevantes sobre bolsas, dólar e empresas em português.`,
              },
            ],
          },
          { timeout: 30000, maxRetries: 0 }
        );

        const txt = (res.choices?.[0]?.message?.content || '').replace(/```json|```/g, '');
        const start = txt.indexOf('{');
        const end = txt.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          const parsed = JSON.parse(txt.slice(start, end + 1));
          const list = (Array.isArray(parsed.highlights) ? parsed.highlights : [])
            .filter((h: unknown) => typeof h === 'string')
            .slice(0, 4);

          if (list.length) {
            highlightsCache.set('all', { at: Date.now(), key, data: list });
            return { all: list };
          }
        }
      } catch (err) {
        console.warn(`[Finance] Highlights failed (${model}):`, (err as Error).message);
      }
    }
  } catch (err) {
    console.warn('[Finance] Highlights error:', (err as Error).message);
  }

  return { all: cached?.data || [] };
}

async function buildFinanceSnapshot(): Promise<FinanceSnapshot | null> {
  const [currencies, yahooResults, macro] = await Promise.all([
    fetchAwesomeCurrencies(),
    Promise.all(YAHOO_ITEMS.map((cfg) => fetchYahooQuote(cfg))),
    fetchBcbIndicators(),
  ]);

  const yahooValid = yahooResults.filter((q): q is MarketQuote => q !== null);
  const quotes = [...currencies, ...yahooValid];

  if (!quotes.length && !macro.length) {
    return snapshotCache;
  }

  const highlights = await buildFinancialHighlights(quotes, macro);
  console.log(`[Finance] Snapshot atualizado: ${quotes.length} ativos, ${macro.length} indicadores macro.`);

  return {
    quotes,
    macro,
    highlights,
    updatedAt: new Date().toISOString(),
    sources: [
      { name: 'AwesomeAPI Câmbio', url: 'https://economia.awesomeapi.com.br' },
      { name: 'Yahoo Finance B3/Global', url: 'https://finance.yahoo.com' },
      { name: 'Banco Central do Brasil', url: 'https://www.bcb.gov.br' },
    ],
  };
}

export async function refreshFinanceSnapshot(): Promise<FinanceSnapshot | null> {
  if (refreshing) return refreshing;
  refreshing = buildFinanceSnapshot()
    .then((snap) => {
      if (snap) snapshotCache = snap;
      return snap;
    })
    .catch((err) => {
      console.warn('[Finance] Refresh failed:', (err as Error).message);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Retorna o snapshot financeiro do cache (instantâneo) ou dispara refresh se vazio/expirado. */
export function getFinanceSnapshot(): FinanceSnapshot | null {
  if (!snapshotCache || Date.now() - new Date(snapshotCache.updatedAt).getTime() > CACHE_TTL_MS) {
    void refreshFinanceSnapshot();
  }
  return snapshotCache;
}
