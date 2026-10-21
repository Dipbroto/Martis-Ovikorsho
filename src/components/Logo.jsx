import { useId } from 'react';

// MarsWalk mark: Mars crossed by a walked trail, cut out as negative space.
// The trail draws itself on first render and again when the parent `.group` is hovered.
export default function Logo({ className = 'w-7 h-7', title }) {
  const maskId = `mw-trail-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 32 32" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <mask id={maskId}>
        <rect width="32" height="32" fill="#fff" />
        <path
          className="mw-logo-trail"
          d="M0 24.5 C7 24.5 9.5 17.5 16 17.5 S 24 9.5 32 9.5"
          pathLength="1"
          fill="none"
          stroke="#000"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </mask>
      <circle cx="16" cy="16" r="15" fill="#F26A3D" mask={`url(#${maskId})`} />
    </svg>
  );
}
