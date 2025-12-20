import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Safely parses a date string, handling timezone issues by treating
 * the date as local midnight (not UTC midnight).
 *
 * This fixes the common off-by-one day error when parsing date-only strings
 * like "2025-12-19" in negative UTC offset timezones.
 */
export function parseLocalDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;

  // If it's already an ISO datetime string with time component, parse directly
  if (dateString.includes('T')) {
    return parseISO(dateString);
  }

  // For date-only strings (YYYY-MM-DD), append T00:00:00 to treat as local time
  return new Date(`${dateString}T00:00:00`);
}

/**
 * Formats a date string to the standard display format: "dd/MM/yyyy"
 * Handles timezone issues correctly.
 */
export function formatDate(
  dateString: string | null | undefined,
  fallback: string = '—'
): string {
  const date = parseLocalDate(dateString);
  if (!date || isNaN(date.getTime())) return fallback;

  return format(date, 'dd/MM/yyyy', { locale: ptBR });
}

/**
 * Formats a date string to a long format: "dd de MMMM de yyyy"
 * Example: "19 de dezembro de 2025"
 */
export function formatDateLong(
  dateString: string | null | undefined,
  fallback: string = '—'
): string {
  const date = parseLocalDate(dateString);
  if (!date || isNaN(date.getTime())) return fallback;

  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/**
 * Formats a date string to show day and short month: "dd de MMM"
 * Example: "19 de dez"
 */
export function formatDateShort(
  dateString: string | null | undefined,
  fallback: string = '—'
): string {
  const date = parseLocalDate(dateString);
  if (!date || isNaN(date.getTime())) return fallback;

  return format(date, "dd 'de' MMM", { locale: ptBR });
}

/**
 * Formats a date string with time: "dd/MM/yyyy 'às' HH:mm"
 * Example: "19/12/2025 às 14:30"
 */
export function formatDateTime(
  dateString: string | null | undefined,
  fallback: string = '—'
): string {
  const date = parseLocalDate(dateString);
  if (!date || isNaN(date.getTime())) return fallback;

  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

/**
 * Formats a date string to weekday name: "EEEE"
 * Example: "quinta-feira"
 */
export function formatWeekday(
  dateString: string | null | undefined,
  fallback: string = '—'
): string {
  const date = parseLocalDate(dateString);
  if (!date || isNaN(date.getTime())) return fallback;

  return format(date, 'EEEE', { locale: ptBR });
}

/**
 * Formats a date for full report headers: "dd 'de' MMMM 'de' yyyy 'às' HH:mm"
 * Example: "19 de dezembro de 2025 às 14:30"
 */
export function formatDateTimeFull(
  dateString: string | null | undefined,
  fallback: string = '—'
): string {
  const date = parseLocalDate(dateString);
  if (!date || isNaN(date.getTime())) return fallback;

  return format(date, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
}
