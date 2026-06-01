import { supabase } from '@/integrations/supabase/client';

export type TelemetryLevel = 'debug' | 'info' | 'warn' | 'error';

export interface TelemetryEvent {
  ts: number;
  level: TelemetryLevel;
  name: string;
  data?: Record<string, unknown>;
}

const STORAGE_KEY = 'client_telemetry_buffer_v1';
const MAX_BUFFER = 200;

let queue: TelemetryEvent[] = [];
let flushTimer: number | null = null;

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readBuffer(): TelemetryEvent[] {
  const stored = safeJsonParse<TelemetryEvent[]>(localStorage.getItem(STORAGE_KEY));
  return Array.isArray(stored) ? stored : [];
}

function writeBuffer(events: TelemetryEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_BUFFER)));
  } catch {
    // If storage is full or blocked, fail silently.
  }
}

async function flushNow() {
  if (queue.length === 0) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  // Skip remote flush when the user is not authenticated — the edge function
  // requires a valid JWT and would return 401, which would surface as a noisy
  // runtime error on public routes (e.g. /auth).
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const batch = queue.splice(0, queue.length);

  // Best-effort: keep local copy
  const persisted = readBuffer();
  writeBuffer([...persisted, ...batch]);

  try {
    await supabase.functions.invoke('client-telemetry', {
      body: { events: batch },
    });
  } catch {
    // Ignore - logs remain in localStorage
  }
}

function scheduleFlush() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(async () => {
    flushTimer = null;
    await flushNow();
  }, 1500);
}

function track(level: TelemetryLevel, name: string, data?: Record<string, unknown>) {
  const evt: TelemetryEvent = {
    ts: Date.now(),
    level,
    name,
    data,
  };

  queue.push(evt);
  if (queue.length > MAX_BUFFER) {
    queue = queue.slice(-MAX_BUFFER);
  }
  scheduleFlush();
}

export const telemetry = {
  event: (name: string, data?: Record<string, unknown>) => track('info', name, data),
  debug: (name: string, data?: Record<string, unknown>) => track('debug', name, data),
  info: (name: string, data?: Record<string, unknown>) => track('info', name, data),
  warn: (name: string, data?: Record<string, unknown>) => track('warn', name, data),
  error: (name: string, data?: Record<string, unknown>) => track('error', name, data),
  flush: flushNow,
  readLocal: () => readBuffer(),
};

export function initClientTelemetry() {
  // Avoid double registration in React StrictMode
  if ((window as any).__clientTelemetryInitialized) return;
  (window as any).__clientTelemetryInitialized = true;

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    telemetry.error('unhandled_rejection', {
      reason: typeof reason === 'string' ? reason : (reason?.message ?? 'unknown'),
    });
  });

  window.addEventListener('error', (event) => {
    telemetry.error('window_error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('online', () => {
    telemetry.info('network_online');
    void flushNow();
  });
  window.addEventListener('offline', () => telemetry.warn('network_offline'));
}
