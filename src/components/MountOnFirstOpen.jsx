import { Suspense, useEffect, useState } from 'react';

/**
 * Defers rendering (and therefore downloading, when `children` is lazy) until `open` is
 * first true. After that the children stay mounted so exit animations still play.
 */
export default function MountOnFirstOpen({ open, children, fallback = null }) {
  const [hasOpened, setHasOpened] = useState(Boolean(open));

  useEffect(() => {
    if (open) setHasOpened(true);
  }, [open]);

  if (!hasOpened && !open) return null;
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
