import { createSignal, untrack, type Accessor } from 'solid-js';

export interface CreateControllableSignalOptions<T> {
  /**
   * Reads the controlled value. The state is controlled while this returns anything but `undefined`.
   */
  value: Accessor<T | undefined>;
  /**
   * Reads the initial uncontrolled value. Only read once, like a native `defaultValue`.
   */
  defaultValue?: Accessor<T> | undefined;
}

export type ControllableSetter<T> = (next: T | ((prev: T) => T)) => void;

/**
 * A signal that can be either controlled by a prop or hold its own (uncontrolled) state.
 *
 * - Reading returns the controlled value when defined, the internal value otherwise.
 * - Writing only updates the internal value. Controlled owners are expected to be notified
 *   through a change callback by the caller before writing.
 */
export function createControllableSignal<T>(
  options: CreateControllableSignalOptions<T> & { defaultValue: Accessor<T> },
): [Accessor<T>, ControllableSetter<T>];
export function createControllableSignal<T>(
  options: CreateControllableSignalOptions<T>,
): [Accessor<T | undefined>, ControllableSetter<T | undefined>];
export function createControllableSignal<T>(
  options: CreateControllableSignalOptions<T>,
): [Accessor<T | undefined>, ControllableSetter<T | undefined>] {
  // `default*` props are initial values by contract: read once, never tracked.
  const [internal, setInternal] = createSignal<T | undefined>(
    untrack(() => options.defaultValue?.()) as any,
  );

  const value = () => {
    const controlled = options.value();
    return controlled !== undefined ? controlled : internal();
  };

  const setValue: ControllableSetter<T | undefined> = (next) => {
    if (untrack(options.value) !== undefined) {
      return;
    }
    // Always wrap so function-typed values are stored as values, not treated as updaters.
    setInternal(() =>
      typeof next === 'function' ? (next as (prev: T | undefined) => T)(untrack(internal)) : next,
    );
  };

  return [value, setValue];
}
