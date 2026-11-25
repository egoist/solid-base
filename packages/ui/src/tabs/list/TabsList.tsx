import { createEffect, createMemo, createSignal, omit } from 'solid-js';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { activeElement, contains } from '@egoist/solid-base-utils/shadowDom';
import type { RefProp } from '@egoist/solid-base-utils/refs';
import { EMPTY_ARRAY } from '@egoist/solid-base-utils/empty';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import type { TabsRootState } from '../root/TabsRoot';
import type { TabsTab } from '../tab/TabsTab';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsRootContext } from '../root/TabsRootContext';
import { TabsListContext } from './TabsListContext';

/**
 * Groups the individual tab buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsList(componentProps: TabsList.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'ref',
    'activateOnFocus',
    'loopFocus',
  );

  const rootContext = useTabsRootContext();

  const [tabsListElement, setTabsListElement] = createSignal<HTMLElement | null>(null);

  // The highlight follows the active tab when the value changes (e.g. externally, in controlled
  // mode). It doesn't follow disabled tabs, which would interfere with keyboard navigation, nor
  // override the roving focus highlight while focus is within the list.
  const activeTabIndex = createMemo(() => {
    const value = rootContext.value();
    const listElement = tabsListElement();
    let activeTab: CompositeMetadata<TabsTab.Metadata> | undefined;
    for (const metadata of rootContext.tabList.map().values()) {
      if (metadata.value === value) {
        activeTab = metadata;
        break;
      }
    }
    if (!activeTab || activeTab.disabled) {
      return undefined;
    }
    if (listElement != null) {
      const activeEl = activeElement(ownerDocument(listElement));
      if (activeEl && contains(listElement, activeEl)) {
        return undefined;
      }
    }
    return activeTab.index;
  });

  const indicatorUpdateListeners = new Set<() => void>();
  const tabResizeObserverElements = new Set<HTMLElement>();
  let resizeObserver: ResizeObserver | null = null;

  createEffect(tabsListElement, (listElement) => {
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      indicatorUpdateListeners.forEach((listener) => {
        listener();
      });
    });

    resizeObserver = observer;

    if (listElement) {
      observer.observe(listElement);
    }

    tabResizeObserverElements.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
      if (resizeObserver === observer) {
        resizeObserver = null;
      }
    };
  });

  function registerIndicatorUpdateListener(listener: () => void) {
    indicatorUpdateListeners.add(listener);
    return () => {
      indicatorUpdateListeners.delete(listener);
    };
  }

  function registerTabResizeObserverElement(element: HTMLElement) {
    tabResizeObserverElements.add(element);
    resizeObserver?.observe(element);
    return () => {
      tabResizeObserverElements.delete(element);
      resizeObserver?.unobserve(element);
    };
  }

  const state: TabsListState = {
    get orientation() {
      return rootContext.orientation();
    },
    get tabActivationDirection() {
      return rootContext.tabActivationDirection();
    },
  };

  const defaultProps: HTMLProps = {
    get 'aria-orientation'() {
      return rootContext.orientation() === 'vertical' ? 'vertical' : undefined;
    },
    role: 'tablist',
  };

  const tabsListContextValue: TabsListContext = {
    activateOnFocus: () => componentProps.activateOnFocus ?? false,
    registerIndicatorUpdateListener,
    registerTabResizeObserverElement,
    tabsListElement,
  };

  return (
    <TabsListContext value={tabsListContextValue}>
      <CompositeRoot
        render={componentProps.render}
        class={componentProps.class}
        style={componentProps.style}
        state={state}
        ref={[
          componentProps.ref as RefProp<HTMLElement>,
          (element: HTMLElement) => setTabsListElement(element),
        ]}
        props={[defaultProps, elementProps]}
        stateAttributesMapping={tabsStateAttributesMapping}
        list={rootContext.tabList}
        syncHighlightedIndex={activeTabIndex()}
        enableHomeAndEndKeys
        loopFocus={componentProps.loopFocus ?? true}
        orientation={rootContext.orientation()}
        disabledIndices={EMPTY_ARRAY}
      />
    </TabsListContext>
  );
}

export interface TabsListState extends TabsRootState {}

export interface TabsListProps extends BaseUIComponentProps<'div', TabsListState> {
  /**
   * Whether to automatically change the active tab on arrow key focus.
   * Otherwise, tabs will be activated using <kbd>Enter</kbd> or <kbd>Space</kbd> key press.
   * @default false
   */
  activateOnFocus?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export namespace TabsList {
  export type State = TabsListState;
  export type Props = TabsListProps;
}
