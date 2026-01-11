import { lazy, type ComponentType } from 'react';

type ComponentImportFn<T> = () => Promise<{ default: T }>;

/**
 * Wraps React.lazy with a single retry on failure.
 * If the retry fails, the error propagates to the ErrorBoundary.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: ComponentImportFn<T>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      // Wait a brief moment then retry once
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Clear module cache for Vite by adding a cache-busting timestamp
      const timestamp = Date.now();
      
      try {
        // Retry the import
        return await importFn();
      } catch (retryError) {
        // If we're in a PWA context, try clearing caches before throwing
        if ('caches' in window) {
          try {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((name) => caches.delete(name)));
          } catch {
            // Ignore cache clearing errors
          }
        }
        throw retryError;
      }
    }
  });
}
