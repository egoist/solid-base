---
title: Shadow DOM
description: A guide to using Solid Base components inside open or closed shadow roots.
order: 7
---

Solid Base components work inside shadow roots, open or closed. This is useful when your UI must
not be affected by the styles of the page it runs on, such as a browser extension's content script
or an embeddable widget.

Focus management, keyboard navigation, outside-press and focus-out dismissal, hover interactions
and label associations all follow the composed tree, so they behave the same inside a shadow root
as they do in the document.

## Mounting into a shadow root

Create the shadow root, add your stylesheet to it, and render your app inside it. Also create an
element for popups to portal into.

```tsx title="content-script.tsx"
import { render } from '@solidjs/web';
import css from './styles.css?inline';
import { App } from './App';

const host = document.createElement('div');
document.body.append(host);

const shadowRoot = host.attachShadow({ mode: 'closed' });

const style = document.createElement('style');
style.textContent = css;

const root = document.createElement('div');
const portalContainer = document.createElement('div');
shadowRoot.append(style, root, portalContainer);

render(() => <App portalContainer={portalContainer} />, root);
```

## Portals

Popups portal to `document.body` by default, which is outside your shadow root: your styles don't
apply there and the page's styles do. Pass an element inside the shadow root (or the shadow root
itself) as `container` to every portal.

```tsx title="Popover inside a shadow root"
<Popover.Root>
  <Popover.Trigger>Open</Popover.Trigger>
  <Popover.Portal container={props.portalContainer}>
    <Popover.Positioner>
      <Popover.Popup>…</Popover.Popup>
    </Popover.Positioner>
  </Popover.Portal>
</Popover.Root>
```

Put the container in a context if many components need it, or wrap each portal in your own
component that sets it.

## Styles injected by components

Scroll Area and Select inject a small stylesheet that hides native scrollbars. Inside a shadow root
it is added to that shadow root rather than the document's `<head>`. Use
[CSP Provider](/utils/csp-provider) to give it a nonce or to turn it off.

## Modal popups

While a modal popup such as a Dialog is open, the content outside it is hidden from assistive
technology. This includes the rest of the page outside the shadow host and the other elements in
the shadow root that contains the popup.
