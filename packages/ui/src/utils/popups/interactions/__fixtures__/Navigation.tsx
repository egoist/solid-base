import { Show, children, createSignal, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { getEmptyRootStore } from '../../floating-root/getEmptyRootStore';
import { FloatingFocusManager } from '../../focus/FloatingFocusManager';
import { FloatingNode, createFloatingNodeId } from '../../tree/FloatingTree';
import { FloatingPortal } from '../../portal/FloatingPortal';
import { safePolygon } from '../safePolygon';
import { createHoverPopupInteraction } from '../hoverPopupInteraction';
import { createHoverTriggerInteraction } from '../hoverTriggerInteraction';
import { createDismiss } from '../dismiss';
import { createFocus } from '../focus';
import { createTestFloating, getInteractionProps } from '../../testUtils';
import { cleanupRef, getFloatingTestProps } from './helpers';

// Port of upstream `test/floating-ui-tests/Navigation.tsx`. Positioning middleware and CSS
// modules are left out: jsdom has no layout.

interface SubItemProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  label: string;
  href: string;
}

/** @internal */
export function NavigationSubItem(props: SubItemProps) {
  const others = omit(props, 'label', 'href');
  return (
    <a {...others} href={props.href}>
      {props.label}
    </a>
  );
}

interface ItemProps {
  label: string;
  href: string;
  children?: JSX.Element;
}

/** @internal */
export function NavigationItem(props: ItemProps) {
  const [open, setOpen] = createSignal(false);
  const resolvedChildren = children(() => props.children);
  // Read once, like upstream's render-time `!!children` for a static tree.
  const hasChildren = untrack(() => resolvedChildren.toArray().length > 0);
  const fallbackStore = getEmptyRootStore();

  const nodeId = createFloatingNodeId();

  const { store, refs, elements } = createTestFloating({
    open,
    nodeId,
    onOpenChange: (value) => setOpen(value),
    placement: 'right-start',
  });

  const hoverStore = hasChildren ? store : fallbackStore;
  const hoverReferenceProps = createHoverTriggerInteraction(hoverStore, {
    handleClose: safePolygon(),
    get triggerElement() {
      return hasChildren ? elements.reference() : undefined;
    },
  });
  createHoverPopupInteraction(hoverStore);

  const interactions = [
    { reference: hoverReferenceProps },
    createFocus(store, { enabled: hasChildren }),
    createDismiss(store, { enabled: hasChildren }),
  ];

  return (
    <FloatingNode id={nodeId}>
      <li>
        <a
          href={props.href}
          {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
        >
          {props.label}
        </a>
      </li>
      <FloatingPortal>
        <Show when={open()}>
          <FloatingFocusManager store={store} modal={false} initialFocus={false}>
            <div
              data-testid="subnavigation"
              {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}
            >
              <button type="button" onClick={() => setOpen(false)}>
                Close
              </button>
              <ul>{resolvedChildren()}</ul>
            </div>
          </FloatingFocusManager>
        </Show>
      </FloatingPortal>
    </FloatingNode>
  );
}

/** @internal */
export function Navigation(props: { children?: JSX.Element }) {
  return (
    <nav>
      <ul>{props.children}</ul>
    </nav>
  );
}

/** @internal */
export function Main() {
  return (
    <>
      <h1>Navigation</h1>
      <div>
        <Navigation>
          <NavigationItem label="Home" href="#" />
          <NavigationItem label="Product" href="#">
            <NavigationSubItem label="Link 1" href="#" />
            <NavigationSubItem label="Link 2" href="#" />
            <NavigationSubItem label="Link 3" href="#" />
          </NavigationItem>
          <NavigationItem label="About" href="#" />
        </Navigation>
      </div>
    </>
  );
}
