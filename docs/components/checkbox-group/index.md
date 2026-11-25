---
title: Checkbox Group
description: Provides shared state to a series of checkboxes.
---

::demo{src="./demos/hero.tsx"}

## Usage guidelines

- **Form controls must have an accessible name.** It can be created using `<label>` elements, or
  the [Field](/components/field) and [Fieldset](/components/fieldset) components. See
  [Labeling a checkbox group](#labeling-a-checkbox-group).

## Anatomy

Checkbox Group is composed together with [Checkbox](/components/checkbox). Import the components
and place them together:

```tsx title="Anatomy"
import { Checkbox } from '@egoist/solid-base/checkbox';
import { CheckboxGroup } from '@egoist/solid-base/checkbox-group';

<CheckboxGroup>
  <Checkbox.Root />
</CheckboxGroup>;
```

## Examples

### Labeling a checkbox group

Label the group with `aria-labelledby` and a sibling label element:

```tsx title="Using aria-labelledby to label a checkbox group"
<div id="protocols-label">Allowed network protocols</div>
<CheckboxGroup aria-labelledby="protocols-label">{/* ... */}</CheckboxGroup>
```

An enclosing `<label>` is the simplest labeling pattern for each checkbox:

```tsx title="Using an enclosing label to label a checkbox"
<label>
  <Checkbox.Root value="http" />
  HTTP
</label>
```

### Rendering as a native button

By default, `<Checkbox.Root>` renders a `<span>` element to support enclosing labels. Prefer
rendering each checkbox as a native button when using sibling labels (`for`/`id`).

```tsx title="Sibling label pattern with a native button"
<div id="protocols-label">Allowed network protocols</div>
<CheckboxGroup aria-labelledby="protocols-label">
  <div>
    <label for="protocol-http">HTTP</label>
    <Checkbox.Root id="protocol-http" value="http" nativeButton render="button">
      <Checkbox.Indicator />
    </Checkbox.Root>
  </div>
</CheckboxGroup>
```

Native buttons with wrapping labels are supported by using the `render` callback to avoid invalid
HTML, so the hidden input is placed outside the label:

```tsx title="Render callback"
<div id="protocols-label">Allowed network protocols</div>
<CheckboxGroup aria-labelledby="protocols-label">
  <Checkbox.Root
    value="http"
    nativeButton
    render={(buttonProps) => (
      <label>
        <button {...buttonProps} />
        HTTP
      </label>
    )}
  />
</CheckboxGroup>
```

### Parent checkbox

A checkbox that controls other checkboxes within a `<CheckboxGroup>` can be created:

1. Make `<CheckboxGroup>` a controlled component
2. Pass an array of all the child checkbox values to the `allValues` prop on the `<CheckboxGroup>`
   component
3. Add the `parent` boolean prop to the parent `<Checkbox.Root>`

The group controls the parent checkbox's [indeterminate](/components/checkbox#indeterminate) state
when some, but not all, child checkboxes are checked.

::demo{src="./demos/parent.tsx"}

### Nested parent checkbox

Groups can be nested. Keep both groups controlled and sync them in their `onValueChange`
handlers; the outer parent checkbox receives an explicit `indeterminate` prop when only some of
the nested permissions are checked.

::demo{src="./demos/nested.tsx"}

## API reference

::api
