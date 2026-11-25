---
title: Direction Provider
description: Enables RTL behavior for Solid Base components.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and wrap it around your app:

```tsx title="Anatomy"
import { DirectionProvider } from '@egoist/solid-base/direction-provider';

<DirectionProvider>{/* Your app or a group of components */}</DirectionProvider>;
```

`<DirectionProvider>` enables child components to adjust behavior based on RTL text direction,
but does not affect HTML and CSS. The `dir="rtl"` HTML attribute or `direction: rtl` CSS style
must be set additionally by your own application code.

## API reference

### DirectionProvider

::api

### useDirection

Use this primitive to read the current text direction. This is useful for wrapping portaled
components that may be rendered outside your application root and are unaffected by the `dir`
attribute set within.

```tsx title="Reading the direction"
import { useDirection } from '@egoist/solid-base/direction-provider';

function Popup(props: { children: JSX.Element }) {
  const direction = useDirection();
  return <div dir={direction()}>{props.children}</div>;
}
```

| Returns                 | Description                                                                    |
| ----------------------- | ------------------------------------------------------------------------------ |
| `Accessor<TextDirection>` | The direction of the closest `<DirectionProvider>`, or `'ltr'` without one. |

:::solid[An accessor, not a value]
Base UI's `useDirection()` returns the direction. Here it returns an accessor: call it
(`direction()`) inside JSX or another tracking scope to react to changes of the provider's
`direction` prop.
:::

### Additional types

```ts
type TextDirection = 'ltr' | 'rtl';
```
