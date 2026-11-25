---
title: Introduction
description: An open-source SolidJS component library for building accessible user interfaces, ported from Base UI.
order: 1
---

Solid Base (`@egoist/solid-base`) is an unstyled component library for building accessible user
interfaces with **SolidJS 2**. It is a faithful port of [Base UI](https://base-ui.com), the React
library from the creators of Radix, Material UI and Floating UI.

The focus is the same as Base UI's: accessibility, performance and developer experience. The goal
is a complete set of open-source UI components with a delightful developer experience — in Solid.

## A faithful port

Every Base UI module is ported with the same components, parts, props, data attributes, CSS
variables, ARIA semantics, keyboard interactions, focus management and change event details. If
you know Base UI, you already know this library, and Base UI's guides and examples apply almost
line for line.

The code underneath is not React-in-Solid. The components are rewritten with idiomatic Solid 2
primitives: fine-grained reactivity, live props instead of re-renders, `createX` primitives
instead of hooks, and no virtual DOM. Where Solid and React differ, the API follows Solid — `class`
instead of `className`, native events, lowercase attributes. These differences are listed in
[Coming from React](/overview/solid).

The port mirrors Base UI's test suites: thousands of upstream tests are ported and pass, covering
rendering, ARIA, keyboard and focus behavior, controlled and uncontrolled state, and event details.

## Features

### Headless

The components are unstyled, don't bundle CSS, and don't prescribe a styling solution. You retain
complete control over your application's CSS layer. They work with Tailwind CSS, CSS Modules,
plain CSS, or any other tool that produces class names or inline styles. See
[Styling](/handbook/styling).

### Accessible

Poor accessibility can make your application difficult to navigate for all users, not just for
users with disabilities. Accessibility is the primary focus. Components adhere to the
[WAI-ARIA design patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) and inherit the behavior that
Base UI tests on a wide range of platforms, devices, browsers and screen readers. See
[Accessibility](/overview/accessibility).

### Composable

Component APIs are fully open, so you have direct access to each node, you can add or remove
parts, and you can wrap them however you prefer. The `render` prop lets you replace any part's
element or compose it with your own components. See [Composition](/handbook/composition).

## Requirements

- **Solid**: `solid-js` 2 and `@solidjs/web` 2 (peer dependencies). Solid 1 is not supported.
- **Browsers**: like Base UI, the library targets modern browsers that implement features marked
  as [Baseline Widely Available](https://web.dev/baseline).
- **Bundlers**: the package ships precompiled ES modules, plus its JSX source under the `solid`
  export condition for bundlers set up to compile Solid, such as Vite with `vite-plugin-solid`.

## Credits and license

Solid Base is MIT licensed. It is based on [Base UI](https://github.com/mui/base-ui) by the MUI
team, also MIT licensed: the component design, behavior, documentation structure and much of the
documentation text come from Base UI. Credit for the original work goes to the Base UI team and
contributors.
