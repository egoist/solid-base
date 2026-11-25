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
  helper return accessors.

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
