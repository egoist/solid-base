---
title: Accessibility
description: Learn how to make the most of Solid Base's accessibility features and guidelines.
order: 3
---

Accessibility is a top priority. The components handle many complex accessibility details,
including ARIA attributes, role attributes, pointer interactions, keyboard navigation and focus
management. The goal is to provide an accessible user experience out of the box, with intuitive
APIs for configuration.

This page highlights some of the key accessibility features of the library, as well as some ways
you need to augment it to ensure that your application is accessible to everyone.

## Keyboard navigation

Components adhere to the [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) to
provide basic keyboard accessibility out of the box. This is critical for users who have
difficulty using a pointer device, but it's also important for users who prefer navigating with a
keyboard or another input mode.

Many components support arrow keys, alphanumeric keys, **Home**, **End**, **Enter** and **Esc**.

## Focus management

Components manage focus automatically following a user interaction. Additionally, some components
provide props like `initialFocus` and `finalFocus` to configure focus management.

While the components manage focus, it's the developer's responsibility to visually indicate
focus. This is typically handled by styling the `:focus` or `:focus-visible` CSS pseudo-classes.
WCAG provides [guidelines on focus appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance).

```css title="styles.css"
.Button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

## Color contrast

When styling elements, it's important to meet the minimum requirements for color contrast between
each foreground element and its corresponding background element. Unless your application has
strict requirements around compliance with current standards, consider adhering to
[APCA](https://apcacontrast.com/).

## Accessible labels

Components like [Form](/components/form), [Input](/components/input), [Field](/components/field)
and [Fieldset](/components/fieldset) automatically associate form controls with their labels and
descriptions. You can also use the native HTML `<label>` element to provide context to
corresponding inputs:

```tsx
<label>
  <Switch.Root />
  Notifications
</label>
```

Most applications present custom controls that require accessible names provided by markup
features such as `alt`, `aria-label` or `aria-labelledby`. WAI-ARIA provides guidelines on
[providing accessible names](https://www.w3.org/TR/wai-aria-1.2/#namecalculation) to custom
controls. See [Forms](/handbook/forms#naming-form-controls) for the labeling strategy of each
form control.

:::solid[ARIA attributes in raw JSX]
Props that go through a component (`aria-label`, `aria-hidden`, …) may use booleans: they are
serialized for you. On plain elements in your own JSX, write ARIA booleans as strings:
`aria-hidden="true"`, `aria-expanded={open() ? 'true' : 'false'}`.
:::

## Testing

Every component has tests for its roles, ARIA attributes, keyboard interactions and focus
management, and every demo is server-rendered and hydrated in the test suite.
