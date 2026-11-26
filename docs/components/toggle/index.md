---
title: Toggle
description: A two-state button that can be on or off.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and use it as a single part:

```tsx title="Anatomy"
import { Toggle } from '@egoist/solid-base/toggle';

<Toggle />;
```

## Examples

### Changing the content when pressed

The `render` function receives the component state as its second argument. Like every `render`
function in this library, it is called once with live `props` and `state` objects: read
`state.pressed` inside JSX (or `<Show>`) rather than branching on it at the top of the function.

```tsx title="Swapping the icon"
<Toggle
  aria-label="Favorite"
  render={(props, state) => (
    <button type="button" {...props}>
      <Show when={state.pressed} fallback={<HeartOutlineIcon />}>
        <HeartFilledIcon />
      </Show>
    </button>
  )}
/>
```

:::solid[Render functions run once]
In React, `render={(props, state) => state.pressed ? <A /> : <B />}` re-runs on every state
change. Here the function is called once; an `if` on `state.pressed` at the top of the function
would only ever see the initial value.
:::

## API reference

::api
