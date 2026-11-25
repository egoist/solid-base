# Solid Base — Base UI for SolidJS 2

This repository is a SolidJS 2 port of [Base UI](https://github.com/mui/base-ui) (`@base-ui/react`).
It is a Bun workspace:

| Path              | Package                    | Contents                                                     |
| ----------------- | -------------------------- | ------------------------------------------------------------ |
| `packages/ui`     | `@egoist/solid-base`       | The components (`src/<component>/`), mirroring upstream      |
| `packages/utils`  | `@egoist/solid-base-utils` | Framework-agnostic helpers and small Solid primitives        |
| `playground`      | `playground`               | Vite app showcasing the components                           |

Commands (run from the repo root):

```sh
bun install
bunx vitest run packages/ui/src/switch      # tests for one component
bun run test                                # all tests
bunx tsc -p tsconfig.json --noEmit          # typecheck everything
bun run dev                                 # playground
```

The upstream source of truth is the `packages/react/src` folder of Base UI. Port behavior
faithfully (same props, same data attributes, same ARIA, same keyboard and focus behavior, same
event details), but write **idiomatic Solid 2**, not React-in-Solid.

## Solid 2 — read this first

Solid 2 is not Solid 1 and not React. Before writing code, read
`node_modules/solid-js/CHEATSHEET.md` (and `node_modules/solid-js/skills/solid-2.0/SKILL.md`).
The essentials for this codebase:

- Imports: `solid-js` (signals, stores, `merge`, `omit`, control flow, context) and
  `@solidjs/web` (`Portal`, `dynamic`, `Dynamic`, `isServer`, `isDev`, `JSX` types).
- `createEffect(compute, apply)` — two functions. `compute` tracks, `apply` runs side effects
  untracked and may return a cleanup. There is no single-argument form.
- Mount/unmount work: `onSettled(() => { ...; return cleanup })`. `onCleanup` for disposal.
- **Reads lag writes**: after `setX(v)`, `x()` returns the old value until the microtask flush
  (or `flush()`). Compute the next value locally instead of re-reading the signal.
- **No writes in owned scopes**: never write a signal in a component body, a memo, or an effect
  `compute`. Write in event handlers, effect `apply`, `onSettled`, ref callbacks, timers.
- **No top-level reactive reads in component bodies** (`STRICT_READ_UNTRACKED`): read props inside
  JSX, getters, accessors, memos or effect computes. Never "fix" it with `untrack`, except for
  intentionally read-once values such as `default*` props (see `createControllableSignal`).
- Props are never destructured. Defaults: `const disabled = () => props.disabled ?? false`.
- `createMemo(fn, options?)` — no initial value argument; `fn` receives the previous value.
- `createContext<T | null>(null)`; the context object is the provider: `<Ctx value={v}>`.
- `<For each>` (keyed: raw item + index accessor), `<For keyed={false}>` (item accessor),
  `<Show>`, `<Switch>/<Match>`.
- Event handlers: camelCase (`onClick`), bound once. Text inputs: use `onInput` for per-keystroke
  changes (`onChange` is the native `change` event).
- Attributes are lowercase: `tabindex`, `for`, `readonly`, `maxlength`, `autocomplete`…
  Boolean attributes are presence/absence (`false` removes them).
- In raw JSX, write ARIA booleans as strings: `aria-hidden="true"`, `aria-expanded={open() ? 'true' : 'false'}`.
  Props that go through `renderElement`/`mergeProps` may use booleans: they are serialized for you.
- `class` accepts strings, arrays and `{ name: boolean }` objects. No `classList`.
- Tests: Solid dev diagnostics (`[CODE] ...` warnings) **fail the test** (see `test/setup.ts`),
  including the attribution reports Vite's dev server shows to users (`EFFECT_WRITES_OWN_SOURCE`,
  `EFFECT_RELAY_TEAR`, `UNSTABLE_MEMO_OUTPUT`). Fix the cause; never silence them.
  `ATTRIBUTION=off` disables the attribution engine to bisect a failure.
- **Never keep derived state in sync with an effect.** Derive it (`createMemo`, a writable
  `createSignal(fn)`, a store `derive`), write at the source in handlers, or register an accessor
  with the parent instead of copying a value into its state. Give memos returning arrays/objects
  an `equals`. An effect whose `apply` only measures the DOM takes no argument.

## Component anatomy

Reference implementations: `packages/ui/src/button/Button.tsx`, `packages/ui/src/separator`,
`packages/ui/src/internals/composite/*`, and their tests.

```tsx
import { omit } from 'solid-js';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';

export function SwitchThumb(componentProps: SwitchThumb.Props) {
  // 1. Everything that is not a DOM prop is omitted; `ref` and `children` stay in `elementProps`.
  const elementProps = omit(componentProps, 'render', 'class', 'style');
  // 2. Context values are live objects (accessors/getters).
  const rootState = useSwitchRootContext();
  // 3. State is an object of getters: it is reactive and becomes `data-*` attributes.
  const state: SwitchThumb.State = {
    get checked() {
      return rootState.checked;
    },
  };
  // 4. renderElement merges: state attributes → props sources (left to right) → class/style.
  return renderElement('span', componentProps, {
    state,
    ref: internalRef, // optional internal ref(s); the user's ref flows through elementProps
    props: [internalProps, elementProps],
    stateAttributesMapping,
  });
}
```

Pitfalls learned while porting:

- Call `renderElement(...)` in the component body (`const element = renderElement(...)`) or in
  its own component, then insert `{element}`. Calling it inline inside a JSX expression or a
  memo makes that scope track the reads it performs, and the element is recreated (losing focus
  and handlers) whenever they change.
- Reading `props.children` creates the children. Never read it in more than one place.
- Effect `apply` callbacks are untracked but still report `STRICT_READ_UNTRACKED` for reactive
  reads: read what you need in the `compute` function, or call imperative helpers that untrack.
- Solid effects never compare their inputs: if `compute` returns an equal value the `apply`
  still runs. Read a memo in `compute` to skip unchanged values.
- There are no `on*Capture` props: attach native capture listeners in `onSettled`/effects.
  `onFocus`/`onBlur` don't bubble; use `onFocusIn`/`onFocusOut` where React relied on bubbling.
- Ref callbacks are never called with `null`: clear element references in `onCleanup`.
- Hydration claims server-rendered elements in render order. When a component returns siblings
  (`<><Guard />{element}<Guard /></>`), create the element in place through a component
  (`const Trigger = () => renderElement(...)`, then `<Trigger />`), not ahead of its siblings in
  the body, or it can miss its event bindings after hydration.
- Server and client must create the same reactive structure: never return early on `isServer`
  (or `isHydrating()`) before creating primitives, or every following hydration id shifts. Wrap
  client-only work in one memo created on both sides.
- Context is captured when a node is created: a provider only reaches children created inside
  it. Create the element (or resolve its children) inside the provider's JSX, not before it.

### Mapping React → Solid

| Upstream (React)                               | This port (Solid 2)                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `React.forwardRef(fn)`                         | plain `function Name(componentProps)`; `ref` is a prop and is merged automatically   |
| `const { a, ...elementProps } = props`         | `const elementProps = omit(props, 'render', 'class', 'style', 'a', ...)`            |
| `className` prop / `mergeClassNames`           | `class` prop (string, array, object, or `(state) => ClassValue`)                    |
| `style` (`React.CSSProperties`, camelCase)     | `style` (`JSX.CSSProperties`, kebab-case keys, string values with units)            |
| `render={<a />}` / `render={(p, s) => ...}`    | `render="a"` or `render={(props, state) => <a {...props} />}` (called **once**; `props` and `state` are live) |
| `useRenderElement(tag, props, params)`         | `renderElement(tag, props, params)` (`internals/renderElement.tsx`)                  |
| `enabled: false` in `useRenderElement`         | `enabled: () => boolean` (renders through `<Show>`)                                  |
| `mergeProps` / `mergePropsN`                   | same names (`merge-props/mergeProps.ts`), returns a live view                        |
| props getter `(props) => props` in `props: []` | supported: a function source receives the live view merged so far                    |
| `useState`                                     | `createSignal`                                                                       |
| `useControlled`                                | `createControllableSignal` (`@egoist/solid-base-utils/controlled`)                   |
| `useRef` for DOM elements                      | `let el: HTMLElement \| undefined` + ref callback, or a signal when it must be reactive |
| `useRef` for mutable values                    | plain `let` variables, or `RefObject` (`@egoist/solid-base-utils/refObject`) for shared boxes |
| `useMemo`                                      | `createMemo`, or a plain accessor function when cheap                               |
| `useCallback` / `useStableCallback`            | plain functions that read props at call time                                        |
| `useEffect` / `useIsoLayoutEffect`             | `createEffect(compute, apply)`; mount-only → `onSettled`                            |
| `useValueChanged(value, fn)`                   | `createEffect(value, fn, { defer: true })`                                           |
| `useId` / `useBaseUiId`                        | `createBaseUiId(() => props.id)` → `Accessor<string>`                                |
| `useTimeout` / `useAnimationFrame`/`useInterval` | `createTimeout` / `createAnimationFrame` / `createInterval` (auto-cleared)          |
| `useScrollLock`                                | `createScrollLock(enabled, referenceElement)`                                       |
| `useTransitionStatus`                          | `createTransitionStatus(open, options)` (`internals/transitionStatus.ts`)            |
| `useOpenChangeComplete`                        | `createOpenChangeComplete` (`internals/openChangeComplete.ts`)                       |
| `useAnimationsFinished`                        | `createAnimationsFinished` (`internals/animationsFinished.ts`)                       |
| `useButton`                                    | `createButton` (`internals/use-button`)                                              |
| `useFocusableWhenDisabled`                     | `createFocusableWhenDisabled` (`utils/focusableWhenDisabled.ts`)                     |
| `CompositeRoot` / `CompositeItem` / `useCompositeListItem` / `CompositeList` | same names in `internals/composite` (`createCompositeRoot`, `createCompositeItem`, `createCompositeList`) |
| `useDirection()` (value)                       | `useDirection()` → `Accessor<TextDirection>`                                          |
| Context with memoized value object             | context value = object of getters/accessors, created once                            |
| `React.Children`, `cloneElement`               | redesign with context/registration; use `children()` from `solid-js` if you must resolve children |
| `ReactDOM.createPortal`                        | `Portal` from `@solidjs/web` (see the popups infrastructure)                         |
| `ReactDOM.flushSync(fn)`                       | `fn(); flush()`                                                                      |
| `event.nativeEvent`                            | `event` (handlers receive native events)                                             |
| `onChange` on text inputs                      | `onInput`                                                                            |
| `tabIndex`, `htmlFor`, `readOnly`, `autoComplete` | `tabindex`, `for`, `readonly`, `autocomplete`                                    |
| `process.env.NODE_ENV !== 'production'`        | `isDev` from `@solidjs/web`                                                          |

Naming: primitives that create reactive behavior are `createX`; functions that read context are
`useXContext`/`useX`. Public component APIs keep upstream names (`Switch.Root`, `Switch.Thumb`,
`onCheckedChange(checked, eventDetails)`, `SwitchRoot.Props`, `SwitchRoot.State`, …).

### Module layout and exports

Mirror upstream: `packages/ui/src/<component>/<part>/<Part>.tsx`, plus
`<Part>DataAttributes.ts`/`<Part>CssVars.ts` (copy the upstream files verbatim — they're plain
enums/docs), `index.parts.ts` (`export { SwitchRoot as Root } from './root/SwitchRoot'`), and
`index.ts` (`export * as Switch from './index.parts'; export type * from ...`). Keep the
upstream public types (`<Part>.Props`, `<Part>.State`, `ChangeEventDetails`, …).

Do not edit `packages/ui/src/index.ts` or any `package.json` — the coordinator aggregates exports
and dependencies. If you need a new dependency, say so in your report.

### Shared code

- `internals/` and `utils/` mirror upstream folders. Pure helpers can be copied with the
  mechanical helper `python3 scripts/port-from-react.py <upstream-file> <dest-file>` (only rewrites
  imports/types — port the logic by hand afterwards).
- If a foundation file (`renderElement`, `mergeProps`, `createButton`, composite, transitions)
  lacks something you need, prefer extending it in a backwards-compatible way and mention it in
  your report. Do not rewrite it.
- Event details: `createChangeEventDetails(REASONS.x, event, trigger?, custom?)` and
  `createGenericEventDetails` in `internals/createBaseUIEventDetails.ts` (same as upstream).

## Tests

Port the upstream `*.test.tsx` files that cover behavior (rendering, ARIA, data attributes,
keyboard, controlled/uncontrolled, callbacks with event details). Use
`@solidjs/testing-library` (`render(() => <X />)`), `@testing-library/user-event`, and
`flush()` from `solid-js` after synchronous `fireEvent` calls before asserting. Upstream's
`describeConformance` has no equivalent here; cover `class`/`style`/`render`/`ref` for at least one
part per component. Skip tests that rely on real layout or animations (jsdom), and keep a short
comment saying why.
