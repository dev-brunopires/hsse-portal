import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { initClientTelemetry, telemetry } from '@/utils/clientTelemetry';

initClientTelemetry();

// Unregister Service Worker + clear caches on Lovable preview / iframe hosts
// to prevent stale "old app" content. Production published domain keeps PWA.
(() => {
  try {
    const isInIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    const host = window.location.hostname;
    const isPreviewHost =
      host.includes('id-preview--') ||
      host.includes('lovableproject.com') ||
      host.endsWith('.lovable.dev');

    if (isPreviewHost || isInIframe) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        }).catch(() => {});
      }
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((n) => caches.delete(n));
        }).catch(() => {});
      }
    }
  } catch {
    // no-op
  }
})();

// Handle chunk loading errors (PWA cache issues) in production only.
// In dev/preview we avoid auto-reload loops.
let didAutoRecover = false;

const isProd = import.meta.env.PROD;

const shouldRecoverFromError = (message: string, assetUrl?: string) => {
  if (!isProd) return false;
  if (didAutoRecover) return false;

  const msg = message.toLowerCase();
  const url = (assetUrl || '').toLowerCase();

  const looksLikeChunk =
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('expected a javascript-or-wasm module script') ||
    msg.includes('strict mime type checking');

  // Only recover when the failing request is clearly a built asset.
  const looksLikeAsset = url.includes('/assets/') || url.endsWith('.js') || url.endsWith('.css');

  return looksLikeChunk && looksLikeAsset;
};

const handleChunkError = async (reason: { message: string; assetUrl?: string }) => {
  if (!shouldRecoverFromError(reason.message, reason.assetUrl)) return;
  didAutoRecover = true;

  telemetry.error('chunk_auto_recover', { message: reason.message, assetUrl: reason.assetUrl });

  // Best-effort: clear caches + unregister service workers, then reload.
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
  } catch (e) {
    telemetry.warn('chunk_auto_recover_cache_clear_failed', { error: String(e) });
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }
  } catch (e) {
    telemetry.warn('chunk_auto_recover_sw_unreg_failed', { error: String(e) });
  }

  window.location.reload();
};

// Script/style load failures
window.addEventListener(
  'error',
  (event) => {
    const target = event.target as any;

    if (target?.tagName === 'SCRIPT') {
      const src = String(target?.src || '');
      void handleChunkError({ message: 'script_load_error', assetUrl: src });
    }

    if (target?.tagName === 'LINK') {
      const href = String(target?.href || '');
      void handleChunkError({ message: 'style_load_error', assetUrl: href });
    }
  },
  true
);

// Dynamic import / module MIME failures
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = typeof reason === 'string' ? reason : (reason?.message ?? 'unknown');

  // Silence expected network failures while offline (e.g. Supabase auth refresh)
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const looksLikeNetwork =
    message.toLowerCase().includes('failed to fetch') ||
    message.toLowerCase().includes('networkerror') ||
    message.toLowerCase().includes('err_internet_disconnected');
  if (isOffline && looksLikeNetwork) {
    event.preventDefault();
    return;
  }

  if (shouldRecoverFromError(message, undefined)) {
    event.preventDefault();
    void handleChunkError({ message });
  }
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
