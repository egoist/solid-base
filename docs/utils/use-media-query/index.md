---
title: useMediaQuery
description: A primitive that tracks whether a CSS media query matches.
badge: Unstable
---

`useMediaQuery` returns an accessor that tells whether a media query matches, and updates when it
starts or stops matching. Resize the window or change your system's color scheme to see the demo
update.

::demo{src="./demos/hero.tsx"}

:::warning[Unstable API]
This primitive is exported from an `unstable-` module: its API may change in a minor release.
:::

## Usage

```tsx title="Usage"
import { useMediaQuery } from '@egoist/solid-base/unstable-use-media-query';

function Navigation() {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  return (
    <Show when={isDesktop()} fallback={<MobileNavigation />}>
      <DesktopNavigation />
    </Show>
  );
}
```

The query can be written with or without the leading `@media`, and can be an accessor to track a
query that changes:

```tsx title="A reactive query"
const [breakpoint, setBreakpoint] = createSignal(768);
const matches = useMediaQuery(() => `(min-width: ${breakpoint()}px)`);
```

## Server rendering

`window.matchMedia()` is unavailable on the server, so the primitive returns `defaultMatches`
(`false` by default) during server rendering and on the client until hydration completes. It then
switches to the real value, which avoids hydration mismatches.

- Set `defaultMatches` to the value most of your users will get.
- Provide `ssrMatchMedia` to compute the server value from the request, for example from the
  user agent or client hints.
- Set `noSsr` when the value is only used on the client: the real value is then read immediately
  during hydration instead of after it.

```tsx title="Server value from client hints"
const isDesktop = useMediaQuery('(min-width: 768px)', {
  ssrMatchMedia: (query) => ({ matches: guessFromUserAgent(query) }),
});
```

:::solid[An accessor, not a value]
The React hook returns a boolean and re-renders the component. Here the primitive returns an
`Accessor<boolean>`: call it (`matches()`) inside JSX, a memo or an effect to react to changes.
:::

## API reference

```ts title="Signature"
function useMediaQuery(
  query: string | Accessor<string>,
  options?: useMediaQuery.Options,
): Accessor<boolean>;
```

### Parameters

| Parameter | Type                            | Description                                                            |
| --------- | ------------------------------- | ---------------------------------------------------------------------- |
| `query`   | `string \| Accessor<string>`    | The media query, with or without the leading `@media`.                 |
| `options` | `useMediaQuery.Options`         | Optional. Read lazily, so its properties can be getters.               |

### Options

- **`defaultMatches`** `boolean` — The value returned on the server and until hydration completes, as `window.matchMedia()` is unavailable on the server. Defaults to `false`.
- **`matchMedia`** `typeof window.matchMedia | null` — A custom `matchMedia` implementation, for example to match against an iframe's content window. Pass `null` to disable media query matching.
- **`noSsr`** `boolean` — Reads the real value immediately during hydration instead of after it. Set it to `true` only if you use the returned value on the client. Defaults to `false`.
- **`ssrMatchMedia`** `(query: string) => { matches: boolean }` — A `matchMedia` implementation used when rendering on the server (and until hydration completes).

### Return value

| Type               | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| `Accessor<boolean>` | Whether the query currently matches. Updates when it changes. |
