import type { JSX } from '@solidjs/web';
import { applyRef } from '@egoist/solid-base-utils/refs';
import type { BaseUIEvent } from '../types';

/**
 * A source of props for {@link mergeProps}:
 * - an object (its getters are read lazily, so it can be reactive), or
 * - a function receiving a live view of the props merged so far and returning the props to use
 *   from then on (it is responsible for forwarding what it receives).
 */
export type PropsSource<P = Record<string, any>> =
  | P
  | ((mergedSoFar: P) => P)
  | null
  | undefined
  | false;

const HIDDEN_NONE: ReadonlySet<PropertyKey> = new Set();

/**
 * Merges several props objects into a single live view.
 *
 * It follows `Object.assign` semantics, where the rightmost source wins, except for:
 * - **event handlers** (`on*`): all of them run, rightmost first. A handler can call
 *   `event.preventBaseUIHandler()` to skip the handlers to its left (usually the internal ones).
 * - **`class`**: classes are joined, rightmost first.
 * - **`style`**: style objects are merged, rightmost properties winning.
 * - **`ref`**: every ref is called with the element.
 *
 * The result is a view, not a copy: reads are forwarded to the sources at access time, so reactive
 * getters stay reactive. Function sources are called once, immediately, with a live view of the
 * props merged up to that point.
 *
 * @public
 */
export function mergeProps<P extends Record<string, any> = Record<string, any>>(
  ...sources: PropsSource<any>[]
): P {
  return mergePropsN<P>(sources);
}

/**
 * Same as {@link mergeProps}, but accepts an array of sources.
 * @public
 */
export function mergePropsN<P extends Record<string, any> = Record<string, any>>(
  sources: readonly PropsSource<any>[],
): P {
  let list: Record<string, any>[] = [];
  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    if (!source) {
      continue;
    }
    if (typeof source === 'function') {
      const view = createMergedView(list);
      list = [source(view)];
    } else {
      list.push(source);
    }
  }
  return createMergedView(list) as P;
}

/**
 * Creates a merged view of `sources` that hides the `hidden` keys.
 * @internal
 */
export function createMergedView(
  sources: readonly Record<string, any>[],
  hidden: ReadonlySet<PropertyKey> = HIDDEN_NONE,
): Record<string, any> {
  const handlerCache = new Map<string, (...args: unknown[]) => unknown>();
  let refCache: ((element: unknown) => void) | undefined;

  function has(key: PropertyKey) {
    if (typeof key !== 'string' || hidden.has(key)) {
      return false;
    }
    for (let i = sources.length - 1; i >= 0; i -= 1) {
      if (key in sources[i]) {
        return true;
      }
    }
    return false;
  }

  function get(key: PropertyKey): any {
    if (typeof key !== 'string' || hidden.has(key)) {
      return undefined;
    }

    if (key === 'class') {
      return mergeClassValues(sources);
    }
    if (key === 'style') {
      return mergeStyleValues(sources);
    }
    if (key === 'ref') {
      let count = 0;
      for (let i = 0; i < sources.length; i += 1) {
        if (sources[i].ref) {
          count += 1;
        }
      }
      if (count === 0) {
        return undefined;
      }
      refCache ??= (element: unknown) => {
        for (let i = 0; i < sources.length; i += 1) {
          applyRef(sources[i].ref, element);
        }
      };
      return refCache;
    }
    if (isEventHandlerKey(key)) {
      let found = false;
      for (let i = 0; i < sources.length; i += 1) {
        if (sources[i][key] != null) {
          found = true;
          break;
        }
      }
      if (!found) {
        return undefined;
      }
      let handler = handlerCache.get(key);
      if (!handler) {
        handler = (...args: unknown[]) => runHandlers(sources, key, args);
        handlerCache.set(key, handler);
      }
      return handler;
    }

    for (let i = sources.length - 1; i >= 0; i -= 1) {
      const source = sources[i];
      if (key in source) {
        const value = source[key];
        if (typeof value === 'boolean' && key.startsWith('aria-')) {
          return value ? 'true' : 'false';
        }
        return value;
      }
    }
    return undefined;
  }

  return new Proxy(Object.create(null), {
    get: (_target, key) => get(key),
    has: (_target, key) => has(key),
    set: () => true,
    deleteProperty: () => true,
    ownKeys() {
      const keys = new Set<string>();
      for (let i = 0; i < sources.length; i += 1) {
        for (const key of Object.keys(sources[i])) {
          if (!hidden.has(key)) {
            keys.add(key);
          }
        }
      }
      return [...keys];
    },
    getOwnPropertyDescriptor(_target, key) {
      if (!has(key)) {
        return undefined;
      }
      return {
        configurable: true,
        enumerable: true,
        get: () => get(key),
      };
    },
  });
}

function isEventHandlerKey(key: string) {
  const code2 = key.charCodeAt(2);
  return (
    key.charCodeAt(0) === 111 /* o */ &&
    key.charCodeAt(1) === 110 /* n */ &&
    code2 >= 65 /* A */ &&
    code2 <= 90 /* Z */
  );
}

function callHandler(handler: unknown, args: unknown[]) {
  if (typeof handler === 'function') {
    return handler(...args);
  }
  if (Array.isArray(handler) && typeof handler[0] === 'function') {
    // Solid's bound handler form: `[handler, data]`.
    return handler[0](handler[1], ...args);
  }
  return undefined;
}

/**
 * Whether the first argument of a handler is an event that can carry `preventBaseUIHandler()`.
 * Non-DOM callbacks (`onValueChange(value)`, `onOpenChange(open, details)`) receive other values.
 */
function isPreventableEvent(value: unknown): value is Event {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as Event).preventDefault === 'function'
  );
}

function runHandlers(sources: readonly Record<string, any>[], key: string, args: unknown[]) {
  const event = args[0];
  const baseUIEvent = isPreventableEvent(event)
    ? makeEventPreventable(event as BaseUIEvent<Event>)
    : undefined;
  let result: unknown;
  let called = false;
  for (let i = sources.length - 1; i >= 0; i -= 1) {
    const handler = sources[i][key];
    if (handler == null) {
      continue;
    }
    const value = callHandler(handler, args);
    if (!called) {
      // The rightmost (external) handler's return value wins, like upstream.
      called = true;
      result = value;
    }
    if (baseUIEvent?.baseUIHandlerPrevented) {
      break;
    }
  }
  return result;
}

/**
 * Adds `preventBaseUIHandler()` to an event, allowing a handler to skip the
 * Base UI handlers that would run after it.
 */
export function makeEventPreventable<E extends Event>(event: E): BaseUIEvent<E> {
  const baseUIEvent = event as BaseUIEvent<E>;
  if (typeof baseUIEvent.preventBaseUIHandler !== 'function') {
    baseUIEvent.preventBaseUIHandler = () => {
      (baseUIEvent as { baseUIHandlerPrevented: boolean }).baseUIHandlerPrevented = true;
    };
  }
  return baseUIEvent;
}

function mergeClassValues(sources: readonly Record<string, any>[]): JSX.ClassValue {
  let result: JSX.ClassValue[] | undefined;
  let single: JSX.ClassValue;
  let count = 0;
  for (let i = sources.length - 1; i >= 0; i -= 1) {
    const value = sources[i].class;
    if (value == null || value === '' || value === false || typeof value === 'function') {
      continue;
    }
    count += 1;
    if (count === 1) {
      single = value;
    } else {
      if (count === 2) {
        result = [single];
      }
      result!.push(value);
    }
  }
  return count > 1 ? result : single;
}

/**
 * Joins class values, rightmost first.
 */
export function mergeClassNames(
  ourClassName: JSX.ClassValue,
  theirClassName: JSX.ClassValue,
): JSX.ClassValue {
  return mergeClassValues([{ class: ourClassName }, { class: theirClassName }]);
}

function mergeStyleValues(sources: readonly Record<string, any>[]) {
  let result: Record<string, any> | undefined;
  let single: JSX.CSSProperties | undefined;
  let count = 0;
  for (let i = 0; i < sources.length; i += 1) {
    const value = sources[i].style;
    if (value == null || typeof value === 'function' || value === '') {
      continue;
    }
    const style = typeof value === 'string' ? parseStyle(value) : value;
    count += 1;
    if (count === 1) {
      single = style;
    } else {
      if (count === 2) {
        result = { ...single };
      }
      Object.assign(result!, style);
    }
  }
  return count > 1 ? result : single;
}

/**
 * Parses an inline style string into a Solid style object.
 */
export function parseStyle(style: string): JSX.CSSProperties {
  const result: Record<string, string> = {};
  for (const declaration of style.split(';')) {
    const index = declaration.indexOf(':');
    if (index === -1) {
      continue;
    }
    const property = declaration.slice(0, index).trim();
    const value = declaration.slice(index + 1).trim();
    if (property) {
      result[property] = value;
    }
  }
  return result;
}
