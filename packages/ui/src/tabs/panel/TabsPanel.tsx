import { createEffect, createSignal, omit, onCleanup, untrack } from 'solid-js';
import { createBaseUiId } from '../../internals/baseUiId';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import { createTransitionStatus } from '../../internals/transitionStatus';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useCompositeListContext } from '../../internals/composite/list/CompositeList';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsRootContext } from '../root/TabsRootContext';
import type { TabsRootState } from '../root/TabsRoot';
import type { TabsTab } from '../tab/TabsTab';
import * as TabsPanelDataAttributes from './TabsPanelDataAttributes';

const stateAttributesMapping: StateAttributesMapping<TabsPanelState> = {
  ...tabsStateAttributesMapping,
  ...transitionStatusMapping,
};

/**
 * A panel displayed when the corresponding tab is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsPanel(componentProps: TabsPanel.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'value', 'keepMounted');

  const rootContext = useTabsRootContext();
  const panelList = useCompositeListContext<TabsPanel.Metadata>();

  const id = createBaseUiId();
  const keepMounted = () => componentProps.keepMounted ?? false;

  const open = () => componentProps.value === rootContext.value();
  const { mounted, transitionStatus, setMounted } = createTransitionStatus(open);
  const hidden = () => !mounted();
  const shouldRender = () => keepMounted() || mounted();

  const [panelElement, setPanelElement] = createSignal<HTMLElement | null>(null);
  // A plain copy for imperative reads (animation tracking).
  let panelElementForAnimations: HTMLElement | null = null;

  // Registers the panel in the root's list to compute its index. The element is unregistered
  // as soon as it leaves the DOM, so unmounted panels don't take an index.
  function panelRef(element: HTMLElement) {
    const previous = untrack(panelElement);
    if (previous === element) {
      return;
    }
    if (previous) {
      panelList?.unregister(previous);
    }
    panelList?.register(element, {});
    panelElementForAnimations = element;
    setPanelElement(element);
  }

  createEffect(shouldRender, (render) => {
    if (render) {
      return;
    }
    const element = untrack(panelElement);
    if (element) {
      panelList?.unregister(element);
      panelElementForAnimations = null;
      setPanelElement(null);
    }
  });

  onCleanup(() => {
    const element = untrack(panelElement);
    if (element) {
      panelList?.unregister(element);
    }
  });

  const index = () => panelList?.indexOf(panelElement()) ?? -1;

  // Only enabled while closed: reopening restarts the primitive, which aborts a pending unmount.
  createOpenChangeComplete({
    enabled: () => !open(),
    open,
    element: () => panelElementForAnimations,
    onComplete() {
      setMounted(false);
    },
  });

  createEffect(
    () => [hidden(), keepMounted(), componentProps.value, id()] as const,
    ([isHidden, isKeptMounted, panelValue, panelId]) => {
      if (isHidden && !isKeptMounted) {
        return undefined;
      }

      return rootContext.registerMountedTabPanel(panelValue, panelId);
    },
  );

  const state: TabsPanelState = {
    get hidden() {
      return hidden();
    },
    get orientation() {
      return rootContext.orientation();
    },
    get tabActivationDirection() {
      return rootContext.tabActivationDirection();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  const panelProps: HTMLProps = {
    get 'aria-labelledby'() {
      return rootContext.getTabIdByPanelValue(componentProps.value);
    },
    get hidden() {
      return hidden();
    },
    get id() {
      return id();
    },
    role: 'tabpanel',
    get tabindex() {
      return open() ? 0 : -1;
    },
    get inert() {
      return !open();
    },
    get [TabsPanelDataAttributes.index]() {
      return index();
    },
  };

  return renderElement('div', componentProps, {
    state,
    ref: panelRef,
    props: [panelProps, elementProps],
    stateAttributesMapping,
    enabled: shouldRender,
  });
}

export interface TabsPanelMetadata {
  id?: string | undefined;
  value: TabsTab.Value;
}

export interface TabsPanelState extends TabsRootState {
  /**
   * Whether the component is hidden.
   */
  hidden: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface TabsPanelProps
  extends Omit<BaseUIComponentProps<'div', TabsPanelState>, 'value'> {
  /**
   * The value of the TabPanel. It will be shown when the Tab with the corresponding value is active.
   */
  value: TabsTab.Value;
  /**
   * Whether to keep the HTML element in the DOM while the panel is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace TabsPanel {
  export type Metadata = TabsPanelMetadata;
  export type State = TabsPanelState;
  export type Props = TabsPanelProps;
}
