import type { JSX } from '@solidjs/web';

/**
 * The Solid Base mark: two solid blocks stacked into an S, the top one rounded on the left and
 * the bottom one on the right. A single `currentColor` path, so it follows the theme.
 */
export function Logo(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M4 9.5A5.5 5.5 0 0 1 9.5 4H26v11H9.5A5.5 5.5 0 0 1 4 9.5ZM6 17h16.5a5.5 5.5 0 0 1 0 11H6Z" />
    </svg>
  );
}
