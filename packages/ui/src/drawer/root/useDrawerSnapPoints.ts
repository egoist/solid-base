import { createEffect, createMemo, createSignal } from 'solid-js';
import { getComputedStyle } from '@floating-ui/utils/dom';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { clamp } from '@egoist/solid-base-utils/clamp';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useDrawerRootContext } from './DrawerRootContext';
import type { DrawerSnapPoint } from './DrawerRootContext';
import type { DrawerRootSnapPointChangeEventDetails } from './DrawerRoot';

export interface ResolvedDrawerSnapPoint {
  value: DrawerSnapPoint;
  height: number;
  offset: number;
}

/**
 * Resolves the vertical swipe movement for a snap point, applying square-root damping once the drag
 * overshoots the fully-open edge (`nextOffset < 0`) so the popup resists travelling past it.
 */
export function getSnapPointSwipeMovement(baseOffset: number, movementValue: number): number {
  const nextOffset = baseOffset + movementValue;
  if (nextOffset >= 0) {
    return movementValue;
  }

  return -Math.sqrt(-nextOffset) - baseOffset;
}

function resolveSnapPointValue(
  snapPoint: DrawerSnapPoint,
  viewportHeight: number,
  rootFontSize: number,
) {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return null;
  }

  if (typeof snapPoint === 'number') {
    if (!Number.isFinite(snapPoint)) {
      return null;
    }

    if (snapPoint <= 1) {
      return clamp(snapPoint, 0, 1) * viewportHeight;
    }

    return snapPoint;
  }

  const trimmed = snapPoint.trim();

  if (trimmed.endsWith('px')) {
    const value = Number.parseFloat(trimmed);
    return Number.isFinite(value) ? value : null;
  }

  if (trimmed.endsWith('rem')) {
    const value = Number.parseFloat(trimmed);
    return Number.isFinite(value) ? value * rootFontSize : null;
  }

  return null;
}

/**
 * Returns the index of the value closest to `target`, or `-1` if `values` is empty.
 */
export function closestSnapPointIndex(values: number[], target: number): number {
  let closestIndex = -1;
  let closestDistance = Infinity;

  for (let index = 0; index < values.length; index += 1) {
    const distance = Math.abs(values[index] - target);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }

  return closestIndex;
}

export interface DrawerSnapPointsValue {
  readonly snapPoints: DrawerSnapPoint[] | undefined;
  readonly activeSnapPoint: DrawerSnapPoint | null;
  setActiveSnapPoint: (
    snapPoint: DrawerSnapPoint | null,
    eventDetails?: DrawerRootSnapPointChangeEventDetails,
  ) => void;
  readonly popupHeight: number;
  readonly viewportHeight: number;
  readonly resolvedSnapPoints: ResolvedDrawerSnapPoint[];
  readonly activeSnapPointOffset: number | null;
}

/**
 * Measures the drawer viewport and resolves the Root's snap points against it.
 * Returns a live object (getters are tracked).
 */
export function createDrawerSnapPoints(): DrawerSnapPointsValue {
  const store = useDialogRootContext();
  const drawer = useDrawerRootContext();

  const [viewportHeight, setViewportHeight] = createSignal(0);
  const [rootFontSize, setRootFontSize] = createSignal(16);

  createEffect(
    () => store.select('viewportElement'),
    (viewportElement) => {
      const measureViewportHeight = () => {
        const doc = ownerDocument(viewportElement);
        const html = doc.documentElement;

        setViewportHeight(viewportElement ? viewportElement.offsetHeight : html.clientHeight);

        const fontSize = parseFloat(getComputedStyle(html).fontSize);
        if (Number.isFinite(fontSize)) {
          setRootFontSize(fontSize);
        }
      };

      measureViewportHeight();

      if (!viewportElement || typeof ResizeObserver !== 'function') {
        return undefined;
      }

      const resizeObserver = new ResizeObserver(measureViewportHeight);
      resizeObserver.observe(viewportElement);
      return () => {
        resizeObserver.disconnect();
      };
    },
  );

  const resolvedSnapPoints = createMemo<ResolvedDrawerSnapPoint[]>(() => {
    const snapPoints = drawer.snapPoints;
    const popupHeight = drawer.popupHeight;
    const height = viewportHeight();
    const fontSize = rootFontSize();
    if (!snapPoints || snapPoints.length === 0 || height <= 0 || popupHeight <= 0) {
      return [];
    }

    const maxHeight = Math.min(popupHeight, height);

    const resolved = snapPoints
      .map((value): ResolvedDrawerSnapPoint | null => {
        const resolvedHeight = resolveSnapPointValue(value, height, fontSize);
        if (resolvedHeight === null) {
          return null;
        }

        const clampedHeight = clamp(resolvedHeight, 0, maxHeight);
        return {
          value,
          height: clampedHeight,
          offset: Math.max(0, popupHeight - clampedHeight),
        };
      })
      .filter((point): point is ResolvedDrawerSnapPoint => Boolean(point));

    if (resolved.length <= 1) {
      return resolved;
    }

    const deduped: ResolvedDrawerSnapPoint[] = [];
    const seenHeights: number[] = [];

    for (let index = resolved.length - 1; index >= 0; index -= 1) {
      const point = resolved[index];
      const isDuplicate = seenHeights.some((seen) => Math.abs(seen - point.height) <= 1);
      if (isDuplicate) {
        continue;
      }

      seenHeights.push(point.height);
      deduped.push(point);
    }

    deduped.reverse();
    return deduped;
  });

  const activeSnapPointOffset = createMemo(() => {
    const activeSnapPoint = drawer.activeSnapPoint;
    if (activeSnapPoint === null) {
      return null;
    }

    const points = resolvedSnapPoints();
    const exactMatch = points.find((point) => Object.is(point.value, activeSnapPoint));
    if (exactMatch) {
      return exactMatch.offset;
    }

    const height = viewportHeight();
    const maxHeight = Math.min(drawer.popupHeight, height);
    const resolvedHeight = resolveSnapPointValue(activeSnapPoint, height, rootFontSize());
    if (resolvedHeight === null) {
      return null;
    }

    const clampedHeight = clamp(resolvedHeight, 0, maxHeight);
    return (
      points[
        closestSnapPointIndex(
          points.map((point) => point.height),
          clampedHeight,
        )
      ]?.offset ?? null
    );
  });

  return {
    get snapPoints() {
      return drawer.snapPoints;
    },
    get activeSnapPoint() {
      return drawer.activeSnapPoint;
    },
    setActiveSnapPoint: drawer.setActiveSnapPoint,
    get popupHeight() {
      return drawer.popupHeight;
    },
    get viewportHeight() {
      return viewportHeight();
    },
    get resolvedSnapPoints() {
      return resolvedSnapPoints();
    },
    get activeSnapPointOffset() {
      return activeSnapPointOffset();
    },
  };
}
