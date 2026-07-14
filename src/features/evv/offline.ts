import { supabase } from '@/integrations/supabase/client';
import type { EvvSubmission } from './types';
import type { Json } from '@/integrations/supabase/types';

const LEGACY_KEY = 'evv:submissions';
const DB_NAME = 'hsse_connect_evv';
const STORE_NAME = 'submissions';

function openEvvDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'client_id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openEvvDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function migrateLegacySubmissions(): Promise<void> {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return;
  try {
    const legacy = JSON.parse(raw) as Record<string, EvvSubmission>;
    for (const submission of Object.values(legacy)) {
      await withStore('readwrite', (store) => store.put(submission));
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Preserve the legacy value when migration fails so no draft is lost.
  }
}

export async function saveSubmissionLocal(sub: EvvSubmission): Promise<void> {
  await migrateLegacySubmissions();
  await withStore('readwrite', (store) => store.put({
    ...sub,
    updated_at: new Date().toISOString(),
  }));
}

export async function getSubmissionLocal(clientId: string): Promise<EvvSubmission | null> {
  await migrateLegacySubmissions();
  return (await withStore<EvvSubmission | undefined>('readonly', (store) => store.get(clientId))) ?? null;
}

export async function deleteSubmissionLocal(clientId: string): Promise<void> {
  await migrateLegacySubmissions();
  await withStore('readwrite', (store) => store.delete(clientId));
}

export async function listSubmissionsLocal(): Promise<EvvSubmission[]> {
  await migrateLegacySubmissions();
  const submissions = await withStore<EvvSubmission[]>('readonly', (store) => store.getAll());
  return submissions.sort(
    (a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''),
  );
}

export async function countUnsynced(): Promise<number> {
  return (await listSubmissionsLocal()).filter((s) => s.status === 'not_synced').length;
}

export async function syncAllUnsynced(
  organizationId: string,
  userId: string,
): Promise<{ synced: number; failed: number; lastError?: string }> {
  const pending = (await listSubmissionsLocal()).filter((s) => s.status === 'not_synced');
  let synced = 0;
  let failed = 0;
  let lastError: string | undefined;
  for (const sub of pending) {
    try {
      const { error } = await supabase
        .from('evv_submissions')
        .upsert(
          {
            client_id: sub.client_id,
            organization_id: organizationId,
            user_id: userId,
            form_type: sub.form_type,
            status: 'completed',
            scope: sub.scope as unknown as Json,
            answers: sub.answers as unknown as Json,
            comments: sub.comments,
            review_status: 'pending',
            signature_data: sub.signature_data ?? null,
            signed_at: sub.signed_at ?? null,
            submitted_at: sub.submitted_at ?? new Date().toISOString(),
          },
          { onConflict: 'client_id' },
        );
      if (error) throw error;
      await saveSubmissionLocal({ ...sub, status: 'completed' });
      synced += 1;
    } catch (e: unknown) {
      console.error('[evv.sync] failed to sync submission', sub.client_id, e);
      lastError = e instanceof Error ? e.message : String(e);
      failed += 1;
    }
  }
  return { synced, failed, lastError };
}
