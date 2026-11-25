import { createContext, useContext } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';
import type { FilterDropdownStore } from '../store';

export interface FilterDropdownItemRegistration {
  getText: () => string | undefined;
}

export type FilterDropdownFilter = (text: string, query: string) => boolean;

/**
 * The context of a filter root. Created once; reactive values are getters.
 */
export interface FilterDropdownRootContext {
  readonly open: boolean;
  readonly disabled: boolean;
  /**
   * The input value. Upstream keeps it in a separate context so a controlled input keeps its
   * caret; Solid contexts are live objects, so it is a getter here.
   */
  readonly value: string;
  readonly inputFocusVisible: boolean;
  setInputFocusVisible: (visible: boolean) => void;
  readonly keyboardModality: boolean;
  setKeyboardModality: (keyboardModality: boolean) => void;
  readonly autoHighlight: boolean | 'always';
  readonly triggerId: string | undefined;
  readonly defaultListId: string | undefined;
  readonly listId: string | undefined;
  /** Records the id the list rendered with, when it differs from `defaultListId`. */
  setRenderedListId: (id: string | undefined) => void;
  /** The input, which owns real focus while the host uses virtual list navigation. */
  focusOwnerRef: RefObject<HTMLElement | null>;
  /** Moves the host's highlight. */
  setActiveIndex: (index: number | null) => void;
  /** Called with the previous items when the host's list changes after it first registered. */
  onItemsChange: (previousItems: readonly (HTMLElement | null)[]) => void;
  /** Reports a query edit and resets the highlight it invalidates. */
  onValueChange: (value: string, eventDetails: FilterDropdownRoot.ChangeEventDetails) => void;
}

export interface FilterDropdownItemContext {
  /** The enclosing dropdown when this root is nested. */
  parent: FilterDropdownItemContext | null;
  store: FilterDropdownStore;
  registerItem: (id: symbol, registration: FilterDropdownItemRegistration) => () => void;
  listRef: RefObject<Array<HTMLElement | null>>;
}

function throwMissingFilterRoot(): never {
  throw new Error(
    'Base UI: Filter parts are missing their filter context and cannot access the query or items. ' +
      'Wrap the component root in its filter provider.',
  );
}

export const FilterDropdownItemContext = createContext<FilterDropdownItemContext | null>(null);

export function useFilterDropdownItemContext(optional?: false): FilterDropdownItemContext;
export function useFilterDropdownItemContext(optional: true): FilterDropdownItemContext | null;
export function useFilterDropdownItemContext(optional: boolean): FilterDropdownItemContext | null;
export function useFilterDropdownItemContext(optional = false) {
  const context = useContext(FilterDropdownItemContext);
  if (context == null && !optional) {
    throwMissingFilterRoot();
  }
  return context ?? null;
}

export const FilterDropdownRootContext = createContext<FilterDropdownRootContext | null>(null);

export function useFilterDropdownRootContext(optional?: false): FilterDropdownRootContext;
export function useFilterDropdownRootContext(optional: true): FilterDropdownRootContext | null;
export function useFilterDropdownRootContext(optional: boolean): FilterDropdownRootContext | null;
export function useFilterDropdownRootContext(optional = false) {
  const context = useContext(FilterDropdownRootContext);
  if (context == null && !optional) {
    throwMissingFilterRoot();
  }
  return context ?? null;
}

/**
 * Finds the dropdown that owns the given item list, walking out through nested roots.
 */
export function useFilterContextForList(
  listRef: RefObject<Array<HTMLElement | null>> | null,
): FilterDropdownItemContext | null {
  let context = useContext(FilterDropdownItemContext) ?? null;
  if (listRef === null) {
    return null;
  }

  while (context !== null && context.listRef !== listRef) {
    context = context.parent;
  }
  return context;
}

export type FilterDropdownRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.clearPress
  | typeof REASONS.popupClose;

export type FilterDropdownRootChangeEventDetails =
  BaseUIChangeEventDetails<FilterDropdownRootChangeEventReason>;

export namespace FilterDropdownRoot {
  export type ChangeEventReason = FilterDropdownRootChangeEventReason;
  export type ChangeEventDetails = FilterDropdownRootChangeEventDetails;
}
