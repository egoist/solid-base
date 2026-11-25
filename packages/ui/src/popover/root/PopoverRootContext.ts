import { createContext, useContext } from 'solid-js';
import type { PopoverStore } from '../store/PopoverStore';

export type PopoverRootContext<Payload = unknown> = PopoverStore<Payload>;

export const PopoverRootContext = createContext<PopoverStore<unknown> | null>(null);

export function usePopoverRootContext(optional?: false): PopoverStore<unknown>;
export function usePopoverRootContext(optional: true): PopoverStore<unknown> | null;
export function usePopoverRootContext(optional?: boolean) {
  const store = useContext(PopoverRootContext);
  if (store == null && !optional) {
    throw new Error(
      'Base UI: PopoverRootContext is missing. Popover parts must be placed within <Popover.Root>.',
    );
  }
  return store;
}
