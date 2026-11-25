import { createUniqueId } from 'solid-js';
import type { JSX } from '@solidjs/web';

/**
 * The Solid Base mark: a hollow, unstyled layer floating over a solid base. The outline uses
 * `currentColor`, so it follows the surrounding text color in both themes.
 */
export function Logo(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  // Unique per instance: a gradient referenced from another (possibly hidden) logo may not paint.
  const id = createUniqueId();
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id={`${id}-top`} x1="4" y1="14.5" x2="28" y2="26.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#5b3df5" />
          <stop offset="0.5" stop-color="#6c8dff" />
          <stop offset="1" stop-color="#3ee6c8" />
        </linearGradient>
        <linearGradient id={`${id}-left`} x1="4" y1="0" x2="16" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#3a1dd6" />
          <stop offset="1" stop-color="#2a6fd0" />
        </linearGradient>
        <linearGradient id={`${id}-right`} x1="16" y1="0" x2="28" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#2a8fb8" />
          <stop offset="1" stop-color="#1fae99" />
        </linearGradient>
      </defs>
      <path d="M4 20.5 16 14.5 28 20.5V24L16 30 4 24Z" fill={`url(#${id}-left)`} />
      <path d="M16 26.5 28 20.5V24L16 30Z" fill={`url(#${id}-right)`} />
      <path d="M16 14.5 28 20.5 16 26.5 4 20.5Z" fill={`url(#${id}-top)`} />
      <path
        d="M16 2.5 26 7.5 16 12.5 6 7.5Z"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
      />
    </svg>
  );
}
