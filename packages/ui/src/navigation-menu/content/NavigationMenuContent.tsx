import {
  Match,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  omit,
  onCleanup,
  untrack,
} from 'solid-js';
import { Portal, type JSX } from '@solidjs/web';
import { contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { FloatingNode } from '../../utils/popups/tree/FloatingTree';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { createTransitionStatus } from '../../internals/transitionStatus';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import * as NavigationMenuContentDataAttributes from './NavigationMenuContentDataAttributes';

const stateAttributesMapping: StateAttributesMapping<NavigationMenuContentState> = {
  ...popupTransitionStateMapping,
  activationDirection(value) {
    if (!value) {
      return null;
    }
    return {
      [NavigationMenuContentDataAttributes.activationDirection]: value,
    };
  },
};

const HIDDEN_PROPS: HTMLProps = { hidden: true };

/**
 * A container for the content of the navigation menu item that is moved into the popup
 * when the item is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuContent(componentProps: NavigationMenuContent.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'keepMounted');
  const keepMounted = () => componentProps.keepMounted ?? false;

  const context = useNavigationMenuRootContext();
  const item = useNavigationMenuItemContext();
  const nodeId = useNavigationMenuTreeContext();

  const open = createMemo(() => context.mounted && context.value === item.value);

  const [contentElement, setContentElement] = createSignal<HTMLElement | null>(null);
  const [focusInside, setFocusInside] = createSignal(false);

  const { mounted, setMounted, transitionStatus } = createTransitionStatus(open);

  // If the popup unmounts before the content's exit animation completes, reset the internal
  // mounted state so the next open can re-enter via `transitionStatus="starting"`.
  createEffect(
    () => mounted() && !context.mounted,
    (shouldReset) => {
      if (shouldReset) {
        setMounted(false);
      }
    },
  );

  createOpenChangeComplete({
    element: contentElement,
    open,
    onComplete() {
      if (!untrack(open)) {
        setMounted(false);
      }
    },
  });

  // When a content re-enters while still mounted (e.g. switching top-level triggers
  // back before the exit animation completes), the DOM element hasn't changed so the
  // callback ref won't fire again. Ensure the shared ref is updated so the
  // MutationObserver in the trigger watches the correct content element.
  createEffect(
    () => (open() ? contentElement() : null),
    (element) => {
      if (element) {
        context.currentContentRef.current = element;
      }
    },
  );

  const state: NavigationMenuContentState = {
    get open() {
      return open();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get activationDirection() {
      return context.activationDirection;
    },
  };

  const isExiting = () => !open() && mounted();

  const defaultProps: HTMLProps = {
    get style() {
      return isExiting() ? { position: 'absolute', top: '0', left: '0' } : undefined;
    },
    get inert() {
      return isExiting() ? !focusInside() : undefined;
    },
    onFocusIn(event: FocusEvent) {
      const target = getTarget(event) as Element | null;
      if (target?.hasAttribute('data-base-ui-focus-guard')) {
        return;
      }
      setFocusInside(true);
    },
    onFocusOut(event: FocusEvent) {
      if (!contains(event.currentTarget as Element, event.relatedTarget as Element | null)) {
        setFocusInside(false);
      }
    },
  };

  const portalContainer = () => context.viewportTargetElement || context.viewportElement;
  // Once kept-mounted content moved into the portal, it never renders inline again.
  const hasMountedInPortal = createMemo<boolean>(
    (previous) => previous === true || (keepMounted() && portalContainer() != null),
  );
  const shouldRenderInline = () => keepMounted() && !portalContainer() && !hasMountedInPortal();
  const hiddenProps = {
    get hidden() {
      return keepMounted() && !mounted() ? true : undefined;
    },
  };

  function InlineContent() {
    return (
      <CompositeRoot
        render={componentProps.render}
        class={componentProps.class}
        style={componentProps.style}
        state={state}
        props={[defaultProps, HIDDEN_PROPS, elementProps]}
        stateAttributesMapping={stateAttributesMapping}
      />
    );
  }

  function PortaledContent() {
    let element: HTMLElement | null = null;
    onCleanup(() => {
      if (untrack(contentElement) === element) {
        setContentElement(null);
      }
    });
    return (
      <FloatingNode id={nodeId}>
        <CompositeRoot
          render={componentProps.render}
          class={componentProps.class}
          style={componentProps.style}
          state={state}
          ref={(el: HTMLElement) => {
            element = el;
            setContentElement(el);
            // Inactive `keepMounted` content also mounts in the viewport; only the
            // active content can own the shared sizing observer target.
            if (untrack(open)) {
              context.currentContentRef.current = el;
            }
          }}
          props={[defaultProps, hiddenProps, elementProps]}
          stateAttributesMapping={stateAttributesMapping}
        />
      </FloatingNode>
    );
  }

  return (
    <Switch>
      <Match when={shouldRenderInline()}>
        <InlineContent />
      </Match>
      <Match when={portalContainer() != null && (mounted() || keepMounted())}>
        <Portal mount={portalContainer()!}>
          <PortaledContent />
        </Portal>
      </Match>
    </Switch>
  );
}

export interface NavigationMenuContentState {
  /**
   * If `true`, the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * The direction of the activation.
   */
  activationDirection: 'left' | 'right' | 'up' | 'down' | null;
}

export interface NavigationMenuContentProps extends BaseUIComponentProps<
  'div',
  NavigationMenuContentState
> {
  /**
   * Whether to keep the content mounted in the DOM while the popup is closed.
   * Ensures the content is present during server-side rendering for web crawlers.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace NavigationMenuContent {
  export type State = NavigationMenuContentState;
  export type Props = NavigationMenuContentProps;
}
