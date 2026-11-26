---
title: Quick start
description: A quick guide to getting started with Solid Base.
order: 2
---

## Install the library

Install Solid Base and its Solid peer dependencies with a package manager.

```sh title="Terminal"
# bun
bun add @egoist/solid-base solid-js @solidjs/web

# npm
npm install @egoist/solid-base solid-js @solidjs/web

# pnpm
pnpm add @egoist/solid-base solid-js @solidjs/web
```

All components are included in a single package. It is tree-shakable, so your app bundle only
contains the components you actually use. Import from a module subpath, or from the root entry:

```tsx
import { Popover } from '@egoist/solid-base/popover';
import { Dialog, Menu } from '@egoist/solid-base';
```

## Set up

### Portals

Components that render popups, such as Dialog and Popover, render them in a portal. To make
portaled components always appear on top of the entire page, add the following style to your
application's root element:

```tsx title="index.tsx"
import { render } from '@solidjs/web';
import App from './App';

render(() => <App />, document.getElementById('root')!);
```

```css title="styles.css"
#root {
  isolation: isolate;
}
```

This style creates a separate stacking context for your application's root element. This way,
popups always appear above the page contents, and any `z-index` property in your styles won't
interfere with them.

### iOS 26+ Safari

Starting with iOS 26, Safari allows content beneath the UI chrome to be visible. Backdrops such as
those used by dialogs must use `position: absolute` instead of `position: fixed` to cover the
entire visual viewport. For this to work after the page is scrolled, add the following style to
your global styles:

```css title="styles.css"
body {
  position: relative;
}
```

## Assemble a component

This demo shows how to import a [Popover](/components/popover) component, assemble its parts, and
apply styles. It is styled with a CSS Module, but since the components are unstyled, you can use
Tailwind CSS, plain CSS, or any other styling solution you prefer.

::demo{src="./demos/popover.tsx"}

Each part renders a single element and accepts a `class`. Parts that open popups expose their
state as data attributes (`[data-popup-open]` on the trigger, `[data-starting-style]` and
`[data-ending-style]` on the popup) and CSS variables (`--transform-origin`, `--available-width`)
for styling. The same popover styled with Tailwind CSS:

```tsx title="Tailwind CSS"
import { Popover } from '@egoist/solid-base/popover';

export default function NotificationsPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger class="flex h-9 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3.5 text-sm font-medium text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 data-popup-open:border-violet-500">
        Notifications
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup class="w-64 origin-(--transform-origin) rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3.5 text-white shadow-lg transition-[transform,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Popover.Title class="text-sm font-semibold">Notifications</Popover.Title>
            <Popover.Description class="mt-1 text-sm text-neutral-400">
              You are all caught up. Good job!
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

:::solid
Use `class`, not `className`. Event handlers receive native events, and attributes use their
lowercase HTML names (`tabindex`, `for`). See [Coming from React](/overview/solid) for every
difference from React.
:::

## Next steps

This walkthrough outlines the basics of putting together a component. Continue to the
[Handbook](/handbook/styling) for broader guidance on topics like styling, animation and
composition, or explore the [components](/components/accordion).
