import type { JSX } from '@solidjs/web';

/**
 * The Solid Base mark: a solid arch standing on a flat base, carved into an S. It is a single
 * `currentColor` path, so it follows the surrounding text color in both themes.
 */
export function Logo(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M4 28V22H19.75A1.75 1.75 0 0 0 19.75 18.5H4V16A12 12 0 0 1 26.392 10H12.25A1.75 1.75 0 0 0 12.25 13.5H27.737A12 12 0 0 1 28 16V28Z"
      />
    </svg>
  );
}
