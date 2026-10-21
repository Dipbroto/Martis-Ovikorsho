import { useEffect } from 'react';

/** Calls `onClose` when the user clicks outside `ref` (or every ref in an array) or presses Escape while `open` is true. */
export default function useDismiss(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      const refs = Array.isArray(ref) ? ref : [ref];
      if (refs.every((r) => r.current && !r.current.contains(e.target))) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, onClose]);
}
