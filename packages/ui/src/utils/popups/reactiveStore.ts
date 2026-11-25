import {
  createEffect,
  createSignal,
  getObserver,
  runWithOwner,
  untrack,
  type Accessor,
  type Setter,
} from 'solid-js';

type SelectorFunction<State> = (state: State, ...args: any[]) => any;

type Tail<T extends any[]> = T extends [any, ...infer Rest] ? Rest : [];

/**
 * The arguments a selector takes after the state.
 */
export type SelectorArgs<Fn> = Fn extends (state: any, ...args: infer Args) => any
  ? Args
  : never;

/**
 * A small external store backed by Solid signals: the Solid counterpart of Base UI's `ReactStore`.
 *
 * - `state` is always up to date: a write is visible to the very next read, unlike signals, whose
 *   reads lag writes until the next flush. Imperative popup logic (event handlers, `setOpen`
 *   pipelines) depends on that.
 * - `select(key)` reads a value (or runs a selector) and **tracks** every key it reads when called
 *   inside a reactive scope. Dependents re-run on the next flush and read the latest values.
 * - Keys can be `bind`-ed to accessors (controlled props, transition status…): reads go straight
 *   to the accessor, and writes to them are ignored.
 *
 * Writes are allowed anywhere (the signals use `ownedWrite`), so stores can be seeded in component
 * bodies and updated from effects, handlers and ref callbacks alike.
 */
export class ReactiveStore<
  State extends object,
  Context = Record<string, never>,
  Selectors extends Record<string, SelectorFunction<State>> = Record<string, never>,
> {
  /**
   * Mutable, non-reactive context shared by the store's users.
   */
  readonly context: Context;

  /**
   * The current state. Reads are untracked and always return the latest written value.
   */
  readonly state: Readonly<State>;

  private readonly values: Record<PropertyKey, any>;

  private readonly bindings = new Map<PropertyKey, Accessor<any>>();

  private readonly derivations = new Map<PropertyKey, (stored: any) => any>();

  private readonly signals = new Map<PropertyKey, [Accessor<number>, Setter<number>]>();

  // Track stored values read through `selectStored`, which bypass derivations.
  private readonly storedSignals = new Map<PropertyKey, [Accessor<number>, Setter<number>]>();

  private readonly listeners = new Set<() => void>();

  private readonly trackedState: State;

  private version = 0;

  private readonly selectors: Selectors | undefined;

  constructor(initialState: State, context: Context, selectors?: Selectors) {
    this.values = { ...initialState };
    this.context = context;
    this.selectors = selectors;

    const read = (key: PropertyKey) => {
      const binding = this.bindings.get(key);
      if (!binding) {
        const derive = this.derivations.get(key);
        return derive ? derive(this.values[key]) : this.values[key];
      }
      // Untracked reads (snapshots in handlers, effect callbacks and ref callbacks) run without an
      // owner: a compiled conditional prop (`open={a() && b()}`) creates a memo on every read that
      // has an owner, which Solid forbids inside effect and ref callbacks.
      return getObserver() ? binding() : runWithOwner(null, binding);
    };

    this.state = new Proxy(this.values, {
      get: (_target, key) => untrack(() => read(key)),
      set: () => false,
    }) as unknown as State;

    this.trackedState = new Proxy(this.values, {
      get: (_target, key) => {
        this.track(key);
        return read(key);
      },
      set: () => false,
    }) as unknown as State;
  }

  /**
   * Reads a state value, or runs a selector against the state, tracking what it reads.
   */
  select<Key extends keyof Selectors>(
    key: Key,
    ...args: SelectorArgs<Selectors[Key]>
  ): ReturnType<Selectors[Key]>;
  select<Key extends keyof State>(key: Key): State[Key];
  select(key: PropertyKey, ...args: any[]): any {
    // Outside a tracking scope (event handlers, effect `apply` phases, timers) the read is an
    // intentional snapshot: don't touch the signals, so Solid doesn't report an untracked read.
    if (!getObserver()) {
      return untrack(() => this.selectTracked(key, args));
    }
    return this.selectTracked(key, args);
  }

  private selectTracked(key: PropertyKey, args: any[]): any {
    const selector = this.selectors?.[key as keyof Selectors];
    if (selector) {
      return selector(this.trackedState, ...args);
    }
    return (this.trackedState as any)[key];
  }

  /**
   * Returns an accessor for `select(key, ...args)`.
   */
  accessor<Key extends keyof Selectors>(
    key: Key,
    ...args: SelectorArgs<Selectors[Key]>
  ): Accessor<ReturnType<Selectors[Key]>>;
  accessor<Key extends keyof State>(key: Key): Accessor<State[Key]>;
  accessor(key: PropertyKey, ...args: any[]): Accessor<any> {
    return () => (this.select as any)(key, ...args);
  }

  /**
   * Sets a single value.
   */
  set<Key extends keyof State>(key: Key, value: State[Key]) {
    this.update({ [key]: value } as unknown as Partial<State>);
  }

  /**
   * Returns a setter for a single key (handy as a ref callback).
   */
  setter<Key extends keyof State>(key: Key): (value: State[Key]) => void {
    return (value) => this.set(key, value);
  }

  /**
   * Merges `changes` into the state and notifies dependents of the keys that changed.
   */
  update(changes: Partial<State>) {
    const previous = this.snapshot();
    const next = this.transformState(previous, { ...previous, ...changes });
    this.commit(previous, next);
  }

  /**
   * Replaces the state.
   */
  setState(newState: State) {
    const previous = this.snapshot();
    this.commit(previous, this.transformState(previous, { ...newState }));
  }

  /**
   * Binds a key to an accessor: reading the key reads the accessor (tracked when selected) and
   * writes to it are ignored. Use it for controlled props and values derived elsewhere.
   */
  bind<Key extends keyof State>(key: Key, accessor: Accessor<State[Key]>) {
    this.bindings.set(key, accessor);
  }

  /**
   * Derives what reading `key` returns from its stored value (tracked when selected), such as a
   * fallback computed from other state. Writes still go to the stored value, and snapshots taken
   * for updates (`transformState`) see the stored value. Returns a function removing it.
   */
  derive<Key extends keyof State>(key: Key, fn: (stored: State[Key]) => State[Key]) {
    this.derivations.set(key, fn);
    return () => {
      if (this.derivations.get(key) === fn) {
        this.derivations.delete(key);
      }
    };
  }

  /**
   * Reads the value of `key` (with its derivation) without going through a selector of the same
   * name, tracking it inside a reactive scope.
   */
  selectValue<Key extends keyof State>(key: Key): State[Key] {
    return getObserver() ? this.trackedState[key] : this.state[key];
  }

  /**
   * Reads the stored value of `key`, bypassing `derive`, tracking it inside a reactive scope.
   */
  selectStored<Key extends keyof State>(key: Key): State[Key] {
    if (getObserver()) {
      let signal = this.storedSignals.get(key);
      if (!signal) {
        signal = createSignal(0, { ownedWrite: true, name: `store.${String(key)}.stored` });
        this.storedSignals.set(key, signal);
      }
      signal[0]();
    }
    return this.values[key as PropertyKey];
  }

  /**
   * Keeps `key` in sync with `accessor`: the value is written now, and again whenever the
   * accessor changes. Unlike `bind`, the key stays writable.
   */
  syncValue<Key extends keyof State>(key: Key, accessor: Accessor<State[Key]>) {
    this.set(key, untrack(accessor));
    createEffect(accessor, (value) => {
      this.set(key, value);
    });
  }

  /**
   * Like `syncValue`, and resets the key to `undefined` when the owner is disposed.
   */
  syncValueWithCleanup<Key extends keyof State>(key: Key, accessor: Accessor<State[Key]>) {
    this.set(key, untrack(accessor));
    createEffect(accessor, (value) => {
      this.set(key, value);
      return () => {
        if (this.values[key as PropertyKey] === value) {
          this.set(key, undefined as State[Key]);
        }
      };
    });
  }

  /**
   * Subscribes to every committed change. Returns the unsubscribe function.
   */
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notifies every dependent and subscriber, as if every value had changed.
   */
  notifyAll() {
    for (const key of Object.keys(this.values)) {
      this.notify(key);
    }
    this.listeners.forEach((listener) => listener());
  }

  /**
   * A hook for subclasses to adjust the next state before it is committed.
   */
  protected transformState(_previous: State, next: State): State {
    return next;
  }

  private snapshot(): State {
    const result: Record<PropertyKey, any> = { ...this.values };
    this.bindings.forEach((binding, key) => {
      // Without an owner, like the untracked reads in the constructor.
      result[key] = untrack(() => runWithOwner(null, binding));
    });
    return result as State;
  }

  private commit(previous: State, next: State) {
    const changedKeys: string[] = [];
    for (const key of Object.keys(next)) {
      if (this.bindings.has(key)) {
        continue;
      }
      if (!Object.is(this.values[key], (next as any)[key]) || !(key in this.values)) {
        changedKeys.push(key);
      }
    }
    if (changedKeys.length === 0) {
      return;
    }

    // A derived key notifies its readers only when what they read changes: writing a stored value
    // that the derivation overrides (an anchor that follows the active trigger while the popup is
    // mounted, say) is not a change for them.
    const derivedBefore = new Map<string, unknown>();
    for (const key of changedKeys) {
      if (this.derivations.has(key)) {
        derivedBefore.set(key, this.state[key as keyof State]);
      }
    }
    for (const key of changedKeys) {
      this.values[key] = (next as any)[key];
    }
    for (const key of changedKeys) {
      this.notifyStored(key);
      if (!derivedBefore.has(key) || !Object.is(derivedBefore.get(key), this.state[key as keyof State])) {
        this.notify(key);
      }
    }
    if (previous !== next) {
      this.listeners.forEach((listener) => listener());
    }
  }

  private track(key: PropertyKey) {
    this.getSignal(key)[0]();
  }

  private notifyStored(key: PropertyKey) {
    const signal = this.storedSignals.get(key);
    if (signal) {
      this.version += 1;
      signal[1](this.version);
    }
  }

  private notify(key: PropertyKey) {
    const signal = this.signals.get(key);
    if (signal) {
      this.version += 1;
      signal[1](this.version);
    }
  }

  private getSignal(key: PropertyKey) {
    let signal = this.signals.get(key);
    if (!signal) {
      signal = createSignal(0, { ownedWrite: true, name: `store.${String(key)}` });
      this.signals.set(key, signal);
    }
    return signal;
  }
}

export type { Tail };
