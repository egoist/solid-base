import {
  Show,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  omit,
  useContext,
  type Accessor,
} from 'solid-js';
import { Portal, type JSX } from '@solidjs/web';
import { isNode } from '@floating-ui/utils/dom';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { mergeCleanups } from '@egoist/solid-base-utils/mergeCleanups';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { FocusGuard } from '../focus/FocusGuard';
import {
  enableFocusInside,
  disableFocusInside,
  getPreviousTabbable,
  getNextTabbable,
  isOutsideEvent,
} from '../focus/tabbable';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { createAttribute } from '../createAttribute';
import { renderElement } from '../../../internals/renderElement';
import { ownerVisuallyHidden } from '../../../internals/constants';
import type { BaseUIComponentProps } from '../../../internals/types';

export interface FocusManagerState {
  modal: boolean;
  open: boolean;
  onOpenChange(open: boolean, data: ReturnType<typeof createChangeEventDetails<any>>): void;
  domReference: Element | null;
  closeOnFocusOut: boolean;
}

/**
 * Mutable holders for the focus guards a non-modal portal renders around its content.
 */
export interface PortalGuardRefs {
  beforeInside: HTMLSpanElement | null;
  afterInside: HTMLSpanElement | null;
  beforeOutside: HTMLSpanElement | null;
  afterOutside: HTMLSpanElement | null;
}

export interface PortalContextValue {
  /** The portal element the content is rendered into. */
  portalNode: Accessor<HTMLElement | null>;
  /** The focus manager inside the portal reports its state here. */
  setFocusManagerState: (state: FocusManagerState | null) => void;
  guards: PortalGuardRefs;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export const usePortalContext = () => useContext(PortalContext);

const attr = createAttribute('portal');

/**
 * Where a portal renders: an element (or shadow root), a ref object, an accessor, or `null` to
 * wait until the container exists. Defaults to the parent portal node, or `<body>`.
 */
export type PortalContainer =
  | HTMLElement
  | ShadowRoot
  | RefObject<HTMLElement | ShadowRoot | null>
  | (() => HTMLElement | ShadowRoot | null | undefined)
  | null
  | undefined;

function createPortalContainer(container: () => PortalContainer) {
  const parentPortalNode = usePortalContext()?.portalNode;
  // Ref objects aren't reactive: when one is still empty, check it again once the current render
  // settled (ancestor and later sibling refs are attached by then). Until that check, the portal
  // waits instead of mounting in the fallback container.
  const [checkedRef, setCheckedRef] = createSignal<RefObject<
    HTMLElement | ShadowRoot | null
  > | null>(null, { ownedWrite: true });

  const resolved = createMemo(() => {
    const value = container();
    if (value === null) {
      return null;
    }
    const getFallback = () => parentPortalNode?.() ?? document.body;
    if (value === undefined) {
      return getFallback();
    }
    if (isNode(value)) {
      return value as HTMLElement | ShadowRoot;
    }
    if (typeof value === 'function') {
      return value() ?? null;
    }
    if (value.current) {
      return value.current;
    }
    // A ref that stays empty after the check falls back like an unset container.
    return checkedRef() === value ? getFallback() : null;
  });

  createEffect(container, (value) => {
    if (value && !isNode(value) && typeof value !== 'function') {
      setCheckedRef(() => value);
    }
  });

  return resolved;
}

export interface FloatingPortalProps extends BaseUIComponentProps<'div', FloatingPortal.State> {
  /**
   * A parent element to render the portal element into.
   */
  container?: PortalContainer;
  /**
   * @ignore
   * The role for the hidden `aria-owns` owner element.
   */
  portalOwnerRole?: JSX.AriaAttributes['role'] | undefined;
}

/**
 * Renders the portal node (a `<div data-base-ui-portal>` inside `container`) and returns the
 * element plus an accessor for the node.
 */
function renderPortalNode(
  componentProps: FloatingPortalProps,
  children: (portalNode: Accessor<HTMLElement | null>) => JSX.Element,
): { element: JSX.Element; portalNode: Accessor<HTMLElement | null>; portalNodeId: Accessor<string> } {
  const container = createPortalContainer(() => componentProps.container);
  const [portalNode, setPortalNode] = createSignal<HTMLElement | null>(null, { ownedWrite: true });
  const generatedId = `base-ui-${createUniqueId()}`;
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'container',
    'portalOwnerRole',
    'children',
  );

  // The rendered id can be overridden by the `id` prop; `aria-owns` must use the rendered value.
  const portalNodeId = () => (elementProps as { id?: string }).id ?? generatedId;

  const element = (
    <Show when={container()}>
      {(mount) => {
        const content = children(portalNode);
        return (
          <Portal mount={mount() as HTMLElement}>
            {renderElement('div', componentProps, {
              ref: (node: HTMLElement) => setPortalNode(() => node),
              props: [{ id: generatedId, [attr]: '', children: content }, elementProps],
            })}
          </Portal>
        );
      }}
    </Show>
  );

  // Forget the node when the container goes away.
  createEffect(container, (value) => {
    if (!value) {
      setPortalNode(null);
    }
  });

  return { element, portalNode, portalNodeId };
}

/**
 * Portals the floating element into a given container element — by default, outside of the app
 * root and into the body — while keeping it inside the component tree (context, event
 * delegation). Non-modal focus managers rendered inside it get focus guards around the portal so
 * Tab order follows the trigger.
 * @internal
 */
export function FloatingPortal(componentProps: FloatingPortalProps): JSX.Element {
  const [focusManagerState, setFocusManagerState] = createSignal<FocusManagerState | null>(null, {
    ownedWrite: true,
  });

  const guards: PortalGuardRefs = {
    beforeInside: null,
    afterInside: null,
    beforeOutside: null,
    afterOutside: null,
  };

  // The children are created before `renderPortalNode` returns, so the context reads the node
  // accessor it receives: nested portals must track it to move into the node once it renders.
  const { element, portalNode, portalNodeId } = renderPortalNode(componentProps, (node) => {
    const contextValue: PortalContextValue = {
      portalNode: node,
      setFocusManagerState: (state) => setFocusManagerState(() => state),
      guards,
    };
    return <PortalContext value={contextValue}>{componentProps.children}</PortalContext>;
  });

  let focusInsideDisabled = false;

  const shouldRenderGuards = () => {
    const state = focusManagerState();
    return !!state && !state.modal && state.open && !!portalNode();
  };

  // Make sure elements inside the portal element are tabbable only when the portal has already
  // been focused, either by tabbing into a focus trap element outside or using the mouse.
  createEffect(
    () => {
      const node = portalNode();
      const state = focusManagerState();
      return node && !state?.modal ? node : null;
    },
    (node) => {
      if (!node) {
        return undefined;
      }

      function onFocus(event: FocusEvent) {
        if (node && event.relatedTarget && isOutsideEvent(event)) {
          if (event.type === 'focusin') {
            if (focusInsideDisabled) {
              enableFocusInside(node);
              focusInsideDisabled = false;
            }
          } else {
            disableFocusInside(node);
            focusInsideDisabled = true;
          }
        }
      }

      // Listen in the capture phase so they run before the focus trap elements' handlers.
      return mergeCleanups(
        addEventListener(node, 'focusin', onFocus, true),
        addEventListener(node, 'focusout', onFocus, true),
      );
    },
  );

  createEffect(
    () => [portalNode(), focusManagerState()?.open] as const,
    ([node, open]) => {
      if (!node || open !== true || !focusInsideDisabled) {
        return;
      }
      // Restore tabbability before the focus manager's queued focus-on-open step runs.
      enableFocusInside(node);
      focusInsideDisabled = false;
    },
  );

  return (
    <>
      <Show when={shouldRenderGuards()}>
        <FocusGuard
          data-type="outside"
          ref={(el: HTMLSpanElement) => {
            guards.beforeOutside = el;
          }}
          onFocus={(event: FocusEvent) => {
            const node = portalNode();
            if (node && isOutsideEvent(event, node)) {
              guards.beforeInside?.focus();
            } else {
              const domReference = focusManagerState()?.domReference ?? null;
              getPreviousTabbable(domReference)?.focus();
            }
          }}
        />
        <span
          role={componentProps.portalOwnerRole}
          aria-owns={portalNodeId()}
          style={ownerVisuallyHidden}
        />
      </Show>
      {element}
      <Show when={shouldRenderGuards()}>
        <FocusGuard
          data-type="outside"
          ref={(el: HTMLSpanElement) => {
            guards.afterOutside = el;
          }}
          onFocus={(event: FocusEvent) => {
            const node = portalNode();
            if (node && isOutsideEvent(event, node)) {
              guards.afterInside?.focus();
            } else {
              const state = focusManagerState();
              const domReference = state?.domReference ?? null;
              getNextTabbable(domReference)?.focus();

              if (state?.closeOnFocusOut) {
                state.onOpenChange(false, createChangeEventDetails(REASONS.focusOut, event));
              }
            }
          }}
        />
      </Show>
    </>
  );
}

export interface FloatingPortalState {}

export namespace FloatingPortal {
  export type State = FloatingPortalState;
  export type Props = FloatingPortalProps;
}

/**
 * `FloatingPortal` without the focus guards, for popups that don't need tabbable handling.
 * @internal
 */
export function FloatingPortalLite(componentProps: FloatingPortalProps): JSX.Element {
  // Read the children lazily, in the portal's tracking scope.
  const { element } = renderPortalNode(
    componentProps,
    () => (() => componentProps.children) as unknown as JSX.Element,
  );
  return element;
}

export namespace FloatingPortalLite {
  export type State = FloatingPortalState;
  export type Props = FloatingPortalProps;
}
