import { createEffect, createMemo, onCleanup, untrack, type Accessor } from 'solid-js';
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

  // The query as of the last time the popup closed: `null` while open, `undefined` before it first
  // opens.
  const closedWith = createMemo<RetainedQuery | null | undefined>(
    (previous) => {
      if (open()) {
        return null;
      }
      return previous !== null ? previous : { query: value() };
    },
    { name: 'createFilterDropdownCloseQuery.closedWith' },
  );

  let pendingReset = false;
  let lastClosedWith: RetainedQuery | undefined;

  function settlePendingReset() {
    pendingReset = false;
    if (untrack(value) !== '') {
      // Runs from an effect: the handler reads the consumer's current props as a snapshot.
      untrack(() => onValueChange('', createChangeEventDetails(REASONS.popupClose)));
    }
  }

  // Clears the committed value once the popup has unmounted. A reopen that interrupts the exit
  // never unmounts, so it settles the pending reset too.
  createEffect(
    () => ({ closed: closedWith(), isMounted: mounted() }),
    ({ closed, isMounted }) => {
      if (closed && closed !== lastClosedWith) {
        lastClosedWith = closed;
        pendingReset = closed.query !== '';
      }
      if (pendingReset && (!closed || !isMounted)) {
        settlePendingReset();
      }
    },
  );

  onCleanup(() => {
    if (pendingReset) {
      settlePendingReset();
    }
  });

  // A memo: the popup unmounting hands the display from the retained query back to the value,
  // which is still the same until the reset above lands.
  return createMemo(
    () => {
      const closed = closedWith();
      return closed && closed.query !== '' && mounted() ? closed.query : value();
    },
    { name: 'createFilterDropdownCloseQuery.query' },
  );
}

interface RetainedQuery {
  query: string;
}
