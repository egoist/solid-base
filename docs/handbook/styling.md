---
title: Styling
description: A guide to styling Solid Base components with your preferred styling engine.
order: 1
---

The components are unstyled, don't bundle CSS, and are compatible with Tailwind CSS, CSS Modules,
plain CSS, or any other styling solution that produces class names or inline styles. You retain
total control of your styling layer.

## Style hooks

### CSS classes

Components that render an HTML element accept a `class` prop to style the element with CSS
classes.

```tsx title="switch.tsx"
<Switch.Thumb class="SwitchThumb" />
```

The prop can also be passed a function that takes the component's state as an argument.

```tsx title="switch.tsx"
<Switch.Thumb class={(state) => (state.checked ? 'checked' : 'unchecked')} />
```

:::solid
`class` replaces React's `className`. Besides strings and functions of the state, it accepts any
Solid class value: an array (`['thumb', size()]`) or an object (`{ 'thumb-active': active() }`).
The function form is re-evaluated whenever the state it reads changes.
:::

### Data attributes

Components provide data attributes designed for styling their states. For example,
[Switch](/components/switch) can be styled using its `[data-checked]` and `[data-unchecked]`
attributes, among others.

```css title="switch.css"
.SwitchThumb[data-checked] {
  background-color: green;
}
```

### CSS variables

Components expose CSS variables to aid in styling, often containing dynamic numeric values to be
used in sizing or transform calculations. For example, [Popover](/components/popover) exposes CSS
variables on its `Positioner` part like `--available-height` and `--anchor-width`.

```css title="popover.css"
.Popup {
  max-height: var(--available-height);
}
```

Check out each component's API reference for a complete list of available data attributes and
CSS variables.

### Style prop

Components that render an HTML element accept a `style` prop to style the element with a CSS
object.

```tsx title="switch.tsx"
<Switch.Thumb style={{ height: '100px' }} />
```

The prop also accepts a function that takes the component's state as an argument.

```tsx title="switch.tsx"
<Switch.Thumb style={(state) => ({ color: state.checked ? 'red' : 'blue' })} />
```

:::solid
Style objects follow Solid's conventions: CSS property names in kebab-case
(`{ 'background-color': 'red' }`) and string values with units (`'100px'`, not `100`). A style
string (`style="height: 100px"`) works too.
:::

## Tailwind CSS

Apply Tailwind CSS classes to each part via the `class` prop. Tailwind's `data-*` variants target
the state attributes directly (`data-highlighted:bg-neutral-950`), and arbitrary values read the
CSS variables (`origin-(--transform-origin)`).

```tsx title="menu.tsx"
import { Menu } from '@egoist/solid-base/menu';

export default function ExampleMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger class="flex h-8 items-center justify-center rounded-md border border-neutral-950 bg-white px-3 text-sm text-neutral-950 select-none hover:bg-neutral-100 active:bg-neutral-200 data-popup-open:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800 dark:active:bg-neutral-700 dark:data-popup-open:bg-neutral-800 dark:focus-visible:outline-white">
        Song
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner class="outline-hidden" sideOffset={8}>
          <Menu.Popup class="origin-(--transform-origin) border border-neutral-950 bg-white py-1 text-neutral-950 outline-hidden transition data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white">
            <Menu.Item class="flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:bg-neutral-950 data-highlighted:text-white dark:data-highlighted:bg-white dark:data-highlighted:text-neutral-950">
              Add to Library
            </Menu.Item>
            <Menu.Item class="flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:bg-neutral-950 data-highlighted:text-white dark:data-highlighted:bg-white dark:data-highlighted:text-neutral-950">
              Add to Playlist
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
```

The function form of `class` is an alternative to data attribute variants when you prefer to pick
the classes in TypeScript:

```tsx
<Tabs.Tab value="overview" class={(state) => (state.active ? 'text-white' : 'text-neutral-400')} />
```

## CSS Modules

Apply custom CSS classes to each part via the `class` prop. Then style those classes in a CSS
Modules file. CSS Modules work out of the box with Vite.

::demo{src="./demos/styling-menu.tsx"}

## Plain CSS

Global stylesheets work the same way: give each part a class name, and target its data
attributes and CSS variables. This is also how you integrate a design system that ships its own
CSS.

```css title="menu.css"
.Menu-popup {
  max-height: var(--available-height);
  transform-origin: var(--transform-origin);
}

.Menu-item[data-highlighted] {
  background-color: var(--accent);
}
```

## CSS-in-JS

Any CSS-in-JS library that produces class names works with the `class` prop. Zero-runtime
libraries such as [vanilla-extract](https://vanilla-extract.style) are a good fit for Solid. The
data attribute and CSS variable names are exported as constants from each module, so you can
reference them without typos:

```ts title="menu.css.ts"
import { style } from '@vanilla-extract/css';
import { MenuItemDataAttributes, MenuPositionerCssVariables } from '@egoist/solid-base/menu';

export const popup = style({
  maxHeight: `var(${MenuPositionerCssVariables.availableHeight})`,
});

export const item = style({
  selectors: {
    [`&[${MenuItemDataAttributes.highlighted}]`]: {
      outline: '1px solid currentColor',
    },
  },
});
```

To package styles with a part, wrap it in a component. Part props are typed by the part's `Props`
namespace type. Since the consumer's `class` may be a function of the state, resolve it in a
function of your own and return both classes:

```tsx title="menu.tsx"
import { Menu } from '@egoist/solid-base/menu';
import * as styles from './menu.css';

function MenuItem(props: Menu.Item.Props) {
  return (
    <Menu.Item
      {...props}
      class={(state) => [
        styles.item,
        typeof props.class === 'function' ? props.class(state) : props.class,
      ]}
    />
  );
}
```
