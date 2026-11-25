---
title: Meter
description: A graphical display of a numeric value within a range.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Meter } from '@egoist/solid-base/meter';

<Meter.Root>
  <Meter.Label />
  <Meter.Track>
    <Meter.Indicator />
  </Meter.Track>
  <Meter.Value />
</Meter.Root>;
```

## API reference

::api
