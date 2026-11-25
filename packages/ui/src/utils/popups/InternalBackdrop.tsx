import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';

export interface InternalBackdropProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /**
   * The element to cut out of the backdrop.
   * This is useful for allowing certain elements to be interactive while the backdrop is present.
   */
  cutout?: Element | null | undefined;
  /**
   * Whether the backdrop ignores interaction (rendered while the popup is closing).
   */
  inert?: boolean | undefined;
}

/**
 * A full-viewport, transparent backdrop rendered behind modal popups. It blocks pointer
 * interaction with the page and is marked with `data-base-ui-inert`, so outside-press detection
 * treats it as an element that existed when the popup rendered.
 * @internal
 */
export function InternalBackdrop(props: InternalBackdropProps) {
  const otherProps = omit(props, 'cutout', 'style', 'inert');

  const clipPath = () => {
    const cutout = props.cutout;
    if (!cutout) {
      return undefined;
    }
    const rect = cutout.getBoundingClientRect();
    return `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${rect.left}px ${rect.top}px,${rect.left}px ${rect.bottom}px,${rect.right}px ${rect.bottom}px,${rect.right}px ${rect.top}px,${rect.left}px ${rect.top}px)`;
  };

  return (
    <div
      role="presentation"
      data-base-ui-inert=""
      {...otherProps}
      inert={props.inert}
      style={{
        position: 'fixed',
        inset: '0',
        'user-select': 'none',
        '-webkit-user-select': 'none',
        'clip-path': clipPath(),
      }}
    />
  );
}

export namespace InternalBackdrop {
  export type Props = InternalBackdropProps;
}
