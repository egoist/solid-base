import { createSignal, omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { RefProp } from '@egoist/solid-base-utils/refs';
import {
  FloatingNode,
  FloatingTree,
  createFloatingNodeId,
  useFloatingTree,
} from '../utils/popups/tree/FloatingTree';
import type { MenuRoot } from '../menu/root/MenuRoot';
import type { BaseUIComponentProps } from '../internals/types';
import { MenubarContext, useMenubarContext } from './MenubarContext';
import { CompositeRoot } from '../internals/composite/root/CompositeRoot';
import { createBaseUiId } from '../internals/baseUiId';
import type { MenuOpenEventDetails } from '../menu/utils/types';
import type { StateAttributesMapping } from '../internals/getStateAttributesProps';
import * as MenubarDataAttributes from './MenubarDataAttributes';
import { REASONS } from '../internals/reasons';

const menubarStateAttributesMapping: StateAttributesMapping<MenubarState> = {
  hasSubmenuOpen(value) {
    return value ? { [MenubarDataAttributes.hasSubmenuOpen]: '' } : null;
  },
};

/**
 * The container for menus.
 *
 * Documentation: [Base UI Menubar](https://base-ui.com/react/components/menubar)
 */
export function Menubar(componentProps: Menubar.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'ref',
    'orientation',
    'loopFocus',
    'modal',
    'disabled',
    'id',
  );

  const orientation = () => componentProps.orientation ?? 'horizontal';
  const loopFocus = () => componentProps.loopFocus ?? true;
  const modal = () => componentProps.modal ?? true;
  const disabled = () => componentProps.disabled ?? false;

  const [contentElement, setContentElement] = createSignal<HTMLElement | null>(null);
  const [hasSubmenuOpen, setHasSubmenuOpen] = createSignal(false);

  const id = createBaseUiId(() => componentProps.id || undefined);

  const state: Menubar.State = {
    get orientation() {
      return orientation();
    },
    get modal() {
      return modal();
    },
    get hasSubmenuOpen() {
      return hasSubmenuOpen();
    },
  };

  const allowMouseUpTriggerRef = { current: false };

  const context: MenubarContext = {
    get contentElement() {
      return contentElement();
    },
    setContentElement,
    get hasSubmenuOpen() {
      return hasSubmenuOpen();
    },
    setHasSubmenuOpen,
    get modal() {
      return modal();
    },
    get disabled() {
      return disabled();
    },
    get orientation() {
      return orientation();
    },
    allowMouseUpTriggerRef,
    get rootId() {
      return id();
    },
  };

  return (
    <MenubarContext value={context}>
      <FloatingTree>
        <MenubarContent>
          <CompositeRoot
            render={componentProps.render}
            class={componentProps.class}
            style={componentProps.style}
            state={state}
            stateAttributesMapping={menubarStateAttributesMapping}
            ref={[componentProps.ref as RefProp<HTMLElement>, setContentElement]}
            props={[
              {
                role: 'menubar',
                get id() {
                  return id();
                },
                get 'aria-orientation'() {
                  return orientation();
                },
              },
              elementProps,
            ]}
            orientation={orientation()}
            loopFocus={loopFocus()}
            enableHomeAndEndKeys
            highlightItemOnHover={hasSubmenuOpen()}
          />
        </MenubarContent>
      </FloatingTree>
    </MenubarContext>
  );
}

function MenubarContent(props: { children?: JSX.Element }) {
  const nodeId = createFloatingNodeId();
  const { events: menuEvents } = useFloatingTree()!;
  const rootContext = useMenubarContext();

  function onSubmenuOpenChange(details: MenuOpenEventDetails) {
    if (!details.nodeId || details.parentNodeId !== nodeId) {
      return;
    }

    // Emitted from effects, so the current value isn't read here: setting an equal value is a
    // no-op for the signal.
    if (details.open) {
      rootContext.setHasSubmenuOpen(true);
    } else if (
      details.reason !== REASONS.siblingOpen &&
      details.reason !== REASONS.listNavigation
    ) {
      rootContext.setHasSubmenuOpen(false);
    }
  }

  // Subscribe before the menus mount so their initial open state is reported.
  menuEvents.on('menuopenchange', onSubmenuOpenChange);
  onCleanup(() => {
    menuEvents.off('menuopenchange', onSubmenuOpenChange);
  });

  return <FloatingNode id={nodeId}>{props.children}</FloatingNode>;
}

export interface MenubarState {
  /**
   * The orientation of the menubar.
   */
  orientation: MenuRoot.Orientation;
  /**
   * Whether the menubar is modal.
   */
  modal: boolean;
  /**
   * Whether any submenu within the menubar is open.
   */
  hasSubmenuOpen: boolean;
}

export interface MenubarProps extends BaseUIComponentProps<'div', MenubarState> {
  /**
   * Whether the menubar is modal.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Whether the whole menubar is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The orientation of the menubar.
   * @default 'horizontal'
   */
  orientation?: MenuRoot.Orientation | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export namespace Menubar {
  export type State = MenubarState;
  export type Props = MenubarProps;
}
