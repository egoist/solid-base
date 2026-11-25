---
title: Select
description: A common form component for choosing a predefined value in a dropdown menu.
---

::demo{src="./demos/hero.tsx"}

## Usage guidelines

- **Prefer Combobox for large lists**: Select is not filterable, aside from basic keyboard
  typeahead to find items by focusing and highlighting them. Prefer
  [Combobox](/components/combobox) instead of Select when the number of items is large enough to
  warrant filtering.
- **Special positioning behavior**: By default, the select popup overlaps its trigger so the
  selected item's text is aligned with the trigger's value text. This behavior
  [can be disabled or customized](#positioning).
- **Form controls must have an accessible name**: Prefer `<Select.Label>`, or provide an
  `aria-label` on `<Select.Trigger>` when no visible label is rendered. See
  [Labeling a select](#labeling-a-select).
- **Closing animations**: The popup stays rendered until its closing animation finishes. Drive
  it with CSS transitions on `[data-starting-style]` and `[data-ending-style]`, or use the
  `actionsRef` prop on `<Select.Root>` to finish an externally controlled animation.

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Select } from '@egoist/solid-base/select';

<Select.Root>
  <Select.Label />
  <Select.Trigger>
    <Select.Value />
    <Select.Icon />
  </Select.Trigger>

  <Select.Portal>
    <Select.Backdrop />
    <Select.Positioner>
      <Select.Popup>
        <Select.ScrollUpArrow />
        <Select.Arrow />
        <Select.List>
          <Select.Item>
            <Select.ItemText />
            <Select.ItemIndicator />
          </Select.Item>
          <Select.Separator />
          <Select.Group>
            <Select.GroupLabel />
          </Select.Group>
        </Select.List>
        <Select.ScrollDownArrow />
      </Select.Popup>
    </Select.Positioner>
  </Select.Portal>
</Select.Root>;
```

## Positioning

`<Select.Positioner>` has a special prop called `alignItemWithTrigger`, which makes its
positioning behave differently by default from other `Positioner` components. The prop makes the
select popup overlap the trigger so the selected item's text is aligned with the trigger's value
text.

For styling, `data-side` is `"none"` on the `Popup` and `Positioner` parts while this mode is
active.

To prevent the select popup from overlapping its trigger, set `alignItemWithTrigger` to `false`.
When it is `true` (the default), note the following:

- **Interaction type dependent**: For UX reasons, the `alignItemWithTrigger` positioning mode is
  disabled if touch was the pointer type used to open the popup.
- **Viewport space dependent**: There must be enough space in the viewport to align the selected
  item's text with the trigger's value text without making the popup too short; otherwise it
  falls back to the default positioning mode. Customize this by setting `min-height` on the
  `<Select.Positioner>` element: a smaller value falls back less often. The trigger must also be
  at least 20px from the top and bottom edges of the viewport, or it falls back as well.
- **Other positioning props are ignored**: Props like `side` or `align` have no effect unless the
  prop is set to `false` or the popup is in fallback mode.

## Examples

### Typed wrapper component

The following example shows a typed wrapper around the Select component with correct type
inference and type safety:

```tsx title="Specifying generic type parameters"
import type { JSX } from '@solidjs/web';
import { Select } from '@egoist/solid-base/select';

export function MySelect<Value, Multiple extends boolean | undefined = false>(
  props: Select.Root.Props<Value, Multiple>,
): JSX.Element {
  return <Select.Root {...props}>{/* ... */}</Select.Root>;
}
```

### Formatting the value

By default, the `<Select.Value>` component renders the raw `value`.

Passing the `items` prop to `<Select.Root>` instead renders the matching label for the rendered
value:

```tsx title="items prop"
const items = [
  { value: null, label: 'Select theme' },
  { value: 'system', label: 'System default' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

<Select.Root items={items}>
  <Select.Value />
</Select.Root>;
```

A function can also be passed as the `children` of `<Select.Value>` to render a formatted value:

```tsx title="Lookup map"
const items = {
  monospace: 'Monospace',
  serif: 'Serif',
  'sans-serif': 'Sans-serif',
};

<Select.Value>
  {(value: keyof typeof items) => <span style={{ 'font-family': value }}>{items[value]}</span>}
</Select.Value>;
```

:::solid
Unlike `render` functions, which are called once, the `<Select.Value>` children function is called
again whenever the selected value changes, receiving the new value each time. Note the kebab-case
`style` keys (`'font-family'`).
:::

To avoid a lookup, [object values](#object-values) can also be used for each item.

### Labeling a select

Use `<Select.Label>` to provide a visible label for the select trigger:

```tsx title="Using Select.Label to label a select"
<Select.Root>
  <Select.Label>Theme</Select.Label>
  {/* ... */}
</Select.Root>
```

`<Select.Label>` renders a `<div>`, so clicking it focuses the select trigger without opening the
popup.

### Placeholder values

To show a placeholder value, use the `placeholder` prop on `<Select.Value>`:

```tsx title="Placeholder item"
const items = [
  { value: 'system', label: 'System default' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

<Select.Root items={items}>
  <Select.Value placeholder="Select theme" />
</Select.Root>;
```

With placeholders, users cannot clear the selected value using the select itself. If the value
should be clearable from the popup (instead of an external "reset" button), use a `null` item
rendered in the list itself:

```tsx title="Clearable item"
const items = [
  { value: null, label: 'Select theme' },
  { value: 'system', label: 'System default' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

<Select.Root items={items}>
  <Select.Value />
</Select.Root>;
```

### Multiple selection

Add the `multiple` prop to `<Select.Root>` to allow multiple selections.

::demo{src="./demos/multiple.tsx"}

### Object values

Select items can use objects as values instead of primitives. This gives custom render functions
access to the full object, and can avoid needing `items` for a lookup. Use `itemToStringValue` to
serialize the object for form submission.

::demo{src="./demos/object-values.tsx"}

### Controlled

Pass `value` and update it from `onValueChange`. The second argument carries the event details,
including the `reason` and `cancel()`:

```tsx
const [theme, setTheme] = createSignal<string | null>('system');

<Select.Root
  items={items}
  value={theme()}
  onValueChange={(value, eventDetails) => setTheme(value)}
>
  {/* ... */}
</Select.Root>;
```

### Grouped

Organize related options with `<Select.Group>` and `<Select.GroupLabel>` to add section headings
inside the popup.

Groups are represented by an array of objects with an `items` property, which itself is an array
of the individual items in each group. An extra property, such as `value`, can provide the heading
text when rendering the group label.

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

::demo{src="./demos/grouped.tsx"}

## API reference

::api
