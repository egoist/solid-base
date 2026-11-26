---
title: Combobox
description: An input combined with a list of predefined items to select.
---

::demo{src="./demos/hero.tsx"}

## Usage guidelines

- **Combobox is a filterable Select**: Use Combobox when the input is restricted to a set of
  predefined selectable items, similar to [Select](/components/select) but whose items are
  filterable using an input. Prefer using Combobox over Select when the number of items is
  sufficiently large to warrant filtering.
- **Avoid for simple search widgets**: Combobox does not allow free-form text input. For search
  widgets, consider using [Autocomplete](/components/autocomplete) instead.
- **Avoid when not rendering an input**: Use [Select](/components/select) instead of Combobox if
  no input is being rendered, which includes accessibility features specific to a listbox without
  an input.
- **Form controls must have an accessible name**: If `<Combobox.Input>` is the form control, label
  it with a native `<label>` or `<Field.Label>`, or provide an `aria-label` when no visible label
  is rendered. `<Combobox.Label>` labels `<Combobox.Trigger>` and is intended for the
  [input-inside-popup](#input-inside-popup) pattern, where the trigger is the form control.
- **Closing animations**: The popup stays rendered until its closing animation finishes. Style
  the `[data-ending-style]` state to animate it out.

## Anatomy

Import the components and place them together:

```tsx title="Anatomy"
import { Combobox } from '@egoist/solid-base/combobox';

<Combobox.Root>
  <Combobox.Label />

  <Combobox.InputGroup>
    <Combobox.Input />
    <Combobox.Trigger />
    <Combobox.Icon />
    <Combobox.Clear />
    <Combobox.Value />

    <Combobox.Chips>
      <Combobox.Chip>
        <Combobox.ChipRemove />
      </Combobox.Chip>
    </Combobox.Chips>
  </Combobox.InputGroup>

  <Combobox.Portal>
    <Combobox.Backdrop />
    <Combobox.Positioner>
      <Combobox.Popup>
        <Combobox.Arrow />

        <Combobox.Status />
        <Combobox.Empty />

        <Combobox.List>
          <Combobox.Row>
            <Combobox.Item>
              <Combobox.ItemIndicator />
            </Combobox.Item>
          </Combobox.Row>

          <Combobox.Separator />

          <Combobox.Group>
            <Combobox.GroupLabel />
          </Combobox.Group>

          <Combobox.Collection />
        </Combobox.List>
      </Combobox.Popup>
    </Combobox.Positioner>
  </Combobox.Portal>
</Combobox.Root>;
```

## Item values

Each `<Combobox.Item>` takes a `value` prop identifying it. Pass the item being rendered:

```tsx title="Using item objects as values"
<Combobox.List>
  {(item: Fruit) => <Combobox.Item value={item}>{item.label}</Combobox.Item>}
</Combobox.List>
```

That item is what `value`, `defaultValue`, and `onValueChange` receive. To store IDs instead, see
[Value selection with IDs](#value-selection-with-ids).

:::solid[List render functions]
A function child of `<Combobox.List>` (or `<Combobox.Collection>`) receives the raw item and is
called **once per item**: the filtered list is rendered with a keyed `<For>`, so there is no `key`
prop. When the function declares a second `index` parameter, it is called again whenever the
item's position in the filtered list changes, so an explicit `index` prop stays in sync.
:::

## Examples

### Typed wrapper component

The following example shows a typed wrapper around the Combobox component with correct type
inference and type safety:

```tsx title="Specifying generic type parameters"
import type { JSX } from '@solidjs/web';
import { Combobox } from '@egoist/solid-base/combobox';

export function MyCombobox<Value, Multiple extends boolean | undefined = false, Item = Value>(
  props: Combobox.Root.Props<Value, Multiple, Item>,
): JSX.Element {
  return <Combobox.Root {...props}>{/* ... */}</Combobox.Root>;
}
```

The third `Item` type parameter is what lets the wrapper accept a `Combobox.createItems()`
collection, whose rendered item type differs from its selection value. Omit it and a collection
infers `Value` as the source item type, surfacing an error on `defaultValue` rather than on
`items`.

### Value selection with IDs

When your app stores IDs rather than item objects, use `Combobox.createItems` with `getValue` and
`getLabel` to derive each item's selection value and display label.

With static data, create the collection at module scope. The accessor parameters are inferred
from `users`. Pass the derived ID to the `value` prop of `<Combobox.Item>`, not the item being
rendered:

```tsx title="Using item IDs as values"
const items = Combobox.createItems(users, {
  getValue: (user) => user.id,
  getLabel: (user) => user.name,
});

<Combobox.Root items={items}>
  <Combobox.List>
    {(user: User) => <Combobox.Item value={user.id}>{user.name}</Combobox.Item>}
  </Combobox.List>
</Combobox.Root>;
```

Selection props and events use the derived IDs, while list rendering continues to receive the
original items. The derived label is also used for filtering and typeahead.

When the data is loaded or replaced at runtime, derive the collection with `createMemo` so that it
is rebuilt only when the data changes:

```tsx title="Creating a collection from dynamic data"
const items = createMemo(() =>
  Combobox.createItems(users(), {
    getValue: (user) => user.id,
    getLabel: (user) => user.name,
  }),
);

<Combobox.Root items={items()}>{/* ... */}</Combobox.Root>;
```

::demo{src="./demos/create-items.tsx"}

As a rule of thumb, use primitive items for simple lists, object values when the selected record
is useful application state, and `createItems()` when selection should use a stable primitive ID
while rendering and filtering still use object records.

Stable IDs preserve item matching when an async data library replaces row objects during a
refetch. With object values, use `isItemEqualToValue` to compare their IDs instead.

When results are filtered externally (for example, by a server-side search), `items` represents
records known to the app, while `filteredItems` represents the current result window displayed in
the popup. Pass source items rather than derived values to `filteredItems`, preserving the flat or
grouped structure of `items`:

```tsx title="Displaying a window of async results"
const items = createMemo(() =>
  Combobox.createItems(knownUsers(), {
    getValue: (user) => user.id,
    getLabel: (user) => user.name,
  }),
);

<Combobox.Root
  items={items()}
  filteredItems={searchResults()}
  value={selectedUserId()}
  onValueChange={(id) => setSelectedUserId(id)}
/>;
```

Include the selected user's record in `knownUsers` so its label remains available when it is
outside `searchResults`. Alternatively, provide `itemToStringLabel` when the label can be derived
from the selected value alone.

### Multiple select

The combobox can allow multiple selections by adding the `multiple` prop to `<Combobox.Root>`.
Selection chips are rendered with `<Combobox.Chip>` inside the input that can be removed.

::demo{src="./demos/multiple.tsx"}

In order for screen readers to announce how to reach and remove the chips, add
`aria-description` to `<Combobox.Chip>` and `<Combobox.Input>`, alongside the `aria-label` on
`<Combobox.Chips>` and `<Combobox.ChipRemove>`. The library does not ship these strings. Translate
them together with the rest of your interface.

:::solid[Rendering chips]
`<Combobox.Value>` accepts a function child that receives the selected value, but the function is
called again **every time the selection changes**, recreating everything it returns. Rendering
the chips _and_ `<Combobox.Input>` from that function would therefore
recreate the input (and drop its focus) on every selection. Instead, control the value with a
signal and render the chips with a keyed `<For>`, keeping the input outside it, as the demo above
does. Each chip then stays mounted while others are added or removed.
:::

Visible chips can be limited by slicing the selected values:

```tsx title="Limiting visible chips"
const CHIP_LIMIT = 3;

const [value, setValue] = createSignal<string[]>([]);
const visibleValue = () => value().slice(0, CHIP_LIMIT);
const hiddenCount = () => value().length - visibleValue().length;

<Combobox.Root items={items} multiple value={value()} onValueChange={(next) => setValue(next)}>
  <Combobox.Chips>
    <For each={visibleValue()}>
      {(item) => (
        <Combobox.Chip aria-description="Press Backspace or Delete to remove">
          {item}
          <Combobox.ChipRemove aria-label={`Remove ${item}`} />
        </Combobox.Chip>
      )}
    </For>
    <Show when={hiddenCount() > 0}>
      <span>{`+${hiddenCount()} more`}</span>
    </Show>
    <Combobox.Input
      aria-description={
        value().length > 0
          ? `${value().length} selected. From the start of the input, press Left Arrow to focus the selected items`
          : undefined
      }
    />
  </Combobox.Chips>
  {/* ... */}
</Combobox.Root>;
```

#### Keeping the filter after selection

In `multiple` mode, selecting an item clears the typed filter and closes the popup when the input
is rendered outside it. To let users pick several results from one query, cancel the relevant
change request.

Which request to cancel depends on the input's placement. When the input is outside the popup,
cancel the `item-press` close request in `onOpenChange`. When it is inside, cancel the clear
request in `onInputValueChange`, marked with `eventDetails.isItemPress`.

```tsx title="Input outside the popup"
<Combobox.Root
  multiple
  onOpenChange={(open, eventDetails) => {
    if (!open && eventDetails.reason === 'item-press') {
      eventDetails.cancel();
    }
  }}
>
  {/* ... */}
</Combobox.Root>
```

```tsx title="Input inside the popup"
<Combobox.Root
  multiple
  onInputValueChange={(value, eventDetails) => {
    if (eventDetails.isItemPress) {
      eventDetails.cancel();
    }
  }}
>
  {/* ... */}
</Combobox.Root>
```

The typed filter still resets once the popup closes.

### Input inside popup

`<Combobox.Input>` can be rendered inside `<Combobox.Popup>` to create a searchable select popup.

::demo{src="./demos/input-inside-popup.tsx"}

Use `<Combobox.Label>` to provide a visible label for the combobox trigger in this pattern:

```tsx title="Using Combobox.Label to label a combobox"
<Combobox.Root>
  <Combobox.Label>Favorite fruit</Combobox.Label>
  {/* ... */}
</Combobox.Root>
```

`<Combobox.Label>` renders a `<div>`, so clicking it focuses the combobox trigger without opening
the popup.

### Grouped

Organize related options with `<Combobox.Group>` and `<Combobox.GroupLabel>` to add section
headings inside the popup.

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

Pass each group's `items` to `<Combobox.Group>` and render them with `<Combobox.Collection>`,
which receives only the group's filtered items:

::demo{src="./demos/grouped.tsx"}

### Async search (single)

Load items from a remote source by fetching on input changes. Keep the selected item in the
`items` list so it remains available while new results stream in. This pattern avoids needing to
load items upfront.

::demo{src="./demos/async-single.tsx"}

:::solid[Pending state]
A `pending` signal is set when a request starts and cleared when the latest one settles; an `AbortController` discards
responses to superseded queries. `items` is derived from the results and the selection with
`createMemo`.
:::

### Async search (multiple)

Load items from a remote source by fetching on input changes while supporting multiple
selections. Selected items remain available in the list while new matches stream in. This
pattern avoids needing to load items upfront.

::demo{src="./demos/async-multiple.tsx"}

### Virtualized

Efficiently handle large datasets by rendering only the visible items. Set `virtualized` on
`<Combobox.Root>`, read the filtered items with `Combobox.useFilteredItems()`, and give each
rendered `<Combobox.Item>` its `index` in the filtered list. Use `onItemHighlighted` to scroll a
highlighted item into view when it is outside the rendered window.

::demo{src="./demos/virtualized.tsx"}

:::solid[Virtualization libraries]
The demo above implements fixed-height windowing
by hand so it has no dependencies; a Solid virtualizer such as `@tanstack/solid-virtual` works the
same way: render its virtual items with their `index`, and call its `scrollToIndex` from
`onItemHighlighted`. Note that `Combobox.useFilteredItems()` returns an **accessor** here, not an
array.
:::

#### Rendering cost without virtualization

In React, datasets up to roughly 1,000 items call for wrapping each item in `React.memo`.
That isn't needed in Solid: the list is rendered with a keyed `<For>`, so typing a query only
inserts and removes the items whose match changed, and the remaining items are never re-rendered.
Virtualization is still worth it for very large datasets, where the cost of mounting every item
when the popup opens dominates.

## API reference

::api

### useFilter

Matches items against a query using `Intl.Collator` for robust string matching. This hook is used
when externally filtering items. Pass the result to the `filter` prop of `<Combobox.Root>`.

```tsx
const { contains, startsWith, endsWith } = Combobox.useFilter({ sensitivity: 'base' });
```

It accepts the `Intl.Collator` options plus `locale`, and `multiple` and `value` to match the
root's selection mode.

:::solid
The options are read lazily: pass getters for reactive values
(`Combobox.useFilter({ get value() { return value(); } })`) and the returned filter always uses
the current ones.
:::

### useFilteredItems

Returns an accessor for the internally filtered items when called inside `<Combobox.Root>`.

```tsx
const filteredItems = Combobox.useFilteredItems<Fruit>();

<For each={filteredItems()}>{/* ... */}</For>;
```

### createItems

Normalizes items into a collection for the `items` prop of `<Combobox.Root>`, deriving each item's
selection value and label before rendering.

```tsx
Combobox.createItems(data, { getValue, getLabel });
```

- `data`: the flat or grouped source items, or `undefined` while they are loading. Items cannot
  have an `items` array property, because it marks a group.
- `getValue(item)`: projects an item to the primitive value that identifies it, used as the
  item's selection value. Each item must derive a unique value.
- `getLabel(item)`: projects an item to the label shown in the input and used when matching the
  typed query.
