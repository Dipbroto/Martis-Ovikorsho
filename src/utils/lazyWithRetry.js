import { lazy } from 'react';

export const CHUNK_RELOAD_KEY = 'marswalk-chunk-reload-at';

export function clearChunkReloadLock() {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* storage blocked */
  }
}

/**
 * Helper to retry module import multiple times before triggering a full page reload.
 * This absorbs transient dev-server HMR rebuilds and momentary connection drops.
 */
async function retryImport(factory, retriesLeft = 2, delayMs = 400) {
  try {
    const mod = await factory();
    // Successfully loaded: clear any previous reload timestamp
    clearChunkReloadLock();
    return mod;
  } catch (err) {
    if (retriesLeft <= 0) {
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return retryImport(factory, retriesLeft - 1, delayMs * 1.5);
  }
}

/**
 * React.lazy that survives a failed chunk download. After a redeploy the old chunk files are gone
 * (and browsers cache a failed module import), so the fix is one page reload to fetch the new ones.
 * A timestamp in sessionStorage stops it reloading in a loop; a second failure goes to the error boundary.
 */
export default function lazyWithRetry(factory) {
  return lazy(async () => {
    try {
      return await retryImport(factory);
    } catch (err) {
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0;
      } catch {
        /* storage blocked */
      }

      // If we haven't reloaded in the last 12 seconds, reload to fetch fresh chunks from the server
      if (Date.now() - last > 12000) {
        try {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
        } catch {
          /* storage blocked */
        }
        window.location.reload();
        return new Promise(() => {}); // Wait for the reload to replace the document
      }

      throw err;
    }
  });
}
