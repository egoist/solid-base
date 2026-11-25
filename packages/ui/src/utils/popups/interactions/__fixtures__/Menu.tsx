import {
  createContext,
  createEffect,
  createSignal,
  onSettled,
  Show,
  children,
  useContext,
  type Accessor,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import {
  CompositeList,
  createCompositeList,
  useCompositeListItem,
} from '../../../../internals/composite/list/CompositeList';
import { enqueueFocus } from '../../focus/enqueueFocus';
import { createTestFloating, getInteractionProps, getItemInteractionProps } from '../../testUtils';
import { FloatingPortal } from '../../portal/FloatingPortal';
import {
  FloatingNode,
  FloatingTree,
  createFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
} from '../../tree/FloatingTree';
import type { ElementProps } from '../../types';
import { createClick } from '../click';
import { createDismiss } from '../dismiss';
import { createListNavigation } from '../listNavigation';
import { createTypeahead } from '../typeahead';
import { gridNavigation } from '../gridNavigation';
import { cleanupRef, getFloatingTestProps } from './helpers';

export const GRID_COLUMN_COUNT = 2;

type MenuContextType = {
  interactions: ElementProps[];
  activeIndex: Accessor<number | null>;
  setActiveIndex: (index: number | null) => void;
  isOpen: Accessor<boolean>;
  setIsOpen: (open: boolean) => void;
  parent: MenuContextType | null;
};

const MenuContext = createContext<MenuContextType>({
  interactions: [],
  activeIndex: () => null,
  setActiveIndex: () => {},
  isOpen: () => false,
  setIsOpen: () => {},
  parent: null,
});

interface MenuProps {
  label: string;
  children?: JSX.Element;
  keepMounted?: boolean;
  orientation?: 'vertical' | 'horizontal' | 'both';
  grid?: boolean;
}

/**
 * A (nested) menu built from the popup interactions (port of Floating UI's `Menu` /
 * `MenuOrientation` fixtures). Hover-to-open of submenus is not ported: the tests that use these
 * fixtures only navigate with the keyboard.
 * @internal
 */
export function MenuComponent(props: MenuProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal<number | null>(null);

  const elementsRef: RefObject<Array<HTMLElement | null>> = { current: [] };
  const labelsRef: RefObject<Array<string | null>> = { current: [] };

  const tree = useFloatingTree();
  const nodeId = createFloatingNodeId();
  const parentId = useFloatingParentNodeId();
  const isNested = parentId != null;
  const orientation = () => props.orientation ?? (props.grid ? 'both' : 'vertical');

  const parent = useContext(MenuContext);
  const item = useCompositeListItem();

  const { store, refs } = createTestFloating({
    nodeId,
    open: isOpen,
    onOpenChange: (open) => setIsOpen(open),
  });

  const click = createClick(store, {
    event: 'mousedown',
    toggle: true,
    ignoreMouse: isNested,
  });
  const dismiss = createDismiss(store, { bubbles: true });
  const listNavigation = createListNavigation(store, {
    listRef: elementsRef,
    get activeIndex() {
      return activeIndex();
    },
    nested: isNested,
    onNavigate: (index) => setActiveIndex(index),
    get orientation() {
      return orientation();
    },
    get grid() {
      return props.grid ? gridNavigation : undefined;
    },
  });
  const typeahead = createTypeahead(store, {
    listRef: labelsRef,
    onMatch: (index) => {
      if (isOpen()) {
        setActiveIndex(index);
      }
    },
    get activeIndex() {
      return activeIndex();
    },
  });

  const interactions = [click, dismiss, listNavigation, typeahead];

  const list = createCompositeList({ elementsRef, labelsRef });

  // Event emitter allows you to communicate across tree components.
  // This effect closes all menus when an item gets clicked anywhere
  // in the tree.
  onSettled(() => {
    if (!tree) {
      return undefined;
    }

    function handleTreeClick() {
      setIsOpen(false);
    }

    function onSubMenuOpen(event: { nodeId: string; parentId: string }) {
      if (event.nodeId !== nodeId && event.parentId === parentId) {
        setIsOpen(false);
      }
    }

    tree.events.on('click', handleTreeClick);
    tree.events.on('menuopen', onSubMenuOpen);

    return () => {
      tree.events.off('click', handleTreeClick);
      tree.events.off('menuopen', onSubMenuOpen);
    };
  });

  // Stands in for `<FloatingFocusManager modal={false} initialFocus={!isNested}>`: these list
  // navigation tests only depend on the root menu focusing its popup when it opens, and leave
  // return focus to the list navigation itself.
  createEffect(
    () => isOpen() && store.select('positionerElement'),
    (floating) => {
      if (floating && !isNested) {
        // Like FloatingFocusManager, focus on the next frame.
        return enqueueFocus(floating, { preventScroll: true });
      }
      return undefined;
    },
  );

  createEffect(isOpen, (open) => {
    if (open && tree) {
      tree.events.emit('menuopen', { parentId, nodeId });
    }
  });

  const context: MenuContextType = {
    interactions,
    activeIndex,
    setActiveIndex: (index) => setActiveIndex(index),
    isOpen,
    setIsOpen: (open) => setIsOpen(open),
    parent,
  };

  return (
    <FloatingNode id={nodeId}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen() ? 'true' : 'false'}
        aria-controls={isOpen() ? store.select('defaultPopupId') : undefined}
        data-open={isOpen() ? '' : undefined}
        tabindex={!isNested ? undefined : parent.activeIndex() === item.index() ? 0 : -1}
        {...getInteractionProps(
          interactions,
          'reference',
          getItemInteractionProps(parent.interactions, {
            ref: (element: HTMLElement) => {
              refs.setReference(element);
              item.ref(element);
            },
          }),
        )}
      >
        {props.label}
        {isNested && <span aria-hidden="true">Icon</span>}
      </button>
      <MenuContext value={context}>
        <CompositeList list={list}>
          <Show when={props.keepMounted || isOpen()}>
            <FloatingPortal>
              <>
                <div
                  id={store.select('defaultPopupId')}
                  role="menu"
                  style={{
                    '--cols': GRID_COLUMN_COUNT,
                    visibility: !props.keepMounted ? undefined : isOpen() ? 'visible' : 'hidden',
                  }}
                  aria-hidden={!isOpen() ? 'true' : undefined}
                  {...getFloatingTestProps(interactions, {
                    ref: cleanupRef(refs.setFloating),
                  })}
                >
                  {props.grid ? <GridRows>{props.children}</GridRows> : props.children}
                </div>
              </>
            </FloatingPortal>
          </Show>
        </CompositeList>
      </MenuContext>
    </FloatingNode>
  );
}

/**
 * Groups the items in `role="row"` elements of `GRID_COLUMN_COUNT` items.
 */
function GridRows(props: { children: JSX.Element }) {
  const resolved = children(() => props.children);
  const rows = () => {
    const items = resolved.toArray();
    return Array.from({ length: Math.ceil(items.length / GRID_COLUMN_COUNT) }, (_row, rowIndex) =>
      items.slice(rowIndex * GRID_COLUMN_COUNT, rowIndex * GRID_COLUMN_COUNT + GRID_COLUMN_COUNT),
    );
  };
  return (
    <>
      {rows().map((row) => (
        <div role="row" style={{ display: 'contents' }}>
          {row}
        </div>
      ))}
    </>
  );
}

interface MenuItemProps {
  label: string;
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
}

/** @internal */
export function MenuItem(props: MenuItemProps) {
  const menu = useContext(MenuContext);
  const item = useCompositeListItem({ label: () => (props.disabled ? null : props.label) });
  const tree = useFloatingTree();
  const isActive = () => item.index() === menu.activeIndex();

  return (
    <button
      type="button"
      role="menuitem"
      disabled={props.disabled}
      tabindex={isActive() ? 0 : -1}
      {...getItemInteractionProps(menu.interactions, {
        ref: item.ref,
        onClick(event: MouseEvent) {
          props.onClick?.(event);
          tree?.events.emit('click');
        },
        onKeyDown(event: KeyboardEvent) {
          function closeParents(parent: MenuContextType | null) {
            parent?.setIsOpen(false);
            if (parent?.parent) {
              closeParents(parent.parent);
            }
          }

          if (
            event.key === 'ArrowRight' &&
            // If the root reference is in a menubar, close parents
            tree?.nodesRef.current[0].context?.elements.domReference?.closest('[role="menubar"]')
          ) {
            closeParents(menu.parent);
          }
        },
      })}
    >
      {props.label}
    </button>
  );
}

/** @internal */
export function Menu(props: MenuProps) {
  const parentId = useFloatingParentNodeId();

  if (parentId === null) {
    return (
      <FloatingTree>
        <MenuComponent {...props} />
      </FloatingTree>
    );
  }

  return <MenuComponent {...props} />;
}

/** @internal */
export function Main() {
  return (
    <>
      <h1>Menu</h1>
      <div>
        <Menu label="Edit">
          <MenuItem label="Undo" />
          <MenuItem label="Redo" />
          <MenuItem label="Cut" disabled />
          <Menu label="Copy as" keepMounted>
            <MenuItem label="Text" />
            <MenuItem label="Video" />
            <Menu label="Image" keepMounted grid orientation="horizontal">
              <MenuItem label=".png" />
              <MenuItem label=".jpg" />
              <MenuItem label=".svg" />
              <MenuItem label=".gif" />
            </Menu>
            <MenuItem label="Audio" />
          </Menu>
          <Menu label="Share">
            <MenuItem label="Mail" />
            <MenuItem label="Instagram" />
          </Menu>
        </Menu>
      </div>
    </>
  );
}

/** @internal */
export function HorizontalMenu() {
  return (
    <>
      <h1>Horizontal menu</h1>
      <div>
        <Menu label="Edit" orientation="horizontal">
          <MenuItem label="Undo" />
          <MenuItem label="Redo" />
          <MenuItem label="Cut" disabled />
          <Menu label="Copy as" keepMounted>
            <MenuItem label="Text" />
            <MenuItem label="Video" />
            <Menu label="Image" keepMounted grid>
              <MenuItem label=".png" />
              <MenuItem label=".jpg" />
              <MenuItem label=".svg" />
              <MenuItem label=".gif" />
            </Menu>
            <MenuItem label="Audio" />
          </Menu>
          <Menu label="Share">
            <MenuItem label="Mail" />
            <MenuItem label="Instagram" />
          </Menu>
        </Menu>
      </div>
    </>
  );
}
