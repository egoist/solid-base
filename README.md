# Solid Base

Unstyled, accessible UI components for **SolidJS 2**. Documentation: https://base.egoist.dev

Composable parts, data attributes for every state, complete keyboard and focus behavior, built
with idiomatic Solid 2 primitives: fine-grained reactivity, live props views instead of
re-renders, `createX` primitives instead of hooks, and no virtual DOM.

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

## Coming from React

If you have used a headless component library in React, most of the API will look familiar. Where
Solid and React differ, it follows Solid:

- **`class`, not `className`.** It accepts any Solid class value (string, array, object) or a
  function of the component state: `class={(state) => (state.checked ? 'on' : 'off')}`.
- **`style`** uses Solid's style objects (`{ 'font-size': '12px' }`), strings, or a function of
  the state.
- **`render`** accepts a tag name (`render="a"`) or a function receiving the props to spread and
  the component state: `render={(props, state) => <a {...props} href="/docs" />}`. The function
  is called once; `props` and `state` are live objects, so read them in JSX to stay reactive and
  don't destructure them.
- **Refs** are Solid ref callbacks (`ref={el => ...}` or `let el; ref={el}`).
- **Event handlers** receive native events. User handlers run before the internal ones and can call `event.preventBaseUIHandler()` to skip them.
- Change callbacks receive the value and the event details: `onOpenChange(open, eventDetails)`,
  `onValueChange(value, eventDetails)`, … with `eventDetails.cancel()` and friends.
- Hooks are Solid primitives: `useRender` returns an element, `useDirection()` and the media query
  helper return accessors, and `useToastManager().toasts` is a reactive getter
  (`<For each={manager.toasts}>`).
- Function children (such as a Root's `{({ payload }) => ...}` or `Field.Validity`) are called once
  with live objects, like `render` functions.
- `actionsRef` accepts a `{ current }` object or a callback.
- Attribute-like props use Solid's lowercase names where React uses camelCase
  (`tabindex`, `autocomplete`, `inputmode`, …).

## Status

About 6,700 tests pass in jsdom, with Solid's dev diagnostics turned into failures. Tests that
need real layout, CSS animations or a real browser are skipped with a comment. A separate suite
server-renders every demo (`bun run test:ssr`); popups render nothing on the server. Another
hydrates every demo and checks that it behaves like a client-rendered one
(`bun run test:hydration`).

Known differences:

- Filterable menus match items by their `label` or rendered text. An item whose text changes while
  it is filtered out is only re-matched once shown again; pass `label` for dynamic text.

## Components

Components:

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

The documentation is Markdown in [`docs`](docs) (see [docs/README.md](docs/README.md) for the
authoring conventions), rendered by the website in [`website`](website): TanStack Start on
Solid 2, prerendered to static HTML, with live demos and an API reference generated from the
TypeScript source.

## Development

This is a Bun workspace.

```sh
bun install
bun run test        # vitest (jsdom) + server rendering + hydration
bun run typecheck   # tsc
bun run dev         # playground at http://localhost:5173
bun run website     # documentation site
bun run website:build
bun run build       # build the packages
```

See [AGENTS.md](AGENTS.md) for the codebase conventions.

## License

MIT. Based on [Base UI](https://github.com/mui/base-ui) by the MUI team (MIT).
