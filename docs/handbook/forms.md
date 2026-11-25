---
title: Forms
description: A guide to building forms with solid-base components.
order: 5
---

Form control components extend the native
[constraint validation API](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#the-constraint-validation-api)
so you can build forms for collecting user input or providing control over an interface. They
also integrate with [external form state](#external-form-state), such as the state managed by a
form library.

::demo{src="./demos/forms-hero.tsx"}

## Naming form controls

Form controls must have an accessible name in order to be recognized by assistive technologies.
Use the label strategy below for each control type.

### Input controls

Use `<Field.Label>` or a native `<label>` to label the following controls:

- `Input`
- `NumberField`
- `OTPField`
- `Autocomplete`
- `Combobox` (input outside popup)
- `Checkbox`
- `Radio`
- `Switch`

You can implicitly label `<Checkbox>`, `<Radio>` and `<Switch>` components by enclosing them with
`<Field.Label>`:

```tsx title="Implicitly labeling a switch"
import { Field } from '@egoist/solid-base/field';
import { Switch } from '@egoist/solid-base/switch';

<Field.Root>
  <Field.Label>
    <Switch.Root />
    Developer mode
  </Field.Label>
  <Field.Description>Enables extra tools for web developers</Field.Description>
</Field.Root>;
```

### Trigger-based controls

- `Combobox` (input inside popup): use `<Combobox.Label>`.
- `Select`: use `<Select.Label>`.
- `Slider`: use `<Slider.Label>`. For multi-thumb sliders, also add an `aria-label` on each
  `<Slider.Thumb>` to distinguish the thumbs.

### Fallback

If no visible label is rendered, provide `aria-label` on the actual form control.

### Describing the control

`<Field.Description>` automatically assigns an accessible description:

```tsx title="Labeling select and slider"
import { Field } from '@egoist/solid-base/field';
import { Form } from '@egoist/solid-base/form';
import { Select } from '@egoist/solid-base/select';
import { Slider } from '@egoist/solid-base/slider';

<Form>
  <Field.Root>
    <Select.Root>
      <Select.Label>Time zone</Select.Label>
      <Select.Trigger />
    </Select.Root>
    <Field.Description>Used for notifications and reminders</Field.Description>
  </Field.Root>

  <Field.Root>
    <Slider.Root defaultValue={50}>
      <Slider.Label>Zoom level</Slider.Label>
      <Field.Description>Adjust the size of the user interface</Field.Description>
      <Slider.Control>
        <Slider.Track>
          <Slider.Thumb />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  </Field.Root>
</Form>;
```

### Labeling control groups

Compose `<Fieldset>` when labeling a group of controls, such as a range slider with multiple
thumbs or a section that combines several inputs. For checkbox and radio groups, keep the group
label in `<Fieldset.Legend>` and wrap each option with `<Field.Item>`:

```tsx title="Composing range slider and radio group with fieldset"
import { Field } from '@egoist/solid-base/field';
import { Fieldset } from '@egoist/solid-base/fieldset';
import { Form } from '@egoist/solid-base/form';
import { Radio } from '@egoist/solid-base/radio';
import { RadioGroup } from '@egoist/solid-base/radio-group';
import { Slider } from '@egoist/solid-base/slider';

<Form>
  <Field.Root>
    <Fieldset.Root render={(props) => <Slider.Root {...props} defaultValue={[25, 75]} />}>
      <Fieldset.Legend>Price range</Fieldset.Legend>
      <Slider.Control>
        <Slider.Track>
          <Slider.Thumb index={0} aria-label="Minimum price" />
          <Slider.Thumb index={1} aria-label="Maximum price" />
        </Slider.Track>
      </Slider.Control>
    </Fieldset.Root>
  </Field.Root>

  <Field.Root>
    <Fieldset.Root render={(props) => <RadioGroup {...props} />}>
      <Fieldset.Legend>Storage type</Fieldset.Legend>
      <Field.Item>
        <Field.Label>
          <Radio.Root value="ssd" />
          SSD
        </Field.Label>
      </Field.Item>
      <Field.Item>
        <Field.Label>
          <Radio.Root value="hdd" />
          HDD
        </Field.Label>
      </Field.Item>
    </Fieldset.Root>
  </Field.Root>
</Form>;
```

`<Field.Item>` should enclose each checkbox or radio option so every control has its own label and
description:

```tsx title="Explicitly labeling checkboxes in a checkbox group"
import { Checkbox } from '@egoist/solid-base/checkbox';
import { CheckboxGroup } from '@egoist/solid-base/checkbox-group';
import { Field } from '@egoist/solid-base/field';
import { Fieldset } from '@egoist/solid-base/fieldset';

<Field.Root>
  <Fieldset.Root render={(props) => <CheckboxGroup {...props} />}>
    <Fieldset.Legend>Backup schedule</Fieldset.Legend>
    <Field.Item>
      <Checkbox.Root value="daily" />
      <Field.Label>Daily</Field.Label>
      <Field.Description>Daily at 00:00</Field.Description>
    </Field.Item>
    <Field.Item>
      <Checkbox.Root value="monthly" />
      <Field.Label>Monthly</Field.Label>
      <Field.Description>On the 5th of every month at 23:59</Field.Description>
    </Field.Item>
  </Fieldset.Root>
</Field.Root>;
```

:::solid
Base UI passes an element (`render={<RadioGroup />}`). Here, `render` takes a function that
spreads the fieldset's props into the group component, as in the examples above.
:::

## Building form fields

Pass the `name` prop to `<Field.Root>` to include the wrapped control's value when a parent form
is submitted:

```tsx title="Assigning field name to combobox"
import { Combobox } from '@egoist/solid-base/combobox';
import { Field } from '@egoist/solid-base/field';
import { Form } from '@egoist/solid-base/form';

<Form>
  <Field.Root name="country">
    <Field.Label>Country of residence</Field.Label>
    <Combobox.Root />
  </Field.Root>
</Form>;
```

## Submitting data

You can take over form submission using the native `onSubmit`, or the custom `onFormSubmit` prop:

```tsx title="Native submission using onSubmit"
import { Form } from '@egoist/solid-base/form';

<Form
  onSubmit={async (event) => {
    // Prevent the browser's default full-page refresh
    event.preventDefault();
    // Create a FormData object
    const formData = new FormData(event.currentTarget);
    // Send the FormData instance in a fetch request
    await fetch('https://api.example.com', {
      method: 'POST',
      body: formData,
    });
  }}
/>;
```

When using `onFormSubmit`, you receive form values as a JavaScript object, with `eventDetails`
provided as a second argument. Additionally, `preventDefault()` is automatically called on the
native submit event:

```tsx title="Submission using onFormSubmit"
import { Form } from '@egoist/solid-base/form';

<Form
  onFormSubmit={async (formValues) => {
    const payload = {
      product_id: formValues.id,
      order_quantity: formValues.quantity,
    };
    await fetch('https://api.example.com', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }}
/>;
```

## Constraint validation

Form components support native HTML validation attributes for many validation rules:

- `required` specifies a required field.
- `minlength` and `maxlength` specify a valid length for text fields.
- `pattern` specifies a regular expression that the field value must match.
- `step` specifies an increment that numeric field values must be an integral multiple of.

```tsx title="Defining constraint validation on a text field"
import { Field } from '@egoist/solid-base/field';

<Field.Root name="website">
  <Field.Control type="url" required pattern="https?://.*" />
  <Field.Error />
</Field.Root>;
```

:::solid
Validation attributes use their lowercase HTML names: `minlength` and `maxlength`, not React's
`minLength` and `maxLength`.
:::

Form components use a hidden input to participate in native form submission and validation. To
anchor the hidden input near a control so the native validation bubble points to the correct
area, ensure the component has been given a `name`, and wrap controls in a relatively positioned
container for best results.

```tsx title="Positioning hidden inputs"
import { Field } from '@egoist/solid-base/field';
import { Select } from '@egoist/solid-base/select';

<Field.Root name="apple">
  <Select.Root>
    <Select.Label>Apple</Select.Label>
    <div style={{ position: 'relative' }}>
      <Select.Trigger />
    </div>
  </Select.Root>
</Field.Root>;
```

## Custom validation

You can add custom validation logic by passing a synchronous or asynchronous validation function
to the `validate` prop, which runs after native validations have passed.

Use the `validationMode` prop to configure when validation is performed:

- `onSubmit` (default) validates all fields when the containing `<Form>` is submitted, afterwards
  invalid fields revalidate when their value changes.
- `onBlur` validates the field when focus moves away.
- `onChange` validates the field when the value changes, for example, after each keypress in a
  text field or when a checkbox is checked or unchecked.

`validationDebounceTime` can be used to debounce the function in use cases such as asynchronous
requests or text fields that validate `onChange`. Set `validationMode` on `<Form>` for every field,
or on a `<Field.Root>`, which takes precedence.

::demo{src="./demos/forms-validation.tsx"}

```tsx title="Text input using custom asynchronous validation"
import { Field } from '@egoist/solid-base/field';

<Field.Root
  name="username"
  validationMode="onChange"
  validationDebounceTime={300}
  validate={async (value) => {
    if (value === 'admin') {
      /* return an error message when invalid */
      return 'Reserved for system use.';
    }

    /* check the availability of a username from an external API */
    const available = await checkAvailability(value);

    if (!available) {
      return `${value} is unavailable.`;
    }

    /* return `null` when valid */
    return null;
  }}
>
  <Field.Control required minlength={3} />
  <Field.Error />
</Field.Root>;
```

## Server-side validation

You can pass errors returned by (post-submission) server-side validation to the `errors` prop,
which will be merged into the client-side field state for display.

This should be an object with field names as keys, and an error string or array of strings as the
value. Once a field's value changes, any corresponding error in `errors` will be cleared from the
field state.

```tsx title="Displaying errors returned by server-side validation"
import { createSignal } from 'solid-js';
import { Field } from '@egoist/solid-base/field';
import { Form } from '@egoist/solid-base/form';

async function submitToServer(data: FormData) {
  return {
    errors: {
      promoCode: 'This promo code has expired',
    },
  };
}

const [errors, setErrors] = createSignal<Record<string, string | string[]>>();

<Form
  errors={errors()}
  onSubmit={async (event) => {
    event.preventDefault();
    const response = await submitToServer(new FormData(event.currentTarget));
    setErrors(response.errors);
  }}
>
  <Field.Root name="promoCode">
    <Field.Control />
    <Field.Error />
  </Field.Root>
</Form>;
```

See the [Form](/components/form) page for a complete example.

## Displaying errors

Use `<Field.Error>` without `children` to automatically display the field's native error message
when invalid. The `match` prop can be used to customize the message based on the validity state,
and manage internationalization from your application logic:

```tsx title="Customizing error message for a required field"
<Field.Error match="valueMissing">You must create a username</Field.Error>
```

For full control, `<Field.Validity>` takes a function child that receives the field's validity
state. Like `render` functions, it is called once with a live object:

```tsx title="Reading the validity state"
<Field.Validity>
  {(state) => (
    <Show when={state.validity.tooShort}>
      {(state.value as string).length} of 3 characters
    </Show>
  )}
</Field.Validity>
```

## External form state

Fields can be driven by state that lives outside of them, such as the state managed by a form
library. `<Field.Root>` accepts the field's `invalid`, `touched` and `dirty` state, the control
takes a controlled `value` with `onValueChange` and `onBlur`, and `<Field.Error match>` delegates
the decision to display the error.

The demo below keeps its values in a Solid store and validates them in plain functions: all fields
are validated on the first submission, and revalidate on every change afterwards.

::demo{src="./demos/forms-external.tsx"}

```tsx title="Forwarding external field state"
<Field.Root
  name="username"
  invalid={error() != null}
  touched={touched.username ?? false}
  dirty={values.username !== initialValues.username}
>
  <Field.Label>Username</Field.Label>
  <Field.Control
    value={values.username}
    onValueChange={(value) => setValues((draft) => { draft.username = value; })}
    onBlur={() => setTouched((draft) => { draft.username = true; })}
  />
  <Field.Error match={error() != null}>{error()}</Field.Error>
</Field.Root>
```

Form libraries that expose per-field state — a value, an error, and touched and dirty flags —
integrate the same way: forward that state to `<Field.Root>`, the control and `<Field.Error>`, and
submit through the library's handler from `onSubmit`. Check that the library supports Solid 2.

:::solid[React Hook Form and TanStack Form]
Base UI's React docs integrate React Hook Form (React-only) and TanStack Form's React adapter.
Their `Controller` and `form.Field` render props map onto the props above: `field.value` →
`value`, `field.onChange` → `onValueChange`, `field.onBlur` → `onBlur`, and `fieldState` →
`invalid`, `touched`, `dirty` and `<Field.Error match>`. When a library hands you a `ref` to focus
invalid fields, pass it to the control, or to the input part of composite controls such as
`<NumberField.Input>`.
:::
