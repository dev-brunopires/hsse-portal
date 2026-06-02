import localforage from 'localforage';
import { supabase } from '@/integrations/supabase/client';
import type { EvvSubmission } from './types';

const store = localforage.createInstance({ name: 'evv', storeName: 'submissions' });

const k = (id: string) => `sub:${id}`;

export async function saveSubmissionLocal(sub: EvvSubmission): Promise<void> {
  await store.setItem(k(sub.client_id), { ...sub, updated_at: new Date().toISOString() });
}

export async function getSubmissionLocal(clientId: string): Promise<EvvSubmission | null> {
  return (await store.getItem<EvvSubmission>(k(clientId))) ?? null;
}

export async function deleteSubmissionLocal(clientId: string): Promise<void> {
  await store.removeItem(k(clientId));
}

export async function listSubmissionsLocal(): Promise<EvvSubmission[]> {
  const out: EvvSubmission[] = [];
  await store.iterate<EvvSubmission, void>((v) => { out.push(v); });
  return out.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

export async function countUnsynced(): Promise<number> {
  const all = await listSubmissionsLocal();
  return all.filter((s) => s.status === 'not_synced').length;
}

export async function syncAllUnsynced(organizationId: string, userId: string): Promise<{ synced: number; failed: number }> {
  const all = await listSubmissionsLocal();
  const pending = all.filter((s) => s.status === 'not_synced');
  let synced = 0;
  let failed = 0;
  for (const sub of pending) {
    try {
      const { error } = await supabase
        .from('evv_submissions' as any)
        .upsert({
          client_id: sub.client_id,
          organization_id: organizationId,
          user_id: userId,
          form_type: sub.form_type,
          status: 'completed',
          scope: sub.scope,
          answers: sub.answers,
          comments: sub.comments,
          submitted_at: sub.submitted_at ?? new Date().toISOString(),
        }, { onConflict: 'client_id' });
      if (error) throw error;
      await saveSubmissionLocal({ ...sub, status: 'completed' });
      synced += 1;
    } catch {
      failed += 1;
    }
  }
  return { synced, failed };
}
