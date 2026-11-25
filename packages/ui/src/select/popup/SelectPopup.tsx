import { createEffect, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { rectToClientRect, type ClientRectObject } from '@floating-ui/utils';
import { platform as floatingPlatform } from '@floating-ui/dom';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { platform } from '@egoist/solid-base-utils/platform';
import { ownerDocument, ownerWindow } from '@egoist/solid-base-utils/owner';
import { createAnimationFrame } from '@egoist/solid-base-utils/animationFrame';
import { clamp } from '@egoist/solid-base-utils/clamp';
import { FloatingFocusManager, type FocusTargetProp } from '../../utils/popups/focus/FloatingFocusManager';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useSelectRootContext } from '../root/SelectRootContext';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import type { Side, Align } from '../../internals/anchorPositioning';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { styleDisableScrollbar } from '../../utils/styles';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import { renderElement } from '../../internals/renderElement';
import { clearStyles, LIST_FUNCTIONAL_STYLES } from './utils';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { getMaxScrollOffset, SCROLL_EDGE_TOLERANCE_PX } from '../../utils/scrollEdges';
import { useCSPContext } from '../../internals/csp-context/CSPContext';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';
import * as SelectPositionerCssVars from '../positioner/SelectPositionerCssVars';

/**
 * A container for the select list.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectPopup(componentProps: SelectPopup.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'finalFocus');

  const store = useSelectRootContext();
  const positioner = useSelectPositionerContext();
  const insideToolbar = useToolbarRootContext(true) != null;
  const direction = useDirection();
  const csp = useCSPContext();

  const open = () => store.select('open');
  const mounted = () => store.select('mounted');
  const listElement = () => store.select('listElement');
  const positionerElement = () => store.select('positionerElement');
  const popupElement = () => store.select('popupElement');
  const alignItemWithTriggerActive = () => positioner.alignItemWithTriggerActive;

  let reachedMaxHeight = false;
  let initialPlaced = false;
  let originalPositionerStyles: Record<string, string> = {};

  const scrollArrowFrame = createAnimationFrame();

  function handleScroll(scroller: HTMLDivElement) {
    const positionerEl = store.state.positionerElement;
    const popupEl = store.state.popupElement;
    if (!positionerEl || !popupEl || !initialPlaced) {
      return;
    }

    const isTopPositioned = positionerEl.style.top === '0px';
    const isBottomPositioned = positionerEl.style.bottom === '0px';

    if (
      reachedMaxHeight ||
      !untrack(alignItemWithTriggerActive) ||
      (!isTopPositioned && !isBottomPositioned)
    ) {
      store.context.handleScrollArrowVisibility(scroller);
      return;
    }

    const scale = getScale(positionerEl);
    const currentHeight = normalizeSize(positionerEl.getBoundingClientRect().height, 'y', scale);
    const doc = ownerDocument(positionerEl);
    const win = ownerWindow(positionerEl);
    const positionerStyles = win.getComputedStyle(positionerEl);
    const marginTop = parseFloat(positionerStyles.marginTop);
    const marginBottom = parseFloat(positionerStyles.marginBottom);
    const maxPopupHeight = getMaxPopupHeight(win.getComputedStyle(popupEl));
    const maxAvailableHeight = Math.min(
      doc.documentElement.clientHeight - marginTop - marginBottom,
      maxPopupHeight,
    );

    const scrollTop = scroller.scrollTop;
    const maxScrollTop = getMaxScrollTop(scroller);

    // `Infinity` requests a scroll to the recomputed maximum offset.
    let nextScrollTop: number | null = null;

    const setHeight = (height: number) => {
      positionerEl.style.height = `${height}px`;
    };

    const diff = isTopPositioned ? maxScrollTop - scrollTop : scrollTop;
    const nextHeight = Math.min(currentHeight + diff, maxAvailableHeight);

    if (diff <= SCROLL_EDGE_TOLERANCE_PX) {
      const heightDelta = clamp(diff, 0, maxAvailableHeight - currentHeight);
      if (heightDelta > 0) {
        // Consume the remaining scroll in height.
        setHeight(currentHeight + heightDelta);
      }
      scroller.scrollTop = isTopPositioned ? maxScrollTop : 0;
      if (maxAvailableHeight - (currentHeight + heightDelta) <= SCROLL_EDGE_TOLERANCE_PX) {
        reachedMaxHeight = true;
      }
      store.context.handleScrollArrowVisibility(scroller);
      return;
    }

    if (maxAvailableHeight - nextHeight > SCROLL_EDGE_TOLERANCE_PX) {
      nextScrollTop = isTopPositioned ? Infinity : 0;
    } else if (isBottomPositioned && scrollTop < maxScrollTop) {
      const overshoot = currentHeight + diff - maxAvailableHeight;
      nextScrollTop = scrollTop - (diff - overshoot);
    }

    const nextPositionerHeight = Math.ceil(nextHeight);

    if (nextPositionerHeight !== 0) {
      setHeight(nextPositionerHeight);
    }

    if (nextScrollTop != null) {
      // Recompute bounds after resizing (clientHeight likely changed).
      const target = clamp(nextScrollTop, 0, getMaxScrollTop(scroller));

      // Avoid adjustments that re-trigger scroll events forever.
      if (Math.abs(scroller.scrollTop - target) > SCROLL_EDGE_TOLERANCE_PX) {
        scroller.scrollTop = target;
      }
    }

    if (nextPositionerHeight >= maxAvailableHeight - SCROLL_EDGE_TOLERANCE_PX) {
      reachedMaxHeight = true;
    }

    store.context.handleScrollArrowVisibility(scroller);
  }

  store.context.scrollHandlerRef.current = handleScroll;
  onCleanup(() => {
    if (store.context.scrollHandlerRef.current === handleScroll) {
      store.context.scrollHandlerRef.current = null;
    }
  });

  createOpenChangeComplete({
    open,
    element: popupElement,
    onComplete() {
      if (store.state.openProp ?? store.state.open) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const state: SelectPopupState = {
    get open() {
      return open();
    },
    get transitionStatus() {
      return store.select('transitionStatus');
    },
    get side() {
      return positioner.side;
    },
    get align() {
      return positioner.align;
    },
  };

  createEffect(
    () => [positionerElement(), popupElement()] as const,
    ([positionerEl, popupEl]) => {
      if (!positionerEl || !popupEl || Object.keys(originalPositionerStyles).length) {
        return;
      }

      originalPositionerStyles = {
        top: positionerEl.style.top || '0',
        left: positionerEl.style.left || '0',
        right: positionerEl.style.right,
        height: positionerEl.style.height,
        bottom: positionerEl.style.bottom,
        'min-height': positionerEl.style.minHeight,
        'max-height': positionerEl.style.maxHeight,
        'margin-top': positionerEl.style.marginTop,
        'margin-bottom': positionerEl.style.marginBottom,
      };
    },
  );

  createEffect(
    () => [open(), alignItemWithTriggerActive(), positionerElement()] as const,
    ([isOpen, active, positionerEl]) => {
      if (isOpen || active) {
        return;
      }

      initialPlaced = false;
      reachedMaxHeight = false;
      clearStyles(positionerEl, originalPositionerStyles);
    },
  );

  // Whether the measurement below fell back from aligning the item with the trigger while the
  // popup is mounted (it then tells the positioner). The measurement keeps its own record rather
  // than reacting to the positioner's state, which its own decision changes.
  let fellBackFromAlignment = false;

  createEffect(mounted, (isMounted) => {
    if (!isMounted) {
      fellBackFromAlignment = false;
    }
  });

  // Places the popup once Floating UI has positioned it. Measures the DOM, so it reads the
  // current state when it runs rather than taking the tracked values as an argument.
  createEffect(
    () =>
      [
        open(),
        store.select('triggerElement'),
        positionerElement(),
        popupElement(),
        positioner.alignItemWithTriggerRequested,
        positioner.isPositioned,
        listElement(),
        store.select('highlightItemOnHover'),
        direction(),
      ] as const,
    () => untrack(placePopup),
  );

  function placePopup() {
    const triggerElement = store.select('triggerElement');
    const positionerEl = positionerElement();
    const popupEl = popupElement();
    const listEl = listElement();
    const active = positioner.alignItemWithTriggerRequested && !fellBackFromAlignment;

    // Wait for Floating UI's first positioning pass before reading DOM geometry.
    // We replace the final coordinates for aligned selects, but still need middleware
    // like `size()` to set CSS variables such as `--anchor-width`.
    if (
      !open() ||
      !triggerElement ||
      !positionerEl ||
      !popupEl ||
      (active && !positioner.isPositioned) ||
      store.state.transitionStatus === 'ending'
    ) {
      return;
    }

    initialPlaced = true;
    popupEl.style.removeProperty(SelectPositionerCssVars.transformOrigin);

    if (!active) {
      requestScrollArrowVisibility(listEl || popupEl);
      return;
    }

    const highlightItemOnHover = store.select('highlightItemOnHover');
    const dir = direction();

    // Ensure we remove any transforms that can affect the location of the popup
    // and therefore the calculations.
    const restoreTransformStyles = unsetTransformStyles(popupEl);

    try {
      let textElement = store.context.selectedItemTextRef.current;

      if (!textElement?.isConnected) {
        const hasSelectedValue = store.select('hasSelectedValue');
        textElement =
          !hasSelectedValue && store.context.firstItemTextRef.current?.isConnected
            ? store.context.firstItemTextRef.current
            : null;
      }

      const valueElement = store.context.valueRef.current;

      const win = ownerWindow(positionerEl);
      const positionerStyles = win.getComputedStyle(positionerEl);
      const popupStyles = win.getComputedStyle(popupEl);

      const doc = ownerDocument(triggerElement);
      const scale = getScale(triggerElement);
      const triggerRect = normalizeRect(triggerElement.getBoundingClientRect(), scale);

      const positionerRect = normalizeRect(positionerEl.getBoundingClientRect(), scale);
      const triggerHeight = triggerRect.height;
      const scroller = listEl || popupEl;
      const scrollHeight = scroller.scrollHeight;

      const borderBottom = parseFloat(popupStyles.borderBottomWidth);
      // The `|| N` fallbacks cover an unset/`auto` value (parses to `NaN`). Note a literal `0`
      // also resolves to the fallback, so an explicit `margin: 0` or `min-height: 0` still takes
      // the default below.
      const marginTop = parseFloat(positionerStyles.marginTop) || 10;
      const marginBottom = parseFloat(positionerStyles.marginBottom) || 10;
      const minHeight = parseFloat(positionerStyles.minHeight) || 100;
      const maxPopupHeight = getMaxPopupHeight(popupStyles);

      const paddingLeft = 5;
      const paddingRight = 5;
      const triggerCollisionThreshold = 20;

      const viewportHeight = doc.documentElement.clientHeight - marginTop - marginBottom;
      const viewportWidth = doc.documentElement.clientWidth;
      const availableSpaceBeneathTrigger = viewportHeight - triggerRect.bottom + triggerHeight;

      let textRect: ClientRectObject | undefined;
      let alignedLeft =
        dir === 'rtl' ? triggerRect.right - positionerRect.width : triggerRect.left;
      let offsetY = 0;

      if (textElement && valueElement) {
        const valueRect = normalizeRect(valueElement.getBoundingClientRect(), scale);
        textRect = normalizeRect(textElement.getBoundingClientRect(), scale);

        alignedLeft =
          positionerRect.left +
          (dir === 'rtl' ? valueRect.right - textRect.right : valueRect.left - textRect.left);
        const valueCenterFromTriggerTop = valueRect.top - triggerRect.top + valueRect.height / 2;
        const textCenterFromPositionerTop =
          textRect.top - positionerRect.top + textRect.height / 2;

        offsetY = textCenterFromPositionerTop - valueCenterFromTriggerTop;
      }

      const idealHeight = availableSpaceBeneathTrigger + offsetY + marginBottom + borderBottom;
      let height = Math.min(viewportHeight, idealHeight);
      const maxHeight = viewportHeight - marginTop - marginBottom;
      const scrollTop = idealHeight - height;

      const maxRight = viewportWidth - paddingRight;

      positionerEl.style.left = `${clamp(
        alignedLeft,
        paddingLeft,
        maxRight - positionerRect.width,
      )}px`;
      positionerEl.style.height = `${height}px`;
      // `none` (not the invalid `auto`) so the explicit height governs in align mode and isn't
      // clamped by a `max-height` from user CSS.
      positionerEl.style.maxHeight = 'none';
      positionerEl.style.marginTop = `${marginTop}px`;
      positionerEl.style.marginBottom = `${marginBottom}px`;
      popupEl.style.height = '100%';

      const maxScrollTop = getMaxScrollTop(scroller);
      const isTopPositioned = scrollTop >= maxScrollTop - SCROLL_EDGE_TOLERANCE_PX;

      if (isTopPositioned) {
        height = Math.min(viewportHeight, positionerRect.height) - (scrollTop - maxScrollTop);
      }

      // When the trigger is too close to the top or bottom of the viewport, or the minHeight is
      // reached, we fallback to aligning the popup to the trigger as the UX is poor otherwise.
      const fallbackToAlignPopupToTrigger =
        triggerRect.top < triggerCollisionThreshold ||
        triggerRect.bottom > viewportHeight - triggerCollisionThreshold ||
        Math.ceil(height) + SCROLL_EDGE_TOLERANCE_PX < Math.min(scrollHeight, minHeight);

      // Safari doesn't position the popup correctly when pinch-zoomed.
      const isPinchZoomed = (win.visualViewport?.scale ?? 1) !== 1 && platform.engine.webkit;

      if (fallbackToAlignPopupToTrigger || isPinchZoomed) {
        clearStyles(positionerEl, originalPositionerStyles);
        fellBackFromAlignment = true;
        positioner.fallBackFromAlignItemWithTrigger();
        requestScrollArrowVisibility(scroller);
        return;
      }

      const initialHeight = Math.max(minHeight, height);

      if (isTopPositioned) {
        const topOffset = Math.max(0, viewportHeight - idealHeight);
        positionerEl.style.top = positionerRect.height >= maxHeight ? '0' : `${topOffset}px`;
        positionerEl.style.height = `${height}px`;
        scroller.scrollTop = getMaxScrollTop(scroller);
      } else {
        positionerEl.style.bottom = '0';
        scroller.scrollTop = scrollTop;
      }

      if (textRect) {
        const popupTop = positionerRect.top;
        const popupHeight = positionerRect.height;
        const textCenterY = textRect.top + textRect.height / 2;

        const clampedY = clamp(
          popupHeight > 0 ? ((textCenterY - popupTop) / popupHeight) * 100 : 50,
          0,
          100,
        );

        popupEl.style.setProperty(SelectPositionerCssVars.transformOrigin, `50% ${clampedY}%`);
      }

      if (initialHeight === viewportHeight || height >= maxPopupHeight) {
        reachedMaxHeight = true;
      }

      store.context.handleScrollArrowVisibility(scroller);

      if (
        highlightItemOnHover &&
        store.state.selectedIndex === null &&
        store.state.activeIndex === null &&
        store.context.listRef.current[0] != null
      ) {
        store.set('activeIndex', 0);
      }
    } finally {
      restoreTransformStyles();
    }
  }

  function requestScrollArrowVisibility(scroller: HTMLElement) {
    // The list owns scrolling once it has mounted, and the placement runs again (cancelling the
    // stale frame) when that happens.
    scrollArrowFrame.request(() => store.context.handleScrollArrowVisibility(scroller));
  }

  createEffect(
    () => [alignItemWithTriggerActive(), positionerElement(), open()] as const,
    ([active, positionerEl, isOpen]) => {
      if (!active || !positionerEl || !isOpen) {
        return undefined;
      }

      const win = ownerWindow(positionerEl);

      function handleResize(event: UIEvent) {
        store.setOpen(false, createChangeEventDetails(REASONS.windowResize, event));
      }

      return addEventListener(win, 'resize', handleResize);
    },
  );

  const rootPopupProps = createDynamicPropsSource(() => store.select('popupProps'));

  const defaultProps: HTMLProps = {
    get role() {
      return listElement() ? 'presentation' : 'listbox';
    },
    get 'aria-multiselectable'() {
      return (!listElement() && store.select('multiple')) || undefined;
    },
    get 'aria-readonly'() {
      return (!listElement() && store.select('readOnly')) || undefined;
    },
    get id() {
      return listElement() ? undefined : `${store.select('id')}-list`;
    },
    onKeyDown(event: KeyboardEvent) {
      if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
        event.stopPropagation();
      }
    },
    onScroll(event: Event & { currentTarget: HTMLDivElement }) {
      if (store.state.listElement) {
        return;
      }
      handleScroll(event.currentTarget);
    },
    get style() {
      if (!alignItemWithTriggerActive()) {
        return undefined;
      }
      return listElement() ? { height: '100%' } : LIST_FUNCTIONAL_STYLES;
    },
    get class() {
      return !listElement() && alignItemWithTriggerActive()
        ? styleDisableScrollbar.class
        : undefined;
    },
  };

  const transitionProps: HTMLProps = {
    get style() {
      return getDisabledMountTransitionStyles(store.select('transitionStatus')).style;
    },
  };

  // Injected once the popup is attached: a ref runs before the element joins the document.
  createEffect(
    () => (csp.disableStyleElements ? null : ([popupElement(), csp.nonce] as const)),
    (styles) => {
      if (styles?.[0]) {
        styleDisableScrollbar.inject(styles[0], styles[1]);
      }
    },
  );

  let ownPopupElement: HTMLElement | null = null;
  onCleanup(() => {
    if (ownPopupElement && store.state.popupElement === ownPopupElement) {
      store.set('popupElement', null);
    }
  });

  const element = renderElement('div', componentProps, {
    ref: (el: HTMLElement) => {
      ownPopupElement = el;
      store.set('popupElement', el);
    },
    state,
    stateAttributesMapping: popupTransitionStateMapping,
    props: [rootPopupProps, defaultProps, transitionProps, elementProps],
  });

  return (
    <FloatingFocusManager
      store={store}
      modal={false}
      disabled={!mounted()}
      openInteractionType={store.select('openMethod')}
      returnFocus={componentProps.finalFocus}
      restoreFocus
    >
      {element}
    </FloatingFocusManager>
  );
}

export interface SelectPopupProps extends BaseUIComponentProps<'div', SelectPopupState> {
  children?: JSX.Element;
  /**
   * Determines the element to focus when the select popup is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - An element or a ref object (`{ current }`): Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: FocusTargetProp;
}

export interface SelectPopupState {
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace SelectPopup {
  export type Props = SelectPopupProps;
  export type State = SelectPopupState;
}

function getMaxPopupHeight(popupStyles: CSSStyleDeclaration) {
  const maxHeightStyle = popupStyles.maxHeight;
  return maxHeightStyle.endsWith('px') ? parseFloat(maxHeightStyle) || Infinity : Infinity;
}

function getMaxScrollTop(scroller: HTMLElement) {
  return getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
}

function getScale(element: HTMLElement) {
  // The platform API is async-capable, but the DOM platform returns a plain scale object.
  return floatingPlatform.getScale(element) as unknown as { x: number; y: number };
}

function normalizeSize(size: number, axis: 'x' | 'y', scale: { x: number; y: number }) {
  return size / scale[axis];
}

function normalizeRect(
  rect: DOMRect | DOMRectReadOnly,
  scale: { x: number; y: number },
): ClientRectObject {
  return rectToClientRect({
    x: normalizeSize(rect.x, 'x', scale),
    y: normalizeSize(rect.y, 'y', scale),
    width: normalizeSize(rect.width, 'x', scale),
    height: normalizeSize(rect.height, 'y', scale),
  });
}

const TRANSFORM_STYLE_RESETS = [
  ['transform', 'none'],
  ['scale', '1'],
  ['translate', '0 0'],
] as const;

type TransformStyleProperty = (typeof TRANSFORM_STYLE_RESETS)[number][0];

function unsetTransformStyles(popupElement: HTMLElement) {
  const { style } = popupElement;
  const originalStyles = {} as Record<TransformStyleProperty, string>;

  for (const [property, value] of TRANSFORM_STYLE_RESETS) {
    originalStyles[property] = style.getPropertyValue(property);
    style.setProperty(property, value, 'important');
  }

  return () => {
    for (const [property] of TRANSFORM_STYLE_RESETS) {
      const originalValue = originalStyles[property];
      if (originalValue) {
        style.setProperty(property, originalValue);
      } else {
        style.removeProperty(property);
      }
    }
  };
}
