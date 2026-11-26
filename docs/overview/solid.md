---
title: Coming from React
description: Every difference from headless React component libraries.
order: 4
---

If you have used a headless component library in React, most of Solid Base will look familiar.
This page lists where it follows Solid instead, so you can translate React examples with
confidence.

## The rules of thumb

- Props are a **live object**. Read `props.x` where you need it (in JSX, a getter or a memo), and
  never destructure props.
- Callbacks you pass (`render`, `class`, `style`, function children) are **called once** or
  re-evaluated by fine-grained tracking — never on a re-render, because there are no re-renders.
- Where React and the DOM disagree, this library follows the DOM: `class`, native events,
  lowercase attribute names.

## `class` instead of `className`

Every part accepts `class`. It takes any Solid class value — a string, an array, or a
`{ name: boolean }` object — or a function of the component state:

```tsx
<Switch.Thumb class="thumb" />
<Switch.Thumb class={['thumb', { 'thumb-large': large() }]} />
<Switch.Thumb class={(state) => (state.checked ? 'thumb on' : 'thumb off')} />
```

The function is re-evaluated whenever the state it reads changes. There is no `classList` prop
in Solid 2: use the object form instead.

## `style`

`style` takes a Solid style object with kebab-case keys and string values with units, a style
string, or a function of the state:

```tsx
<Switch.Thumb style={{ 'background-color': 'red', 'margin-top': '4px' }} />
<Switch.Thumb style={(state) => ({ color: state.checked ? 'red' : 'blue' })} />
```

## The `render` prop

`render` accepts a tag name, or a function receiving the props to spread and the component state.
It does not accept an element (`render={<a />}` in React):

```tsx
// React: render={<a href="/docs" />}
<Menu.LinkItem render="a" href="/docs">Docs</Menu.LinkItem>

// React: render={(props, state) => <a {...props} />}
<Menu.LinkItem render={(props) => <A {...props} href="/docs" />}>Docs</Menu.LinkItem>
```

The function is **called once**. `props` and `state` are live objects: spread `props` and read
`state` inside JSX to stay reactive. Don't destructure them, and don't branch on the state at the
top of the function — that branch would never re-run:

```tsx
// ✗ Runs once: the icon never changes.
<Toggle render={(props, state) => (state.pressed ? <On {...props} /> : <Off {...props} />)} />

// ✓ The element stays, its content follows the state.
<Toggle
  render={(props, state) => (
    <button {...props}>
      <Show when={state.pressed} fallback={<HeartIcon />}>
        <HeartFilledIcon />
      </Show>
    </button>
  )}
/>
```

When you also set props on the rendered element, attributes written after the spread override the
part's own. Use [`mergeProps`](/utils/merge-props) when both should apply — it chains handlers,
joins classes and merges styles. See [Composition](/handbook/composition).

## Refs

Refs are Solid ref callbacks or variables, and `ref` is an ordinary prop — there is no
`forwardRef`:

```tsx
let trigger!: HTMLButtonElement;

<Popover.Trigger ref={trigger} />
<Popover.Trigger ref={(element) => console.log(element)} />
```

Ref callbacks are never called with `null`. Use `onCleanup` to clear a stored element.

## Events

Event handlers receive **native events** (there is no `event.nativeEvent`), use camelCase names
(`onClick`, `onKeyDown`), and are bound once. Your handlers run before the
internal ones and can call `event.preventBaseUIHandler()` to skip them:

```tsx
<NumberField.Input
  onPaste={(event) => {
    event.preventBaseUIHandler();
  }}
/>
```

There are no `on*Capture` props: attach capture listeners with `addEventListener` in a ref
callback or `onSettled`. `onFocus` and `onBlur` don't bubble, as in the DOM: use `onFocusIn` and
`onFocusOut` where React code relied on React's bubbling focus events.

### `onInput` for text inputs

In Solid, `onChange` is the native `change` event, which fires when a text input loses focus. Use
`onInput` for per-keystroke changes — or the component's own `onValueChange`, which keeps Base
UI's signature:

```tsx
<Input onValueChange={(value, eventDetails) => setQuery(value)} />
<input onInput={(event) => setQuery(event.currentTarget.value)} />
```

### Change callbacks

Change callbacks receive the new value and the event details — `onOpenChange(open, eventDetails)`,
`onValueChange(value, eventDetails)`, `onCheckedChange(checked, eventDetails)` — with
`eventDetails.reason`, `eventDetails.event`, `cancel()`, `allowPropagation()` and the rest. See
[Customization](/handbook/customization).

## Lowercase attributes

Attribute-like props use their HTML names where React uses camelCase:

| React          | Solid          |
| -------------- | -------------- |
| `className`    | `class`        |
| `htmlFor`      | `for`          |
| `tabIndex`     | `tabindex`     |
| `readOnly`     | `readonly`     |
| `autoComplete` | `autocomplete` |
| `autoFocus`    | `autofocus`    |
| `inputMode`    | `inputmode`    |
| `minLength`    | `minlength`    |
| `maxLength`    | `maxlength`    |

Boolean attributes are set by presence: `false` removes them. In your own JSX, write ARIA booleans
as strings (`aria-hidden="true"`); props that go through a component may use booleans.

## Controlled state

Pass a signal's value and update it from the change callback. Because Solid reads props lazily,
there is no stale closure to worry about:

```tsx
const [open, setOpen] = createSignal(false);

<Dialog.Root open={open()} onOpenChange={(next) => setOpen(next)}>
  …
</Dialog.Root>;
```

## Hooks are Solid primitives

Hooks keep familiar `use` names, but return Solid values:

- [`useRender`](/utils/use-render) returns an element and runs once. Pass it live objects (a
  `render` getter, `omit(props, 'render')`, a `state` object with getters).
- [`useDirection()`](/utils/direction-provider) returns an accessor: `useDirection()()` or
  `const direction = useDirection(); direction() === 'rtl'`.
- [`useMediaQuery()`](/utils/use-media-query) returns an accessor of whether the query matches.
- `Toast.useToastManager().toasts` is a reactive getter. Render it with `<For>`:

```tsx
function ToastList() {
  const toastManager = Toast.useToastManager();
  return <For each={toastManager.toasts}>{(toast) => <Toast.Root toast={toast} />}</For>;
}
```

## Function children

Function children — such as a Root's `{({ payload }) => …}` with detached triggers, or
`Field.Validity` — are called once with live objects, like `render` functions. Read their
properties inside JSX:

```tsx
const handle = Popover.createHandle<string>();

<Popover.Trigger handle={handle} payload="Ada">Edit Ada</Popover.Trigger>
<Popover.Trigger handle={handle} payload="Grace">Edit Grace</Popover.Trigger>

<Popover.Root handle={handle}>
  {(state) => (
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup>Editing {state.payload}</Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  )}
</Popover.Root>

<Field.Validity>
  {(state) => <Show when={state.validity.valid === false}>{state.error}</Show>}
</Field.Validity>
```

Destructuring the argument (`{({ payload }) => …}`) reads `payload` once, when the function is
called, and loses reactivity.

## `actionsRef`

`actionsRef` accepts a `{ current }` object or a callback receiving the actions (and `null` on
unmount):

```tsx
const actionsRef: { current: Popover.Root.Actions | null } = { current: null };

<Popover.Root actionsRef={actionsRef}>…</Popover.Root>;

actionsRef.current?.close();
```

## Server-side rendering

Components render on the server with Solid's SSR. Like React portals, popups (the contents of a
`Portal` part) render nothing on the server and mount on the client. Anything that depends on
measuring the DOM, such as anchor positioning, starts once the component runs in the browser.

## Behaviors that differ

- Filterable menus match items by their `label` or rendered text. An item whose text changes
  while it is filtered out is only re-matched once shown again; pass `label` for dynamic text.
- React-specific APIs have no equivalent: there is no StrictMode behavior, and nothing depends on
  render counts.
