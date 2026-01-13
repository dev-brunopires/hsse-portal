import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { initClientTelemetry, telemetry } from '@/utils/clientTelemetry';

initClientTelemetry();

// Handle chunk loading errors by clearing caches and reloading
const handleChunkError = async () => {
  telemetry.error('chunk_load_error', { url: window.location.href });
  
  // Clear all caches
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('Caches cleared due to chunk error');
    } catch (e) {
      console.error('Failed to clear caches:', e);
    }
  }
  
  // Unregister service workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('Service workers unregistered');
    } catch (e) {
      console.error('Failed to unregister service workers:', e);
    }
  }
  
  // Force reload
  window.location.reload();
};

// Listen for chunk load errors
window.addEventListener('error', (event) => {
  const target = event.target as HTMLElement;
  if (target?.tagName === 'SCRIPT' || target?.tagName === 'LINK') {
    handleChunkError();
  }
}, true);

// Listen for unhandled module loading errors
window.addEventListener('unhandledrejection', (event) => {
  const reason = String(event.reason || '');
  if (
    reason.includes('Failed to fetch dynamically imported module') ||
    reason.includes('Loading chunk') ||
    reason.includes('MIME type')
  ) {
    event.preventDefault();
    handleChunkError();
  }
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
