import { createEffect, createMemo, createSignal, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { getSide, getAlignment, getSideAxis } from '@floating-ui/utils';
import type { Rect } from '@floating-ui/utils';
import { ownerDocument, ownerWindow } from '@egoist/solid-base-utils/owner';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import {
  autoUpdate,
  flip,
  limitShift,
  offset,
  shift as floatingShift,
  size,
} from '@floating-ui/dom';
import type {
  Placement,
  VirtualElement,
  Padding,
  Side as PhysicalSide,
  MiddlewareState,
  AutoUpdateOptions,
  Middleware,
} from '@floating-ui/dom';
import type {
  PositioningInteractionStore,
  PopupPositioningContext,
  ReferenceType,
} from '../utils/popups/types';
import type { FloatingTreeStore } from '../utils/popups/tree/FloatingTreeStore';
import { createFloating } from '../utils/popups/positioning/floating';
import type { FloatingRefs } from '../utils/popups/positioning/floating';
import { useDirection } from './direction-context/DirectionContext';
import { arrow } from '../utils/popups/positioning/arrow';
import { hide } from '../utils/popups/positioning/hideMiddleware';
import { DEFAULT_SIDES } from '../utils/popups/positioning/adaptiveOriginConstants';
import * as CommonPositionerCssVars from '../utils/popups/positioning/CommonPositionerCssVars';

export { createFloatingRootStore } from '../utils/popups/floating-root/createFloatingRootStore';
export type { CreateFloatingRootStoreOptions } from '../utils/popups/floating-root/createFloatingRootStore';
export type { FloatingRootStore } from '../utils/popups/floating-root/FloatingRootStore';
export type { PositioningInteractionStore } from '../utils/popups/types';

const AVAILABLE_WIDTH_VAR = CommonPositionerCssVars.availableWidth;
const AVAILABLE_HEIGHT_VAR = CommonPositionerCssVars.availableHeight;

function getLogicalSide(sideParam: Side, renderedSide: PhysicalSide, isRtl: boolean): Side {
  const isLogicalSideParam = sideParam === 'inline-start' || sideParam === 'inline-end';
  const logicalRight = isRtl ? 'inline-start' : 'inline-end';
  const logicalLeft = isRtl ? 'inline-end' : 'inline-start';
  return (
    {
      top: 'top',
      right: isLogicalSideParam ? logicalRight : 'right',
      bottom: 'bottom',
      left: isLogicalSideParam ? logicalLeft : 'left',
    } satisfies Record<PhysicalSide, Side>
  )[renderedSide];
}

function getOffsetData(state: MiddlewareState, sideParam: Side, isRtl: boolean) {
  const { rects, placement } = state;
  const data = {
    side: getLogicalSide(sideParam, getSide(placement), isRtl),
    align: getAlignment(placement) || 'center',
    anchor: { width: rects.reference.width, height: rects.reference.height },
    positioner: { width: rects.floating.width, height: rects.floating.height },
  } as const;
  return data;
}

function getPhysicalSide(sideParam: Side, isRtl: boolean): PhysicalSide {
  return (
    {
      top: 'top',
      right: 'right',
      bottom: 'bottom',
      left: 'left',
      'inline-end': isRtl ? 'left' : 'right',
      'inline-start': isRtl ? 'right' : 'left',
    } satisfies Record<Side, PhysicalSide>
  )[sideParam];
}

function normalizeCollisionPadding(padding: Padding) {
  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return {
    top: padding?.top || 0,
    right: padding?.right || 0,
    bottom: padding?.bottom || 0,
    left: padding?.left || 0,
  };
}

export type Side = 'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start';
export type Align = 'start' | 'center' | 'end';
export type Boundary = 'clipping-ancestors' | Element | Element[] | Rect;
export type OffsetFunction = (data: {
  side: Side;
  align: Align;
  anchor: { width: number; height: number };
  positioner: { width: number; height: number };
}) => number;

interface SideFlipMode {
  /**
   * How to avoid collisions on the side axis.
   * - `'flip'`: If there is not enough space, place the popup on the opposite side.
   * - `'none'`: Keep the preferred side even if it overflows.
   */
  side?: 'flip' | 'none' | undefined;
  /**
   * How to avoid collisions on the align axis.
   * - `'flip'`: If there is not enough space, swap `'start'` and `'end'` alignment.
   * - `'shift'`: Keep the alignment and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred alignment even if it overflows.
   */
  align?: 'flip' | 'shift' | 'none' | undefined;
  /**
   * If both sides on the preferred axis do not fit, determines whether to fallback
   * to a side on the perpendicular axis and which logical side to prefer.
   * - `'start'`: Prefer the logical start side on the perpendicular axis.
   * - `'end'`: Prefer the logical end side on the perpendicular axis.
   * - `'none'`: Do not fallback to the perpendicular axis.
   */
  fallbackAxisSide?: 'start' | 'end' | 'none' | undefined;
}

interface SideShiftMode {
  /**
   * How to avoid collisions on the side axis.
   * - `'shift'`: Keep the preferred side and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred side even if it overflows.
   */
  side?: 'shift' | 'none' | undefined;
  /**
   * How to avoid collisions on the align axis.
   * - `'shift'`: Keep the alignment and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred alignment even if it overflows.
   */
  align?: 'shift' | 'none' | undefined;
  /**
   * If both sides on the preferred axis do not fit, determines whether to fallback
   * to a side on the perpendicular axis and which logical side to prefer.
   * - `'start'`: Prefer the logical start side on the perpendicular axis.
   * - `'end'`: Prefer the logical end side on the perpendicular axis.
   * - `'none'`: Do not fallback to the perpendicular axis.
   */
  fallbackAxisSide?: 'start' | 'end' | 'none' | undefined;
}

export type CollisionAvoidance = SideFlipMode | SideShiftMode;

/**
 * Provides standardized anchor positioning behavior for floating elements. Wraps `createFloating`
 * (Floating UI's `computePosition` and `autoUpdate`).
 *
 * Parameters are read lazily, like Solid props: pass getters for reactive values. `interactionStore`,
 * `nodeId` and `externalTree` are read once. The return value is a live object whose getters are
 * tracked.
 */
export function createAnchorPositioning(
  params: CreateAnchorPositioningParameters,
): CreateAnchorPositioningReturnValue {
  // Read once: the store and the tree node a popup is positioned with don't change.
  const { interactionStore, nodeId, externalTree } = untrack(() => ({
    interactionStore: params.interactionStore,
    nodeId: params.nodeId,
    externalTree: params.externalTree,
  }));

  const positionMethod = () => params.positionMethod ?? 'absolute';
  const sideParam = () => params.side ?? 'bottom';
  const alignParam = () => params.align ?? 'center';
  const keepMounted = () => params.keepMounted ?? false;
  const mounted = () => params.mounted;
  const lazyFlip = () => params.lazyFlip ?? false;
  const lockAlign = () => lazyFlip() === 'placement';

  const direction = useDirection();
  const isRtl = () => direction() === 'rtl';

  // Locks the flipped side, and the alignment too when the consumer opts in, while filtering
  // resizes the popup: once the rendered placement leaves the requested (or locked) one, it is
  // kept. A locked placement only lasts while the popup is mounted. Derived from the rendered
  // placement, so the side and alignment follow it in the same flush.
  //
  // The floating element is created below from the placement this derives: it is connected once
  // created.
  const [floatingSource, setFloatingSource] = createSignal<{
    readonly isPositioned: boolean;
    readonly placement: Placement;
  } | null>(null, { ownedWrite: true, name: 'createAnchorPositioning.floatingSource' });
  const mountPlacement = createMemo<Placement | null>(
    (locked) => {
      if (!mounted()) {
        return null;
      }
      const previous = locked ?? null;
      const rendered = floatingSource();
      if (!lazyFlip() || !rendered?.isPositioned) {
        return previous;
      }
      const renderedPlacement = rendered.placement;
      const currentSide = previous ? getSide(previous) : getPhysicalSide(sideParam(), isRtl());
      const lock = lockAlign();
      const currentAlign = (previous && lock ? getAlignment(previous) || 'center' : null) || alignParam();
      if (
        getSide(renderedPlacement) !== currentSide ||
        (lock && (getAlignment(renderedPlacement) || 'center') !== currentAlign)
      ) {
        return renderedPlacement;
      }
      return previous;
    },
    { name: 'createAnchorPositioning.mountPlacement' },
  );

  const side = createMemo((): PhysicalSide => {
    const placement = mountPlacement();
    return placement ? getSide(placement) : getPhysicalSide(sideParam(), isRtl());
  });

  const placementAlign = createMemo((): Align => {
    const placement = mountPlacement();
    const mountAlign = placement && lockAlign() ? getAlignment(placement) || 'center' : null;
    return mountAlign || alignParam();
  });

  const placement = createMemo(
    (): Placement =>
      placementAlign() === 'center' ? side() : (`${side()}-${placementAlign()}` as Placement),
  );

  let arrowElement: Element | null = null;
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });

  const crossAxisShiftEnabled = () => {
    const collisionAvoidance = params.collisionAvoidance;
    const collisionAvoidanceSide = collisionAvoidance.side || 'flip';
    const collisionAvoidanceAlign = collisionAvoidance.align || 'flip';
    const shiftDisabled = collisionAvoidanceAlign === 'none' && collisionAvoidanceSide !== 'shift';
    return (
      !shiftDisabled &&
      ((params.sticky ?? false) ||
        (params.shift?.crossAxis ?? false) ||
        collisionAvoidanceSide === 'shift')
    );
  };

  const middleware = createMemo(() => {
    const currentSideParam = sideParam();
    const rtl = isRtl();
    const sideOffset = params.sideOffset ?? 0;
    const alignOffset = params.alignOffset ?? 0;
    const collisionBoundary = params.collisionBoundary ?? 'clipping-ancestors';
    const collisionPadding = normalizeCollisionPadding(params.collisionPadding ?? 5);
    const sticky = params.sticky ?? false;
    const arrowPadding = params.arrowPadding ?? 5;
    const inlineMiddleware = params.inline;
    const adaptiveOrigin = params.adaptiveOrigin;
    const collisionAvoidance = params.collisionAvoidance;
    const shiftCrossAxis = params.shift?.crossAxis ?? false;
    const shiftRootBoundary = params.shift?.rootBoundary;

    const collisionAvoidanceSide = collisionAvoidance.side || 'flip';
    const collisionAvoidanceAlign = collisionAvoidance.align || 'flip';
    const collisionAvoidanceFallbackAxisSide = collisionAvoidance.fallbackAxisSide || 'end';

    // Create a bias to the preferred side.
    // On iOS, when the mobile software keyboard opens, the input is exactly centered
    // in the viewport, but this can cause it to flip to the top undesirably.
    // The bias is only applied to `flip()` so it doesn't shift the resting position
    // computed by `shift()` and `size()` away from the requested `collisionPadding`.
    const bias = 1;
    const biasTop = currentSideParam === 'bottom' ? bias : 0;
    const biasBottom = currentSideParam === 'top' ? bias : 0;
    const biasLeft = currentSideParam === 'right' ? bias : 0;
    const biasRight = currentSideParam === 'left' ? bias : 0;

    const commonCollisionProps = {
      boundary:
        collisionBoundary === 'clipping-ancestors' ? 'clippingAncestors' : collisionBoundary,
      padding: collisionPadding,
    } as const;

    const result: Array<Middleware | null> = [];

    if (inlineMiddleware) {
      result.push(inlineMiddleware);
    }

    result.push(
      offset((state) => {
        const data = getOffsetData(state, currentSideParam, rtl);

        const sideAxis = typeof sideOffset === 'function' ? sideOffset(data) : sideOffset;
        const alignAxis = typeof alignOffset === 'function' ? alignOffset(data) : alignOffset;

        return {
          mainAxis: sideAxis,
          crossAxis: alignAxis,
          alignmentAxis: alignAxis,
        };
      }),
    );

    const shiftDisabled = collisionAvoidanceAlign === 'none' && collisionAvoidanceSide !== 'shift';
    const crossAxisShift = crossAxisShiftEnabled();

    const flipOptions = {
      ...commonCollisionProps,
      // Ensure the popup flips if it's been limited by its --available-height and it resizes.
      // Since the size() padding is smaller than the flip() padding, flip() will take precedence.
      padding: {
        top: collisionPadding.top + bias + biasTop,
        right: collisionPadding.right + bias + biasRight,
        bottom: collisionPadding.bottom + bias + biasBottom,
        left: collisionPadding.left + bias + biasLeft,
      },
      mainAxis: !shiftCrossAxis && collisionAvoidanceSide === 'flip',
      crossAxis: collisionAvoidanceAlign === 'flip' ? ('alignment' as const) : false,
      fallbackAxisSideDirection: collisionAvoidanceFallbackAxisSide,
    };
    const flipMiddleware =
      collisionAvoidanceSide === 'none'
        ? null
        : flip(
            // Once size() has run in this pass (it may have raised the cap), accept its new cap.
            ({ middlewareData }) =>
              middlewareData.size ? { ...flipOptions, padding: collisionPadding } : flipOptions,
          );
    const shiftMiddleware = shiftDisabled
      ? null
      : floatingShift({
          ...commonCollisionProps,
          // Use the Layout Viewport to avoid shifting around when pinch-zooming.
          rootBoundary: shiftRootBoundary,
          mainAxis: collisionAvoidanceAlign !== 'none',
          crossAxis: crossAxisShift,
          limiter:
            sticky || shiftCrossAxis
              ? undefined
              : limitShift((limitData) => {
                  if (!arrowElement) {
                    return {};
                  }
                  const { width, height } = arrowElement.getBoundingClientRect();
                  const sideAxis = getSideAxis(getSide(limitData.placement));
                  const arrowSize = sideAxis === 'y' ? width : height;
                  const offsetAmount =
                    sideAxis === 'y'
                      ? collisionPadding.left + collisionPadding.right
                      : collisionPadding.top + collisionPadding.bottom;
                  return {
                    offset: arrowSize / 2 + offsetAmount / 2,
                  };
                }),
        });

    // https://floating-ui.com/docs/flip#combining-with-shift
    // Keyed on the alignment actually being requested, not the raw prop: a locked alignment can
    // differ from `align`, and the ordering has to match the placement that is asked for.
    if (
      collisionAvoidanceSide === 'shift' ||
      collisionAvoidanceAlign === 'shift' ||
      placementAlign() === 'center'
    ) {
      result.push(shiftMiddleware, flipMiddleware);
    } else {
      result.push(flipMiddleware, shiftMiddleware);
    }

    result.push(
      size({
        ...commonCollisionProps,
        apply({ elements: { floating }, availableWidth, availableHeight, rects }) {
          if (disposed || !untrack(mounted)) {
            return;
          }

          const floatingStyle = floating.style;
          floatingStyle.setProperty(AVAILABLE_WIDTH_VAR, `${availableWidth}px`);
          floatingStyle.setProperty(AVAILABLE_HEIGHT_VAR, `${availableHeight}px`);

          // Snap anchor dimensions to device pixels to ensure the popup's visual width matches the anchor's one.
          const dpr = ownerWindow(floating).devicePixelRatio || 1;
          const { x, y, width, height } = rects.reference;
          const anchorWidth = (Math.round((x + width) * dpr) - Math.round(x * dpr)) / dpr;
          const anchorHeight = (Math.round((y + height) * dpr) - Math.round(y * dpr)) / dpr;

          floatingStyle.setProperty(CommonPositionerCssVars.anchorWidth, `${anchorWidth}px`);
          floatingStyle.setProperty(CommonPositionerCssVars.anchorHeight, `${anchorHeight}px`);
        },
      }),
      arrow((state) => ({
        // `transform-origin` calculations rely on an element existing. If the arrow hasn't been set,
        // we'll create a fake element.
        element: arrowElement || ownerDocument(state.elements.floating).createElement('div'),
        // No padding for the fake arrow: it would displace aligned popups on narrow anchors.
        padding: arrowElement ? arrowPadding : 0,
      })),
      {
        name: 'transformOrigin',
        fn(state) {
          const {
            elements: { floating },
            middlewareData,
            placement: renderedPlacement,
            platform,
            rects,
            y,
          } = state;

          const renderedSide = getSide(renderedPlacement);
          const renderedAlign = getAlignment(renderedPlacement);
          const isVertical = getSideAxis(renderedSide) === 'y';
          const arrowEl = arrowElement;

          const sideOffsetValue =
            typeof sideOffset === 'function'
              ? sideOffset(getOffsetData(state, currentSideParam, rtl))
              : sideOffset;

          // An aligned arrowless popup grows from its aligned edge, until a shift (beyond subpixel)
          // breaks its alignment with the anchor. Everything else grows from the arrow, real or fake.
          let crossOrigin: string;
          if (
            !arrowEl &&
            renderedAlign &&
            Math.abs(isVertical ? middlewareData.shift?.x || 0 : middlewareData.shift?.y || 0) <= 1
          ) {
            // The platform direction, not `isRtl`: it must match what Floating UI placed with.
            crossOrigin =
              (renderedAlign === 'start') === (isVertical && platform.isRTL?.(floating) === true)
                ? '100%'
                : '0%';
          } else {
            const arrowOffset = isVertical
              ? middlewareData.arrow?.x || 0
              : middlewareData.arrow?.y || 0;
            const arrowSize = isVertical ? arrowEl?.clientWidth || 0 : arrowEl?.clientHeight || 0;
            crossOrigin = `${arrowOffset + arrowSize / 2}px`;
          }

          // Side axis: the anchor-facing edge, or the anchor's center when the popup overlaps it.
          let sideOrigin =
            renderedSide === 'top' || renderedSide === 'left'
              ? `calc(100% + ${sideOffsetValue}px)`
              : `${-sideOffsetValue}px`;
          if (
            crossAxisShift &&
            isVertical &&
            Math.abs(middlewareData.shift?.y || 0) > sideOffsetValue
          ) {
            sideOrigin = `${rects.reference.y + rects.reference.height / 2 - y}px`;
          }

          floating.style.setProperty(
            CommonPositionerCssVars.transformOrigin,
            isVertical ? `${crossOrigin} ${sideOrigin}` : `${sideOrigin} ${crossOrigin}`,
          );

          return {};
        },
      },
      hide,
    );

    if (adaptiveOrigin) {
      result.push(adaptiveOrigin);
    }

    return result;
  });

  createEffect(mounted, (isMounted) => {
    // Ensure positioning doesn't run initially for `keepMounted` elements that
    // aren't initially open.
    if (!isMounted) {
      interactionStore.clearPositioning();
    }
  });

  const autoUpdateOptions = (): AutoUpdateOptions => {
    const disableAnchorTracking = params.disableAnchorTracking ?? false;
    return {
      ancestorScroll: !disableAnchorTracking,
      elementResize: !disableAnchorTracking && typeof ResizeObserver !== 'undefined',
      layoutShift: !disableAnchorTracking && typeof IntersectionObserver !== 'undefined',
    };
  };

  const floating = createFloating({
    rootStore: interactionStore,
    get open() {
      return keepMounted() ? mounted() : undefined;
    },
    get placement() {
      return placement();
    },
    get middleware() {
      return middleware();
    },
    get strategy() {
      return positionMethod();
    },
    get whileElementsMounted() {
      if (keepMounted()) {
        return undefined;
      }
      const options = autoUpdateOptions();
      return (reference: ReferenceType, floatingElement: HTMLElement, update: () => void) =>
        autoUpdate(reference, floatingElement, update, options);
    },
    nodeId,
    externalTree,
  });
  setFloatingSource(floating);

  // An arrow that mounts or unmounts after the popup is positioned doesn't resize the positioner, so
  // reposition explicitly. Deferred so an anchor that changed in the same update is registered
  // first. `update` reads the latest middleware when it runs.
  const arrowRef = (element: Element | null) => {
    arrowElement = element;
    if (untrack(() => floating.isPositioned)) {
      queueMicrotask(() => {
        if (!disposed) {
          floating.update();
        }
      });
    }
  };

  const positionerStyles = createMemo((): JSX.CSSProperties => {
    const isPositioned = floating.isPositioned;
    // Default to `fixed` when not positioned to prevent `autoFocus` scroll jumps.
    // This ensures the popup is inside the viewport initially before it gets positioned.
    const resolvedPosition: 'absolute' | 'fixed' = isPositioned ? positionMethod() : 'fixed';

    let base: Record<string, string | undefined>;
    if (!isPositioned) {
      // Until a position for the current open is computed, ignore any coordinates retained from a
      // previous open (or from a pass that measured the hidden popup as 0x0). Rendering the
      // full-size popup at such stale coordinates can overflow the layout viewport, which makes
      // mobile Chrome zoom the page out and reflow everything the popup is anchored to.
      base = { position: resolvedPosition, top: '0px', left: '0px' };
    } else if (params.adaptiveOrigin) {
      const { sideX, sideY } = floating.middlewareData.adaptiveOrigin || DEFAULT_SIDES;
      base = {
        position: resolvedPosition,
        [sideX]: `${floating.x}px`,
        [sideY]: `${floating.y}px`,
      };
    } else {
      base = {
        ...(floating.floatingStyles as Record<string, string | undefined>),
        position: resolvedPosition,
      };
    }

    // Seed the available size vars so consumer `max-height: min(x, var(--available-height))` rules
    // resolve to a valid length on the first positioning pass, before `size()` writes the real
    // values. Without a fallback the unresolved `var()` invalidates the whole declaration, so the
    // popup is measured unconstrained while `flip()` picks its side, against the full content
    // height rather than the capped one. Seeded unconditionally (not only while `!isPositioned`):
    // the keys must stay present with a constant value so Solid's per-property style diff never
    // rewrites them after mount, preserving the px values `size()` sets imperatively. Removing them
    // once positioned would make Solid remove the properties, wiping `size()`'s values and leaving
    // the popup unconstrained.
    base[AVAILABLE_WIDTH_VAR] = '100vw';
    base[AVAILABLE_HEIGHT_VAR] = '100vh';

    if (!isPositioned) {
      base.opacity = '0';
    }
    return base as JSX.CSSProperties;
  });

  let registeredPositionReference: ReferenceType | null = null;

  function registerPositionReference(anchor: ReferenceType | null) {
    if (anchor !== registeredPositionReference) {
      floating.refs.setPositionReference(anchor);
      registeredPositionReference = anchor;
    }
  }

  function resolveAnchor() {
    const anchorValue = params.anchor;
    const resolvedAnchor = typeof anchorValue === 'function' ? anchorValue() : anchorValue;
    const anchorRef = isRef(resolvedAnchor) ? resolvedAnchor : undefined;
    const unwrappedElement = (anchorRef ? anchorRef.current : resolvedAnchor) || null;
    return { anchor: unwrappedElement as ReferenceType | null, anchorRef };
  }

  createEffect(
    () => {
      if (!mounted()) {
        return false;
      }
      // Tracks the anchor (a signal accessor passed as `anchor` included).
      resolveAnchor();
      return true;
    },
    (isMounted) => {
      if (!isMounted) {
        return;
      }

      // Resolved again now that the update has been rendered: an `anchor` function may read a
      // variable that a ref callback has just set, like upstream's layout effect.
      const { anchor, anchorRef } = untrack(resolveAnchor);
      registerPositionReference(anchor);

      // Ref objects are filled by ref callbacks, which may run after this effect (such as the
      // ref of an element rendered later in the tree): check again once the update settles.
      if (anchorRef) {
        queueMicrotask(() => {
          if (!disposed && untrack(mounted)) {
            registerPositionReference(anchorRef.current || null);
          }
        });
      }
    },
  );

  createEffect(
    () => {
      if (!keepMounted() || !mounted()) {
        return null;
      }
      return {
        reference: floating.elements.reference,
        floating: floating.elements.floating,
        options: autoUpdateOptions(),
      };
    },
    (value) => {
      if (value && value.reference && value.floating) {
        return autoUpdate(value.reference, value.floating, floating.update, value.options);
      }
      return undefined;
    },
  );

  const renderedSide = () => getSide(floating.placement);

  const arrowStyles = createMemo(
    (): JSX.CSSProperties => {
      const arrowData = floating.middlewareData.arrow;
      return {
        position: 'absolute',
        top: arrowData?.y != null ? `${arrowData.y}px` : undefined,
        left: arrowData?.x != null ? `${arrowData.x}px` : undefined,
      };
    },
    {
      name: 'createAnchorPositioning.arrowStyles',
      equals: (a, b) => a.top === b.top && a.left === b.left,
    },
  );

  return {
    get positionerStyles() {
      return positionerStyles();
    },
    get arrowStyles() {
      return arrowStyles();
    },
    arrowRef,
    get arrowUncentered() {
      return floating.middlewareData.arrow?.centerOffset !== 0;
    },
    get side() {
      return getLogicalSide(sideParam(), renderedSide(), isRtl());
    },
    get align() {
      return getAlignment(floating.placement) || 'center';
    },
    get physicalSide() {
      return renderedSide();
    },
    get anchorHidden() {
      return Boolean(floating.middlewareData.hide?.referenceHidden);
    },
    refs: floating.refs,
    context: floating.context,
    get isPositioned() {
      return floating.isPositioned;
    },
    update: floating.update,
  };
}

function isRef(param: unknown): param is RefObject<Element | null> {
  return param != null && typeof param === 'object' && 'current' in param;
}

export interface CreateAnchorPositioningSharedParameters {
  /**
   * An element to position the popup against.
   * By default, the popup will be positioned against the trigger.
   *
   * Accepts an element, a virtual element, a ref object, or a function (such as a signal accessor)
   * that returns an element or a virtual element.
   */
  anchor?:
    | Element
    | null
    | VirtualElement
    | RefObject<Element | null>
    | (() => Element | VirtualElement | null | undefined)
    | undefined;
  /**
   * Determines which CSS `position` property to use.
   * @default 'absolute'
   */
  positionMethod?: 'absolute' | 'fixed' | undefined;
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   * @default 'bottom'
   */
  side?: Side | undefined;
  /**
   * Distance between the anchor and the popup in pixels.
   * Also accepts a function that returns the distance to read the dimensions of the anchor
   * and positioner elements, along with its side and alignment.
   *
   * The function takes a `data` object parameter with the following properties:
   * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
   * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
   * - `data.side`: which side of the anchor element the positioner is aligned against.
   * - `data.align`: how the positioner is aligned relative to the specified side.
   *
   * @example
   * ```jsx
   * <Positioner
   *   sideOffset={({ side, align, anchor, positioner }) => {
   *     return side === 'top' || side === 'bottom'
   *       ? anchor.height
   *       : anchor.width;
   *   }}
   * />
   * ```
   *
   * @default 0
   */
  sideOffset?: number | OffsetFunction | undefined;
  /**
   * How to align the popup relative to the specified side.
   * @default 'center'
   */
  align?: Align | undefined;
  /**
   * Additional offset along the alignment axis in pixels.
   * Also accepts a function that returns the offset to read the dimensions of the anchor
   * and positioner elements, along with its side and alignment.
   *
   * The function takes a `data` object parameter with the following properties:
   * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
   * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
   * - `data.side`: which side of the anchor element the positioner is aligned against.
   * - `data.align`: how the positioner is aligned relative to the specified side.
   *
   * @example
   * ```jsx
   * <Positioner
   *   alignOffset={({ side, align, anchor, positioner }) => {
   *     return side === 'top' || side === 'bottom'
   *       ? anchor.width
   *       : anchor.height;
   *   }}
   * />
   * ```
   *
   * @default 0
   */
  alignOffset?: number | OffsetFunction | undefined;
  /**
   * An element or a rectangle that delimits the area that the popup is confined to.
   * @default 'clipping-ancestors'
   */
  collisionBoundary?: Boundary | undefined;
  /**
   * Additional space to maintain from the edge of the collision boundary.
   * @default 5
   */
  collisionPadding?: Padding | undefined;
  /**
   * Whether to maintain the popup in the viewport after
   * the anchor element was scrolled out of view.
   * @default false
   */
  sticky?: boolean | undefined;
  /**
   * Minimum distance to maintain between the arrow and the edges of the popup.
   *
   * Use it to prevent the arrow element from hanging out of the rounded corners of a popup.
   * @default 5
   */
  arrowPadding?: number | undefined;
  /**
   * Whether to disable the popup from tracking any layout shift of its positioning anchor.
   * @default false
   */
  disableAnchorTracking?: boolean | undefined;
  /**
   * Determines how to handle collisions when positioning the popup.
   *
   * `side` controls overflow on the preferred placement axis (`top`/`bottom` or `left`/`right`):
   * - `'flip'`: keep the requested side when it fits; otherwise try the opposite side
   *   (`top` and `bottom`, or `left` and `right`).
   * - `'shift'`: never change side; keep the requested side and move the popup within
   *   the clipping boundary so it stays visible.
   * - `'none'`: do not correct side-axis overflow.
   *
   * `align` controls overflow on the alignment axis (`start`/`center`/`end`):
   * - `'flip'`: keep side, but swap `start` and `end` when the requested alignment overflows.
   * - `'shift'`: keep side and requested alignment, then nudge the popup along the
   *   alignment axis to fit.
   * - `'none'`: do not correct alignment-axis overflow.
   *
   * `fallbackAxisSide` controls fallback behavior on the perpendicular axis when the
   * preferred axis cannot fit:
   * - `'start'`: allow perpendicular fallback and try the logical start side first
   *   (`top` before `bottom`, or `left` before `right` in LTR).
   * - `'end'`: allow perpendicular fallback and try the logical end side first
   *   (`bottom` before `top`, or `right` before `left` in LTR).
   * - `'none'`: do not fallback to the perpendicular axis.
   *
   * When `side` is `'shift'`, explicitly setting `align` only supports `'shift'` or `'none'`.
   * If `align` is omitted, it defaults to `'flip'`.
   *
   * @example
   * ```jsx
   * <Positioner
   *   collisionAvoidance={{
   *     side: 'shift',
   *     align: 'shift',
   *     fallbackAxisSide: 'none',
   *   }}
   * />
   * ```
   *
   */
  collisionAvoidance?: CollisionAvoidance | undefined;
}

/**
 * Alias of `CreateAnchorPositioningSharedParameters`, the name upstream uses.
 */
export type UseAnchorPositioningSharedParameters = CreateAnchorPositioningSharedParameters;

export interface CreateAnchorPositioningParameters extends CreateAnchorPositioningSharedParameters {
  keepMounted?: boolean | undefined;
  /**
   * The interaction store the popup is positioned with. Components without a popup store create
   * one with `createFloatingRootStore`. Read once.
   */
  interactionStore: PositioningInteractionStore;
  mounted: boolean;
  /**
   * The popup's floating tree node id. Read once.
   */
  nodeId?: string | undefined;
  adaptiveOrigin?: Middleware | undefined;
  collisionAvoidance: CollisionAvoidance;
  shift?:
    | {
        crossAxis?: boolean | undefined;
        rootBoundary?: 'layoutViewport' | undefined;
      }
    | undefined;
  /**
   * Locks a flipped placement so it doesn't flip back eagerly while filtering resizes the
   * popup. `true` locks the side only; `'placement'` also locks the alignment.
   */
  lazyFlip?: boolean | 'placement' | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used. Read once.
   */
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Optional middleware that can replace the measured reference rect before offsets and collision
   * middleware run. Used by Preview Card to position against a specific inline line box.
   */
  inline?: Middleware | undefined;
}

export interface CreateAnchorPositioningReturnValue {
  readonly positionerStyles: JSX.CSSProperties;
  readonly arrowStyles: JSX.CSSProperties;
  /**
   * Ref callback for the arrow element. Call it with `null` when the arrow unmounts.
   */
  arrowRef: (element: Element | null) => void;
  readonly arrowUncentered: boolean;
  readonly side: Side;
  readonly align: Align;
  readonly physicalSide: PhysicalSide;
  readonly anchorHidden: boolean;
  refs: FloatingRefs;
  context: PopupPositioningContext;
  readonly isPositioned: boolean;
  update: () => void;
}

/**
 * Alias of `CreateAnchorPositioningParameters`, the name upstream uses.
 */
export type UseAnchorPositioningParameters = CreateAnchorPositioningParameters;
/**
 * Alias of `CreateAnchorPositioningReturnValue`, the name upstream uses.
 */
export type UseAnchorPositioningReturnValue = CreateAnchorPositioningReturnValue;
