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

  // Values are boxed: tab values can be functions, which signals would treat as updaters.
  const [internalValue, setInternalValue] = createSignal<{ current: TabsTab.Value }>({
    current: defaultValue,
  });

  const isControlled = () => componentProps.value !== undefined;
  const value = (): TabsTab.Value =>
    componentProps.value !== undefined ? componentProps.value : internalValue().current;
  const setValue = (next: TabsTab.Value) => setInternalValue({ current: next });

  const orientation = () => componentProps.orientation ?? 'horizontal';

  const [tabMap, setTabMap] = createSignal<TabMap>(new Map());
  const [mountedTabPanels, setMountedTabPanels] = createSignal(
    new Map<TabsTab.Value, string>(),
  );

  const panelList = createCompositeList<TabsPanel.Metadata>();

  function getTabElementBySelectedValue(selectedValue: TabsTab.Value): HTMLElement | null {
    return findTabElement(tabMap(), selectedValue);
  }

  // The value the current activation direction was computed from. Plain variables: they're a
  // snapshot of the last committed selection, not reactive state.
  let previousValue: TabsTab.Value = UNSET;
  let resetActivationDirection = false;

  const tabActivationDirection = createMemo<TabsTab.ActivationDirection>((previous) => {
    const currentValue = value();
    const map = tabMap();
    const currentOrientation = orientation();

    if (previousValue === UNSET) {
      previousValue = currentValue;
      return 'none';
    }

    if (resetActivationDirection) {
      // Automatic fallbacks are not directional transitions.
      resetActivationDirection = false;
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

    setValue(newValue);
  }

  function notifyAutomaticValueChange(
    nextValue: TabsTab.Value,
    reason: TabsRoot.ChangeEventReason,
  ) {
    componentProps.onValueChange?.(
      nextValue,
      createChangeEventDetails(reason, undefined, undefined, {
        activationDirection: 'none' as TabsTab.ActivationDirection,
      }),
    );
  }

  function registerMountedTabPanel(panelValue: TabsTab.Value, panelId: string) {
    setMountedTabPanels((prev) => {
      const next = new Map(prev);
      next.set(panelValue, panelId);
      return next;
    });

    return () => {
      setMountedTabPanels((prev) => {
        // Another panel with the same value took ownership in the meantime;
        // leave its registration in place.
        if (prev.get(panelValue) !== panelId) {
          return prev;
        }

        const next = new Map(prev);
        next.delete(panelValue);
        return next;
      });
    };
  }

  // Implicit uncontrolled selections are still automatic changes, so notify
  // once when the tabs first register. Explicit defaults are treated as user-owned.
  let shouldNotifyInitialValueChange = !hasExplicitDefaultValueProp;
  // An explicit defaultValue can intentionally point at a disabled tab on mount.
  // Once that selection becomes valid, later disabled states should fall back.
  let shouldHonorDisabledDefaultValue = hasExplicitDefaultValueProp;
  let didRegisterTabs = false;
  let lastKnownTabElement: HTMLElement | undefined;

  // Uncontrolled roots own automatic fallback. Controlled roots keep the exact
  // value supplied by the parent, even when that tab is disabled or missing.
  createEffect(
    () => {
      if (isControlled()) {
        return null;
      }

      const map = tabMap();
      const currentValue = value();
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

      return {
        map,
        value: currentValue,
        selectedFound: selected != null,
        selectedDisabled: selected?.disabled ?? false,
        firstEnabledTabValue,
      };
    },
    (snapshot) => {
      if (snapshot == null) {
        return;
      }

      const { map, value: currentValue, selectedFound, selectedDisabled } = snapshot;

      function commitAutomaticValueChange(
        fallbackValue: TabsTab.Value,
        fallbackReason: TabsRoot.ChangeEventReason,
      ) {
        setValue(fallbackValue);
        // Automatic fallbacks are not directional transitions; reset the direction
        // alongside the value.
        previousValue = fallbackValue;
        resetActivationDirection = true;
        notifyAutomaticValueChange(fallbackValue, fallbackReason);
        // Mark the initial notification as delivered only after the consumer callback returns.
        shouldNotifyInitialValueChange = false;
      }

      if (map.size === 0) {
        if (didRegisterTabs && currentValue !== null && !lastKnownTabElement?.isConnected) {
          commitAutomaticValueChange(null, REASONS.missing);
        }
        return;
      }

      didRegisterTabs = true;
      lastKnownTabElement = map.keys().next().value;

      const selectionIsMissing = !selectedFound && currentValue !== null;

      if (!selectedDisabled && currentValue === initialDefaultValue) {
        shouldHonorDisabledDefaultValue = false;
      }

      if (
        shouldHonorDisabledDefaultValue &&
        selectedDisabled &&
        currentValue === initialDefaultValue
      ) {
        return;
      }

      if (selectedDisabled || selectionIsMissing) {
        const fallbackValue = snapshot.firstEnabledTabValue ?? null;

        if (currentValue === fallbackValue) {
          // Already at the fallback value; no commit or notification needed,
          // but record that the implicit-initial transition has resolved.
          shouldNotifyInitialValueChange = false;
          return;
        }

        let fallbackReason: TabsRoot.ChangeEventReason = REASONS.missing;

        if (shouldNotifyInitialValueChange) {
          fallbackReason = REASONS.initial;
        } else if (selectedDisabled) {
          fallbackReason = REASONS.disabled;
        }

        commitAutomaticValueChange(fallbackValue, fallbackReason);
        return;
      }

      if (shouldNotifyInitialValueChange && selectedFound) {
        notifyAutomaticValueChange(currentValue, REASONS.initial);
        shouldNotifyInitialValueChange = false;
      }
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
      return mountedTabPanels().get(tabValue);
    },
    registerMountedTabPanel,
    setTabMap: (map) => setTabMap(map),
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
