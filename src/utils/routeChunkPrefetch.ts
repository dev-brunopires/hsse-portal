/**
 * Pre-warm lazy route chunks on hover/focus so navigation feels instant.
 * Each entry returns the same dynamic import used by App.tsx, so the browser
 * caches the chunk and React.lazy resolves immediately on click.
 */
const routeChunkLoaders: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/Index'),
  '/equipment': () => import('@/pages/EquipmentList'),
  '/inspections': () => import('@/pages/Inspections'),
  '/maintenance': () => import('@/pages/Maintenance'),
  '/certificates': () => import('@/pages/Certificates'),
  '/reports': () => import('@/pages/Reports'),
  '/alerts': () => import('@/pages/Alerts'),
  '/pending': () => import('@/pages/PendingRecommendations'),
  '/categories': () => import('@/pages/Categories'),
  '/users': () => import('@/pages/Users'),
  '/settings': () => import('@/pages/Settings'),
  '/audit-log': () => import('@/pages/AuditLog'),
  '/profile': () => import('@/pages/Profile'),
  '/offline': () => import('@/pages/OfflineData'),
  '/diagnostics': () => import('@/pages/Diagnostics'),
  '/health-check': () => import('@/pages/HealthCheck'),
  '/supervisor': () => import('@/pages/Supervisor'),
  '/platform-admin': () => import('@/pages/PlatformAdmin'),
};

const prefetched = new Set<string>();

export function prefetchRouteChunk(path: string) {
  if (prefetched.has(path)) return;
  const loader = routeChunkLoaders[path];
  if (!loader) return;
  prefetched.add(path);
  // Fire and forget; failures are silent (real navigation will surface them)
  loader().catch(() => prefetched.delete(path));
}
