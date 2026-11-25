import { createContext, useContext, type Accessor } from 'solid-js';
import { NOOP } from '../noop';
import type { HTMLProps } from '../types';

/**
 * A state setter accepting a value or an updater function.
 */
export type StateSetter<T> = (next: T | ((prev: T) => T)) => void;

export interface LabelableContextValue {
  /**
   * The `id` of the labelable element.
   * When `null` the label omits `for`, either because the association is implicit or
   * because the control takes its name from `aria-labelledby`.
   */
  controlId: Accessor<string | null | undefined>;
  registerControlId: (source: symbol, id: string | null | undefined) => void;
  resetControlId: () => void;
  /**
   * The `id` of the label.
   */
  labelId: Accessor<string | undefined>;
  setLabelId: StateSetter<string | undefined>;
  /**
   * The `id`s of the elements that provide an accessible description.
   */
  messageIds: Accessor<string[]>;
  setMessageIds: StateSetter<string[]>;
  /**
   * Registers a description whose `id` is derived (e.g. an error message that is only rendered
   * while the field is invalid): `messageIds` includes it whenever `id` returns one.
   * Returns the unregister function.
   */
  registerMessageId: (id: Accessor<string | undefined>) => () => void;
  /**
   * Returns a live view of `externalProps` whose `aria-describedby` also references the
   * descriptions and errors registered in this (and the parent) labelable scope.
   */
  getDescriptionProps: (externalProps: HTMLProps) => HTMLProps;
}

const EMPTY_IDS: string[] = [];

const DEFAULT_LABELABLE_CONTEXT: LabelableContextValue = {
  controlId: () => undefined,
  registerControlId: NOOP,
  resetControlId: NOOP,
  labelId: () => undefined,
  setLabelId: NOOP,
  messageIds: () => EMPTY_IDS,
  setMessageIds: NOOP,
  registerMessageId: () => NOOP,
  getDescriptionProps: (externalProps: HTMLProps) => externalProps,
};

/**
 * A context for providing [labelable elements](https://html.spec.whatwg.org/multipage/forms.html#category-label)
 * with an accessible name (label) and description.
 */
export const LabelableContext = createContext<LabelableContextValue | null>(null);

/**
 * Returns the closest labelable scope, or an inert default when there is none
 * (`registerControlId === NOOP`).
 */
export function useLabelableContext(): LabelableContextValue {
  return useContext(LabelableContext) ?? DEFAULT_LABELABLE_CONTEXT;
}
