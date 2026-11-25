import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { useScrollAreaScrollbarContext } from '../scrollbar/ScrollAreaScrollbarContext';
import { createElementRegistration } from '../utils/createElementRegistration';

/**
 * The draggable part of the scrollbar that indicates the current scroll position.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area)
 */
export function ScrollAreaThumb(componentProps: ScrollAreaThumb.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const {
    thumbYRef,
    thumbXRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    scrollingX,
    scrollingY,
    hasMeasuredScrollbar,
  } = useScrollAreaRootContext();

  const orientation = useScrollAreaScrollbarContext();
  const vertical = () => orientation() === 'vertical';

  const registration = createElementRegistration<HTMLDivElement>(() =>
    vertical() ? thumbYRef : thumbXRef,
  );

  const state: ScrollAreaThumbState = {
    get scrolling() {
      return vertical() ? scrollingY() : scrollingX();
    },
    get orientation() {
      return orientation();
    },
  };

  return renderElement('div', componentProps, {
    ref: registration.ref,
    state,
    props: [
      {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerUp,
        get style(): JSX.CSSProperties {
          return {
            visibility: hasMeasuredScrollbar() ? undefined : 'hidden',
            ...(vertical()
              ? { height: 'var(--scroll-area-thumb-height)' }
              : { width: 'var(--scroll-area-thumb-width)' }),
          };
        },
      },
      elementProps,
    ],
  });
}

export interface ScrollAreaThumbState {
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * The component orientation.
   */
  orientation: 'horizontal' | 'vertical';
}

export interface ScrollAreaThumbProps extends BaseUIComponentProps<'div', ScrollAreaThumbState> {}

export namespace ScrollAreaThumb {
  export type State = ScrollAreaThumbState;
  export type Props = ScrollAreaThumbProps;
}
