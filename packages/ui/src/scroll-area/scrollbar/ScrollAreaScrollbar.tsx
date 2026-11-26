import { createEffect, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { scrollAreaStateAttributesMapping } from '../root/stateAttributes';
import type { ScrollAreaRootState } from '../root/ScrollAreaRoot';
import { getOffset } from '../utils/getOffset';
import { createElementRegistration } from '../utils/createElementRegistration';
import { ScrollAreaScrollbarContext } from './ScrollAreaScrollbarContext';
import * as ScrollAreaRootCssVars from '../root/ScrollAreaRootCssVars';
import * as ScrollAreaScrollbarCssVars from './ScrollAreaScrollbarCssVars';

/**
 * A vertical or horizontal scrollbar for the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Scroll Area](https://base.egoist.dev/components/scroll-area)
 */
export function ScrollAreaScrollbar(componentProps: ScrollAreaScrollbar.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'orientation',
    'keepMounted',
  );

  const orientation = () => componentProps.orientation ?? 'vertical';
  const keepMounted = () => componentProps.keepMounted ?? false;

  const {
    hovering,
    scrollingX,
    scrollingY,
    hiddenState,
    scrollbarYRef,
    scrollbarXRef,
    viewportRef,
    thumbYRef,
    thumbXRef,
    handlePointerDown,
    handlePointerUp,
    handleScroll,
    disableViewportSnap,
    rootId,
    thumbSize,
    hasMeasuredScrollbar,
    viewportState,
  } = useScrollAreaRootContext();

  const vertical = () => orientation() === 'vertical';

  const state: ScrollAreaScrollbarState = {
    get scrolling() {
      return vertical() ? scrollingY() : scrollingX();
    },
    get hasOverflowX() {
      return viewportState.hasOverflowX;
    },
    get hasOverflowY() {
      return viewportState.hasOverflowY;
    },
    get overflowXStart() {
      return viewportState.overflowXStart;
    },
    get overflowXEnd() {
      return viewportState.overflowXEnd;
    },
    get overflowYStart() {
      return viewportState.overflowYStart;
    },
    get overflowYEnd() {
      return viewportState.overflowYEnd;
    },
    get cornerHidden() {
      return viewportState.cornerHidden;
    },
    get hovering() {
      return hovering();
    },
    get orientation() {
      return orientation();
    },
  };

  const direction = useDirection();
  const hideTrackUntilMeasured = () => !hasMeasuredScrollbar() && !keepMounted();
  const isHidden = () => (vertical() ? hiddenState().y : hiddenState().x);
  const shouldRender = () => keepMounted() || !isHidden();

  const registration = createElementRegistration<HTMLDivElement>(
    () => (vertical() ? scrollbarYRef : scrollbarXRef),
    shouldRender,
  );

  createEffect(
    () => {
      const scrollbarEl = registration.element();
      return scrollbarEl && shouldRender() ? { scrollbarEl, horizontal: !vertical() } : null;
    },
    (target) => {
      if (!target) {
        return undefined;
      }
      const { scrollbarEl, horizontal } = target;

      function handleWheel(event: WheelEvent) {
        const viewportEl = viewportRef.current;
        if (!viewportEl || event.ctrlKey) {
          return;
        }

        const scrollProperty = horizontal ? 'scrollLeft' : 'scrollTop';
        const delta = horizontal ? event.deltaX : event.deltaY;
        if (delta === 0) {
          return;
        }

        const isRtl = direction() === 'rtl';
        const maxScroll = horizontal
          ? viewportEl.scrollWidth - viewportEl.clientWidth
          : viewportEl.scrollHeight - viewportEl.clientHeight;
        // RTL horizontal scrolling uses a negative `scrollLeft` range, from 0 to `-maxScroll`.
        const minScroll = horizontal && isRtl ? -maxScroll : 0;
        const maxScrollValue = horizontal && isRtl ? 0 : maxScroll;
        const scrollValue = viewportEl[scrollProperty];

        // At an edge (or with no overflow), let the wheel event chain to the
        // parent/page instead of swallowing it via `preventDefault`.
        if (
          (scrollValue <= minScroll && delta < 0) ||
          (scrollValue >= maxScrollValue && delta > 0)
        ) {
          return;
        }

        event.preventDefault();

        viewportEl[scrollProperty] = Math.min(
          maxScrollValue,
          Math.max(minScroll, scrollValue + delta),
        );

        handleScroll({ x: viewportEl.scrollLeft, y: viewportEl.scrollTop });
      }

      return addEventListener(scrollbarEl, 'wheel', handleWheel, { passive: false });
    },
  );

  const props: HTMLProps = {
    get 'data-id'() {
      return `${rootId()}-scrollbar`;
    },
    'aria-hidden': 'true',
    onPointerDown(event: PointerEvent & { currentTarget: HTMLDivElement }) {
      if (event.button !== 0) {
        return;
      }

      const isVertical = vertical();
      const target = getTarget(event) as Element | null;
      const thumbEl = isVertical ? thumbYRef.current : thumbXRef.current;

      // Ignore clicks on thumb, including cases where the event is retargeted to the track host
      // across a shadow boundary.
      if (thumbEl && contains(thumbEl, target)) {
        return;
      }

      const viewportEl = viewportRef.current;
      if (!viewportEl) {
        return;
      }

      const scrollbarEl = isVertical ? scrollbarYRef.current : scrollbarXRef.current;

      if (!thumbEl || !scrollbarEl) {
        return;
      }

      const axis = isVertical ? 'y' : 'x';
      const thumbOffset = getOffset(thumbEl, 'margin', axis);
      const scrollbarOffset = getOffset(scrollbarEl, 'padding', axis);
      const thumbSizePx = isVertical ? thumbEl.offsetHeight : thumbEl.offsetWidth;
      const trackRect = scrollbarEl.getBoundingClientRect();
      const clickPosition = isVertical
        ? event.clientY - trackRect.top - thumbSizePx / 2 - scrollbarOffset + thumbOffset / 2
        : event.clientX - trackRect.left - thumbSizePx / 2 - scrollbarOffset + thumbOffset / 2;

      const scrollableSize = isVertical ? viewportEl.scrollHeight : viewportEl.scrollWidth;
      const viewportSize = isVertical ? viewportEl.clientHeight : viewportEl.clientWidth;
      const trackSize = isVertical ? scrollbarEl.offsetHeight : scrollbarEl.offsetWidth;

      const maxThumbOffset = trackSize - thumbSizePx - scrollbarOffset - thumbOffset;
      // A short or heavily padded track can drive `maxThumbOffset` to zero or
      // negative once the thumb hits its `MIN_THUMB_SIZE` floor. Dividing by it
      // would yield a non-finite (`Infinity`/`NaN`) or inverted scroll position.
      if (maxThumbOffset <= 0) {
        return;
      }

      const scrollRatio = clickPosition / maxThumbOffset;
      const maxScrollDistance = scrollableSize - viewportSize;

      // Disable snapping before the jump-to-click assignment, or the
      // assigned position quantizes to the nearest snap point and the thumb
      // stays offset from the pointer for the whole drag. `handlePointerDown`
      // below re-runs this as a guarded no-op for the thumb-drag path.
      disableViewportSnap();

      if (isVertical) {
        viewportEl.scrollTop = scrollRatio * maxScrollDistance;
      } else if (direction() === 'rtl') {
        viewportEl.scrollLeft = -(1 - scrollRatio) * maxScrollDistance;
      } else {
        viewportEl.scrollLeft = scrollRatio * maxScrollDistance;
      }

      handleScroll({ x: viewportEl.scrollLeft, y: viewportEl.scrollTop });

      handlePointerDown(event);
    },
    // Native scrollbars don't move focus when pressed, whichever button is used.
    // Handled here rather than on the thumb so the bubbled press covers both.
    onMouseDown(event: MouseEvent) {
      event.preventDefault();
    },
    onPointerUp: handlePointerUp,
    // Mirror `onPointerUp` so a browser-cancelled gesture on the track (no thumb
    // child captures the pointer) still clears the drag state.
    onPointerCancel: handlePointerUp,
    get style(): JSX.CSSProperties {
      const base: JSX.CSSProperties = {
        position: 'absolute',
        'touch-action': 'none',
        '-webkit-user-select': 'none',
        'user-select': 'none',
        visibility: hideTrackUntilMeasured() ? 'hidden' : undefined,
      };
      if (vertical()) {
        return {
          ...base,
          top: '0px',
          bottom: `var(${ScrollAreaRootCssVars.scrollAreaCornerHeight})`,
          'inset-inline-end': '0px',
          [ScrollAreaScrollbarCssVars.scrollAreaThumbHeight]: `${thumbSize().height}px`,
        };
      }
      return {
        ...base,
        'inset-inline-start': '0px',
        'inset-inline-end': `var(${ScrollAreaRootCssVars.scrollAreaCornerWidth})`,
        bottom: '0px',
        [ScrollAreaScrollbarCssVars.scrollAreaThumbWidth]: `${thumbSize().width}px`,
      };
    },
  };

  return (
    <ScrollAreaScrollbarContext value={orientation}>
      {renderElement('div', componentProps, {
        ref: registration.ref,
        state,
        props: [props, elementProps],
        stateAttributesMapping: scrollAreaStateAttributesMapping,
        enabled: shouldRender,
      })}
    </ScrollAreaScrollbarContext>
  );
}

export interface ScrollAreaScrollbarState extends ScrollAreaRootState {
  /**
   * Whether the scroll area is being hovered.
   */
  hovering: boolean;
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * The orientation of the scrollbar.
   */
  orientation: 'vertical' | 'horizontal';
}

export interface ScrollAreaScrollbarProps extends BaseUIComponentProps<
  'div',
  ScrollAreaScrollbarState
> {
  /**
   * Whether the scrollbar controls vertical or horizontal scroll.
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal' | undefined;
  /**
   * Whether to keep the HTML element in the DOM when the viewport isn't scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace ScrollAreaScrollbar {
  export type State = ScrollAreaScrollbarState;
  export type Props = ScrollAreaScrollbarProps;
}
