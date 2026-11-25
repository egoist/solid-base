---
title: Progress
description: Displays the status of a task that takes a long time.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Progress } from '@egoist/solid-base/progress';

<Progress.Root>
  <Progress.Label />
  <Progress.Track>
    <Progress.Indicator />
  </Progress.Track>
  <Progress.Value />
</Progress.Root>;
```

## API reference

::api
