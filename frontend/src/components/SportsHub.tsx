'use client';

import React, { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
const POLL_MS = 30_000;

interface TeamSide {
  name: string;
  logo?: string;
  score?: string | null;
  form?: string | null;
  winner?: boolean;
}
interface MatchEvent {
  minute: string;
  kind: 'goal' | 'red' | 'yellow' | 'other';
  text: string;
  side?: 'home' | 'away';
}
interface Match {
  id: string;
  group: string;
  sport: 'football' | 'basketball' | 'tennis';
  competition: string;
  startTime: string;
  status: 'live' | 'scheduled' | 'finished';
  statusText: string;
  home: TeamSide;
  away: TeamSide;
  venue?: string;
  broadcast?: string;
  events: MatchEvent[];
  note?: string;
}
interface StandingRow {
  position: number;
  team: string;
  logo?: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor?: number;
  goalsAgainst?: number;
  diff: number;
  points: number;
  note?: string;
  noteColor?: string;
}
interface StandingTable {
  group: string;
  competition: string;
  conference?: string;
  sport: 'football' | 'basketball';
  rows: StandingRow[];
}
interface Snapshot {
  matches: Match[];
  standings: StandingTable[];
  highlights: Record<string, string[]>;
  updatedAt: string;
  sources: Array<{ name: string; url: string }>;
}

type Tab = 'today' | 'standings' | 'results';
type SportFilter = 'all' | Match['sport'];

const SPORT_LABEL: Record<SportFilter, string> = {
  all: 'Todos',
  football: 'Futebol',
  basketball: 'Basquete',
  tennis: 'Tênis',
};

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const dayFmt = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  timeZone: 'America/Sao_Paulo',
});
const dayKey = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

function Logo({ src, name }: { src?: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/70 shrink-0">
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setBroken(true)}
      className="w-7 h-7 object-contain shrink-0"
    />
  );
}

function FormDots({ form }: { form?: string | null }) {
  if (!form) return null;
  return (
    <span className="flex gap-0.5 mt-0.5">
      {form
        .slice(-5)
        .split('')
        .map((c, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${
              c === 'W' ? 'bg-emerald-500' : c === 'D' ? 'bg-yellow-500' : c === 'L' ? 'bg-red-500' : 'bg-white/20'
            }`}
          />
        ))}
    </span>
  );
}

function MatchCard({ m }: { m: Match }) {
  const hasScore = m.status !== 'scheduled';
  const tennis = m.sport === 'tennis';
  return (
    <div className="rounded-xl bg-[#202222] border border-white/[0.06] p-4">
      <div className="flex items-center justify-between text-[11px] text-white/50 mb-3 gap-2">
        <span className="truncate">{m.competition}</span>
        {m.status === 'live' ? (
          <span className="flex items-center gap-1 text-red-400 font-semibold shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {m.statusText || 'AO VIVO'}
          </span>
        ) : m.status === 'finished' ? (
          <span className="shrink-0">
            Encerrado · {dayFmt.format(new Date(m.startTime))}
          </span>
        ) : (
          <span className="shrink-0 text-white/80 font-medium">
            {dayFmt.format(new Date(m.startTime))} · {timeFmt.format(new Date(m.startTime))}
          </span>
        )}
      </div>
      {[m.home, m.away].map((side, i) => (
        <div key={i} className="flex items-center justify-between py-1.5 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo src={side.logo} name={side.name} />
            <div className="min-w-0">
              <div className={`text-sm truncate ${side.winner ? 'text-white font-bold' : 'text-white/85 font-medium'}`}>
                {side.name}
              </div>
              <FormDots form={side.form} />
            </div>
          </div>
          <span className={`tabular-nums ${tennis ? 'text-sm' : 'text-lg'} ${side.winner ? 'text-white font-bold' : 'text-white/80 font-semibold'}`}>
            {hasScore ? side.score || '–' : '–'}
          </span>
        </div>
      ))}
      {m.events.length > 0 && (
        <ul className="mt-3 pt-3 border-t border-white/[0.06] space-y-1 text-xs text-white/60">
          {m.events.map((e, i) => (
            <li key={i}>
              <span className="text-white/40 tabular-nums mr-1.5">{e.minute}</span>
              {e.kind === 'goal' ? '⚽' : '🟥'} {e.text}{' '}
              <span className="text-white/30">({e.side === 'home' ? m.home.name : m.away.name})</span>
            </li>
          ))}
        </ul>
      )}
      {(m.note || m.venue || m.broadcast) && (
        <p className="mt-2 text-[11px] text-white/40">
          {[m.note, m.venue, m.broadcast && `📺 ${m.broadcast}`].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  );
}

function StandingsTable({ t }: { t: StandingTable }) {
  const football = t.sport === 'football';
  return (
    <div className="rounded-xl bg-[#202222] border border-white/[0.06] p-4 overflow-x-auto">
      <h3 className="text-white font-semibold mb-3 text-sm">
        {t.competition}
        {t.conference && <span className="text-white/40 font-normal"> · {t.conference}</span>}
      </h3>
      <table className="w-full text-xs text-white/80 min-w-[380px]">
        <thead className="text-white/40">
          <tr>
            <th className="text-left font-normal w-6">#</th>
            <th className="text-left font-normal">Time</th>
            <th className="font-normal px-1">J</th>
            <th className="font-normal px-1">V</th>
            {football && <th className="font-normal px-1">E</th>}
            <th className="font-normal px-1">D</th>
            {football && <th className="font-normal px-1">GP</th>}
            {football && <th className="font-normal px-1">GC</th>}
            <th className="font-normal px-1">SG</th>
            {football && <th className="font-normal px-1">Pts</th>}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r) => (
            <tr key={r.team} className="border-t border-white/[0.05]">
              <td className="py-1.5">
                <span
                  className="inline-block w-1 h-4 align-middle rounded-sm mr-1"
                  style={{ background: r.noteColor || 'transparent' }}
                  title={r.note}
                />
                {r.position}
              </td>
              <td>
                <span className="flex items-center gap-2">
                  <Logo src={r.logo} name={r.team} />
                  <span className="truncate max-w-[150px]">{r.team}</span>
                </span>
              </td>
              <td className="text-center">{r.played}</td>
              <td className="text-center">{r.wins}</td>
              {football && <td className="text-center">{r.draws}</td>}
              <td className="text-center">{r.losses}</td>
              {football && <td className="text-center">{r.goalsFor ?? '-'}</td>}
              {football && <td className="text-center">{r.goalsAgainst ?? '-'}</td>}
              <td className="text-center">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
              {football && <td className="text-center font-bold text-white">{r.points}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Subtemas que têm dados ao vivo no hub (os demais, como F1 e UFC, mostram só notícias). */
const HUB_GROUPS = new Set([
  'sport_futebol_br',
  'sport_futebol_ing',
  'sport_futebol_esp',
  'sport_futebol_ita',
  'sport_futebol_ale',
  'sport_futebol_fra',
  'sport_futebol_por',
  'sport_champions',
  'sport_nba',
  'sport_tenis',
]);

export default function SportsHub({ subtheme = null }: { subtheme?: string | null }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [sport, setSport] = useState<SportFilter>('all');
  const [competition, setCompetition] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sports/live`);
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (res.status === 202 || !Array.isArray(json?.matches)) {
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

  const inSubtheme = <T extends { group: string }>(x: T) => !subtheme || x.group === subtheme;

  // Ao trocar de subtema, volta os filtros internos ao padrão
  useEffect(() => {
    setSport('all');
    setCompetition('all');
  }, [subtheme]);

  const bySport = useMemo(
    () => (data?.matches || []).filter((m) => inSubtheme(m) && (sport === 'all' || m.sport === sport)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, sport, subtheme]
  );
  const standings = useMemo(
    () => (data?.standings || []).filter((t) => inSubtheme(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, subtheme]
  );
  const highlights = useMemo(() => {
    const h = data?.highlights || {};
    if (subtheme) return h[subtheme] || [];
    // Visão geral: 1-2 destaques de cada subtema, no máximo 5
    return Object.values(h)
      .flatMap((list) => list.slice(0, 1))
      .slice(0, 5);
  }, [data, subtheme]);
  const competitions = useMemo(() => Array.from(new Set(bySport.map((m) => m.competition))), [bySport]);
  const filtered = bySport.filter((m) => competition === 'all' || m.competition === competition);

  const today = dayKey(new Date().toISOString());
  const upcoming = filtered.filter((m) => m.status !== 'finished');
  const results = filtered
    .filter((m) => m.status === 'finished')
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  const list = tab === 'today' ? upcoming : results;

  const tabs: Array<[Tab, string]> = [
    ['today', 'Hoje / Ao vivo'],
    ['standings', 'Classificação'],
    ['results', 'Resultados'],
  ];

  const liveCount = bySport.filter((m) => m.status === 'live').length;

  // Subtemas sem dados no hub (F1, UFC, Olímpicos): mostra só as notícias
  if (subtheme && !HUB_GROUPS.has(subtheme)) return null;

  return (
    <section className="mb-10">
      {data && highlights.length > 0 && (
        <div className="mb-5 rounded-xl bg-gradient-to-br from-[#1e2a2a] to-[#202222] border border-white/[0.06] p-4">
          <h3 className="text-white font-semibold text-sm mb-2">✨ Destaques da IA</h3>
          <ul className="space-y-1 text-sm text-white/75 list-disc pl-5">
            {highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${
              tab === id ? 'bg-white text-black' : 'bg-white/[0.06] text-white/70 hover:bg-white/10'
            }`}
          >
            {label}
            {id === 'today' && liveCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5">{liveCount}</span>
            )}
          </button>
        ))}
        {tab !== 'standings' && (
          <div className="ml-auto flex gap-2">
            {!subtheme && (
              <select
                value={sport}
                onChange={(e) => {
                  setSport(e.target.value as SportFilter);
                  setCompetition('all');
                }}
                className="bg-[#202222] text-white/80 text-sm rounded-lg px-2 py-1.5 border border-white/10"
              >
                {(Object.keys(SPORT_LABEL) as SportFilter[]).map((k) => (
                  <option key={k} value={k}>
                    {SPORT_LABEL[k]}
                  </option>
                ))}
              </select>
            )}
            {competitions.length > 1 && (
              <select
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
                className="bg-[#202222] text-white/80 text-sm rounded-lg px-2 py-1.5 border border-white/10 max-w-[180px]"
              >
                <option value="all">Todos os campeonatos</option>
                {competitions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {!data && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-36 rounded-xl bg-[#202222] animate-pulse" />
          ))}
        </div>
      )}
      {error && !data && (
        <p className="text-sm text-white/50">Dados esportivos indisponíveis no momento. Tentando novamente…</p>
      )}

      {data && tab !== 'standings' &&
        (list.length ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {list.map((m) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/50">
            Nenhum jogo encontrado para este filtro{tab === 'today' ? ` (${today})` : ''}.
          </p>
        ))}

      {data && tab === 'standings' &&
        (standings.length ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {standings.map((t, i) => (
              <StandingsTable key={`${t.competition}-${t.conference || i}`} t={t} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/50">Este subtema não tem tabela de classificação.</p>
        ))}

      {data && (
        <p className="mt-4 text-[11px] text-white/35">
          Dados: {data.sources.map((s) => s.name).join(', ')} · destaques narrados por IA · atualizado às{' '}
          {timeFmt.format(new Date(data.updatedAt))} (Brasília)
        </p>
      )}
    </section>
  );
}
