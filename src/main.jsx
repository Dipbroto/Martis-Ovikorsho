import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { startTerrainSync } from './terrain/terrainSync';
import { startAccessibilitySync } from './utils/a11y';

startTerrainSync();
startAccessibilitySync();

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
