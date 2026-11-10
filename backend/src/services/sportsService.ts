import { createOmniRouteClient } from './omnirouteService';
import { getSportsIntervalsMs, isAiRestPeriod } from './aiScheduleService';

/**
 * Fonte estruturada: endpoints JSON públicos da ESPN (placares, horários, escudos, tabelas).
 * A IA entra depois, narrando os grupos com destaques a partir desses dados exatos.
 */
const ESPN = 'https://site.api.espn.com/apis';

export interface TeamSide {
  name: string;
  logo?: string;
  score?: string | null;
  form?: string | null; // ex: "WDLWW"
  winner?: boolean;
}

export interface MatchEvent {
  minute: string;
  kind: 'goal' | 'red' | 'yellow' | 'other';
  text: string;
  side?: 'home' | 'away';
}

export interface SportsMatch {
  id: string;
  group: string; // id do subtema (ex: sport_futebol_br)
  sport: 'football' | 'basketball' | 'tennis';
  competition: string;
  startTime: string; // ISO UTC
  status: 'live' | 'scheduled' | 'finished';
  statusText: string; // ex: "67'", "Q3 5:12", "Encerrado"
  home: TeamSide;
  away: TeamSide;
  venue?: string;
  broadcast?: string;
  events: MatchEvent[];
  note?: string;
}

export interface StandingRow {
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

export interface StandingTable {
  group: string; // id do subtema
  competition: string;
  conference?: string; // ex: Eastern Conference (NBA)
  sport: 'football' | 'basketball';
  rows: StandingRow[];
}

export interface SportsSnapshot {
  matches: SportsMatch[];
  standings: StandingTable[];
  highlights: Record<string, string[]>; // por subtema; chave 'all' = geral
  updatedAt: string;
  sources: Array<{ name: string; url: string }>;
}

interface SoccerLeague {
  slug: string;
  name: string;
  group: string;
  standings: boolean;
}

const GROUP_NBA = 'sport_nba';
const GROUP_TENNIS = 'sport_tenis';

const SOCCER_LEAGUES: SoccerLeague[] = [
  { slug: 'bra.1', name: 'Brasileirão Série A', group: 'sport_futebol_br', standings: true },
  { slug: 'bra.2', name: 'Brasileirão Série B', group: 'sport_futebol_br', standings: true },
  { slug: 'bra.copa_do_brazil', name: 'Copa do Brasil', group: 'sport_futebol_br', standings: false },
  { slug: 'conmebol.libertadores', name: 'Libertadores', group: 'sport_futebol_br', standings: false },
  { slug: 'conmebol.sudamericana', name: 'Sul-Americana', group: 'sport_futebol_br', standings: false },
  { slug: 'eng.1', name: 'Premier League', group: 'sport_futebol_ing', standings: true },
  { slug: 'eng.2', name: 'Championship', group: 'sport_futebol_ing', standings: true },
  { slug: 'eng.fa', name: 'FA Cup', group: 'sport_futebol_ing', standings: false },
  { slug: 'eng.league_cup', name: 'Carabao Cup', group: 'sport_futebol_ing', standings: false },
  { slug: 'esp.1', name: 'La Liga', group: 'sport_futebol_esp', standings: true },
  { slug: 'esp.copa_del_rey', name: 'Copa del Rey', group: 'sport_futebol_esp', standings: false },
  { slug: 'ita.1', name: 'Serie A (Itália)', group: 'sport_futebol_ita', standings: true },
  { slug: 'ger.1', name: 'Bundesliga', group: 'sport_futebol_ale', standings: true },
  { slug: 'fra.1', name: 'Ligue 1', group: 'sport_futebol_fra', standings: true },
  { slug: 'por.1', name: 'Liga Portugal', group: 'sport_futebol_por', standings: true },
  { slug: 'uefa.champions', name: 'Champions League', group: 'sport_champions', standings: true },
  { slug: 'uefa.europa', name: 'Europa League', group: 'sport_champions', standings: true },
  { slug: 'uefa.europa.conf', name: 'Conference League', group: 'sport_champions', standings: false },
];
let matchesCache: { at: number; data: SportsMatch[] } | null = null;
let standingsCache: { at: number; data: StandingTable[] } | null = null;
const highlightsCache = new Map<string, { at: number; key: string; data: string[] }>();
let refreshing: Promise<SportsSnapshot | null> | null = null;
let lastSnapshot: SportsSnapshot | null = null;
let lastRefreshAt = 0;

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getJson(url: string): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/** Ontem, hoje e amanhã (fuso de Brasília). A ESPN rejeita intervalos de datas, então consultamos dia a dia. */
function dateList(): string[] {
  const brt = Date.now() - 3 * 60 * 60 * 1000;
  return [-1, 0, 1].map((d) => ymd(new Date(brt + d * 24 * 60 * 60 * 1000)));
}

function mapStatus(type: any): { status: SportsMatch['status']; text: string } {
  const state = type?.state;
  if (state === 'in') return { status: 'live', text: '' };
  if (state === 'post') return { status: 'finished', text: 'Encerrado' };
  return { status: 'scheduled', text: '' };
}

function mapEvents(comp: any, homeId: string): MatchEvent[] {
  const out: MatchEvent[] = [];
  for (const d of comp?.details || []) {
    const kind: MatchEvent['kind'] = d.scoringPlay ? 'goal' : d.redCard ? 'red' : d.yellowCard ? 'yellow' : 'other';
    if (kind === 'other' || kind === 'yellow') continue;
    const player = d.athletesInvolved?.[0]?.displayName || '';
    const label = kind === 'goal' ? (d.ownGoal ? 'Gol contra' : d.penaltyKick ? 'Gol (pênalti)' : 'Gol') : 'Cartão vermelho';
    out.push({
      minute: d.clock?.displayValue || '',
      kind,
      text: player ? `${label} · ${player}` : label,
      side: String(d.team?.id) === homeId ? 'home' : 'away',
    });
  }
  return out;
}

function mapTeamEvent(ev: any, competition: string, sport: 'football' | 'basketball', group: string): SportsMatch | null {
  const comp = ev.competitions?.[0];
  const cs = comp?.competitors;
  if (!comp || !cs || cs.length < 2) return null;
  const home = cs.find((c: any) => c.homeAway === 'home') || cs[0];
  const away = cs.find((c: any) => c.homeAway === 'away') || cs[1];
  const { status, text } = mapStatus(comp.status?.type);
  const side = (c: any): TeamSide => ({
    name: c.team?.displayName || c.team?.name || '?',
    logo: c.team?.logo || c.team?.logos?.[0]?.href,
    score: status === 'scheduled' ? null : String(c.score ?? ''),
    form: c.form || null,
    winner: !!c.winner,
  });
  return {
    id: String(ev.id),
    group,
    sport,
    competition,
    startTime: ev.date,
    status,
    statusText:
      status === 'live'
        ? sport === 'football'
          ? comp.status?.displayClock || comp.status?.type?.shortDetail || 'Ao vivo'
          : comp.status?.type?.shortDetail || 'Ao vivo'
        : text,
    home: side(home),
    away: side(away),
    venue: [comp.venue?.fullName, comp.venue?.address?.city].filter(Boolean).join(' · ') || undefined,
    broadcast: comp.broadcast || comp.broadcasts?.[0]?.names?.join(', ') || undefined,
    events: sport === 'football' ? mapEvents(comp, String(home.team?.id)) : [],
  };
}

function mapTennis(ev: any, tour: string): SportsMatch[] {
  const out: SportsMatch[] = [];
  const tournament = ev.name || tour;
  for (const g of ev.groupings || []) {
    const round = g.grouping?.displayName || '';
    for (const comp of g.competitions || []) {
      const cs = comp.competitors;
      if (!cs || cs.length < 2) continue;
      const { status } = mapStatus(comp.status?.type);
      const side = (c: any): TeamSide => ({
        name: c.athlete?.displayName || c.team?.displayName || '?',
        logo: c.athlete?.flag?.href || c.athlete?.headshot?.href,
        score:
          status === 'scheduled'
            ? null
            : (c.linescores || []).map((l: any) => String(l.value ?? '')).filter(Boolean).join(' ') || null,
        winner: !!c.winner,
      });
      out.push({
        id: `t-${comp.id}`,
        group: GROUP_TENNIS,
        sport: 'tennis',
        competition: `${tour} · ${tournament}`,
        startTime: comp.startDate || comp.date || ev.date,
        status,
        statusText: status === 'live' ? comp.status?.type?.shortDetail || 'Ao vivo' : status === 'finished' ? 'Encerrado' : '',
        home: side(cs[0]),
        away: side(cs[1]),
        venue: [comp.venue?.court, comp.venue?.fullName].filter(Boolean).join(' · ') || undefined,
        events: [],
        note: round || comp.notes?.[0]?.text || undefined,
      });
    }
  }
  return out;
}

async function fetchMatches(): Promise<SportsMatch[]> {
  const jobs: Array<Promise<SportsMatch[]>> = [];

  for (const date of dateList()) {
    for (const l of SOCCER_LEAGUES) {
      jobs.push(
        getJson(`${ESPN}/site/v2/sports/soccer/${l.slug}/scoreboard?dates=${date}`).then((j) =>
          (j?.events || []).map((e: any) => mapTeamEvent(e, l.name, 'football', l.group)).filter(Boolean)
        )
      );
    }
    jobs.push(
      getJson(`${ESPN}/site/v2/sports/basketball/nba/scoreboard?dates=${date}`).then((j) =>
        (j?.events || []).map((e: any) => mapTeamEvent(e, 'NBA', 'basketball', GROUP_NBA)).filter(Boolean)
      )
    );
  }
  // Tênis: o placar do torneio já agrupa as partidas recentes e do dia
  for (const tour of ['atp', 'wta']) {
    jobs.push(
      getJson(`${ESPN}/site/v2/sports/tennis/${tour}/scoreboard`).then((j) =>
        (j?.events || []).flatMap((e: any) => mapTennis(e, tour.toUpperCase()))
      )
    );
  }

  const all = (await Promise.all(jobs)).flat();
  const seen = new Set<string>();
  const cutoff = Date.now() - 40 * 60 * 60 * 1000; // descarta partidas antigas (ex.: rodadas anteriores de torneios de tênis)
  const unique = all.filter(
    (m) => new Date(m.startTime).getTime() >= cutoff && (seen.has(m.id) ? false : (seen.add(m.id), true))
  );
  const rank = { live: 0, scheduled: 1, finished: 2 } as const;
  return unique.sort(
    (a, b) => rank[a.status] - rank[b.status] || new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
}
function statVal(stats: any[], name: string): number {
  const s = (stats || []).find((x) => x.name === name);
  return Number(s?.value ?? 0) || 0;
}

function mapStandings(json: any, competition: string, sport: 'football' | 'basketball', group: string): StandingTable[] {
  const tables: StandingTable[] = [];
  for (const child of json?.children || []) {
    const entries: any[] = child.standings?.entries || [];
    if (!entries.length) continue;
    const rows: StandingRow[] = entries
      .map((e, i): StandingRow => {
        const stats = e.stats || [];
        const wins = statVal(stats, 'wins');
        const losses = statVal(stats, 'losses');
        const draws = statVal(stats, 'ties') || statVal(stats, 'draws');
        return {
          position: statVal(stats, 'rank') || i + 1,
          team: e.team?.displayName || e.team?.name || '?',
          logo: e.team?.logos?.[0]?.href,
          played: statVal(stats, 'gamesPlayed') || wins + losses + draws,
          wins,
          draws,
          losses,
          goalsFor: sport === 'football' ? statVal(stats, 'pointsFor') : undefined,
          goalsAgainst: sport === 'football' ? statVal(stats, 'pointsAgainst') : undefined,
          diff: statVal(stats, 'pointDifferential'),
          points: statVal(stats, 'points'),
          note: e.note?.description,
          noteColor: e.note?.color,
        };
      })
      .sort((a, b) => a.position - b.position);
    tables.push({
      group,
      competition,
      conference: json.children.length > 1 ? child.name : undefined,
      sport,
      rows,
    });
  }
  return tables;
}

async function fetchStandings(): Promise<StandingTable[]> {
  const jobs: Array<Promise<StandingTable[]>> = SOCCER_LEAGUES.filter((l) => l.standings).map((l) =>
    getJson(`${ESPN}/v2/sports/soccer/${l.slug}/standings`).then((j) => mapStandings(j, l.name, 'football', l.group))
  );
  jobs.push(getJson(`${ESPN}/v2/sports/basketball/nba/standings`).then((j) => mapStandings(j, 'NBA', 'basketball', GROUP_NBA)));
  return (await Promise.all(jobs)).flat();
}

/** IA narra grupos com destaques de UM subtema usando apenas os dados já verificados acima. */
async function highlightsFor(groupId: string, matches: SportsMatch[], highlightsTtlMs: number): Promise<string[]> {
  const relevant = matches
    .filter((m) => m.status !== 'scheduled')
    .slice(0, 20)
    .map((m) => {
      const sc = m.sport === 'tennis' ? `${m.home.score ?? ''} | ${m.away.score ?? ''}` : `${m.home.score}-${m.away.score}`;
      const goals = m.events.filter((e) => e.kind === 'goal').map((e) => `${e.minute} ${e.text}`).join('; ');
      return `${m.competition}: ${m.home.name} ${sc} ${m.away.name} (${m.status === 'live' ? 'AO VIVO ' + m.statusText : 'encerrado'})${goals ? ' - ' + goals : ''}`;
    });
  if (!relevant.length) return [];
  const key = relevant.join('|');
  const cached = highlightsCache.get(groupId);
  if (cached && cached.key === key && Date.now() - cached.at < highlightsTtlMs) return cached.data;
  if (isAiRestPeriod()) return cached?.data || [];

  try {
    const { client, config } = await createOmniRouteClient();
    const models = Array.from(new Set(['antigravity/gemini-3.8-flash-low', 'antigravity/gemini-3.1-flash-lite', config.omnirouteModel]));
    for (const model of models) {
      try {
        const res = await client.chat.completions.create(
          {
            model,
            temperature: 0.4,
            messages: [
              {
                role: 'system',
                content:
                  'Você é um narrador esportivo brasileiro. Escreva SOMENTE com base nos dados fornecidos, sem inventar fatos e sem citar jogos que não estejam nos dados. Responda apenas com JSON: {"highlights":["...","..."]}.',
              },
              {
                role: 'user',
                content: `Dados:\n${relevant.join('\n')}\n\nEscreva de 2 a 4 grupos com destaques curtos (1 frase cada) em português, priorizando jogos ao vivo e goleadas.`,
              },
            ],
          },
          { timeout: 30000, maxRetries: 0 }
        );
        const txt = (res.choices?.[0]?.message?.content || '').replace(/```json|```/g, '');
        const parsed = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
        const list = (Array.isArray(parsed.highlights) ? parsed.highlights : [])
          .filter((h: unknown) => typeof h === 'string')
          .slice(0, 4);
        if (list.length) {
          highlightsCache.set(groupId, { at: Date.now(), key, data: list });
          return list;
        }
      } catch (err) {
        console.warn(`[Sports] Highlights failed (${groupId}/${model}):`, (err as Error).message);
      }
    }
  } catch (err) {
    console.warn('[Sports] Highlights error:', (err as Error).message);
  }
  return cached?.data || [];
}

async function buildHighlights(matches: SportsMatch[], highlightsTtlMs: number): Promise<Record<string, string[]>> {
  const groups = Array.from(new Set(matches.map((m) => m.group)));
  const entries = await Promise.all(
    groups.map(async (g) => [g, await highlightsFor(g, matches.filter((m) => m.group === g), highlightsTtlMs)] as const)
  );
  const out: Record<string, string[]> = {};
  for (const [g, list] of entries) if (list.length) out[g] = list;
  return out;
}

async function buildSnapshot(): Promise<SportsSnapshot | null> {
  const intervals = getSportsIntervalsMs();
  if (!intervals) {
    return lastSnapshot;
  }

  const { matchTtlMs, standingsTtlMs, highlightsTtlMs } = intervals;
  const needMatches = !matchesCache || Date.now() - matchesCache.at > matchTtlMs;
  const needStandings = !standingsCache || Date.now() - standingsCache.at > standingsTtlMs;

  if (needMatches) {
    const data = await fetchMatches();
    if (data.length || !matchesCache) matchesCache = { at: Date.now(), data };
  }
  if (needStandings) {
    const data = await fetchStandings();
    if (data.length || !standingsCache) standingsCache = { at: Date.now(), data };
  }

  const matches = matchesCache?.data || [];
  const standings = standingsCache?.data || [];
  if (!matches.length && !standings.length) return null;

  const highlights = await buildHighlights(matches, highlightsTtlMs);
  console.log(`[Sports] Snapshot: ${matches.length} jogos, ${standings.length} tabelas, ${Object.keys(highlights).length} grupos com destaques`);

  return {
    matches,
    standings,
    highlights,
    updatedAt: new Date().toISOString(),
    sources: [{ name: 'ESPN', url: 'https://www.espn.com.br' }],
  };
}

export async function refreshSportsSnapshot(): Promise<SportsSnapshot | null> {
  if (isAiRestPeriod()) {
    return lastSnapshot;
  }

  const intervals = getSportsIntervalsMs();
  if (!intervals) {
    return lastSnapshot;
  }

  if (lastRefreshAt > 0 && Date.now() - lastRefreshAt < intervals.matchTtlMs) {
    return lastSnapshot;
  }

  if (refreshing) return refreshing;
  refreshing = buildSnapshot()
    .then((snap) => {
      if (snap) {
        lastSnapshot = snap;
        lastRefreshAt = Date.now();
      }
      return snap;
    })
    .catch((err) => {
      console.warn('[Sports] Refresh failed:', (err as Error).message);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Retorna o cache na hora (nunca bloqueia); atualiza em segundo plano quando vencido (respeitando descanso 00h-05h e janela 45min das 05h01-12h). */
export function getSportsSnapshot(): SportsSnapshot | null {
  if (isAiRestPeriod()) {
    return lastSnapshot;
  }

  const intervals = getSportsIntervalsMs();
  if (!intervals) {
    return lastSnapshot;
  }

  if (!lastSnapshot || lastRefreshAt === 0 || Date.now() - lastRefreshAt >= intervals.matchTtlMs) {
    void refreshSportsSnapshot();
  }
  return lastSnapshot;
}
