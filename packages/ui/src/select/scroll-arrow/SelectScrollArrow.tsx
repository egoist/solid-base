import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useSelectRootContext } from '../root/SelectRootContext';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import type { Side } from '../../internals/anchorPositioning';
import { createTransitionStatus, type TransitionStatus } from '../../internals/transitionStatus';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import { renderElement } from '../../internals/renderElement';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import {
  getMaxScrollOffset,
  normalizeScrollOffset,
  SCROLL_EDGE_TOLERANCE_PX,
} from '../../utils/scrollEdges';

/**
 * @internal
 */
export function SelectScrollArrow(componentProps: SelectScrollArrow.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'direction', 'keepMounted');

  const store = useSelectRootContext();
  const positioner = useSelectPositionerContext();

  const isUp = () => componentProps.direction === 'up';

  // Scroll arrows are disabled for touch modality as they are a hover-only element.
  const visible = () =>
    store.select(isUp() ? 'scrollUpArrowVisible' : 'scrollDownArrowVisible') &&
    store.select('openMethod') !== 'touch';

  const timeout = createTimeout();

  const scrollArrowRef = () =>
    isUp() ? positioner.scrollUpArrowRef : positioner.scrollDownArrowRef;

  const { mounted, transitionStatus, setMounted } = createTransitionStatus(visible);

  store.context.scrollArrowsMountedCountRef.current += 1;
  store.set('hasScrollArrows', true);
  onCleanup(() => {
    store.context.scrollArrowsMountedCountRef.current = Math.max(
      0,
      store.context.scrollArrowsMountedCountRef.current - 1,
    );
    if (store.context.scrollArrowsMountedCountRef.current === 0) {
      store.set('hasScrollArrows', false);
    }
  });

  let element: HTMLDivElement | null = null;

  createOpenChangeComplete({
    open: visible,
    element: () => element,
    onComplete() {
      if (!visible()) {
        setMounted(false);
      }
    },
  });

  const state: SelectScrollArrowState = {
    get direction() {
      return componentProps.direction;
    },
    get visible() {
      return visible();
    },
    get side() {
      return positioner.side;
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  const defaultProps: HTMLProps = {
    'aria-hidden': true,
    get children() {
      return isUp() ? '▲' : '▼';
    },
    style: {
      position: 'absolute',
    },
    onMouseMove(event: MouseEvent) {
      if ((event.movementX === 0 && event.movementY === 0) || timeout.isStarted()) {
        return;
      }

      store.set('activeIndex', null);

      const up = isUp();

      function scrollNextItem() {
        const scroller = store.state.listElement ?? store.state.popupElement;
        if (!scroller) {
          return;
        }

        store.set('activeIndex', null);
        store.context.handleScrollArrowVisibility(scroller);

        const maxScrollTop = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
        const scrollTop = normalizeScrollOffset(scroller.scrollTop, maxScrollTop);
        const isScrolledToEdge = scrollTop === (up ? 0 : maxScrollTop);
        const items = store.context.listRef.current;

        if (scrollTop !== scroller.scrollTop) {
          scroller.scrollTop = scrollTop;
        }

        if (isScrolledToEdge) {
          timeout.clear();
          return;
        }

        if (items.length > 0) {
          const scrollArrowHeight = element?.offsetHeight || 0;
          scroller.scrollTop = getTargetScrollTop(
            items,
            up,
            scrollTop,
            scroller.clientHeight,
            scrollArrowHeight,
            maxScrollTop,
          );
        }

        timeout.start(40, scrollNextItem);
      }

      timeout.start(40, scrollNextItem);
    },
    onMouseLeave() {
      timeout.clear();
    },
  };

  return renderElement('div', componentProps, {
    ref: (el: HTMLDivElement) => {
      element = el;
      scrollArrowRef().current = el;
    },
    state,
    props: [defaultProps, elementProps],
    stateAttributesMapping: transitionStatusMapping,
    enabled: () => mounted() || (componentProps.keepMounted ?? false),
  });
}

export interface SelectScrollArrowState {
  /**
   * The direction of the element.
   */
  direction: 'up' | 'down';
  /**
   * Whether the element is visible.
   */
  visible: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface SelectScrollArrowProps extends BaseUIComponentProps<'div', SelectScrollArrowState> {
  direction: 'up' | 'down';
  /**
   * Whether to keep the HTML element in the DOM while the select popup is not scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace SelectScrollArrow {
  export type State = SelectScrollArrowState;
  export type Props = SelectScrollArrowProps;
}

function getTargetScrollTop(
  items: Array<HTMLElement | null>,
  isUp: boolean,
  scrollTop: number,
  clientHeight: number,
  scrollArrowHeight: number,
  maxScrollTop: number,
) {
  if (isUp) {
    let firstVisibleIndex = 0;
    const visibleTop = scrollTop + scrollArrowHeight - SCROLL_EDGE_TOLERANCE_PX;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item && item.offsetTop >= visibleTop) {
        firstVisibleIndex = i;
        break;
      }
    }

    const targetIndex = Math.max(0, firstVisibleIndex - 1);
    const targetItem = items[targetIndex];
    return targetIndex < firstVisibleIndex && targetItem
      ? normalizeScrollOffset(targetItem.offsetTop - scrollArrowHeight, maxScrollTop)
      : 0;
  }

  let lastVisibleIndex = items.length - 1;
  const visibleBottom = scrollTop + clientHeight - scrollArrowHeight + SCROLL_EDGE_TOLERANCE_PX;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item && item.offsetTop + item.offsetHeight > visibleBottom) {
      lastVisibleIndex = Math.max(0, i - 1);
      break;
    }
  }

  const targetIndex = Math.min(items.length - 1, lastVisibleIndex + 1);
  const targetItem = items[targetIndex];
  return targetIndex > lastVisibleIndex && targetItem
    ? normalizeScrollOffset(
        targetItem.offsetTop + targetItem.offsetHeight - clientHeight + scrollArrowHeight,
        maxScrollTop,
      )
    : maxScrollTop;
}
