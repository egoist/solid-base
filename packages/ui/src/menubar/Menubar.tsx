import { createMemo, createSignal, omit, type Accessor } from 'solid-js';
import { isServer, type JSX } from '@solidjs/web';
import type { RefProp } from '@egoist/solid-base-utils/refs';
import { FloatingNode, FloatingTree, createFloatingNodeId } from '../utils/popups/tree/FloatingTree';
import type { MenuRoot } from '../menu/root/MenuRoot';
import type { BaseUIComponentProps } from '../internals/types';
import { MenubarContext, type MenubarMenuStore } from './MenubarContext';
import { CompositeRoot } from '../internals/composite/root/CompositeRoot';
import { createBaseUiId } from '../internals/baseUiId';
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
 * Documentation: [Solid Base Menubar](https://base.egoist.dev/components/menubar)
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

  // Menus register from their component bodies, before they read the menubar's state.
  const menus = new Set<Accessor<MenubarMenuStore>>();
  const [menusVersion, setMenusVersion] = createSignal(0, {
    ownedWrite: true,
    equals: false,
    name: 'Menubar.menus',
  });

  // A submenu stays open across a switch to a sibling menu, including one that closes the current
  // menu before the next one opens (sibling open, list navigation), and stops being open once a
  // menu closes for any other reason.
  const submenuState = createMemo<SubmenuState>(
    (previous) => {
      menusVersion();
      const openMenus = new Set<MenubarMenuStore>();
      for (const menu of menus) {
        const store = menu();
        const parent = store.select('parent');
        if (parent.type === 'menubar' && parent.context === context && store.select('open')) {
          openMenus.add(store);
        }
      }
      if (openMenus.size > 0) {
        return { openMenus, hasSubmenuOpen: true };
      }
      let hasSubmenuOpen = previous?.hasSubmenuOpen ?? false;
      previous?.openMenus.forEach((store) => {
        const reason = store.select('lastOpenChangeReason');
        if (reason !== REASONS.siblingOpen && reason !== REASONS.listNavigation) {
          hasSubmenuOpen = false;
        }
      });
      return { openMenus, hasSubmenuOpen };
    },
    { name: 'Menubar.submenuState', equals: isSameSubmenuState },
  );
  const hasSubmenuOpen = createMemo(() => submenuState().hasSubmenuOpen, {
    name: 'Menubar.hasSubmenuOpen',
  });

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
    registerMenu(menu) {
      menus.add(menu);
      // A server render never re-runs (and must not write signals): only notify in the browser.
      if (!isServer) {
        setMenusVersion(0);
      }
      return () => {
        if (menus.delete(menu) && !isServer) {
          setMenusVersion(0);
        }
      };
    },
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
  return <FloatingNode id={nodeId}>{props.children}</FloatingNode>;
}

interface SubmenuState {
  openMenus: ReadonlySet<MenubarMenuStore>;
  hasSubmenuOpen: boolean;
}

function isSameSubmenuState(a: SubmenuState | undefined, b: SubmenuState) {
  if (!a || a.hasSubmenuOpen !== b.hasSubmenuOpen || a.openMenus.size !== b.openMenus.size) {
    return false;
  }
  for (const store of a.openMenus) {
    if (!b.openMenus.has(store)) {
      return false;
    }
  }
  return true;
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
