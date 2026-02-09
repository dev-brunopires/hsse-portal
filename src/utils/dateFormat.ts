import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Returns today's date as YYYY-MM-DD using local timezone.
 * ALWAYS use this instead of new Date().toISOString().split('T')[0]
 * which shifts by -1 day in negative UTC offsets (e.g. Brazil UTC-3).
 */
export function getLocalToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Formats a Date object as YYYY-MM-DD using local timezone.
 * ALWAYS use this instead of date.toISOString().split('T')[0].
 */
export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

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

/**
 * Calculate next date based on a frequency string.
 * Centralized to avoid duplicate implementations across the app.
 */
export function calculateNextDateByFrequency(dateString: string, frequency: string): string {
  const date = new Date(`${dateString}T12:00:00`);
  
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setDate(date.getDate() + 30);
      break;
    case 'quarterly':
      date.setDate(date.getDate() + 90);
      break;
    case 'semi-annual':
    case 'semiannual':
      date.setDate(date.getDate() + 180);
      break;
    case 'annual':
    case 'yearly':
      date.setDate(date.getDate() + 365);
      break;
    default:
      date.setDate(date.getDate() + 30);
  }
  
  return formatLocalDate(date);
}
