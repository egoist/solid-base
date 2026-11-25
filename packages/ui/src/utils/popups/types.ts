import type { VirtualElement } from '@floating-ui/dom';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { TransitionStatus } from '../../internals/transitionStatus';
import type { HTMLProps } from '../../internals/types';
import type { FloatingTreeStore } from './tree/FloatingTreeStore';
import type { PopupTriggerMap } from './popupTriggerMap';

export type Delay = number | Partial<{ open: number; close: number }>;

export type NarrowedElement<T> = T extends Element ? T : Element;

export type ReferenceType = Element | VirtualElement;

export interface PopupEvents {
  emit<T extends string>(event: T, data?: any): void;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}

/**
 * Reads the interaction state of a popup by key.
 *
 * Reads are **tracked** when they happen inside a reactive scope (JSX, memo, effect compute) and
 * always return the latest written value, so they are also safe in event handlers.
 */
export interface PopupInteractionReader {
  (key: 'open'): boolean;
  (key: 'transitionStatus'): TransitionStatus | undefined;
  /**
   * The active trigger's element. Popup stores keep it after the popup unmounts;
   * `FloatingRootStore` clears it while the popup isn't mounted.
   */
  (key: 'anchorElement'): Element | null;
  /**
   * The anchor the interactions see: the anchor override, such as the cursor position from
   * `createClientPoint`, or else the owner's anchor (usually the active trigger). A Positioner's
   * `anchor` prop isn't included; positioning applies it on its own.
   */
  (key: 'anchor'): ReferenceType | null;
  /**
   * The popup's positioner element, or the popup itself when it has no positioner.
   */
  (key: 'positionerElement'): HTMLElement | null;
  /**
   * The popup's id unless its element sets one.
   */
  (key: 'defaultPopupId'): string | undefined;
}

/**
 * Non-reactive values shared by the interactions of one popup (the equivalent of Floating UI's
 * `dataRef`). Plain mutable fields: interactions read and write them imperatively.
 */
export interface PopupInteractionContext {
  readonly events: PopupEvents;
  nested: boolean;
  readonly triggerElements: PopupTriggerMap;
  /**
   * The event that opened the popup. Written by `dispatchOpenChange`; NavigationMenu clears it.
   */
  openEvent?: Event | undefined;
  /**
   * The popup's positioning. Written by `createFloating()`.
   */
  positioning?: PopupPositioningContext | undefined;
  /**
   * The popup's list navigation orientation, which nested lists read from their parent. Written by
   * `createListNavigation`.
   */
  orientation?: 'vertical' | 'horizontal' | 'both' | undefined;
  /**
   * Whether the current event passed through the popup's component tree, such as from a portaled
   * child, so native listeners that see it as outside ignore it. Set by `createDismiss` and the
   * focus manager, and cleared on the next tick.
   */
  insideReactTree?: boolean | undefined;
  /**
   * Whether an Escape key press bubbles to the parent popup. Written by `createDismiss` and never
   * cleared.
   */
  escapeKeyBubbles?: boolean | undefined;
  /**
   * Whether an outside press bubbles to the parent popup. Written by `createDismiss` and never
   * cleared.
   */
  outsidePressBubbles?: boolean | undefined;
}

/**
 * The store that interactions, the focus manager and positioning read and write.
 * Popup stores (`BasePopupStore`) implement it directly. Navigation Menu and Toast, which keep
 * their open state outside a store, use `FloatingRootStore`.
 */
export interface PopupInteractionStore {
  select: PopupInteractionReader;
  set(key: 'anchorOverride', value: ReferenceType | null): void;
  set(key: 'anchorElement', value: Element | null): void;
  setOpen(open: boolean, eventDetails: BaseUIChangeEventDetails<string>): void;
  readonly context: PopupInteractionContext;
}

/**
 * The store anchor positioning reads and clears.
 */
export interface PositioningInteractionStore extends PopupInteractionStore {
  /**
   * Forgets the elements positioning reads while the popup isn't mounted, so positioning doesn't
   * run for a `keepMounted` popup that is closed.
   */
  clearPositioning(): void;
}

/**
 * The positioning context of a popup, shared with its floating tree node. A live object: its
 * getters read the store.
 */
export interface PopupPositioningContext {
  readonly open: boolean;
  readonly nodeId: string | undefined;
  readonly defaultPopupId: string | undefined;
  readonly elements: ExtendedElements;
  readonly rootStore: PopupInteractionStore;
  /** Imperative refs of the positioned elements (set by `createFloating`). */
  readonly refs?: ExtendedRefs | undefined;
  /** Additional positioning data, such as `x`, `y`, `placement` (set by `createFloating`). */
  readonly [key: string]: unknown;
}

export interface ExtendedRefs {
  setReference(node: ReferenceType | null): void;
  setFloating(node: HTMLElement | null): void;
  setPositionReference(node: ReferenceType | null): void;
}

export interface ExtendedElements {
  readonly reference: ReferenceType | null;
  readonly floating: HTMLElement | null;
  readonly domReference: Element | null;
}

export interface FloatingNodeType {
  id: string | undefined;
  parentId: string | null;
  context?: PopupPositioningContext | undefined;
}

export type FloatingTreeType = FloatingTreeStore;

/**
 * Props returned by an interaction, to be passed to `renderElement`'s `props` array of the
 * matching part. Each object is created once; reactive values are exposed through getters.
 */
export interface ElementProps {
  /** Props for the element the popup is anchored to (usually the active trigger). */
  reference?: HTMLProps | undefined;
  /** Props for the floating element (the popup, or its positioner). */
  floating?: HTMLProps | undefined;
  /** Props for list items (list navigation, typeahead). */
  item?: HTMLProps | ((props: ItemPropsArg) => HTMLProps) | undefined;
  /** Props for inactive triggers (detached triggers that aren't the active one). */
  trigger?: HTMLProps | undefined;
}

export interface ItemPropsArg {
  active?: boolean | undefined;
  selected?: boolean | undefined;
}

export type { FloatingTreeStore };
