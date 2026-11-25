import { ReactiveStore } from './reactiveStore';

type SelectorFunction<State> = (state: State, ...args: any[]) => any;

/**
 * A `ReactiveStore` whose state never changes.
 *
 * Useful for fallback stores that need to support normal store reads while detached from the
 * component that owns real state (such as a handle's store before a Root attaches). Context values
 * may still contain mutable maps.
 */
export class NullStore<
  State extends object,
  Context = Record<string, never>,
  Selectors extends Record<string, SelectorFunction<State>> = Record<string, never>,
> extends ReactiveStore<State, Context, Selectors> {
  override setState(_newState: State) {}

  override update(_changes: Partial<State>) {}

  override set<Key extends keyof State>(_key: Key, _value: State[Key]) {}

  override notifyAll() {}
}
