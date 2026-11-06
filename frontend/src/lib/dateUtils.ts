/**
 * Utility functions for exact date and time formatting across reach.news
 * Supports Brazilian Portuguese (pt) and English (en).
 */

function pad(num: number): string {
  return String(num).padStart(2, '0');
}

function parseDate(dateInput: string | Date | undefined | null): Date | null {
  if (!dateInput) return null;
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return isNaN(d.getTime()) ? null : d;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

const PT_MONTHS_FULL = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const PT_MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

const EN_MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const EN_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Returns exact full timestamp:
 * PT: "05 de novembro de 2026 às 10:06"
 * EN: "November 5, 2026 at 10:06 AM"
 */
export function formatExactDateTime(
  dateInput: string | Date | undefined | null,
  lang: 'pt' | 'en'
): string {
  const d = parseDate(dateInput);
  if (!d) return String(dateInput || '');

  const day = pad(d.getDate());
  const year = d.getFullYear();
  const hours24 = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  if (lang === 'pt') {
    const month = PT_MONTHS_FULL[d.getMonth()];
    return `${day} de ${month} de ${year} às ${hours24}:${minutes}`;
  }

  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const month = EN_MONTHS_FULL[d.getMonth()];
  return `${month} ${d.getDate()}, ${year} at ${h}:${minutes} ${ampm}`;
}

/**
 * Returns exact publication text for Article view:
 * PT: "Publicado em 05 de novembro de 2026 às 10:06"
 * EN: "Published on November 5, 2026 at 10:06 AM"
 */
export function formatExactPublishedAt(
  dateInput: string | Date | undefined | null,
  lang: 'pt' | 'en'
): string {
  const full = formatExactDateTime(dateInput, lang);
  if (!full) return '';
  return lang === 'pt' ? `Publicado em ${full}` : `Published on ${full}`;
}

/**
 * Returns exact publication string for Hero featured story:
 * PT: "Publicado em 05 de nov. de 2026 às 10:06"
 * EN: "Published Nov 5, 2026 at 10:06 AM"
 */
export function formatHeroPublishedAt(
  dateInput: string | Date | undefined | null,
  lang: 'pt' | 'en'
): string {
  const d = parseDate(dateInput);
  if (!d) return String(dateInput || '');

  const day = pad(d.getDate());
  const year = d.getFullYear();
  const hours24 = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  if (lang === 'pt') {
    const month = PT_MONTHS_SHORT[d.getMonth()];
    return `Publicado em ${day} de ${month}. de ${year} às ${hours24}:${minutes}`;
  }

  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const month = EN_MONTHS_SHORT[d.getMonth()];
  return `Published ${month} ${d.getDate()}, ${year} at ${h}:${minutes} ${ampm}`;
}

/**
 * Returns compact exact publication string for standard grid cards:
 * - If today: "Hoje às 10:06" / "Today at 10:06 AM"
 * - If yesterday: "Ontem às 10:06" / "Yesterday at 10:06 AM"
 * - Same year: "05 de nov. às 10:06" / "Nov 5 at 10:06 AM"
 * - Other years: "05/11/2025 às 10:06" / "Nov 5, 2025 at 10:06 AM"
 */
export function formatCardPublishedAt(
  dateInput: string | Date | undefined | null,
  lang: 'pt' | 'en'
): string {
  const d = parseDate(dateInput);
  if (!d) return String(dateInput || '');

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const hours24 = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;

  const ptTime = `${hours24}:${minutes}`;
  const enTime = `${h}:${minutes} ${ampm}`;

  if (isSameDay(d, now)) {
    return lang === 'pt' ? `Hoje às ${ptTime}` : `Today at ${enTime}`;
  }

  if (isSameDay(d, yesterday)) {
    return lang === 'pt' ? `Ontem às ${ptTime}` : `Yesterday at ${enTime}`;
  }

  if (d.getFullYear() === now.getFullYear()) {
    const ptMonth = PT_MONTHS_SHORT[d.getMonth()];
    const enMonth = EN_MONTHS_SHORT[d.getMonth()];
    return lang === 'pt'
      ? `${pad(d.getDate())} de ${ptMonth}. às ${ptTime}`
      : `${enMonth} ${d.getDate()} at ${enTime}`;
  }

  const enMonth = EN_MONTHS_SHORT[d.getMonth()];
  return lang === 'pt'
    ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${ptTime}`
    : `${enMonth} ${d.getDate()}, ${d.getFullYear()} at ${enTime}`;
}
