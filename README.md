# solid-base

Unstyled, accessible UI components for **SolidJS 2** — a faithful port of
[Base UI](https://base-ui.com) (`@base-ui/react`).

Same components, parts, props, data attributes, ARIA semantics, keyboard and focus behavior as
Base UI, rewritten with idiomatic Solid 2 primitives: fine-grained reactivity, live props views
instead of re-renders, `createX` primitives instead of hooks, and no virtual DOM.

```sh
bun add @egoist/solid-base solid-js @solidjs/web
```

```tsx
import { Switch } from '@egoist/solid-base/switch';

function Airplane() {
  return (
    <label>
      <Switch.Root class="switch" onCheckedChange={(checked) => console.log(checked)}>
        <Switch.Thumb class="thumb" />
      </Switch.Root>
      Airplane mode
    </label>
  );
}
```

## Differences from the React API

The component APIs follow Base UI's documentation at https://base-ui.com, with the following
Solid-specific adjustments:

- **`class`, not `className`.** It accepts any Solid class value (string, array, object) or a
  function of the component state: `class={(state) => (state.checked ? 'on' : 'off')}`.
- **`style`** uses Solid's style objects (`{ 'font-size': '12px' }`), strings, or a function of
  the state.
- **`render`** accepts a tag name (`render="a"`) or a function receiving the props to spread and
  the component state: `render={(props, state) => <a {...props} href="/docs" />}`. The function
  is called once; `props` and `state` are live objects, so read them in JSX to stay reactive and
  don't destructure them.
- **Refs** are Solid ref callbacks (`ref={el => ...}` or `let el; ref={el}`).
- **Event handlers** receive native events. Like in Base UI, user handlers run before the
  internal ones and can call `event.preventBaseUIHandler()` to skip them.
- Change callbacks keep Base UI's signature: `onOpenChange(open, eventDetails)`,
  `onValueChange(value, eventDetails)`, … with `eventDetails.cancel()` and friends.
- Hooks are Solid primitives: `useRender` returns an element, `useDirection()` and the media query
  helper return accessors, and `useToastManager().toasts` is a reactive getter
  (`<For each={manager.toasts}>`).
- Function children (such as a Root's `{({ payload }) => ...}` or `Field.Validity`) are called once
  with live objects, like `render` functions.
- `actionsRef` accepts a `{ current }` object or a callback.
- Attribute-like props use Solid's lowercase names where Base UI uses React's camelCase
  (`tabindex`, `autocomplete`, `inputmode`, …).

## Status

The port mirrors Base UI's test suites: about 6,700 tests ported from upstream pass in jsdom.
Upstream tests that need real layout, CSS animations or a real browser are skipped with a comment,
as are React-specific ones (StrictMode, render counts). Server rendering and hydration follow
Solid's model but are not covered by the test suite yet.

Known differences:

- Filterable menus match items by their `label` or rendered text. An item whose text changes while
  it is filtered out is only re-matched once shown again; pass `label` for dynamic text.

## Components

Every Base UI module is ported, with the same parts and props:

Accordion · Alert Dialog · Autocomplete · Avatar · Button · Checkbox · Checkbox Group ·
Collapsible · Combobox · Context Menu · Dialog · Drawer · Field · Fieldset · Form · Input · Menu ·
Menubar · Meter · Navigation Menu · Number Field · OTP Field · Popover · Preview Card · Progress ·
Radio · Radio Group · Scroll Area · Select · Separator · Slider · Switch · Tabs · Toast · Toggle ·
Toggle Group · Toolbar · Tooltip

Utilities: `CSPProvider`, `DirectionProvider` / `useDirection`, `mergeProps`, `useRender`, and
`useMediaQuery` (`@egoist/solid-base/unstable-use-media-query`).

Import from the root entry or from a module subpath:

```tsx
import { Dialog, Menu } from '@egoist/solid-base';
import { Popover } from '@egoist/solid-base/popover';
```

## Packages

| Package                                       | Description                                            |
| --------------------------------------------- | ------------------------------------------------------ |
| [`@egoist/solid-base`](packages/ui)            | The components                                         |
| [`@egoist/solid-base-utils`](packages/utils)   | DOM helpers and Solid primitives used by the components |

## Development

This is a Bun workspace.

```sh
bun install
bun run test        # vitest (jsdom)
bun run typecheck   # tsc
bun run dev         # playground at http://localhost:5173
bun run build       # build the packages
```

See [AGENTS.md](AGENTS.md) for the porting conventions.

## License

MIT. Based on [Base UI](https://github.com/mui/base-ui) by the MUI team (MIT).
