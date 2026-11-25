import { createEffect, createSignal, omit } from 'solid-js';
import type { RefProp } from '@egoist/solid-base-utils/refs';
import { EMPTY_ARRAY } from '@egoist/solid-base-utils/empty';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import type { TabsRootState } from '../root/TabsRoot';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
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

  const [highlightedTabIndex, setHighlightedTabIndex] = createSignal(0);
  const [tabsListElement, setTabsListElement] = createSignal<HTMLElement | null>(null);

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
        highlightedIndex={highlightedTabIndex()}
        enableHomeAndEndKeys
        loopFocus={componentProps.loopFocus ?? true}
        orientation={rootContext.orientation()}
        onHighlightedIndexChange={setHighlightedTabIndex}
        onMapChange={rootContext.setTabMap}
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
