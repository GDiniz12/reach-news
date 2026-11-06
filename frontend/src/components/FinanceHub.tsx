'use client';

import React, { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
const POLL_MS = 30_000;

interface MarketQuote {
  symbol: string;
  name: string;
  shortName: string;
  group: string;
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

interface MacroIndicator {
  name: string;
  code: string;
  value: string;
  unit: string;
  period?: string;
  source: string;
}

interface FinanceSnapshot {
  quotes: MarketQuote[];
  macro: MacroIndicator[];
  highlights: Record<string, string[]>;
  updatedAt: string;
  sources: Array<{ name: string; url: string }>;
}

const SUBTHEME_TO_TAB: Record<string, string> = {
  eco_mercado: 'indices',
  eco_cambio: 'currencies',
  eco_acoes_br: 'stocks_br',
  eco_acoes_global: 'stocks_global',
  eco_bc_selic: 'rates',
  eco_commodities: 'commodities',
};

const TAB_TO_SUBTHEME: Record<string, string> = {
  indices: 'eco_mercado',
  currencies: 'eco_cambio',
  stocks_br: 'eco_acoes_br',
  stocks_global: 'eco_acoes_global',
  rates: 'eco_bc_selic',
  commodities: 'eco_commodities',
};

function formatPrice(val: number, currency: string, type: MarketQuote['type']) {
  if (type === 'index') {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(val) + ' pts';
  }
  if (type === 'crypto') {
    return 'R$ ' + new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(val);
  }
  if (currency === 'BRL') {
    const dec = val < 10 && (type === 'currency') ? 4 : 2;
    return 'R$ ' + new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val);
  }
  if (currency === 'USD') {
    return 'US$ ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  }
  return String(val);
}

function QuoteCard({ q }: { q: MarketQuote }) {
  const isUp = q.changePercent > 0;
  const isDown = q.changePercent < 0;
  const sign = isUp ? '+' : '';

  return (
    <div className="rounded-xl bg-[#202222] border border-white/[0.06] p-4 flex flex-col justify-between hover:border-white/20 transition group">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-bold text-white/90 group-hover:text-emerald-400 transition truncate">
            {q.shortName}
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums shrink-0 ${
              isUp
                ? 'bg-emerald-500/15 text-emerald-400'
                : isDown
                ? 'bg-rose-500/15 text-rose-400'
                : 'bg-white/10 text-white/60'
            }`}
          >
            {isUp ? '▲' : isDown ? '▼' : '•'} {sign}{q.changePercent.toFixed(2)}%
          </span>
        </div>
        <div className="text-[11px] text-white/50 truncate mb-3" title={q.name}>
          {q.name}
        </div>
      </div>

      <div>
        <div className="text-lg font-bold text-white tabular-nums tracking-tight">
          {formatPrice(q.price, q.currency, q.type)}
        </div>
        {(q.high !== undefined || q.low !== undefined) && (
          <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-white/40 tabular-nums">
            <span>Mín: {q.low !== undefined ? formatPrice(q.low, q.currency, q.type) : '–'}</span>
            <span>Máx: {q.high !== undefined ? formatPrice(q.high, q.currency, q.type) : '–'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FinanceHub({ subtheme = null }: { subtheme?: string | null }) {
  const [data, setData] = useState<FinanceSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/finance/market`);
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (res.status === 202 || !Array.isArray(json?.quotes)) {
          if (!cancelled) retryTimer = setTimeout(load, 5000);
          return;
        }
        if (!cancelled) {
          setData(json);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      clearInterval(id);
    };
  }, []);

  // Alinha a aba com o subtema quando selecionado pelo usuário
  useEffect(() => {
    if (subtheme && SUBTHEME_TO_TAB[subtheme]) {
      setTab(SUBTHEME_TO_TAB[subtheme]);
    } else if (!subtheme) {
      setTab('all');
    }
  }, [subtheme]);

  const activeGroup = useMemo(() => {
    if (subtheme && SUBTHEME_TO_TAB[subtheme]) return subtheme;
    if (tab !== 'all' && TAB_TO_SUBTHEME[tab]) return TAB_TO_SUBTHEME[tab];
    return null;
  }, [subtheme, tab]);

  const filteredQuotes = useMemo(() => {
    if (!data?.quotes) return [];
    if (!activeGroup) return data.quotes;
    return data.quotes.filter((q) => q.group === activeGroup);
  }, [data, activeGroup]);

  const highlights = useMemo(() => {
    const all = data?.highlights?.all || [];
    return all;
  }, [data]);

  const tabs = [
    { id: 'all', label: 'Visão Geral' },
    { id: 'currencies', label: 'Câmbio & Dólar', group: 'eco_cambio' },
    { id: 'indices', label: 'Bolsas & Índices', group: 'eco_mercado' },
    { id: 'stocks_br', label: 'Ações B3', group: 'eco_acoes_br' },
    { id: 'stocks_global', label: 'Ações Globais', group: 'eco_acoes_global' },
    { id: 'rates', label: 'Selic & Juros', group: 'eco_bc_selic' },
    { id: 'commodities', label: 'Commodities', group: 'eco_commodities' },
  ];

  const nowFmt = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  return (
    <section className="mb-10">
      {/* Resumo da IA */}
      {data && highlights.length > 0 && (
        <div className="mb-5 rounded-xl bg-gradient-to-br from-[#1a2924] to-[#1e2222] border border-emerald-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-white font-semibold text-sm">✨ Giro do Mercado pela IA</h3>
          </div>
          <ul className="space-y-1.5 text-sm text-white/80 list-disc pl-5">
            {highlights.map((h, i) => (
              <li key={i} className="leading-relaxed">{h}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Indicadores Macro BCB (Selic, CDI, IPCA) */}
      {data && data.macro && data.macro.length > 0 && (tab === 'all' || tab === 'rates') && (
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.macro.map((m) => (
            <div
              key={m.code}
              className="rounded-xl bg-[#202222] border border-white/[0.06] p-3.5 flex items-center justify-between"
            >
              <div>
                <span className="text-[11px] text-white/50 block font-medium">{m.name}</span>
                <span className="text-xl font-bold text-white tabular-nums tracking-tight">{m.value}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-400/80 font-mono block">Oficial BCB</span>
                {m.period && <span className="text-[10px] text-white/40 block">{m.period}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros de Abas internas (apenas se nenhum subtema externo estiver fixado) */}
      {!subtheme && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-white text-black'
                  : 'bg-white/[0.06] text-white/70 hover:bg-white/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Skeletons */}
      {!data && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="h-28 rounded-xl bg-[#202222] animate-pulse" />
          ))}
        </div>
      )}

      {/* Mensagem de Erro temporário */}
      {error && !data && (
        <p className="text-sm text-white/50">Carregando cotações em tempo real...</p>
      )}

      {/* Grid de Ativos */}
      {data && (
        filteredQuotes.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredQuotes.map((q) => (
              <QuoteCard key={q.symbol} q={q} />
            ))}
          </div>
        ) : (
          tab !== 'rates' && (
            <p className="text-sm text-white/50">Nenhuma cotação específica para este filtro no momento.</p>
          )
        )
      )}

      {/* Rodapé de dados */}
      {data && (
        <p className="mt-4 text-[11px] text-white/35 flex flex-wrap items-center justify-between gap-2">
          <span>
            Fontes: {data.sources.map((s) => s.name).join(' · ')}
          </span>
          <span>
            Atualizado às {nowFmt.format(new Date(data.updatedAt))} (Brasília) · Cotações com delay de mercado
          </span>
        </p>
      )}
    </section>
  );
}
