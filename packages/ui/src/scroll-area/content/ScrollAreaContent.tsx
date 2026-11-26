import { createEffect, omit, untrack } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { useScrollAreaViewportContext } from '../viewport/ScrollAreaViewportContext';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { scrollAreaStateAttributesMapping } from '../root/stateAttributes';
import type { ScrollAreaRootState } from '../root/ScrollAreaRoot';
import { createElementRegistration } from '../utils/createElementRegistration';
import { createRefObject } from '@egoist/solid-base-utils/refObject';

/**
 * A container for the content of the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Scroll Area](https://base.egoist.dev/components/scroll-area)
 */
export function ScrollAreaContent(componentProps: ScrollAreaContent.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const { computeThumbPosition } = useScrollAreaViewportContext();
  const { hasMeasuredScrollbar, viewportState } = useScrollAreaRootContext();

  const contentRef = createRefObject<HTMLDivElement | null>(null);
  const registration = createElementRegistration(() => contentRef);
  // Intentionally read once: whether the viewport was measured before this content mounted.
  const computeOnInitialResize = untrack(hasMeasuredScrollbar);

  createEffect(registration.element, (content) => {
    if (typeof ResizeObserver === 'undefined' || !content) {
      return undefined;
    }

    let hasInitialized = false;
    const resizeObserver = new ResizeObserver(() => {
      if (!hasInitialized) {
        hasInitialized = true;

        // ResizeObserver fires once upon observing. Skip that initial call to avoid
        // double-calculating the thumb position on mount, unless the content mounted
        // after the viewport's initial measurement (in which case this fire is what
        // brings the overflow state in sync).
        if (!computeOnInitialResize) {
          return;
        }
      }

      computeThumbPosition();
    });

    resizeObserver.observe(content);

    return () => {
      resizeObserver.disconnect();
    };
  });

  return renderElement('div', componentProps, {
    ref: registration.ref,
    state: viewportState,
    stateAttributesMapping: scrollAreaStateAttributesMapping,
    props: [
      {
        role: 'presentation',
        style: {
          'min-width': 'fit-content',
        },
      },
      elementProps,
    ],
  });
}

export interface ScrollAreaContentState extends ScrollAreaRootState {}

export interface ScrollAreaContentProps extends BaseUIComponentProps<
  'div',
  ScrollAreaContentState
> {}

export namespace ScrollAreaContent {
  export type State = ScrollAreaContentState;
  export type Props = ScrollAreaContentProps;
}
