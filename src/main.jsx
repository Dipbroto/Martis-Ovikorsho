import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { startTerrainSync } from './terrain/terrainSync';
import { startAccessibilitySync } from './utils/a11y';

startTerrainSync();
startAccessibilitySync();

// A module that fails to download (an update was deployed, the dev server restarted, or the connection
// dropped for a moment) is fixed by one reload. A timestamp stops it reloading in a loop.
const RELOAD_KEY = 'marswalk-chunk-reload-at';
function reloadOnce() {
  let last = 0;
  try { last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0; } catch { /* storage blocked */ }
  if (Date.now() - last < 30000) return false;
  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* storage blocked */ }
  window.location.reload();
  return true;
}
window.addEventListener('vite:preloadError', (e) => { if (reloadOnce()) e.preventDefault(); });
window.addEventListener('unhandledrejection', (e) => {
  const msg = String(e.reason?.message || e.reason || '');
  if (/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(msg) && reloadOnce()) e.preventDefault();
});

// In development, a service worker left over from a production build on the same address would serve old
// files and break hot reloading, so remove it and its caches.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
}

// Offline support (production builds only, so development hot reloading isn't cached)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker not registered:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
window.__bootOk?.();
