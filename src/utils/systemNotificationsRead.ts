export type SystemNotificationId = 'system-ship-filter' | 'system-high-priority';

const STORAGE_KEY = 'system-notifications-read-v1';

type SystemReadMap = Record<string, string>;

export function readSystemNotificationsRead(): SystemReadMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as SystemReadMap;
  } catch {
    return {};
  }
}

export function writeSystemNotificationsRead(map: SystemReadMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function markSystemNotificationRead(
  id: SystemNotificationId,
  version: string = '1'
): SystemReadMap {
  const current = readSystemNotificationsRead();
  const next = { ...current, [id]: version };
  writeSystemNotificationsRead(next);
  return next;
}
