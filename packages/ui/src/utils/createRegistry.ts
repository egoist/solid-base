import { createSignal, type Accessor } from 'solid-js';
import { isServer } from '@solidjs/web';

export interface Registry<Entry> {
  /** The registered entries, in registration order. Reactive in the browser. */
  entries: Accessor<readonly Entry[]>;
  /** Registers an entry, typically from a child's component body. Returns the unregister function. */
  register: (entry: Entry) => () => void;
}

/**
 * A list of entries (usually accessors) that children register with a parent as they are created.
 *
 * In the browser the list is a signal, so readers follow registrations. A server render never
 * re-runs and must not write signals, so there the entries are only recorded, and readers see
 * the entries registered so far.
 */
export function createRegistry<Entry>(name?: string): Registry<Entry> {
  if (isServer) {
    let entries: readonly Entry[] = [];
    return {
      entries: () => entries,
      register(entry) {
        entries = [...entries, entry];
        return () => {
          entries = entries.filter((current) => current !== entry);
        };
      },
    };
  }

  const [entries, setEntries] = createSignal<readonly Entry[]>([], { ownedWrite: true, name });
  return {
    entries,
    register(entry) {
      setEntries((current) => [...current, entry]);
      return () => {
        setEntries((current) => current.filter((registered) => registered !== entry));
      };
    },
  };
}
