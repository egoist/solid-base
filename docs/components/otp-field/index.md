---
title: OTP Field
description: A one-time password input composed of individual character slots.
---

::demo{src="./demos/hero.tsx"}

## Usage guidelines

- **Form controls must have an accessible name.** It can be created using a `<label>` element or
  the [Field](/components/field) component. See
  [Labeling an OTP field](#labeling-an-otp-field).

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { OTPField } from '@egoist/solid-base/otp-field';

<OTPField.Root>
  <OTPField.Input />
  <OTPField.Separator />
</OTPField.Root>;
```

## Examples

### Labeling an OTP field

Pass an `id` to `<OTPField.Root>` and use a native `<label>` with a matching `for`. Let the first
input use the field label, and add `aria-label` to the remaining inputs so assistive technology
can announce which slot is focused.

Optionally, add `aria-describedby` when supporting text should be announced with the field.

```tsx title="OTP Field with a native label and description"
<div>
  <label for="verification-code">Verification code</label>
  <OTPField.Root
    id="verification-code"
    length={6}
    aria-describedby="verification-code-description"
  >
    <OTPField.Input />
    <OTPField.Input aria-label="Character 2 of 6" />
    <OTPField.Input aria-label="Character 3 of 6" />
    <OTPField.Input aria-label="Character 4 of 6" />
    <OTPField.Input aria-label="Character 5 of 6" />
    <OTPField.Input aria-label="Character 6 of 6" />
  </OTPField.Root>
  <p id="verification-code-description">Enter the 6-character code we sent to your device.</p>
</div>
```

The demos on this page render the slots with `<Repeat>`, which passes each slot's index as a
plain number:

```tsx
<Repeat count={6}>
  {(index) => (
    <OTPField.Input aria-label={index === 0 ? undefined : `Character ${index + 1} of 6`} />
  )}
</Repeat>
```

### Submitting on completion

Pass `autoSubmit` to submit the owning form automatically when all slots are filled, or use
`onValueComplete` to react to completion without submitting.

### Alphanumeric verification codes

Use `validationType="alphanumeric"` for recovery, backup, or invite codes that mix letters and
numbers.

::demo{src="./demos/alphanumeric.tsx"}

### Grouped layouts

Wrap subsets of inputs in your own layout elements and use `<OTPField.Separator>` when you want
the code presented in smaller visual chunks such as `123-456`.

::demo{src="./demos/grouped.tsx"}

### Custom normalization

Use `normalizeValue` to normalize accepted values before state updates, such as converting
alphanumeric codes to uppercase. It runs after `validationType` filtering, and the result is
filtered against `validationType` again. Use `validationType="none"` when the normalizer should
provide the full validation rule.

Pair custom rules with `inputmode` for keyboard hints and `onValueInvalid` for rejected
characters.

::demo{src="./demos/custom-normalize.tsx"}

:::solid
The keyboard hint prop is the lowercase DOM attribute `inputmode` (React: `inputMode`).
:::

### Masked entry

Use `mask` when the code should be obscured while it is being typed.

::demo{src="./demos/password.tsx"}

## API reference

::api
