// Utilitários de data/hora para o fuso Africa/Luanda (UTC+1), moeda AOA (Kz) e telefones angolanos

export const LUANDA_TIMEZONE = 'Africa/Luanda';

export const DAY_NAMES_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

/**
 * Converte "HH:MM" para minutos desde 00:00.
 */
export function timeToMinutes(time: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!match) {
    throw new Error(`Formato de hora inválido: ${time}. Use HH:MM.`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Hora fora dos limites: ${time}`);
  }
  return hours * 60 + minutes;
}

/**
 * Converte minutos desde 00:00 para "HH:MM".
 */
export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Obtém data (YYYY-MM-DD), hora em minutos e timestamp ISO no fuso horário Africa/Luanda.
 */
export function getLuandaNow(referenceDate: Date = new Date()): {
  date: string;
  minutes: number;
  time: string;
  dayOfWeek: number;
  iso: string;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: LUANDA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(referenceDate);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = Number(get('hour'));
  if (hour === 24) hour = 0;
  const minute = Number(get('minute'));

  const date = `${year}-${month}-${day}`;
  const minutes = hour * 60 + minute;
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const dayOfWeek = getDayOfWeekFromDateString(date);

  return {
    date,
    minutes,
    time,
    dayOfWeek,
    iso: referenceDate.toISOString(),
  };
}

/**
 * Calcula o dia da semana (0=Domingo .. 6=Sábado) para "YYYY-MM-DD".
 */
export function getDayOfWeekFromDateString(dateStr: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new Error(`Data inválida: ${dateStr}. Use YYYY-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month, day)).getUTCDay();
}

/**
 * Diferença em dias inteiros (dateB - dateA) usando calendário UTC puro para evitar desvios de fuso.
 */
export function diffDays(dateA: string, dateB: string): number {
  const [yA, mA, dA] = dateA.split('-').map(Number);
  const [yB, mB, dB] = dateB.split('-').map(Number);
  const utcA = Date.UTC(yA, mA - 1, dA);
  const utcB = Date.UTC(yB, mB - 1, dB);
  return Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
}

/**
 * Adiciona dias a uma data YYYY-MM-DD.
 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Converte data YYYY-MM-DD + hora HH:MM em Africa/Luanda (UTC+01:00) para timestamp em ms.
 */
export function luandaDateTimeToEpochMs(dateStr: string, timeStr: string): number {
  return Date.parse(`${dateStr}T${timeStr}:00+01:00`);
}

/**
 * Formata valores em Kwanzas (AOA).
 */
export function formatKz(amount: number): string {
  return `${new Intl.NumberFormat('pt-AO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount))} Kz`;
}

/**
 * Formata data YYYY-MM-DD para leitura em português.
 */
export function formatDatePt(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/**
 * Normaliza telefone angolano para deduplicação consistente por salão.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('244') && digits.length >= 12) {
    return digits;
  }
  if (digits.length === 9 && digits.startsWith('9')) {
    return `244${digits}`;
  }
  return digits;
}

/**
 * Verifica se dois intervalos [aStart, aEnd) e [bStart, bEnd) se sobrepõem.
 */
export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart;
}
