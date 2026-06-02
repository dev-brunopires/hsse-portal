import { supabase } from '@/integrations/supabase/client';
import type { EvvSubmission } from './types';

// Lightweight localStorage-backed store. Offshore data volume per user is low (forms).
const KEY = 'evv:submissions';

function readAll(): Record<string, EvvSubmission> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as Record<string, EvvSubmission> : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, EvvSubmission>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* quota — ignore */
  }
}

export async function saveSubmissionLocal(sub: EvvSubmission): Promise<void> {
  const map = readAll();
  map[sub.client_id] = { ...sub, updated_at: new Date().toISOString() };
  writeAll(map);
}

export async function getSubmissionLocal(clientId: string): Promise<EvvSubmission | null> {
  return readAll()[clientId] ?? null;
}

export async function deleteSubmissionLocal(clientId: string): Promise<void> {
  const map = readAll();
  delete map[clientId];
  writeAll(map);
}

export async function listSubmissionsLocal(): Promise<EvvSubmission[]> {
  return Object.values(readAll()).sort(
    (a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''),
  );
}

export async function countUnsynced(): Promise<number> {
  return (await listSubmissionsLocal()).filter((s) => s.status === 'not_synced').length;
}

export async function syncAllUnsynced(
  organizationId: string,
  userId: string,
): Promise<{ synced: number; failed: number }> {
  const pending = (await listSubmissionsLocal()).filter((s) => s.status === 'not_synced');
  let synced = 0;
  let failed = 0;
  for (const sub of pending) {
    try {
      const { error } = await supabase
        .from('evv_submissions' as any)
        .upsert(
          {
            client_id: sub.client_id,
            organization_id: organizationId,
            user_id: userId,
            form_type: sub.form_type,
            status: 'completed',
            scope: sub.scope,
            answers: sub.answers,
            comments: sub.comments,
            submitted_at: sub.submitted_at ?? new Date().toISOString(),
          },
          { onConflict: 'client_id' },
        );
      if (error) throw error;
      await saveSubmissionLocal({ ...sub, status: 'completed' });
      synced += 1;
    } catch {
      failed += 1;
    }
  }
  return { synced, failed };
}
