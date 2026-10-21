import { lazy } from 'react';

const RELOAD_KEY = 'marswalk-chunk-reload-at';

/**
 * React.lazy that survives a failed chunk download. After a redeploy the old chunk files are gone
 * (and browsers cache a failed module import), so the fix is one page reload to fetch the new ones.
 * A timestamp in sessionStorage stops it reloading in a loop; a second failure goes to the error boundary.
 */
export default function lazyWithRetry(factory) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      let last = 0;
      try { last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0; } catch { /* storage blocked */ }
      if (Date.now() - last > 30000) {
        try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* storage blocked */ }
        window.location.reload();
        return new Promise(() => {}); // the reload replaces the page
      }
      throw err;
    }
  });
}
