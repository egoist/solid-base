import { createEffect, createSignal, onCleanup, untrack, type Accessor } from 'solid-js';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { FilterDropdownRoot } from './FilterDropdownRootContext';

interface CreateFilterDropdownCloseQueryParameters {
  open: Accessor<boolean>;
  mounted: Accessor<boolean>;
  value: Accessor<string>;
  onValueChange: (value: string, details: FilterDropdownRoot.ChangeEventDetails) => void;
}

/**
 * Retains the displayed query and filtered items while a filter popup closes, and clears the
 * committed value once it has unmounted. The input lives inside the popup, so the value stays in
 * use until then: clearing it earlier would change whatever the consumer renders from it, such
 * as externally filtered items, while the popup animates out.
 */
export function createFilterDropdownCloseQuery(
  params: CreateFilterDropdownCloseQueryParameters,
): Accessor<string> {
  const { open, mounted, value, onValueChange } = params;

  const [closeQuery, setCloseQuery] = createSignal<string | null>(null, { ownedWrite: true });

  let previousOpen = untrack(open);
  let pendingReset = false;

  function settlePendingReset() {
    pendingReset = false;
    if (untrack(value) !== '') {
      // Runs from an effect: the handler reads the consumer's current props as a snapshot.
      untrack(() => onValueChange('', createChangeEventDetails(REASONS.popupClose)));
    }
  }

  createEffect(
    () => [open(), mounted(), value(), closeQuery()] as const,
    ([isOpen, isMounted, currentValue, currentCloseQuery]) => {
      const wasOpen = previousOpen;
      previousOpen = isOpen;
      if (wasOpen && !isOpen && currentValue !== '') {
        pendingReset = true;
        setCloseQuery(currentValue);
      } else if ((isOpen || !isMounted) && currentCloseQuery !== null) {
        // A reopen that interrupts the exit never unmounts, so it settles the pending reset too.
        setCloseQuery(null);
        settlePendingReset();
      }
    },
  );

  onCleanup(() => {
    if (pendingReset) {
      settlePendingReset();
    }
  });

  return () => {
    const currentCloseQuery = closeQuery();
    return !open() && currentCloseQuery !== null ? currentCloseQuery : value();
  };
}
