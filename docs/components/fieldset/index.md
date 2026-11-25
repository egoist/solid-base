---
title: Fieldset
description: A native fieldset element with an easily stylable legend.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Fieldset } from '@egoist/solid-base/fieldset';

<Fieldset.Root>
  <Fieldset.Legend />
</Fieldset.Root>;
```

## Examples

### Labeling a group of controls

`<Fieldset.Legend>` labels the whole fieldset, which makes it a good fit for groups such as a
[Checkbox Group](/components/checkbox-group) or a [Radio Group](/components/radio-group). Render
the group as the fieldset itself with a `render` callback so the legend names it, and wrap it in a
`<Field.Root>` to give it a form `name`:

::demo{src="./demos/radio-group.tsx"}

### Disabling a group

Set `disabled` on `<Fieldset.Root>` to disable every field inside it.

## API reference

::api
