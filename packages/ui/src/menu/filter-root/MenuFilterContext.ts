import { createContext, useContext, type Accessor, type Component } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { MenuRootContext } from '../root/MenuRootContext';
import type { HTMLProps } from '../../internals/types';
import type { MenuParent } from '../root/MenuRoot';
import type { MenuStore } from '../store/MenuStore';

/**
 * What an item part passes to the filter. Read lazily (getters).
 */
export interface MenuFilterItemParams {
  readonly label?: string | undefined;
}

export interface MenuFilterItemResult {
  /** Whether the item matches the query. A hidden item renders nothing. */
  visible: Accessor<boolean>;
  /** Registers the element with the filter. */
  ref: ((element: HTMLElement) => void) | null;
  /** Props the filter needs on the element, merged under the consumer's. */
  props?: HTMLProps | undefined;
}

export interface MenuFilterParentHandoff {
  /** The filterable parent's input, which the closing submenu returns focus to. */
  parentVirtualFocusRef: RefObject<HTMLElement | null> | undefined;
  handleFocus: ((event: FocusEvent) => void) | undefined;
}

/**
 * The filter implementation that a filterable root hands to the parts below it. Only the roots
 * `Menu.FilterProvider` renders provide it. Parts whose whole structure differs are swapped as
 * components; parts that only register with the filter call an injected primitive.
 */
export interface MenuFilterImpl {
  Popup: Component<any>;
  List: Component<any>;
  Group: Component<any>;
  RadioGroup: Component<any>;
  /** Registers an item with the filter and reports whether it matches the query. */
  useItem: (params: MenuFilterItemParams) => MenuFilterItemResult;
  /** Like `useItem` for a submenu trigger, which is an item of the parent list. */
  useSubmenuTrigger: (params: MenuFilterItemParams) => MenuFilterItemResult;
  /** Hands focus and the highlight back to a filterable parent when a plain submenu closes. */
  useParentHandoff: (
    store: MenuStore<unknown>,
    parent: MenuParent,
    open: Accessor<boolean>,
    virtualFocus: boolean,
  ) => MenuFilterParentHandoff;
}

/** Static below a filter root: the implementation never changes. */
export const MenuFilterImplContext = createContext<MenuFilterImpl | null>(null);

export type MenuFilterPartScope =
  /** The part belongs to the nearest root. */
  | 'root'
  /** The part is an item of the parent list but renders inside its own submenu root. */
  | 'submenu-trigger';

/**
 * The filter implementation when the menu this part belongs to is filterable, otherwise `null`.
 * `virtualFocus` marks a filter root; a plain `Menu.Root` never sets it. The result is fixed for
 * a mounted part.
 */
export function useMenuFilterImpl(scope: MenuFilterPartScope = 'root'): MenuFilterImpl | null {
  const impl = useContext(MenuFilterImplContext);
  const root = useContext(MenuRootContext);

  if (impl === null || root == null) {
    return null;
  }

  const filterable =
    scope === 'submenu-trigger' ? root.virtualFocus || root.parentVirtualFocus : root.virtualFocus;
  return filterable ? impl : null;
}

/**
 * Throws unless the menu this part renders in is filterable, naming the part and the provider.
 */
export function useMenuFilterPart(part: string) {
  if (useMenuFilterImpl() === null) {
    throw new Error(
      `Base UI: <Menu.${part}> must be placed in a menu wrapped in <Menu.FilterProvider>. ` +
        'It reads the filter query and the matching items from the provider, which a plain menu ' +
        'does not have. Wrap the <Menu.Root> or <Menu.SubmenuRoot> it belongs to in ' +
        '<Menu.FilterProvider>. See https://base-ui.com/react/components/menu#filtering',
    );
  }
}

const ALWAYS_VISIBLE = () => true;

const UNFILTERED: MenuFilterItemResult = { visible: ALWAYS_VISIBLE, ref: null };

/**
 * Registers an item part with the filter of the menu it belongs to. A plain menu's items are
 * always visible.
 */
export function useMenuFilterItem(
  props: MenuFilterItemParams,
  scope: MenuFilterPartScope = 'root',
): MenuFilterItemResult {
  const impl = useMenuFilterImpl(scope);
  if (!impl) {
    return UNFILTERED;
  }
  const params: MenuFilterItemParams = {
    get label() {
      return props.label;
    },
  };
  return scope === 'submenu-trigger' ? impl.useSubmenuTrigger(params) : impl.useItem(params);
}
