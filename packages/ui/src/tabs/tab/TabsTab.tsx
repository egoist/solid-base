import { omit, onCleanup } from 'solid-js';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { createBaseUiId } from '../../internals/baseUiId';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../internals/types';
import { createButton } from '../../internals/use-button/createButton';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { createCompositeItem } from '../../internals/composite/item/createCompositeItem';
import type { TabsRoot } from '../root/TabsRoot';
import { useTabsRootContext } from '../root/TabsRootContext';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsListContext } from '../list/TabsListContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

/**
 * An individual interactive tab button that toggles the corresponding panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Solid Base Tabs](https://base.egoist.dev/components/tabs)
 */
export function TabsTab(componentProps: TabsTab.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'value',
    'id',
    'nativeButton',
  );

  const rootContext = useTabsRootContext();
  const listContext = useTabsListContext();

  const disabled = () => componentProps.disabled ?? false;
  const id = createBaseUiId(() => componentProps.id || undefined);

  const tabMetadata: TabsTab.Metadata = {
    get disabled() {
      return disabled();
    },
    get id() {
      return id();
    },
    get value() {
      return componentProps.value;
    },
  };

  const { compositeProps, compositeRef } = createCompositeItem<TabsTab.Metadata>({
    metadata: tabMetadata,
  });

  const active = () => componentProps.value === rootContext.value();

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => componentProps.nativeButton ?? true,
    focusableWhenDisabled: () => true,
  });

  // Registered from the ref callback so the observer follows the rendered element.
  let unobserveTabElement: (() => void) | null = null;
  function observeTabElement(element: HTMLElement) {
    unobserveTabElement?.();
    unobserveTabElement = listContext.registerTabResizeObserverElement(element);
  }
  onCleanup(() => {
    unobserveTabElement?.();
    unobserveTabElement = null;
  });

  let isPressing = false;
  let isMainButton = false;

  // Both callers guard on `!active`, so the current value is never re-committed.
  function activate(event: Event) {
    rootContext.onValueChange(
      componentProps.value,
      createChangeEventDetails(REASONS.none, event, undefined, {
        activationDirection: 'none' as TabsTab.ActivationDirection,
      }),
    );
  }

  const tabProps: HTMLProps = {
    role: 'tab',
    get 'aria-controls'() {
      return rootContext.getTabPanelIdByValue(componentProps.value);
    },
    get 'aria-selected'() {
      return active();
    },
    get id() {
      return id();
    },
    get [ACTIVE_COMPOSITE_ITEM]() {
      return active() ? '' : undefined;
    },
    onClick(event: MouseEvent) {
      if (active() || disabled()) {
        return;
      }

      activate(event);
    },
    onFocus(event: FocusEvent) {
      if (active() || disabled()) {
        return;
      }

      if (
        listContext.activateOnFocus() &&
        (!isPressing || // keyboard or touch focus
          isMainButton) // main mouse button focus
      ) {
        activate(event);
      }
    },
    onPointerDown(event: PointerEvent) {
      if (active() || disabled()) {
        return;
      }

      isPressing = true;
      // Secondary presses (context menu, middle click) may focus the tab, but
      // must not activate it with `activateOnFocus`.
      isMainButton = event.button === 0;

      // Registered for every button so a secondary press doesn't leave the tab
      // stuck in the pressing state, which would suppress later focus activation.
      const doc = ownerDocument(event.currentTarget as Element);

      function handlePointerEnd() {
        isPressing = false;
        isMainButton = false;
        doc.removeEventListener('pointerup', handlePointerEnd);
        doc.removeEventListener('pointercancel', handlePointerEnd);
      }

      doc.addEventListener('pointerup', handlePointerEnd);
      doc.addEventListener('pointercancel', handlePointerEnd);
    },
  };

  const state: TabsTabState = {
    get disabled() {
      return disabled();
    },
    get active() {
      return active();
    },
    get orientation() {
      return rootContext.orientation();
    },
    get tabActivationDirection() {
      return rootContext.tabActivationDirection();
    },
  };

  return renderElement('button', componentProps, {
    state,
    ref: [buttonRef, compositeRef, observeTabElement],
    props: [compositeProps, tabProps, elementProps, getButtonProps],
    stateAttributesMapping: tabsStateAttributesMapping,
  });
}

export type TabsTabValue = any | null;

export type TabsTabActivationDirection = 'left' | 'right' | 'up' | 'down' | 'none';

export interface TabsTabPosition {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface TabsTabSize {
  width: number;
  height: number;
}

export interface TabsTabMetadata {
  disabled: boolean;
  id: string | undefined;
  value: TabsTab.Value | undefined;
}

export interface TabsTabState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the component is active.
   */
  active: boolean;
  /**
   * The component orientation.
   */
  orientation: TabsRoot.Orientation;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: TabsTab.ActivationDirection;
}

export interface TabsTabProps
  extends NativeButtonProps, Omit<BaseUIComponentProps<'button', TabsTabState>, 'value'> {
  /**
   * The value of the Tab.
   */
  value: TabsTab.Value;
  /**
   * Whether the Tab is disabled.
   *
   * If a first Tab on a `<Tabs.List>` is disabled, it won't initially be selected.
   * Instead, the next enabled Tab will be selected.
   * However, it does not work like this during server-side rendering, as it is not known
   * during pre-rendering which Tabs are disabled.
   * To work around it, ensure that `defaultValue` or `value` on `<Tabs.Root>` is set to an enabled Tab's value.
   */
  disabled?: boolean | undefined;
}

export namespace TabsTab {
  export type Value = TabsTabValue;
  export type ActivationDirection = TabsTabActivationDirection;
  export type Position = TabsTabPosition;
  export type Size = TabsTabSize;
  export type Metadata = TabsTabMetadata;
  export type State = TabsTabState;
  export type Props = TabsTabProps;
}
