---
title: Menu
description: A list of actions in a dropdown, enhanced with keyboard navigation.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Menu } from '@egoist/solid-base/menu';

<Menu.FilterProvider>
  <Menu.Root>
    <Menu.Trigger />
    <Menu.Portal>
      <Menu.Backdrop />
      <Menu.Positioner>
        <Menu.Popup>
          <Menu.Arrow />
          <Menu.Input />
          <Menu.Clear />
          <Menu.Empty />

          <Menu.List>
            <Menu.Item />
            <Menu.LinkItem />
            <Menu.Separator />

            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger />
            </Menu.SubmenuRoot>

            <Menu.Group>
              <Menu.GroupLabel />
            </Menu.Group>

            <Menu.RadioGroup>
              <Menu.GroupLabel />
              <Menu.RadioItem>
                <Menu.RadioItemIndicator />
              </Menu.RadioItem>
            </Menu.RadioGroup>

            <Menu.CheckboxItem>
              <Menu.CheckboxItemIndicator />
            </Menu.CheckboxItem>
          </Menu.List>

          <Menu.Viewport />
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</Menu.FilterProvider>;
```

## Examples

### Open on hover

To create a menu that opens on hover, add the `openOnHover` prop to `<Menu.Trigger>`. You can
additionally configure how quickly the menu opens on hover using the `delay` prop.

::demo{src="./demos/open-on-hover.tsx"}

### Checkbox items

Use the `<Menu.CheckboxItem>` part to create a menu item that can toggle a setting on or off.

::demo{src="./demos/checkbox-items.tsx"}

### Radio items

Use the `<Menu.RadioGroup>` and `<Menu.RadioItem>` parts to create menu items that work like radio
buttons.

::demo{src="./demos/radio-items.tsx"}

### Close on click

Use the `closeOnClick` prop to change whether the menu closes when an item is clicked.

```tsx title="Control whether the menu closes on click"
// Close the menu when a checkbox item is clicked
<Menu.CheckboxItem closeOnClick />

// Keep the menu open when an item is clicked
<Menu.Item closeOnClick={false} />
```

### Group labels

Use the `<Menu.GroupLabel>` part to add a label to a `<Menu.Group>` or `<Menu.RadioGroup>`.

::demo{src="./demos/group-labels.tsx"}

### Nested menu

To create a submenu, nest another menu inside the parent menu with `<Menu.SubmenuRoot>`. Use the
`<Menu.SubmenuTrigger>` part for the menu item that opens the nested menu.

```tsx title="Adding a submenu"
<Menu.Root>
  <Menu.Trigger />
  <Menu.Portal>
    <Menu.Positioner>
      <Menu.Popup>
        <Menu.Item />

        {/* Submenu */}
        <Menu.SubmenuRoot>
          <Menu.SubmenuTrigger />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>{/* Submenu items */}</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.SubmenuRoot>
      </Menu.Popup>
    </Menu.Positioner>
  </Menu.Portal>
</Menu.Root>
```

::demo{src="./demos/submenu.tsx"}

### Navigate to another page

Use the `<Menu.LinkItem>` part to create a link.

```tsx title="A menu item that opens a link"
<Menu.LinkItem href="/projects">Go to Projects</Menu.LinkItem>
```

To navigate with a client-side router, render the router's link component (see
[Composition](/handbook/composition)):

```tsx title="Using a router link"
import { A } from '@solidjs/router';

<Menu.LinkItem render={(props) => <A href="/projects" {...props} />}>Go to Projects</Menu.LinkItem>;
```

### Detached triggers

A menu can be opened by a trigger that lives either inside or outside the `<Menu.Root>`. Keep the
trigger inside `<Menu.Root>` for simple, tightly coupled layouts like the hero demo at the top of
this page. When the trigger and menu content need to live in different parts of the tree (for
example, in a card list that controls a menu rendered near the document root), create a `handle`
with `Menu.createHandle()` and pass it to both the trigger and the root.

Note that only top-level menus can have detached triggers. Submenus must have their triggers
defined within the `SubmenuRoot` part.

The imperative methods on the handle, such as `open()` and `close()`, require a `<Menu.Root>`
using the same handle to be mounted. Calls made while no root is attached to the handle — before
one mounts, or after it unmounts — are ignored. Each time a root mounts, it starts from fresh
state: a call made while no root was attached is not replayed, and no open state carries over from
a previous mount.

```tsx title="Detached triggers"
const demoMenu = Menu.createHandle();

<Menu.Trigger handle={demoMenu}>Actions</Menu.Trigger>

<Menu.Root handle={demoMenu}>
  <Menu.Portal>
    <Menu.Positioner>
      <Menu.Popup>
        <Menu.Item>Edit</Menu.Item>
        <Menu.Item>Share</Menu.Item>
      </Menu.Popup>
    </Menu.Positioner>
  </Menu.Portal>
</Menu.Root>
```

::demo{src="./demos/detached-triggers-simple.tsx"}

### Multiple triggers

One menu can be opened by several triggers. You can either render multiple `<Menu.Trigger>`
components inside the same `<Menu.Root>`, or attach several detached triggers to the same
`handle`.

```tsx title="Multiple triggers within the Root part"
<Menu.Root>
  <Menu.Trigger>Row actions</Menu.Trigger>
  <Menu.Trigger>Quick actions</Menu.Trigger>
  {/* Rest of the menu */}
</Menu.Root>
```

```tsx title="Multiple detached triggers"
const projectMenu = Menu.createHandle();

<Menu.Trigger handle={projectMenu}>Row actions</Menu.Trigger>
<Menu.Trigger handle={projectMenu}>Quick actions</Menu.Trigger>

<Menu.Root handle={projectMenu}>
  {/* Rest of the menu */}
</Menu.Root>
```

Menus can render different content depending on which trigger opened them. Pass a `payload` prop
to each `<Menu.Trigger>` and read it via a function child on `<Menu.Root>`. Provide a type argument
to `createHandle()` to strongly type the payload.

```tsx title="Detached triggers with payload"
const menus = {
  file: ['New', 'Open', 'Save'],
  edit: ['Undo', 'Redo', 'Cut', 'Copy', 'Paste'],
};

const demoMenu = Menu.createHandle<{ items: string[] }>();

<Menu.Trigger handle={demoMenu} payload={{ items: menus.file }}>
  File
</Menu.Trigger>

<Menu.Trigger handle={demoMenu} payload={{ items: menus.edit }}>
  Edit
</Menu.Trigger>

<Menu.Root handle={demoMenu}>
  {(menu) => (
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup>
          <Menu.Viewport>
            <For each={menu.payload?.items ?? []}>
              {(item) => <Menu.Item>{item}</Menu.Item>}
            </For>
          </Menu.Viewport>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )}
</Menu.Root>
```

:::solid[Payload children]
The function child of `<Menu.Root>` is called **once**. Its argument exposes `payload` as a live
getter, so read `menu.payload` inside JSX (or a `<Show>`/`<For>`) instead of destructuring it in
the parameter list — a destructured `payload` would be frozen at its initial value.
:::

### Controlled mode with multiple triggers

Control a menu's open state externally with the `open` and `onOpenChange` props on `<Menu.Root>`.
When more than one trigger can open the menu, track the active trigger with the `triggerId` prop on
`<Menu.Root>` and matching `id` props on each `<Menu.Trigger>`. The `onOpenChange` callback
receives `eventDetails`, which includes the DOM element that initiated the change, so you can
update your `triggerId` state when the user activates a different trigger.

::demo{src="./demos/detached-triggers-controlled.tsx"}

### Arrow

Use the `<Menu.Arrow>` part inside the popup to visually connect the menu to its trigger.

::demo{src="./demos/arrow.tsx"}

### Animating the Menu

When one menu is opened by multiple detached triggers, you can animate the menu as it moves between
triggers. This includes animating position, size, and content.

#### Position and size

To animate the menu's position, apply CSS transitions to the `left`, `right`, `top`, and `bottom`
properties of the **Positioner** part. To animate its size, transition the `width` and `height` of
the **Popup** part.

#### Content

The menu also supports content transitions. This is useful when different triggers display
different content within the same menu.

To enable content animations, wrap the menu content in the `<Menu.Viewport>` part. This part
renders a `div` with `data-activation-direction`, containing up to two space-separated tokens — a
horizontal (`left` or `right`) and a vertical (`up` or `down`) value — so you can make
direction-aware animations.

Inside `<Menu.Viewport>`, content is wrapped in `div`s with transition data attributes:

- `data-current`: The currently visible content when no transitions are present or the incoming
  content.
- `data-previous`: The outgoing content during a transition.

::demo{src="./demos/detached-triggers-full.tsx"}

The `Viewport` is optional — reach for it only when a single popup is opened by multiple triggers,
its content differs per trigger, and the switch between them is animated. When used, set
`width: var(--positioner-width)` and `height: var(--positioner-height)` on the `Positioner` so its
box is frozen to the measured size during the transition; otherwise content-driven resizing can
make the popup thrash or flip to another side.

### Filtering

Wrap `<Menu.Root>` in `<Menu.FilterProvider>`, add `<Menu.Input>` to the popup, and put the items
inside `<Menu.List>`.

```tsx title="Filterable menu"
<Menu.FilterProvider>
  <Menu.Root>
    <Menu.Trigger>Actions</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup>
          <Menu.Input aria-label="Filter actions" />
          <Menu.Clear>Clear</Menu.Clear>
          <Menu.Empty>No results.</Menu.Empty>
          <Menu.List>
            <Menu.Item>Rename</Menu.Item>
            <Menu.Item>Delete</Menu.Item>
          </Menu.List>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</Menu.FilterProvider>
```

Label the input with `aria-label`, `aria-labelledby`, or a visible `<label>`. Type to narrow the
actions, then use the arrow keys to move through matching items.

::demo{src="./demos/filter.tsx"}

#### Matching items

Items match their text by default. Use `label` to override it.

```tsx title="Labels"
<Menu.Item label="Move to folder">Move</Menu.Item>
```

Groups with no matching items get the `hidden` attribute and stay mounted. If your styles set
`display` on a group, add a `[hidden]` rule so it still hides.

```css title="Hiding styled groups"
.Group {
  display: flex;
}

.Group[hidden] {
  display: none;
}
```

`<Menu.Empty>` appears when no items match.

By default, an item matches when its text contains the query, ignoring case, accents, and
punctuation. Use `filter` to replace the matching. It receives each item's text and the trimmed
query, and keeps the item when it returns `true`. `Menu.useFilter` provides the same locale-aware
comparisons.

```tsx title="Custom matching"
const { startsWith } = Menu.useFilter();

<Menu.FilterProvider filter={startsWith}>
  <Menu.Root>{/* menu parts */}</Menu.Root>
</Menu.FilterProvider>;
```

For external filtering, pass `filter={null}` and render the results yourself, omitting empty
groups.

```tsx title="External filtering"
const { contains } = Menu.useFilter();
const [query, setQuery] = createSignal('');
const results = () => actions.filter((action) => contains(action.label, query()));

<Menu.FilterProvider filter={null} value={query()} onValueChange={(value) => setQuery(value)}>
  <Menu.Root>{/* render `results()` */}</Menu.Root>
</Menu.FilterProvider>;
```

:::solid
`Menu.useFilter` is a plain function, not a hook: it returns a cached `{ contains, startsWith,
endsWith }` object for the given collator options, so it can be called anywhere, including at
module scope.
:::

#### Controlling the query

`value` and `onValueChange` on `<Menu.FilterProvider>` control the query. It resets to an empty
string when the menu closes, reported with the `'popup-close'` reason. Cancel that change to keep
the query.

#### Highlighting

Use `autoHighlight` to highlight the first match while filtering, or `autoHighlight="always"` to
highlight it even when the query is empty. The highlighted item has the `data-highlighted`
attribute, and `onItemHighlighted` on `<Menu.Root>` reports each change.

#### Focus and keyboard

Opening the menu with a click or the keyboard focuses the input. Opening it on hover, touch, or
with a pen does not, so the on-screen keyboard stays hidden. The arrow keys move the highlight
while the input keeps focus. <kbd>Tab</kbd> closes the menu, and <kbd>Shift</kbd>+<kbd>Tab</kbd>
returns focus to the trigger. The popup is a `dialog` that holds the `searchbox` input and the
`menu` list.

#### Submenus

Wrap each searchable `<Menu.SubmenuRoot>` in its own `<Menu.FilterProvider>`. Submenus without a
provider remain unfiltered.

#### Filtering with detached triggers

Use the same `Menu.createHandle()` handle for the root and its detached trigger:

```tsx title="Detached trigger"
const handle = Menu.createHandle();

<Menu.Trigger handle={handle}>Actions</Menu.Trigger>
<Menu.FilterProvider>
  <Menu.Root handle={handle}>{/* menu parts */}</Menu.Root>
</Menu.FilterProvider>
```

## API reference

::api

## useFilter

When filtering items yourself, `Menu.useFilter` matches text according to the user's locale.

```ts title="Signature"
function useFilter(options?: Intl.CollatorOptions & { locale?: Intl.LocalesArgument }): {
  contains: (item: Item, query: string, itemToString?: (item: Item) => string) => boolean;
  startsWith: (item: Item, query: string, itemToString?: (item: Item) => string) => boolean;
  endsWith: (item: Item, query: string, itemToString?: (item: Item) => string) => boolean;
};
```

The collator defaults to `usage: 'search'`, `sensitivity: 'base'` and `ignorePunctuation: true`.

## createHandle

Creates a handle that connects a `<Menu.Root>` with detached `<Menu.Trigger>` components. The
optional type argument types the triggers' `payload`.

```ts title="Signature"
function createHandle<Payload>(): Menu.Handle<Payload>;
```

### Handle

| Member              | Description                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `open(triggerId)`   | Opens the menu and associates it with the trigger with the given `id`. The trigger must be a `Menu.Trigger` with this handle. |
| `close()`           | Closes the menu.                                                                                                            |
| `isOpen`            | Whether the menu is open. `false` while no root is attached. Tracked when read in a reactive scope.                         |

Call `open()` and `close()` from event handlers or effects, not while rendering.
