import { createEffect, createMemo, createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import { contains } from '@egoist/solid-base-utils/shadowDom';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import { fastObjectShallowCompare } from '@egoist/solid-base-utils/fastObjectShallowCompare';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { createBaseUiId } from '../../internals/baseUiId';
import { useCSPContext } from '../../internals/csp-context/CSPContext';
import { styleDisableScrollbar } from '../../utils/styles';
import { ScrollAreaRootContext } from './ScrollAreaRootContext';
import { SCROLL_TIMEOUT } from '../constants';
import { getOffset } from '../utils/getOffset';
import { scrollAreaStateAttributesMapping } from './stateAttributes';
import * as ScrollAreaRootCssVars from './ScrollAreaRootCssVars';
import * as ScrollAreaScrollbarDataAttributes from '../scrollbar/ScrollAreaScrollbarDataAttributes';

const DEFAULT_COORDS: Coords = { x: 0, y: 0 };
const DEFAULT_SIZE: Size = { width: 0, height: 0 };
const DEFAULT_OVERFLOW_EDGES: OverflowEdges = {
  xStart: false,
  xEnd: false,
  yStart: false,
  yEnd: false,
};
const DEFAULT_HIDDEN_STATE: HiddenState = { x: true, y: true, corner: true };

// Measurements are recomputed on every scroll frame: only notify when a value actually changed.
const SHALLOW = { equals: fastObjectShallowCompare };

export interface HiddenState {
  x: boolean;
  y: boolean;
  corner: boolean;
}
export interface OverflowEdges<T = boolean> {
  xStart: T;
  xEnd: T;
  yStart: T;
  yEnd: T;
}
export interface Size {
  width: number;
  height: number;
}
export interface Coords {
  x: number;
  y: number;
}

/**
 * Groups all parts of the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Scroll Area](https://base.egoist.dev/components/scroll-area)
 */
export function ScrollAreaRoot(componentProps: ScrollAreaRoot.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'overflowEdgeThreshold');

  const overflowEdgeThreshold = createMemo(
    () => normalizeOverflowEdgeThreshold(componentProps.overflowEdgeThreshold),
    SHALLOW,
  );

  const rootId = createBaseUiId();

  const scrollYTimeout = createTimeout();
  const scrollXTimeout = createTimeout();

  const csp = useCSPContext();

  const [hovering, setHovering] = createSignal(false);
  const [scrollingX, setScrollingX] = createSignal(false);
  const [scrollingY, setScrollingY] = createSignal(false);
  const [touchModality, setTouchModality] = createSignal(false);
  const [hasMeasuredScrollbar, setHasMeasuredScrollbar] = createSignal(false);
  const [cornerSize, setCornerSize] = createSignal<Size>(DEFAULT_SIZE, SHALLOW);
  const [thumbSize, setThumbSize] = createSignal<Size>(DEFAULT_SIZE, SHALLOW);
  const [overflowEdges, setOverflowEdges] = createSignal<OverflowEdges>(
    DEFAULT_OVERFLOW_EDGES,
    SHALLOW,
  );
  const [hiddenState, setHiddenState] = createSignal<HiddenState>(DEFAULT_HIDDEN_STATE, SHALLOW);

  let rootElement: HTMLDivElement | null = null;
  const viewportRef = createRefObject<HTMLDivElement | null>(null);
  const scrollbarYRef = createRefObject<HTMLDivElement | null>(null);
  const scrollbarXRef = createRefObject<HTMLDivElement | null>(null);
  const thumbYRef = createRefObject<HTMLDivElement | null>(null);
  const thumbXRef = createRefObject<HTMLDivElement | null>(null);
  const cornerRef = createRefObject<HTMLDivElement | null>(null);

  let activePointerId: number | null = null;
  let startY = 0;
  let startX = 0;
  let startScrollTop = 0;
  let startScrollLeft = 0;
  let currentOrientation: 'vertical' | 'horizontal' = 'vertical';
  let scrollPosition = DEFAULT_COORDS;
  let savedSnapType: string | null = null;

  function startScrolling(vertical: boolean) {
    const setScrolling = vertical ? setScrollingY : setScrollingX;
    const timeout = vertical ? scrollYTimeout : scrollXTimeout;

    setScrolling(true);
    timeout.start(SCROLL_TIMEOUT, () => {
      setScrolling(false);
    });
  }

  function handleScroll(nextScrollPosition: Coords) {
    const offsetX = nextScrollPosition.x - scrollPosition.x;
    const offsetY = nextScrollPosition.y - scrollPosition.y;

    scrollPosition = nextScrollPosition;

    if (offsetY !== 0) {
      startScrolling(true);
    }

    if (offsetX !== 0) {
      startScrolling(false);
    }
  }

  // CSS scroll snap forces every programmatic scroll to land on a snap
  // point, making thumb dragging jump between snap points. Native
  // scrollbars suppress snapping while dragging, so disable it until the
  // pointer is released; restoring the value re-snaps the viewport. The
  // save is guarded so a second pointer during an active drag can't
  // clobber the saved value with `none`.
  function disableViewportSnap() {
    const viewportEl = viewportRef.current;
    if (viewportEl && savedSnapType === null) {
      savedSnapType = viewportEl.style.scrollSnapType;
      viewportEl.style.scrollSnapType = 'none';
    }
  }

  function getActiveThumb() {
    return currentOrientation === 'vertical' ? thumbYRef.current : thumbXRef.current;
  }

  function handlePointerDown(event: PointerEvent & { currentTarget: Element }) {
    if (event.button !== 0) {
      return;
    }

    if (activePointerId !== null) {
      // A live drag holds capture for the active pointer — ignore other pointers.
      // No capture means the release went missing entirely (silent capture drop
      // with an id that never reappears, e.g. a lost touch contact), so let the
      // new pointer take over the latch instead of leaving dragging dead.
      if (getActiveThumb()?.hasPointerCapture(activePointerId)) {
        return;
      }
    }

    activePointerId = event.pointerId;
    startY = event.clientY;
    startX = event.clientX;
    currentOrientation = event.currentTarget.getAttribute(
      ScrollAreaScrollbarDataAttributes.orientation,
    ) as 'vertical' | 'horizontal';

    const viewportEl = viewportRef.current;
    if (viewportEl) {
      startScrollTop = viewportEl.scrollTop;
      startScrollLeft = viewportEl.scrollLeft;
      disableViewportSnap();
    }

    getActiveThumb()?.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: PointerEvent) {
    if (event.pointerId !== activePointerId) {
      return;
    }

    activePointerId = null;
    // Clear the drag's scrolling state immediately rather than waiting for the
    // `SCROLL_TIMEOUT` timer armed by the last drag move, so every release path
    // (real, `pointercancel`, or the missed-release fallback) behaves the same.
    (currentOrientation === 'vertical' ? setScrollingY : setScrollingX)(false);

    if (savedSnapType !== null) {
      if (viewportRef.current) {
        viewportRef.current.style.scrollSnapType = savedSnapType;
      }
      savedSnapType = null;
    }

    const thumb = getActiveThumb();
    // `pointercancel` releases capture implicitly, so guard against releasing a
    // capture we no longer hold (which would throw).
    if (thumb?.hasPointerCapture(event.pointerId)) {
      thumb.releasePointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: PointerEvent) {
    if (event.pointerId !== activePointerId) {
      return;
    }

    // The release can go missing entirely (e.g. the browser drops pointer
    // capture while the scrollbar is hidden mid-drag), leaving the drag
    // latched so a buttonless hover over the thumb scrolls the viewport.
    // Treat a move without the primary button held (`buttons` bit 1 unset)
    // as the missed release.
    if (event.buttons % 2 === 0) {
      handlePointerUp(event);
      return;
    }

    const viewportEl = viewportRef.current;
    if (!viewportEl) {
      return;
    }

    const vertical = currentOrientation === 'vertical';
    const thumbEl = vertical ? thumbYRef.current : thumbXRef.current;
    const scrollbarEl = vertical ? scrollbarYRef.current : scrollbarXRef.current;
    if (!thumbEl || !scrollbarEl) {
      return;
    }

    const axis = vertical ? 'y' : 'x';
    const scrollbarOffset = getOffset(scrollbarEl, 'padding', axis);
    const thumbOffset = getOffset(thumbEl, 'margin', axis);
    const thumbSizePx = vertical ? thumbEl.offsetHeight : thumbEl.offsetWidth;
    const trackSize = vertical ? scrollbarEl.offsetHeight : scrollbarEl.offsetWidth;
    const maxThumbOffset = trackSize - thumbSizePx - scrollbarOffset - thumbOffset;
    // A short or heavily padded track can drive `maxThumbOffset` to zero or
    // negative once the thumb hits its `MIN_THUMB_SIZE` floor. Dividing by it
    // would yield a non-finite (`Infinity`/`NaN`) or inverted scroll position.
    const delta = vertical ? event.clientY - startY : event.clientX - startX;
    const scrollRatio = maxThumbOffset <= 0 ? 0 : delta / maxThumbOffset;

    const scrollableSize = vertical ? viewportEl.scrollHeight : viewportEl.scrollWidth;
    const viewportSize = vertical ? viewportEl.clientHeight : viewportEl.clientWidth;
    const startScroll = vertical ? startScrollTop : startScrollLeft;
    const nextScroll = startScroll + scrollRatio * (scrollableSize - viewportSize);

    if (vertical) {
      viewportEl.scrollTop = nextScroll;
    } else {
      viewportEl.scrollLeft = nextScroll;
    }
    event.preventDefault();

    startScrolling(vertical);
  }

  function handleTouchModalityChange(event: PointerEvent) {
    setTouchModality(event.pointerType === 'touch');
  }

  function handlePointerEnterOrMove(event: PointerEvent) {
    handleTouchModalityChange(event);

    if (event.pointerType !== 'touch') {
      setHovering(contains(rootElement, event.target as Element));
    }
  }

  createEffect(
    () => (csp.disableStyleElements ? null : { nonce: csp.nonce }),
    (styles) => {
      if (styles) {
        styleDisableScrollbar.inject(rootElement, styles.nonce);
      }
    },
  );

  const state: ScrollAreaRootState = {
    get scrolling() {
      return scrollingX() || scrollingY();
    },
    get hasOverflowX() {
      return !hiddenState().x;
    },
    get hasOverflowY() {
      return !hiddenState().y;
    },
    get overflowXStart() {
      return overflowEdges().xStart;
    },
    get overflowXEnd() {
      return overflowEdges().xEnd;
    },
    get overflowYStart() {
      return overflowEdges().yStart;
    },
    get overflowYEnd() {
      return overflowEdges().yEnd;
    },
    get cornerHidden() {
      return hiddenState().corner;
    },
  };

  const props: HTMLProps = {
    role: 'presentation',
    onPointerEnter: handlePointerEnterOrMove,
    onPointerMove: handlePointerEnterOrMove,
    onPointerDown: handleTouchModalityChange,
    onPointerLeave() {
      setHovering(false);
    },
    get style(): JSX.CSSProperties {
      return {
        position: 'relative',
        [ScrollAreaRootCssVars.scrollAreaCornerHeight]: `${cornerSize().height}px`,
        [ScrollAreaRootCssVars.scrollAreaCornerWidth]: `${cornerSize().width}px`,
      };
    },
  };

  const contextValue: ScrollAreaRootContext = {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleScroll,
    disableViewportSnap,
    cornerSize,
    setCornerSize,
    thumbSize,
    setThumbSize,
    hasMeasuredScrollbar,
    setHasMeasuredScrollbar,
    touchModality,
    cornerRef,
    scrollingX,
    scrollingY,
    hovering,
    setHovering,
    viewportRef,
    scrollbarYRef,
    scrollbarXRef,
    thumbYRef,
    thumbXRef,
    rootId,
    hiddenState,
    setHiddenState,
    overflowEdges,
    setOverflowEdges,
    viewportState: state,
    overflowEdgeThreshold,
  };

  return (
    <ScrollAreaRootContext value={contextValue}>
      {renderElement('div', componentProps, {
        state,
        ref: (element: HTMLDivElement) => {
          rootElement = element;
        },
        props: [props, elementProps],
        stateAttributesMapping: scrollAreaStateAttributesMapping,
      })}
    </ScrollAreaRootContext>
  );
}

export interface ScrollAreaRootState {
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * Whether horizontal overflow is present.
   */
  hasOverflowX: boolean;
  /**
   * Whether vertical overflow is present.
   */
  hasOverflowY: boolean;
  /**
   * Whether there is overflow on the inline start side for the horizontal axis.
   */
  overflowXStart: boolean;
  /**
   * Whether there is overflow on the inline end side for the horizontal axis.
   */
  overflowXEnd: boolean;
  /**
   * Whether there is overflow on the block start side.
   */
  overflowYStart: boolean;
  /**
   * Whether there is overflow on the block end side.
   */
  overflowYEnd: boolean;
  /**
   * Whether the scrollbar corner is hidden.
   */
  cornerHidden: boolean;
}

export interface ScrollAreaRootProps extends BaseUIComponentProps<'div', ScrollAreaRootState> {
  /**
   * The threshold in pixels that must be passed before the overflow edge attributes are applied.
   * Accepts a single number for all edges or an object to configure them individually.
   * @default 0
   */
  overflowEdgeThreshold?: number | Partial<OverflowEdges<number>> | undefined;
}

export namespace ScrollAreaRoot {
  export type State = ScrollAreaRootState;
  export type Props = ScrollAreaRootProps;
}

function normalizeOverflowEdgeThreshold(
  threshold: ScrollAreaRoot.Props['overflowEdgeThreshold'] | undefined,
): OverflowEdges<number> {
  const thresholds =
    typeof threshold === 'number'
      ? { xStart: threshold, xEnd: threshold, yStart: threshold, yEnd: threshold }
      : threshold;

  return {
    xStart: Math.max(0, thresholds?.xStart || 0),
    xEnd: Math.max(0, thresholds?.xEnd || 0),
    yStart: Math.max(0, thresholds?.yStart || 0),
    yEnd: Math.max(0, thresholds?.yEnd || 0),
  };
}
