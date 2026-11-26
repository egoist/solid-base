---
title: Navigation Menu
description: A collection of links and menus for website navigation.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { NavigationMenu } from '@egoist/solid-base/navigation-menu';

<NavigationMenu.Root>
  <NavigationMenu.List>
    <NavigationMenu.Item>
      <NavigationMenu.Trigger>
        <NavigationMenu.Icon />
      </NavigationMenu.Trigger>
      <NavigationMenu.Content>
        <NavigationMenu.Link />
      </NavigationMenu.Content>
    </NavigationMenu.Item>
  </NavigationMenu.List>

  <NavigationMenu.Portal>
    <NavigationMenu.Backdrop />
    <NavigationMenu.Positioner>
      <NavigationMenu.Popup>
        <NavigationMenu.Arrow />
        <NavigationMenu.Viewport />
      </NavigationMenu.Popup>
    </NavigationMenu.Positioner>
  </NavigationMenu.Portal>
</NavigationMenu.Root>;
```

## Examples

### Nested submenus

A `<NavigationMenu.Root>` can be nested within a higher-level `<NavigationMenu.Content>` part to
create a multi-level navigation menu.

::demo{src="./demos/nested.tsx"}

### Nested inline submenus

For second-level navigation that should stay in the same panel, omit the nested
`<NavigationMenu.Portal>` and render only `List` + `Viewport` with a `defaultValue`.

::demo{src="./demos/nested-inline.tsx"}

### Custom links

`<NavigationMenu.Link>` renders an `<a>` element. Use the `render` prop to render your router's
link component instead, so navigation happens on the client:

```tsx title="Solid Router example"
import { A } from '@solidjs/router';
import { NavigationMenu } from '@egoist/solid-base/navigation-menu';

function Link(props: NavigationMenu.Link.Props) {
  return (
    <NavigationMenu.Link
      {...props}
      // `linkProps` carries `href`, the event handlers and the ARIA attributes.
      render={(linkProps) => <A {...linkProps} href={props.href ?? ''} />}
    />
  );
}
```

:::solid
In React you would pass an element (`render={<NextLink />}`). Here `render` is a tag name or a function
`(props, state) => JSX.Element` that is called **once**: `props` and `state` are live objects, so
spread them instead of reading values out of them. Since the default element is already an `<a>`,
you don't need a wrapper for plain anchors: `<NavigationMenu.Link href="/docs">`.
:::

Links don't close the menu when clicked by default; pass `closeOnClick` to close it, and `active`
to mark the link of the current page (it sets `aria-current="page"` and `data-active`).

### Large menus

When you have large menu content that doesn't fit in the viewport in some cases, you usually have
two choices:

1. Compress the navigation menu content

You can change the layout of the navigation menu to render less content or be more compact by
reducing the space it takes up. If your content is flexible, you can use the `max-height`
property on `.Popup` to limit the height of the navigation menu to let it compress itself while
preventing overflow.

```css title="Compact layout"
.Content,
.Popup {
  max-height: var(--available-height);
}
```

2. Make the navigation menu scrollable

```css title="Scrollable layout"
.Content,
.Popup {
  max-height: var(--available-height);
}

.Content {
  overflow-y: auto;
}
```

Native scrollbars are visible while transitioning content, so we recommend using the
[Scroll Area](/components/scroll-area) component instead of native scrollbars to keep them
hidden, which also allows the `Arrow` to be centered correctly.

## Closing animations

The popup stays rendered until its closing animation finishes, so CSS transitions and animations
driven by `[data-ending-style]` work without extra setup.

To animate the closing with JavaScript instead, take control of the unmount: call
`eventDetails.preventUnmountOnClose()` in `onValueChange` when the value becomes `null`, then call
the `unmount` action once your animation is done. Close the menu with the `close` action instead
of setting `value` to `null` directly.

```tsx title="Manual unmount"
const actionsRef: { current: NavigationMenu.Root.Actions | null } = { current: null };

<NavigationMenu.Root
  actionsRef={actionsRef}
  onValueChange={(value, eventDetails) => {
    if (value === null) {
      eventDetails.preventUnmountOnClose();
      animateOut().then(() => actionsRef.current?.unmount());
    }
  }}
>
  ...
</NavigationMenu.Root>;
```

## API reference

::api
