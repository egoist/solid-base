import { createEffect, createSignal, omit, onSettled, Show, untrack } from 'solid-js';
import { isServer, type JSX } from '@solidjs/web';
import { getParentNode, isHTMLElement, isLastTraversableNode } from '@floating-ui/utils/dom';
import { ownerWindow } from '@egoist/solid-base-utils/owner';
import { renderElement } from '../../internals/renderElement';
import { useCSPContext } from '../../internals/csp-context/CSPContext';
import { getCssDimensions } from '../../utils/getCssDimensions';
import { getElementTransform } from '../../utils/getElementTransform';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { TabsRoot, TabsRootState } from '../root/TabsRoot';
import { useTabsRootContext } from '../root/TabsRootContext';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsListContext } from '../list/TabsListContext';
import type { TabsTab } from '../tab/TabsTab';
import * as TabsIndicatorCssVars from './TabsIndicatorCssVars';
import { script as prehydrationScript } from './prehydrationScript.min';

const stateAttributesMapping: StateAttributesMapping<TabsIndicatorState> = {
  ...(tabsStateAttributesMapping as StateAttributesMapping<TabsIndicatorState>),
  activeTabPosition: () => null,
  activeTabSize: () => null,
};

// `offsetLeft`/`offsetTop` are rounded to whole pixels and the error can compound
// across the offset parent chain.
const MAX_LAYOUT_ROUNDING_ERROR = 2;

interface IndicatorMeasurement {
  position: TabsTab.Position;
  size: TabsTab.Size;
}

/**
 * A visual indicator that can be styled to match the position of the currently active tab.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsIndicator(componentProps: TabsIndicator.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'renderBeforeHydration');

  const rootContext = useTabsRootContext();
  const listContext = useTabsListContext();
  const csp = useCSPContext();

  // Bumped whenever the tab list or one of its tabs resizes, to re-measure the active tab.
  const [version, setVersion] = createSignal(0);

  onSettled(() =>
    listContext.registerIndicatorUpdateListener(() => {
      setVersion((current) => current + 1);
    }),
  );

  // Layout is measured once the DOM updated (an effect), not while the graph computes: the
  // active tab's position is read from the DOM, outside of the reactive graph.
  const [measurement, setMeasurement] = createSignal<IndicatorMeasurement | null>(null, {
    name: 'TabsIndicator.measurement',
    equals: isSameMeasurement,
  });

  function getActiveTab() {
    const value = rootContext.value();
    const tabsListElement = listContext.tabsListElement();
    if (value == null || tabsListElement == null) {
      return null;
    }
    return rootContext.getTabElementBySelectedValue(value);
  }

  function measure(): IndicatorMeasurement | null {
    return untrack(() => {
      const activeTab = getActiveTab();
      const tabsListElement = listContext.tabsListElement();
      return activeTab && tabsListElement ? measureActiveTab(activeTab, tabsListElement) : null;
    });
  }

  createEffect(
    () => {
      version();
      return getActiveTab();
    },
    () => {
      setMeasurement(measure());
    },
  );

  const displayIndicator = () => {
    const current = measurement();
    return current != null && current.size.width > 0 && current.size.height > 0;
  };

  const state: TabsIndicatorState = {
    get orientation() {
      return rootContext.orientation();
    },
    get activeTabPosition() {
      return measurement()?.position ?? null;
    },
    get activeTabSize() {
      return measurement()?.size ?? null;
    },
    get tabActivationDirection() {
      return rootContext.tabActivationDirection();
    },
  };

  const indicatorProps: HTMLProps = {
    role: 'presentation',
    get style() {
      const current = measurement();
      if (current == null) {
        return undefined;
      }
      const { position, size } = current;
      return {
        [TabsIndicatorCssVars.activeTabLeft]: `${position.left}px`,
        [TabsIndicatorCssVars.activeTabRight]: `${position.right}px`,
        [TabsIndicatorCssVars.activeTabTop]: `${position.top}px`,
        [TabsIndicatorCssVars.activeTabBottom]: `${position.bottom}px`,
        [TabsIndicatorCssVars.activeTabWidth]: `${size.width}px`,
        [TabsIndicatorCssVars.activeTabHeight]: `${size.height}px`,
      } as JSX.CSSProperties;
    },
    // Do not display the indicator before the layout is settled.
    get hidden() {
      return !displayIndicator();
    },
  };

  const hasValue = () => rootContext.value() != null;

  return (
    <Show when={hasValue()}>
      {renderElement('span', componentProps, {
        state,
        props: [indicatorProps, elementProps],
        stateAttributesMapping,
      })}
      {/* The script positions the server-rendered indicator before hydration. It's only
          emitted on the server: the client never renders it. */}
      {isServer && componentProps.renderBeforeHydration ? (
        <script nonce={csp.nonce} innerHTML={prehydrationScript} />
      ) : null}
    </Show>
  );
}

function isSameMeasurement(a: IndicatorMeasurement | null, b: IndicatorMeasurement | null) {
  if (a === b) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  return (
    a.position.left === b.position.left &&
    a.position.right === b.position.right &&
    a.position.top === b.position.top &&
    a.position.bottom === b.position.bottom &&
    a.size.width === b.size.width &&
    a.size.height === b.size.height
  );
}

function measureActiveTab(
  activeTab: HTMLElement,
  tabsListElement: HTMLElement,
): IndicatorMeasurement {
  const { width: computedWidth, height: computedHeight } = getCssDimensions(activeTab);
  const { width: tabListWidth, height: tabListHeight } = getCssDimensions(tabsListElement);
  const tabRect = activeTab.getBoundingClientRect();
  const tabsListRect = tabsListElement.getBoundingClientRect();
  const scaleX = tabListWidth > 0 ? tabsListRect.width / tabListWidth : 1;
  const scaleY = tabListHeight > 0 ? tabsListRect.height / tabListHeight : 1;

  // Layout offsets are immune to transforms, but lose sub-pixel precision.
  const layoutOffset = getLayoutOffset(activeTab, tabsListElement);
  let left = layoutOffset.left;
  let top = layoutOffset.top;

  const rectLeft =
    (tabRect.left - tabsListRect.left) / scaleX +
    tabsListElement.scrollLeft -
    tabsListElement.clientLeft;
  const rectTop =
    (tabRect.top - tabsListRect.top) / scaleY +
    tabsListElement.scrollTop -
    tabsListElement.clientTop;

  // The rect-based offset is sub-pixel-precise but is derived from projected viewport
  // geometry: a rotation, skew, flip, perspective, or 3D transform on the tab or any
  // ancestor warps it beyond what the scale division can undo. When it agrees with the
  // layout offset (up to layout rounding), no distortion is in effect and the more
  // precise value is safe to use. A tab list scaled to zero divides by zero just above,
  // and the resulting `NaN`/`Infinity` fails this same check, leaving the layout offset
  // in place.
  //
  // The active tab's own translation moves the rect but not the layout offset, so
  // strip it from the comparison. This lets the indicator follow tab-local animations.
  const tabTranslation = getActiveTabTranslation(activeTab);
  if (
    Math.abs(rectLeft - tabTranslation.x - left) <= MAX_LAYOUT_ROUNDING_ERROR &&
    Math.abs(rectTop - tabTranslation.y - top) <= MAX_LAYOUT_ROUNDING_ERROR
  ) {
    left = rectLeft;
    top = rectTop;
  }

  const width = computedWidth;
  const height = computedHeight;
  const right = tabsListElement.scrollWidth - left - width;
  const bottom = tabsListElement.scrollHeight - top - height;

  return {
    position: { left, right, top, bottom },
    size: { width, height },
  };
}

export interface TabsIndicatorState extends TabsRootState {
  /**
   * The active tab position.
   */
  activeTabPosition: TabsTab.Position | null;
  /**
   * The active tab size.
   */
  activeTabSize: TabsTab.Size | null;
  /**
   * The component orientation.
   */
  orientation: TabsRoot.Orientation;
}

export interface TabsIndicatorProps extends BaseUIComponentProps<'span', TabsIndicatorState> {
  /**
   * Whether to render itself before the client hydrates.
   * This minimizes the time that the indicator isn't visible after server-side rendering.
   * @default false
   */
  renderBeforeHydration?: boolean | undefined;
}

export namespace TabsIndicator {
  export type State = TabsIndicatorState;
  export type Props = TabsIndicatorProps;
}

function getLayoutOffset(element: HTMLElement, ancestor: HTMLElement) {
  const elementOffset = getCumulativeOffset(element);
  const ancestorOffset = getCumulativeOffset(ancestor);

  let left = elementOffset.left - ancestorOffset.left - ancestor.clientLeft;
  let top = elementOffset.top - ancestorOffset.top - ancestor.clientTop;

  // `offsetLeft`/`offsetTop` describe layout, and scrolling doesn't change layout: a scroll
  // container between the tab and the list moves the tab on screen while its layout slot stays
  // put. Subtract that scroll so this offset remains comparable with the rect-based one. The
  // list's own scroll is deliberately excluded: the indicator sits inside it and scrolls along
  // with the tab.
  //
  // `getParentNode` crosses shadow boundaries (and slots), so a tab inside a shadow root still
  // reaches the scroll containers between it and the list.
  let node: Node | null = getParentNode(element);
  while (isHTMLElement(node) && node !== ancestor && !isLastTraversableNode(node)) {
    left -= node.scrollLeft;
    top -= node.scrollTop;
    node = getParentNode(node);
  }

  return { left, top };
}

function getCumulativeOffset(element: HTMLElement) {
  let left = 0;
  let top = 0;
  let currentElement: HTMLElement | null = element;

  while (currentElement != null) {
    left += currentElement.offsetLeft;
    top += currentElement.offsetTop;

    const offsetParent = currentElement.offsetParent as HTMLElement | null;
    if (offsetParent != null) {
      left += offsetParent.clientLeft;
      top += offsetParent.clientTop;
    }

    currentElement = offsetParent;
  }

  return { left, top };
}

// Returns the active tab's own 2D translation, in CSS pixels: the translation component of
// the computed `transform` matrix plus the `translate` longhand. CSS composes the two as
// `translate → rotate → scale → transform`, so adding them is only exact when no rotation or
// scale is in play. That is enough here: with either of those present the caller's agreement
// check rejects the rect-based offset regardless of the translation, and the tab's layout
// slot is used instead.
function getActiveTabTranslation(element: HTMLElement) {
  const computedStyle = ownerWindow(element).getComputedStyle(element);
  const { x, y } = getElementTransform(element, computedStyle);
  let translateX = x;
  let translateY = y;

  // The `translate` longhand is a separate property and is not reflected in the
  // computed `transform` matrix that `getElementTransform` reads. `getComputedStyle`
  // resolves absolute and font-relative lengths to pixels but keeps percentages, which
  // resolve against the tab's border box.
  const { translate } = computedStyle;
  if (translate && translate !== 'none') {
    const parts = translate.split(' ');
    translateX += resolveTranslateLength(parts[0], element.offsetWidth);
    translateY += resolveTranslateLength(parts[1], element.offsetHeight);
  }

  return { x: translateX, y: translateY };
}

// Resolves a single `translate` longhand component to pixels. Percentages resolve against
// the given border-box size; anything that isn't a plain number or percentage (e.g.
// `calc(...)`) is treated as no translation, so the indicator falls back to the tab's
// layout slot rather than guessing.
function resolveTranslateLength(value: string | undefined, referenceSize: number): number {
  if (!value) {
    return 0;
  }
  const numeric = parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return value.endsWith('%') ? (numeric / 100) * referenceSize : numeric;
}
