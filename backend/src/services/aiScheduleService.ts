/**
 * Gerenciador centralizado de janelas de operação e frequência da IA (fuso horário de Brasília: America/Sao_Paulo).
 *
 * Regras de Frequência da IA:
 * - 00h00 às 05h00: Tempo de descanso absoluto — a IA não trabalha para nada (notícias, dados financeiros, esportes, etc.).
 * - 05h01 às 18h00:
 *   • Notícias: IA acionada a cada 1 hora (60 min).
 *   • Dados Financeiros: IA consultada de 2 em 2 horas (120 min).
 *   • Esportes: De 05h01 às 12h00, o intervalo de atualização é de 45 em 45 min; das 12h01 às 18h00, modo ativo padrão.
 * - 18h01 às 23h59:
 *   • Notícias: IA acionada a cada 2 horas (120 min).
 *   • Dados Financeiros: IA consultada de 2 em 2 horas (120 min).
 *   • Esportes: Modo ativo padrão (como estava antes).
 */

export const SCHEDULE_TIMEZONE = 'America/Sao_Paulo';

export interface BrtTimeParts {
  hour: number;
  minute: number;
  totalMinutes: number; // 0..1439 (ex: 05:01 = 301, 12:00 = 720, 18:00 = 1080)
  formatted: string;
}

export function getBrtTime(date: Date = new Date()): BrtTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHEDULE_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  let hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  if (hour === 24) hour = 0;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const totalMinutes = hour * 60 + minute;

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');

  return {
    hour,
    minute,
    totalMinutes,
    formatted: `${hh}:${mm}`,
  };
}

/**
 * 00h00 às 05h00 (inclusive 05:00 -> totalMinutes <= 300):
 * Tempo de descanso da IA. A IA só volta a partir das 05h01 (totalMinutes >= 301).
 */
export function isAiRestPeriod(date: Date = new Date()): boolean {
  const { totalMinutes } = getBrtTime(date);
  return totalMinutes >= 0 && totalMinutes <= 300; // 00:00 (0) até 05:00 (300)
}

/**
 * Intervalo de atualização de Notícias (Ciclo Editorial da IA):
 * - 00h00–05h00: null (descanso)
 * - 05h01–18h00 (301..1080): 1 hora (60 min)
 * - 18h01–23h59 (1081..1439): 2 horas (120 min)
 */
export function getNewsUpdateIntervalMs(date: Date = new Date()): number | null {
  if (isAiRestPeriod(date)) return null;
  const { totalMinutes } = getBrtTime(date);
  if (totalMinutes <= 1080) {
    // 05:01 até 18:00 -> 1 hora
    return 60 * 60 * 1000;
  }
  // 18:01 até 23:59 -> 2 horas
  return 2 * 60 * 60 * 1000;
}

/**
 * Intervalo de atualização de Dados Financeiros (Pesquisa de Mercado via IA):
 * - 00h00–05h00: null (descanso)
 * - 05h01–18h00: 2 em 2 horas (120 min)
 * - 18h01–23h59: 2 em 2 horas (120 min)
 */
export function getFinanceUpdateIntervalMs(date: Date = new Date()): number | null {
  if (isAiRestPeriod(date)) return null;
  return 2 * 60 * 60 * 1000; // 2 horas em ambos os períodos ativos
}

/**
 * Intervalos de atualização do Modo Esporte (Placares/Tabelas + Destaques da IA):
 * - 00h00–05h00: null (descanso total)
 * - 05h01–12h00 (301..720): pelo menos de 45 em 45 minutos (45 min)
 * - 12h01–18h00 (721..1080) e 18h01–23h59 (1081..1439): modo ativo original
 *   (placares a cada 1 min, tabelas a cada 20 min, narrativas de IA a cada 10 min)
 */
export function getSportsIntervalsMs(date: Date = new Date()): {
  matchTtlMs: number;
  standingsTtlMs: number;
  highlightsTtlMs: number;
} | null {
  if (isAiRestPeriod(date)) return null;
  const { totalMinutes } = getBrtTime(date);

  // Das 05h01 às 12h00 (301 até 720): atualização espaçada de 45 em 45 minutos
  if (totalMinutes >= 301 && totalMinutes <= 720) {
    const fortyFiveMin = 45 * 60 * 1000;
    return {
      matchTtlMs: fortyFiveMin,
      standingsTtlMs: fortyFiveMin,
      highlightsTtlMs: fortyFiveMin,
    };
  }

  // Das 12h01 às 23h59: modo ativo padrão
  return {
    matchTtlMs: 60 * 1000, // 1 min
    standingsTtlMs: 20 * 60 * 1000, // 20 min
    highlightsTtlMs: 10 * 60 * 1000, // 10 min
  };
}
