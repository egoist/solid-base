---
title: Animation
description: A guide to animating solid-base components.
order: 2
---

Components can be animated using CSS transitions, CSS animations, or JavaScript animations. Each
component provides a number of data attributes to target its states, as well as a few attributes
specifically for animation.

## CSS transitions

Use the following attributes for creating transitions when a component becomes visible or hidden:

- `[data-starting-style]` corresponds to the initial style to transition from.
- `[data-ending-style]` corresponds to the final style to transition to.

Transitions are recommended over CSS animations, because a transition can be smoothly cancelled
midway. For example, if the user closes a popup before it finishes opening, with CSS transitions
it will smoothly animate to its closed state without any abrupt changes.

::demo{src="./demos/animation-transition.tsx"}

```css title="popover.css"
.Popup {
  box-sizing: border-box;
  padding: 1rem 1.5rem;
  background-color: canvas;
  transform-origin: var(--transform-origin);
  transition:
    transform 150ms,
    opacity 150ms;

  &[data-starting-style],
  &[data-ending-style] {
    opacity: 0;
    transform: scale(0.9);
  }
}
```

## CSS animations

Use the following attributes for creating CSS animations when a component becomes visible or
hidden:

- `[data-open]` corresponds to the style applied when a component becomes visible.
- `[data-closed]` corresponds to the style applied before a component becomes hidden.

::demo{src="./demos/animation-keyframes.tsx"}

```css title="popover.css"
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes scaleOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}

.Popup[data-open] {
  animation: scaleIn 250ms ease-out;
}

.Popup[data-closed] {
  animation: scaleOut 250ms ease-in;
}
```

## JavaScript animations

JavaScript animations need the popup to stay rendered while its exit animation plays, and the
component to know when that animation is over.

When a popup closes, `open` becomes `false` right away, but the popup stays rendered in a closing
phase until its closing animation finishes. Components detect the animations running on the popup
element with `element.getAnimations()`: CSS transitions, CSS animations, and animations started
with the [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
(`element.animate()`). Once they end, the popup is removed from the DOM, or hidden if the
`<Portal>` has `keepMounted`, and `onOpenChangeComplete(false)` fires.

So in Solid, a JavaScript animation needs no extra wiring: use the `render` prop to get the popup
element, and start an animation whenever the live `state.open` changes. This works the same way
whether the popup is removed from the DOM when closed or kept mounted with `keepMounted`.

::demo{src="./demos/animation-js.tsx"}

```tsx title="animated-popover.tsx"
<Popover.Popup
  render={(props, state) => {
    let element!: HTMLDivElement;
    createEffect(
      () => state.open,
      (open) => {
        element.animate(open ? [hidden, shown] : [shown, hidden], {
          duration: 200,
          fill: 'forwards',
        });
      },
    );
    return <div {...mergeProps(props, { ref: (el: HTMLDivElement) => (element = el) })} />;
  }}
>
  Popup
</Popover.Popup>
```

:::solid[No AnimatePresence]
Base UI's React docs pair the popup with Motion's `<AnimatePresence>` and a controlled `open`
prop. You don't need either here: the `render` function is called once, its effect follows
`state.open`, and the component itself keeps the popup mounted until the exit animation finishes.
Animation libraries built on the Web Animations API work the same way as `element.animate()`.
:::

### Manual unmounting

Use this when the closing animation can't be detected — for example, when a library animates
style properties frame by frame with `requestAnimationFrame` instead of the Web Animations API —
or when the popup should stay in its closing phase until something other than an animation
completes.

Call `eventDetails.preventUnmountOnClose()` in `onOpenChange` when the component closes, then call
`unmount()` on the `actionsRef` passed to the `<Root>` once the animation finishes. This ends the
closing phase, and `onOpenChangeComplete(false)` fires. Whether the popup leaves the DOM is still
decided by `keepMounted`.

```tsx title="manual-unmount.tsx"
function App() {
  const actionsRef: { current: Popover.Root.Actions | null } = { current: null };

  return (
    <Popover.Root
      onOpenChange={(open, eventDetails) => {
        if (!open) {
          eventDetails.preventUnmountOnClose();
        }
      }}
      actionsRef={actionsRef}
    >
      <Popover.Trigger>Trigger</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup
            render={(props, state) => {
              let element!: HTMLDivElement;
              createEffect(
                () => state.open,
                (open) => {
                  if (!open) {
                    runExitAnimation(element).then(() => actionsRef.current?.unmount());
                  }
                },
              );
              return <div {...mergeProps(props, { ref: (el: HTMLDivElement) => (element = el) })} />;
            }}
          >
            Popup
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

If you need to wait for something before closing, control `open` and keep it `true` while you
wait. After the `await`, call `eventDetails.preventUnmountOnClose()` and then set `open` to
`false`. The request holds until the popup opens again, even if more close requests arrive while
you wait, but not if you `cancel()` the close it belongs to.

Don't call it before the `await`: an open request that arrives while you wait clears it. Only call
it once you've decided to close: `cancel()` has no effect after an `await`, so if you keep the
popup open instead, the request stays and the popup's next close won't unmount it. Navigation Menu
only accepts `preventUnmountOnClose()` synchronously, in `onValueChange`.

```tsx title="manual-unmount-after-await.tsx"
const [open, setOpen] = createSignal(false);

<Popover.Root
  open={open()}
  onOpenChange={async (nextOpen, eventDetails) => {
    if (nextOpen) {
      setOpen(true);
      return;
    }
    await save();
    eventDetails.preventUnmountOnClose();
    setOpen(false);
  }}
  actionsRef={actionsRef}
>
  …
</Popover.Root>;
```
