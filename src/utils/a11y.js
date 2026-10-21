// Gives icon-only buttons an accessible name. Most of the app's icon buttons already have a `title`
// tooltip; screen readers need it as an aria-label too. Runs once and on DOM changes.
const NAME_ATTRS = ['aria-label', 'aria-labelledby'];

function label(root) {
  root.querySelectorAll('button, [role="button"], a').forEach((el) => {
    if (NAME_ATTRS.some((a) => el.hasAttribute(a))) return;
    const text = (el.textContent || '').trim();
    if (text) return;
    const name = el.getAttribute('title') || el.querySelector('img[alt]')?.getAttribute('alt');
    if (name) el.setAttribute('aria-label', name);
  });
}

export function startAccessibilitySync() {
  if (typeof document === 'undefined') return;
  let queued = false;
  const run = () => {
    queued = false;
    label(document.body);
  };
  const schedule = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(run);
    }
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}
