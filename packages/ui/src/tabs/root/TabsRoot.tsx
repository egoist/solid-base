import { createEffect, createMemo, createSignal, omit, untrack } from 'solid-js';
import type { BaseUIComponentProps, Orientation as BaseOrientation } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import {
  CompositeList,
  createCompositeList,
  type CompositeMetadata,
} from '../../internals/composite/list/CompositeList';
import { TabsRootContext } from './TabsRootContext';
import { tabsStateAttributesMapping } from './stateAttributesMapping';
import type { TabsTab } from '../tab/TabsTab';
import type { TabsPanel } from '../panel/TabsPanel';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

const UNSET = Symbol('unset');

type TabMap = Map<HTMLElement, CompositeMetadata<TabsTab.Metadata>>;

/**
 * Groups the tabs and the corresponding panels.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsRoot(componentProps: TabsRoot.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'value',
    'defaultValue',
    'onValueChange',
    'orientation',
  );

  // `defaultValue` is an initial value by contract: read once.
  const initialDefaultValue: TabsTab.Value = untrack(() => componentProps.defaultValue);
  // Track whether the user explicitly provided a defined `defaultValue` prop.
  // Used to determine if we should honor a disabled tab selection.
  const hasExplicitDefaultValueProp = initialDefaultValue !== undefined;
  const defaultValue = hasExplicitDefaultValueProp ? initialDefaultValue : 0;

  const isControlled = () => componentProps.value !== undefined;
  const orientation = () => componentProps.orientation ?? 'horizontal';

  // The tabs register in this list (through `<Tabs.List>`), the panels in `panelList`.
  const tabList = createCompositeList<TabsTab.Metadata>();
  const panelList = createCompositeList<TabsPanel.Metadata>();
  const tabMap: () => TabMap = tabList.map;

  // The uncontrolled selection. It's a writable memo: user selections write it, and it falls
  // back on its own when the selected tab is missing or disabled (uncontrolled roots own the
  // automatic fallback; controlled roots keep the exact value supplied by the parent).
  const [selection, setSelection] = createSignal<Selection>(
    (prev) => {
      const state = prev ?? {
        value: defaultValue,
        notification: null,
        didRegisterTabs: false,
        lastKnownTabElement: undefined,
        // An explicit defaultValue can intentionally point at a disabled tab on mount.
        // Once that selection becomes valid, later disabled states should fall back.
        honorDisabledDefaultValue: hasExplicitDefaultValueProp,
        // Implicit uncontrolled selections are still automatic changes, so notify
        // once when the tabs first register. Explicit defaults are treated as user-owned.
        notifyInitialValueChange: !hasExplicitDefaultValueProp,
      };
      const map = tabMap();
      if (isControlled()) {
        return state;
      }
      return resolveSelection(state, map, initialDefaultValue);
    },
    { name: 'TabsRoot.selection', equals: isSameSelection },
  );

  const selectedValue = createMemo(() => selection().value);
  const value = (): TabsTab.Value =>
    componentProps.value !== undefined ? componentProps.value : selectedValue();

  function getTabElementBySelectedValue(selectedValue: TabsTab.Value): HTMLElement | null {
    return findTabElement(tabMap(), selectedValue);
  }

  // The value the current activation direction was computed from. Plain variables: they're a
  // snapshot of the last committed selection, not reactive state.
  let previousValue: TabsTab.Value = UNSET;
  let consumedNotification: SelectionNotification | null = null;

  const tabActivationDirection = createMemo<TabsTab.ActivationDirection>((previous) => {
    const currentValue = value();
    const map = tabMap();
    const currentOrientation = orientation();
    const notification = isControlled() ? null : selection().notification;

    if (previousValue === UNSET) {
      previousValue = currentValue;
      return 'none';
    }

    if (notification?.fallback && notification !== consumedNotification) {
      // Automatic fallbacks are not directional transitions.
      consumedNotification = notification;
      previousValue = currentValue;
      return 'none';
    }

    if (previousValue === currentValue) {
      return previous ?? 'none';
    }

    const direction = computeActivationDirection(
      previousValue,
      currentValue,
      currentOrientation,
      map,
    );

    // When a new tab is added and selected in the same controlled update, the tab element may
    // not yet be registered in the tab map, so direction was computed from a value-based
    // fallback. Keep the previous value snapshot stale so we re-compute from DOM positions once
    // the tab map is up to date.
    const directionComputationIncomplete =
      previousValue != null && currentValue != null && findTabElement(map, currentValue) == null;

    if (!directionComputationIncomplete) {
      previousValue = currentValue;
    }

    return direction;
  });

  function onValueChange(newValue: TabsTab.Value, eventDetails: TabsRoot.ChangeEventDetails) {
    eventDetails.activationDirection = computeActivationDirection(
      value(),
      newValue,
      orientation(),
      tabMap(),
    );

    componentProps.onValueChange?.(newValue, eventDetails);

    if (eventDetails.isCanceled || isControlled()) {
      return;
    }

    const map = tabMap();
    setSelection((prev) =>
      resolveSelection({ ...prev, value: newValue, notification: null }, map, initialDefaultValue),
    );
  }

  // Report automatic selections (fallbacks and the implicit initial selection).
  createEffect(
    () => (isControlled() ? null : selection().notification),
    (notification) => {
      if (!notification) {
        return;
      }
      componentProps.onValueChange?.(
        notification.value,
        createChangeEventDetails(notification.reason, undefined, undefined, {
          activationDirection: 'none' as TabsTab.ActivationDirection,
        }),
      );
    },
  );

  const contextValue: TabsRootContext = {
    value,
    onValueChange,
    orientation,
    getTabElementBySelectedValue,
    getTabIdByPanelValue(panelValue) {
      for (const metadata of tabMap().values()) {
        if (panelValue === metadata.value) {
          return metadata.id;
        }
      }
      return undefined;
    },
    getTabPanelIdByValue(tabValue) {
      // Panels are registered while they're rendered. The last one sharing a value owns it.
      let panelId: string | undefined;
      for (const metadata of panelList.map().values()) {
        if (metadata.value === tabValue) {
          panelId = metadata.id;
        }
      }
      return panelId;
    },
    tabList,
    tabActivationDirection,
  };

  const state: TabsRootState = {
    get orientation() {
      return orientation();
    },
    get tabActivationDirection() {
      return tabActivationDirection();
    },
  };

  return (
    <TabsRootContext value={contextValue}>
      <CompositeList list={panelList}>
        {renderElement('div', componentProps, {
          state,
          props: elementProps,
          stateAttributesMapping: tabsStateAttributesMapping,
        })}
      </CompositeList>
    </TabsRootContext>
  );
}

interface SelectionNotification {
  value: TabsTab.Value;
  reason: TabsRoot.ChangeEventReason;
  /** Whether the value changed (a fallback), as opposed to confirming the initial value. */
  fallback: boolean;
}

interface Selection {
  value: TabsTab.Value;
  /** The automatic change to report through `onValueChange`, if the last update was one. */
  notification: SelectionNotification | null;
  didRegisterTabs: boolean;
  lastKnownTabElement: HTMLElement | undefined;
  honorDisabledDefaultValue: boolean;
  notifyInitialValueChange: boolean;
}

function isSameSelection(a: Selection, b: Selection) {
  return (
    a.value === b.value &&
    a.notification === b.notification &&
    a.didRegisterTabs === b.didRegisterTabs &&
    a.lastKnownTabElement === b.lastKnownTabElement &&
    a.honorDisabledDefaultValue === b.honorDisabledDefaultValue &&
    a.notifyInitialValueChange === b.notifyInitialValueChange
  );
}

/**
 * Applies the automatic fallback of uncontrolled roots to a selection: when the selected tab is
 * missing or disabled, the first enabled tab (or `null`) is selected instead.
 */
function resolveSelection(
  state: Selection,
  map: TabMap,
  initialDefaultValue: TabsTab.Value,
): Selection {
  const currentValue = state.value;
  let next: Selection = state.notification ? { ...state, notification: null } : state;

  function commitAutomaticValueChange(
    fallbackValue: TabsTab.Value,
    reason: TabsRoot.ChangeEventReason,
  ): Selection {
    return {
      ...next,
      value: fallbackValue,
      notification: { value: fallbackValue, reason, fallback: true },
      notifyInitialValueChange: false,
    };
  }

  if (map.size === 0) {
    if (state.didRegisterTabs && currentValue !== null && !state.lastKnownTabElement?.isConnected) {
      return commitAutomaticValueChange(null, REASONS.missing);
    }
    return next;
  }

  let selected: CompositeMetadata<TabsTab.Metadata> | undefined;
  let firstEnabledTabValue: TabsTab.Value | undefined;
  let hasFirstEnabledTab = false;

  for (const metadata of map.values()) {
    if (selected === undefined && metadata.value === currentValue) {
      selected = metadata;
    }
    if (!hasFirstEnabledTab && !metadata.disabled) {
      hasFirstEnabledTab = true;
      firstEnabledTabValue = metadata.value;
    }
  }

  const selectedFound = selected != null;
  const selectedDisabled = selected?.disabled ?? false;
  const lastKnownTabElement: HTMLElement | undefined = map.keys().next().value;

  if (!next.didRegisterTabs || next.lastKnownTabElement !== lastKnownTabElement) {
    next = { ...next, didRegisterTabs: true, lastKnownTabElement };
  }

  if (!selectedDisabled && currentValue === initialDefaultValue && next.honorDisabledDefaultValue) {
    next = { ...next, honorDisabledDefaultValue: false };
  }

  if (next.honorDisabledDefaultValue && selectedDisabled && currentValue === initialDefaultValue) {
    return next;
  }

  const selectionIsMissing = !selectedFound && currentValue !== null;

  if (selectedDisabled || selectionIsMissing) {
    const fallbackValue = firstEnabledTabValue ?? null;

    if (currentValue === fallbackValue) {
      // Already at the fallback value; no commit or notification needed,
      // but record that the implicit-initial transition has resolved.
      return next.notifyInitialValueChange ? { ...next, notifyInitialValueChange: false } : next;
    }

    let fallbackReason: TabsRoot.ChangeEventReason = REASONS.missing;

    if (next.notifyInitialValueChange) {
      fallbackReason = REASONS.initial;
    } else if (selectedDisabled) {
      fallbackReason = REASONS.disabled;
    }

    return commitAutomaticValueChange(fallbackValue, fallbackReason);
  }

  if (next.notifyInitialValueChange && selectedFound) {
    return {
      ...next,
      notification: { value: currentValue, reason: REASONS.initial, fallback: false },
      notifyInitialValueChange: false,
    };
  }

  return next;
}

function findTabElement(tabMap: TabMap, value: TabsTab.Value): HTMLElement | null {
  for (const [tabElement, tabMetadata] of tabMap.entries()) {
    if (value === tabMetadata.value) {
      return tabElement;
    }
  }

  return null;
}

function computeActivationDirection(
  oldValue: TabsTab.Value | null,
  newValue: TabsTab.Value | null,
  orientation: 'horizontal' | 'vertical',
  tabMap: TabMap,
): TabsTab.ActivationDirection {
  if (oldValue == null || newValue == null) {
    return 'none';
  }

  const [positionProp, backward, forward] =
    orientation === 'horizontal'
      ? (['left', 'left', 'right'] as const)
      : (['top', 'up', 'down'] as const);

  const oldTab = findTabElement(tabMap, oldValue);
  const newTab = findTabElement(tabMap, newValue);

  if (oldTab == null || newTab == null) {
    // Fallback for dynamic tabs: when a tab element isn't registered yet
    // (e.g. added and selected in the same update), infer direction from
    // the values themselves. Works for comparable types (numbers, strings).
    if (
      oldTab !== newTab &&
      (typeof oldValue === 'number' || typeof oldValue === 'string') &&
      typeof oldValue === typeof newValue
    ) {
      return newValue > oldValue ? forward : backward;
    }
    return 'none';
  }

  const oldPosition = oldTab.getBoundingClientRect()[positionProp];
  const newPosition = newTab.getBoundingClientRect()[positionProp];

  if (newPosition < oldPosition) {
    return backward;
  }
  if (newPosition > oldPosition) {
    return forward;
  }

  return 'none';
}

export type TabsRootOrientation = BaseOrientation;

export interface TabsRootState {
  /**
   * The component orientation.
   */
  orientation: TabsRoot.Orientation;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: TabsTab.ActivationDirection;
}

export interface TabsRootProps extends BaseUIComponentProps<'div', TabsRootState> {
  /**
   * The value of the currently active `Tab`. Use when the component is controlled.
   * When the value is `null`, no Tab will be active.
   */
  value?: TabsTab.Value | undefined;
  /**
   * The default value. Use when the component is not controlled.
   * When the value is `null`, no Tab will be active.
   * @default 0
   */
  defaultValue?: TabsTab.Value | undefined;
  /**
   * The component orientation (layout flow direction).
   * @default 'horizontal'
   */
  orientation?: TabsRoot.Orientation | undefined;
  /**
   * Callback invoked when new value is being set.
   *
   * The event `reason` is `'none'` for user-initiated changes, such as a click
   * or keyboard navigation; `'initial'` for the first automatic selection or
   * fallback in uncontrolled roots when `defaultValue` is omitted or
   * `undefined`, including when the implicit initial value is disabled or
   * missing; `'disabled'` for automatic fallback when the selected tab becomes
   * disabled in uncontrolled roots; or `'missing'` for automatic fallback when
   * the selected tab is removed, or when an explicit `defaultValue` never
   * matches a mounted tab in uncontrolled roots.
   *
   * For automatic changes, the selected value can be `null` when no enabled Tab
   * is available as a fallback.
   *
   * Automatic changes cannot be canceled; calling `eventDetails.cancel()` for
   * `'initial'`, `'disabled'`, or `'missing'` has no effect.
   */
  onValueChange?:
    | ((value: TabsTab.Value, eventDetails: TabsRoot.ChangeEventDetails) => void)
    | undefined;
}

export type TabsRootChangeEventReason =
  | typeof REASONS.none
  | typeof REASONS.disabled
  | typeof REASONS.missing
  | typeof REASONS.initial;
export type TabsRootChangeEventDetails = BaseUIChangeEventDetails<
  TabsRoot.ChangeEventReason,
  { activationDirection: TabsTab.ActivationDirection }
>;

export namespace TabsRoot {
  export type State = TabsRootState;
  export type Props = TabsRootProps;
  export type Orientation = TabsRootOrientation;
  export type ChangeEventReason = TabsRootChangeEventReason;
  export type ChangeEventDetails = TabsRootChangeEventDetails;
}
