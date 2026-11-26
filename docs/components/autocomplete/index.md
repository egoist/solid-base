---
title: Autocomplete
description: An input that suggests options as you type.
---

::demo{src="./demos/hero.tsx"}

## Usage guidelines

- **Avoid when selection state is needed**: Use [Combobox](/components/combobox) instead of
  Autocomplete if the selection should be remembered and the input value cannot be custom. Unlike
  Combobox, Autocomplete's input can contain free-form text, as its suggestions only _optionally_
  autocomplete the text.
- **Form controls must have an accessible name**: It can be created using a `<label>` element or
  the [Field](/components/field) component. See the [forms guide](/handbook/forms).
- **Closing animations**: The popup stays rendered until its closing animation finishes. See
  [JavaScript animations](/handbook/animation#javascript-animations) for manual control.

## Anatomy

Import the components and place them together:

```tsx title="Anatomy"
import { Autocomplete } from '@egoist/solid-base/autocomplete';

<Autocomplete.Root>
  <Autocomplete.InputGroup>
    <Autocomplete.Input />
    <Autocomplete.Trigger />
    <Autocomplete.Icon />
    <Autocomplete.Clear />
    <Autocomplete.Value />
  </Autocomplete.InputGroup>

  <Autocomplete.Portal>
    <Autocomplete.Backdrop />
    <Autocomplete.Positioner>
      <Autocomplete.Popup>
        <Autocomplete.Arrow />

        <Autocomplete.Status />
        <Autocomplete.Empty />

        <Autocomplete.List>
          <Autocomplete.Row>
            <Autocomplete.Item />
          </Autocomplete.Row>

          <Autocomplete.Separator />

          <Autocomplete.Group>
            <Autocomplete.GroupLabel />
          </Autocomplete.Group>

          <Autocomplete.Collection />
        </Autocomplete.List>
      </Autocomplete.Popup>
    </Autocomplete.Positioner>
  </Autocomplete.Portal>
</Autocomplete.Root>;
```

## Item values

Each `<Autocomplete.Item>` takes a `value` prop identifying it. Pass the item being rendered, so
that props like `itemToStringValue` receive it.

A function child of `<Autocomplete.List>` renders each item of the filtered list:

```tsx title="Rendering items"
<Autocomplete.Root items={tags}>
  {/* ... */}
  <Autocomplete.List>
    {(tag: Tag) => <Autocomplete.Item value={tag}>{tag.value}</Autocomplete.Item>}
  </Autocomplete.List>
</Autocomplete.Root>
```

:::solid
The render function receives the raw item and is called **once per item**: there is no `key`
prop, because the list is rendered with Solid's keyed `<For>`, which reuses an item's elements for
as long as the item stays in the filtered list. Declare a second `index` parameter only when you
need it — the item is then re-rendered whenever its position changes.
:::

## Examples

### Async search

Load items asynchronously while typing and render custom status content.

::demo{src="./demos/async.tsx"}

Pass `filter={null}` when the results are already filtered by the server, and keep the query in a
signal with `value` and `onValueChange`. An `AbortController` discards responses that arrive after
a newer query was typed.

### Inline autocomplete

Autofill the input with the highlighted item while navigating with arrow keys using the `mode`
prop. Accepts `aria-autocomplete` values `list`, `both`, `inline`, or `none`.

::demo{src="./demos/inline.tsx"}

### Grouped

Organize related options with `<Autocomplete.Group>` and `<Autocomplete.GroupLabel>` to add
section headings inside the popup.

Groups are represented by an array of objects with an `items` property, which itself is an array
of individual items for each group. An extra property, such as `value`, can be provided for the
heading text when rendering the group label.

```tsx title="Example"
interface ProduceGroupItem {
  value: string;
  items: string[];
}

const groups: ProduceGroupItem[] = [
  {
    value: 'Fruits',
    items: ['Apple', 'Banana', 'Orange'],
  },
  {
    value: 'Vegetables',
    items: ['Carrot', 'Lettuce', 'Spinach'],
  },
];
```

Pass each group's items to `<Autocomplete.Group items>` and render them with
`<Autocomplete.Collection>`:

::demo{src="./demos/grouped.tsx"}

### Fuzzy matching

Use fuzzy matching to find relevant results even when the query doesn't exactly match the item
text. Pass a custom `filter` to `<Autocomplete.Root>`: it receives each item and the query, and
keeps the item when it returns `true`.

::demo{src="./demos/fuzzy-matching.tsx"}

A function child of `<Autocomplete.Value>` receives the current input value, and re-runs when it
changes. The demo uses it to highlight the matched text in each item.

### Limit results

Limit the number of visible items using the `limit` prop and guide users to refine their query
using `<Autocomplete.Status>`.

::demo{src="./demos/limit.tsx"}

### Auto highlight

The first matching item can be automatically highlighted as the user types by specifying the
`autoHighlight` prop on `<Autocomplete.Root>`. Set the prop's value to `"always"` if the highlight
should always be present, such as when the list is rendered inline within a dialog.

The prop can be combined with the `keepHighlight` and `highlightItemOnHover` props to configure how
the highlight behaves during mouse interactions.

::demo{src="./demos/auto-highlight.tsx"}

### Virtualized

Efficiently handle large datasets by rendering only the items in view. Add the `virtualized` prop
to `<Autocomplete.Root>`, read the filtered items with `Autocomplete.useFilteredItems()`, and pass
each rendered item its `index` in the filtered list.

::demo{src="./demos/virtualized.tsx"}

The demo windows a fixed-height list by hand. A virtualization library such as
`@tanstack/solid-virtual` works the same way: render its virtual items as `<Autocomplete.Item>`
parts with their `index`, and scroll to the highlighted index from `onItemHighlighted`.

:::solid[Memoizing items]
In React, lists of up to roughly 1,000 items call for wrapping each item in `React.memo`.
That isn't needed in Solid: the list's render function runs once per item, and typing only adds
and removes the items that enter or leave the filtered list, without re-rendering the others.
Opening the popup still mounts every item, so very large lists benefit from virtualization.
:::

## API reference

::api

## useFilter

Matches items against a query using `Intl.Collator` for robust string matching. Use it when
filtering items externally.

```tsx title="useFilter"
const { contains, startsWith, endsWith } = Autocomplete.useFilter({ sensitivity: 'base' });

contains('Crème brûlée', 'creme'); // true
```

It accepts `Intl.CollatorOptions` plus a `locale` (defaults to the user's runtime locale), and
returns `contains`, `startsWith` and `endsWith` functions with the signature
`(item, query, itemToString?) => boolean`.

:::solid
`Autocomplete.useFilter` is a plain function: it reads its options when it's called and returns
the same cached filter for equal options, so it can be called anywhere, including outside a
component.
:::

## useFilteredItems

Returns the internally filtered items when called inside `<Autocomplete.Root>`.

```tsx title="useFilteredItems"
const filteredItems = Autocomplete.useFilteredItems<Tag>();

filteredItems().length;
```

:::solid
The result is an **accessor**: call it (`filteredItems()`) inside JSX, a memo or an effect to
track the filtered list. Treat the array as read-only.
:::
