# Popup infrastructure

The Solid port of Base UI's `utils/popups` (upstream vendors `@floating-ui/react` here) plus the
popup-related internals. Every popup component (Dialog, AlertDialog, Drawer, Popover, Tooltip,
PreviewCard, Menu, ContextMenu, Menubar, Select, Combobox, NavigationMenu, Toast) is built from
these pieces. **Dialog (`packages/ui/src/dialog`) is the reference implementation**: read it first.

## Mental model

```
Root ─ createPopupRoot(props, createStore) ──▶ store (BasePopupStore subclass)
  │      binds open/triggerId props, runs transitions, unmount-after-close, actionsRef
  ├─ interactions: createDismiss(store, …), createClick(store, …), hover, focus, list nav…
  │      → props objects published to the store (activeTriggerProps / popupProps…)
  ├─ Trigger ─ createTriggerDataForwarding (registration, payload) + interaction props
  └─ Portal (FloatingPortal) ─ [InternalBackdrop] ─ Positioner (createPopupPositioner)
                                                     └─ Popup (+ FloatingFocusManager)
```

* **One store per popup**, created once by the Root, provided through context. Every part reads
  it reactively and writes to it imperatively.
* **Interactions are `createX(store, options)` primitives** that attach document/element
  listeners in effects and return *props objects* (`{ reference, floating, trigger, item }`) that
  parts pass to `renderElement(..., { props: [...] })`.
* **Options are read lazily**, like Solid props: pass getters for reactive values
  (`{ get enabled() { return !props.disabled } }`), plain values otherwise. Never destructure
  them.

## The store

### `ReactiveStore` (`reactiveStore.ts`)

The Solid counterpart of upstream's `ReactStore`.

| Upstream (React)                    | Here                                                                 |
| ----------------------------------- | -------------------------------------------------------------------- |
| `store.useState('x', ...args)`      | `store.select('x', ...args)` inside a reactive scope (getter, JSX, memo, effect compute) |
| `store.select('x')` (in handlers)   | `store.select('x')` or `store.state.x` (untracked)                   |
| `store.set` / `store.update`        | same; writes are synchronous and visible to the next read            |
| `store.useSyncedValue(key, value)`  | `store.syncValue(key, accessor)` / `store.syncValueWithCleanup`      |
| `store.useControlledProp(key, v)`   | `store.bind(key, accessor)` (reads go to the accessor, writes ignored) |
| `store.useStateSetter('x')`         | `store.setter('x')` (handy as a ref callback)                        |
| `store.useContextCallback(k, fn)`   | assign `store.context.k = fn` (the context is a plain mutable object) |

Unlike signals, reads never lag writes: imperative popup logic (`setOpen` pipelines, handlers)
relies on that. Reactive dependents re-run on the next flush. Outside a tracking scope
(handlers, effect `apply` phases, timers) `select` is an untracked snapshot, so it never trips
Solid's untracked-read diagnostic — which also means a read in a component body silently doesn't
update: always read inside getters, JSX, memos or effect computes.

Solid effects never compare what their compute returns: an effect whose compute returns a fresh
object re-runs on every tracked change. When re-arming has side effects (listeners, focus
bookkeeping), put the dependencies in a `createMemo(..., { equals })` first.

### `BasePopupStore` (`store.ts`)

State shared by every popup (`PopupStoreState`): `open`, `openProp`, `mounted`,
`transitionStatus`, `payload`, `activeTriggerId/Element`, `anchorElement`, `popupElement`,
`positionerElement`, `anchorOverride`, `activeTriggerProps`, `inactiveTriggerProps`,
`popupProps`, … and selectors (`popupStoreSelectors`): `open`, `isOpenedByTrigger(id)`,
`triggerPopupId(id)`, `triggerProps(isActive)`, `anchor`, `positionerElement`…

`store.setOpen(open, eventDetails)` runs the upstream pipeline: drop impossible changes →
`getCloseTrigger` → add `preventUnmountOnClose()` → `onOpenChange(open, details)` (may
`cancel()`) → emit `openchange` on `store.context.events` → `prepareOpenChange` → commit
(flushed synchronously for hover changes). Subclasses override only the hooks they need:

```ts
type State = PopupStoreState<unknown> & { modal: boolean; openMethod: InteractionType | null };

class PopoverStore extends BasePopupStore<State, Context, typeof selectors, ChangeEventDetails> {
  protected override prepareOpenChange(nextOpen: boolean, details: ChangeEventDetails) {
    return { instantType: nextOpen ? undefined : 'dismiss' }; // committed with the change
  }
}
```

`store.context` (`PopupInteractionContext`) holds non-reactive shared values: `events`
(`openchange`, `droppedclose`, hover/list-navigation events), `triggerElements`
(`PopupTriggerMap`), `openEvent`, `positioning`, `nested`, `onOpenChange`,
`onOpenChangeComplete`, plus anything a component adds (Dialog adds `backdropElement`…).

Components without a popup store (NavigationMenu, Toast) use `FloatingRootStore`
(`floating-root/createFloatingRootStore.ts`), whose `open`/`anchor`/`positionerElement` are bound
to accessors and whose `setOpen` calls `onOpenChange`.

## Root (`popupRoot.tsx`)

```tsx
export function PopoverRoot<Payload>(props: PopoverRoot.Props<Payload>) {
  const { store, open } = createPopupRoot(props, (initialState, defaultPopupId) =>
    new PopoverStore({ ...initialState, modal: untrack(() => props.modal) ?? false }, defaultPopupId),
  );
  store.bind('modal', () => props.modal ?? false);
  createPopupRootSync(store, open);                       // resets `openMethod` on close
  attachPopupHandle(() => props.handle, store);           // detached triggers
  createPopoverInteractions(store);                       // dismiss etc. (see below)
  return (
    <FloatingTree>
      <PopoverRootContext value={store}>
        {renderPopupRootChildren(props.children, () => store.select('payload'))}
      </PopoverRootContext>
    </FloatingTree>
  );
}
```

`createPopupRoot` binds `open`/`triggerId` props, wires `onOpenChange`/`onOpenChangeComplete`,
keeps the active trigger in sync with the registered triggers (`createImplicitActiveTrigger`,
optionally `closeOnActiveTriggerUnmount`), runs the open/close transition
(`internals/unmountAfterClose.ts`: `mounted` and `transitionStatus` are bound into the store, the
popup unmounts after its exit animation unless `preventUnmountOnClose()` was called) and exposes
`actionsRef` (`{ unmount, close }`, a `{ current }` object or a callback).

## Interactions (`interactions/`)

| Upstream hook                  | Primitive                                  | Returns                  |
| ------------------------------ | ------------------------------------------ | ------------------------ |
| `useDismiss`                   | `createDismiss(store, opts)`               | `{ reference, floating, trigger }` |
| `useClick`                     | `createClick(store, opts)`                 | `{ reference }`          |
| `useFocus`                     | `createFocus(store, opts)`                 | `{ reference, trigger }` |
| `useHoverTriggerInteraction`   | `createHoverTriggerInteraction(store, opts)` | trigger props          |
| `useHoverPopupInteraction`     | `createHoverPopupInteraction(store, opts)` | nothing (native listeners on the positioner) |
| `safePolygon`, hover intent    | `safePolygon(opts)`, `getHoverIntent(store)` | —                      |
| `useListNavigation`            | `createListNavigation(store, opts)`        | `{ reference, floating, item }` |
| `useTypeahead`                 | `createTypeahead(store, opts)`             | `{ reference, floating }` |
| `useClientPoint`               | `createClientPoint(store, opts)`           | `{ reference, trigger }` |
| `useOpenMethodTriggerProps`    | `createOpenMethodTriggerProps(open, set)`  | `{ onClick, onPointerDown }` |
| `FloatingDelayGroup`/`useDelayGroup` | `<FloatingDelayGroup>` / `createDelayGroup` | —                  |

Root-level interactions publish their props through the store, so detached triggers and the
popup can pick them up:

```ts
const dismiss = createDismiss(store, {
  outsidePressEvent: { mouse: 'intentional', touch: 'sloppy' },
  get escapeKey() { return isTopmost(); },
});
createPopupInteractionProps(store, {
  activeTriggerProps: dismiss.reference!,
  inactiveTriggerProps: dismiss.trigger!,
  popupProps: dismiss.floating!,
});
```

Solid notes:

* React capture-phase handlers (`onClickCapture`) don't exist in Solid JSX; interactions attach
  native listeners in effects instead.
* React's "inside the React tree" (events bubbling through portals) maps to Solid's portal host
  links: `isInsideComponentTree(ancestor, node)` (`element.ts`). Solid's delegated events already
  bubble through `<Portal>`s, like React's.

## Triggers (`popupStoreUtils.ts`)

```tsx
const store = () => props.handle?.store ?? rootStore;   // a handle's store follows attach/detach
const id = createBaseUiId(() => props.id);
const { registerTrigger, isMountedByThisTrigger } =
  createTriggerDataForwarding(id, store, () => ({ payload: props.payload }));
const click = createClick(createStoreProxy(store));
return renderElement('button', props, {
  state,
  ref: [buttonRef, registerTrigger],
  props: [
    click.reference,
    createDynamicPropsSource(() => store().select('triggerProps', isMountedByThisTrigger())),
    { get 'aria-expanded'() { return store().select('isOpenedByTrigger', id()); }, … },
    elementProps,
    getButtonProps,
  ],
  stateAttributesMapping: triggerOpenStateMapping,
});
```

* `createDynamicPropsSource(accessor)` turns props published in the store into a live props
  source for `renderElement`.
* `createStoreProxy(accessor)` is a stable `PopupInteractionStore` forwarding to the current store.

### Handles (`popupHandle.ts`)

`BasePopupHandle` keeps the store detached triggers read (`handle.store`, tracked), a fallback
`NullStore` while no Root is attached, and the shared `openByTrigger(id)` / `closePopup()`.
Subclass it per component (`DialogHandle` adds `open`, `openWithPayload`, `close`, `isOpen`).

## Portal, backdrop and focus

* `FloatingPortal` (`portal/FloatingPortal.tsx`) renders a `<div data-base-ui-portal>` into
  `container` (default: the parent portal, or `<body>`) with Solid's `<Portal>`, and renders focus
  guards around it for non-modal popups. `FloatingPortalLite` has no guards. `container` accepts an
  element, a `{ current }` ref object, an accessor, or `null` (wait).
* `InternalBackdrop` is the transparent full-viewport backdrop of modal popups (marked
  `data-base-ui-inert`; optional `cutout` element).
* `FloatingFocusManager` (`focus/FloatingFocusManager.tsx`) wraps the popup element:
  `initialFocus`, `returnFocus` (boolean, element, `{ current }`, or `(interactionType) => …`),
  `modal` (focus trap + `aria-hidden` outside via `markOthers`), `closeOnFocusOut`,
  `restoreFocus`, `openInteractionType`, `disabled`, `getInsideElements`. Mark the focusable popup
  with `FOCUSABLE_POPUP_PROPS`.
* Scroll lock: `createScrollLock(enabled, reference)` (`@egoist/solid-base-utils/scrollLock`) for
  dialogs, `createAnchoredPopupScrollLock` (`anchoredPopupScrollLock.ts`) for anchored popups
  opened by touch.

```tsx
// Dialog.Popup (abridged)
return (
  <FloatingFocusManager
    store={store}
    openInteractionType={store.select('openMethod')}
    disabled={!store.select('mounted')}
    initialFocus={props.initialFocus ?? createDefaultInitialFocus(() => store.state.popupElement)}
    returnFocus={props.finalFocus}
    modal={store.select('modal') !== false}
    restoreFocus="popup"
  >
    {renderElement('div', props, {
      state,
      ref: store.setter('popupElement'),
      props: [createDynamicPropsSource(() => store.select('popupProps')), FOCUSABLE_POPUP_PROPS, …],
      stateAttributesMapping: popupTransitionStateMapping,
    })}
  </FloatingFocusManager>
);
```

## Positioning

All positioning uses `@floating-ui/dom` directly (`computePosition` + `autoUpdate`; there is no
`@floating-ui/react-dom`).

* `createFloating(options)` (`positioning/floating.ts`) — the counterpart of upstream
  `useBaseUIFloating`: reactive `x`, `y`, `strategy`, `placement`, `middlewareData`,
  `isPositioned`, `update()`, `refs` and the live positioning `context`, which it publishes to
  `store.context.positioning` and the popup's floating tree node (`createPositioningContext`).
* `createAnchorPositioning(params)` (`internals/anchorPositioning.ts`) — the counterpart of
  upstream `useAnchorPositioning`: `side`/`align` (logical `inline-start`/`inline-end` follow
  `useDirection()`), `sideOffset`/`alignOffset` (numbers or functions), `collisionAvoidance`,
  `collisionBoundary`, `collisionPadding`, `sticky`, `arrowPadding`, `positionMethod`,
  `disableAnchorTracking`, `anchor` (element, virtual element, `{ current }` or function), and
  returns a live object: `positionerStyles` (incl. `--anchor-width`, `--anchor-height`,
  `--available-width`, `--available-height`, `--transform-origin`), `arrowStyles`, `arrowRef`,
  `arrowUncentered`, `side`, `align`, `physicalSide`, `anchorHidden`, `isPositioned`, `refs`,
  `context`, `update()`. Middleware: `positioning/arrow.ts`, `positioning/hideMiddleware.ts`,
  `positioning/adaptiveOriginMiddleware.ts`, `inlineRect.ts` (`createInlineMiddleware`).
* `createPopupPositioner(store, componentProps, options)` (`popupPositioner.ts`) — what every
  `*.Positioner` part calls: runs `createAnchorPositioning` with the positioning props, writes
  `positionerElement`, and renders the `<div role="presentation">` with `data-side`,
  `data-align`, `data-open/closed`, `data-anchor-hidden`, `data-instant` and the styles
  (`positioning/positioner.tsx` → `renderPositioner`). The store must have `instantType` and
  `adaptiveOrigin` in its state. Returns `{ element, positioning, open, mounted }`.
* `createClientPoint(store, opts)` positions against the cursor (anchor override).
* Viewports that animate between triggers: `viewport/popupViewport.tsx`
  (`createPopupViewport`), `viewport/popupAutoResize.ts` (`createPopupAutoResize`),
  `internals/triggerSwitchTransition.ts` (`createTriggerSwitchTransition`).
* Select/Combobox-like popups: `value-popup/ValuePopupStore.ts`.
* Focus guards around triggers of non-modal popups: `triggerFocusGuards.ts`.

A Popover-like Positioner:

```tsx
export function PopoverPositioner(componentProps: PopoverPositioner.Props) {
  const store = usePopoverRootContext();
  const keepMounted = usePopoverPortalContext();
  const nodeId = createFloatingNodeId();
  const { element, positioning } = createPopupPositioner(store, componentProps, {
    get keepMounted() { return keepMounted(); },
    positioning: { nodeId },
  });
  const trueModal = () =>
    store.select('modal') === true && store.select('openChangeReason') !== REASONS.triggerHover;
  createAnchoredPopupScrollLock(
    () => store.select('open') && trueModal(),
    () => store.select('openMethod') === 'touch',
    () => store.select('positionerElement'),
    () => store.select('activeTriggerElement'),
  );
  return (
    <PopoverPositionerContext value={positioning}>
      <Show when={store.select('mounted') && trueModal()}>
        <InternalBackdrop inert={!store.select('open')} cutout={store.select('activeTriggerElement')} />
      </Show>
      <FloatingNode id={nodeId}>{element}</FloatingNode>
    </PopoverPositionerContext>
  );
}
// Popover.Arrow: renderElement('div', props, { ref: positioning.arrowRef,
//   props: [{ get style() { return positioning.arrowStyles; }, 'aria-hidden': true }, elementProps] })
```

## Nested popups (`tree/`)

`<FloatingTree>` (once, at the outermost Root of a family) and `<FloatingNode id={createFloatingNodeId()}>`
(around each Positioner) let interactions see parents and children: `createDismiss` `bubbles`,
nested hover, nested list navigation, and the focus manager's "inside the floating tree" checks.
`createPositioningContext` / `createFloating` attach the popup's live context to its node.
Dialogs nest through context instead (`store.context.onNestedDialogOpen`).

## Data attributes and CSS variables

* `popupStateMapping`, `popupTransitionStateMapping` (`data-open`, `data-closed`,
  `data-starting-style`, `data-ending-style`, `data-anchor-hidden`), `triggerOpenStateMapping`
  (`data-popup-open`), `pressableTriggerOpenStateMapping` (`+ data-pressed`).
* `CommonPopupDataAttributes`, `CommonTriggerDataAttributes`,
  `positioning/CommonPositionerCssVars` (`--anchor-width`, `--available-height`,
  `--transform-origin`, …), `viewport/CommonPopupCssVars`.

## Testing interactions

`testUtils.tsx` replaces upstream's `useFloating` + `useTestInteractions`:

```tsx
function App() {
  const [open, setOpen] = createSignal(true);
  const { store, refs } = createTestFloating({ open, onOpenChange: (next) => setOpen(next) });
  const dismiss = createDismiss(store);
  return (
    <>
      <button ref={refs.setReference} {...getInteractionProps([dismiss], 'reference')} />
      <Show when={open()}>
        <div role="tooltip" ref={refs.setFloating} {...getInteractionProps([dismiss], 'floating')} />
      </Show>
    </>
  );
}
```
