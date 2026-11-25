import { createSignal, flush, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  createEvent,
  fireEvent as baseFireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { FloatingFocusManager } from '../focus/FloatingFocusManager';
import {
  FloatingNode,
  FloatingTree,
  createFloatingNodeId,
  useFloatingParentNodeId,
} from '../tree/FloatingTree';
import { FloatingPortal } from '../portal/FloatingPortal';
import { createTestFloating, getInteractionProps } from '../testUtils';
import type { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { createDismiss, normalizeProp } from './dismiss';
import type { CreateDismissOptions } from './dismiss';
import { createFocus } from './focus';
import { createClick } from './click';
import { cleanupRef, getFloatingTestProps } from './__fixtures__/helpers';
import { REASONS } from '../../../internals/reasons';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../../internals/createBaseUIEventDetails';

type OnOpenChange = (open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void;

/**
 * `fireEvent` that flushes Solid's pending updates afterwards, like `@mui/internal-test-utils`'
 * `fireEvent` wraps React's `act`.
 */
const fireEvent = new Proxy(baseFireEvent, {
  apply(target, thisArg, args) {
    const result = Reflect.apply(target, thisArg, args);
    flush();
    return result;
  },
  get(target, key) {
    const value = Reflect.get(target, key);
    if (typeof value !== 'function') {
      return value;
    }
    return (...args: unknown[]) => {
      const result = value(...args);
      flush();
      return result;
    };
  },
}) as typeof baseFireEvent;

async function flushMicrotasks() {
  await Promise.resolve();
  flush();
}

async function wait(ms = 0) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
  flush();
}

type PointerInit = PointerEventInit & { timeStamp: number };

function firePointerEvent(type: 'pointerDown' | 'pointerUp', element: Element, init: PointerInit) {
  const { timeStamp, ...eventInit } = init;
  const event = createEvent[type](element, eventInit);
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  return fireEvent(element, event);
}

const firePointer = {
  down: (element: Element, init: PointerInit) => firePointerEvent('pointerDown', element, init),
  up: (element: Element, init: PointerInit) => firePointerEvent('pointerUp', element, init),
};

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
    (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  );
});

function App(
  props: CreateDismissOptions & {
    onClose?: () => void;
  },
) {
  const [open, setOpen] = createSignal(true, { ownedWrite: true });
  const { refs, store } = createTestFloating({
    open,
    onOpenChange(openArg, data) {
      setOpen(openArg);
      const reason = data?.reason;
      if (props.outsidePress) {
        expect(reason).toBe(REASONS.outsidePress);
      } else if (props.escapeKey) {
        expect(reason).toBe(REASONS.escapeKey);
        if (!openArg) {
          props.onClose?.();
        }
      } else if (props.referencePress?.()) {
        expect(reason).toBe(REASONS.triggerPress);
      }
    },
  });
  const dismiss = createDismiss(store, props);

  return (
    <>
      <button {...getInteractionProps([dismiss], 'reference')} ref={refs.setReference} />
      <Show when={open()}>
        <div role="tooltip" {...getFloatingTestProps([dismiss])} ref={cleanupRef(refs.setFloating)}>
          <input />
        </div>
      </Show>
    </>
  );
}

/**
 * A popup whose open state persists, with buttons that open and close it.
 */
function PersistentDismiss(props: { withInput?: boolean }) {
  const [open, setOpen] = createSignal(true, { ownedWrite: true });
  const { refs, store } = createTestFloating({
    open,
    onOpenChange: (value) => setOpen(value),
  });
  const dismiss = createDismiss(store);

  return (
    <>
      <button {...getInteractionProps([dismiss], 'reference')} ref={refs.setReference} />
      <button onClick={() => setOpen(true)}>open</button>
      <button onClick={() => setOpen(false)}>close</button>
      <Show when={open()}>
        <div role="tooltip" {...getFloatingTestProps([dismiss])} ref={cleanupRef(refs.setFloating)}>
          <Show when={props.withInput}>
            <input />
          </Show>
        </div>
      </Show>
    </>
  );
}

describe('createDismiss', () => {
  describe('default options', () => {
    test('registers outside press touch listeners as passive', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      try {
        render(() => <App />);

        await Promise.all(
          ['touchstart', 'touchmove', 'touchend'].map((eventName) =>
            waitFor(() => {
              expect(addEventListenerSpy).toHaveBeenCalledWith(eventName, expect.any(Function), {
                capture: true,
                passive: true,
              });
            }),
          ),
        );
      } finally {
        addEventListenerSpy.mockRestore();
      }
    });

    test('dismisses with escape key', async () => {
      render(() => <App />);
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      await flushMicrotasks();
    });

    test('calls preventDefault on escape key dismiss', async () => {
      render(() => <App />);
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(event);
      flush();
      expect(event.defaultPrevented).toBe(true);
      await flushMicrotasks();
    });

    test('does not call preventDefault on escape key if close is canceled', async () => {
      function CancelApp() {
        const [open, setOpen] = createSignal(true, { ownedWrite: true });
        const { refs, store } = createTestFloating({
          open,
          onOpenChange(_openArg, data) {
            data?.cancel();
            setOpen(true);
          },
        });
        const dismiss = createDismiss(store);

        return (
          <>
            <button {...getInteractionProps([dismiss], 'reference')} ref={refs.setReference} />
            <Show when={open()}>
              <div
                role="tooltip"
                {...getFloatingTestProps([dismiss])}
                ref={cleanupRef(refs.setFloating)}
              />
            </Show>
          </>
        );
      }

      render(() => <CancelApp />);
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(event);
      flush();
      expect(event.defaultPrevented).toBe(false);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    test('does not dismiss with escape key if IME is active', async () => {
      const onClose = vi.fn();

      render(() => <App onClose={onClose} escapeKey />);

      const textbox = screen.getByRole('textbox');

      textbox.focus();
      flush();

      await flushMicrotasks();

      // Simulate behavior when "あ" (Japanese) is entered and Esc is pressed for IME
      // cancellation.
      fireEvent.change(textbox, { target: { value: 'あ' } });
      fireEvent.compositionStart(textbox);
      fireEvent.keyDown(textbox, { key: 'Escape', isComposing: true });
      fireEvent.compositionEnd(textbox);

      // Wait for the compositionend timeout tick due to Safari
      await wait(0);

      expect(onClose).toHaveBeenCalledTimes(0);

      fireEvent.keyDown(textbox, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('does not dismiss with escape key while a composition spans a reopen', async () => {
      render(() => <PersistentDismiss />);

      fireEvent.compositionStart(document.body);
      fireEvent.click(screen.getByRole('button', { name: 'close' }));
      fireEvent.click(screen.getByRole('button', { name: 'open' }));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.keyDown(document.body, { key: 'Escape', isComposing: true });
      await flushMicrotasks();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('does not dismiss with the escape key that ends a composition spanning a reopen', async () => {
      render(() => <PersistentDismiss />);

      fireEvent.compositionStart(document.body);
      fireEvent.click(screen.getByRole('button', { name: 'close' }));
      fireEvent.click(screen.getByRole('button', { name: 'open' }));

      // Safari fires `compositionend` before the `keydown` that ends the composition.
      fireEvent.compositionEnd(document.body);
      fireEvent.keyDown(document.body, { key: 'Escape' });
      await flushMicrotasks();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('dismisses with escape key after closing during IME composition', async () => {
      render(() => <PersistentDismiss withInput />);

      // The primitive stays alive while closed, so the composition that ends after closing must
      // not keep blocking Escape once it reopens.
      fireEvent.compositionStart(screen.getByRole('textbox'));
      fireEvent.click(screen.getByRole('button', { name: 'close' }));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      fireEvent.compositionEnd(document.body);

      fireEvent.click(screen.getByRole('button', { name: 'open' }));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test.each([6, 12])(
      'does not dismiss a reopened popup when an old touch moves %s pixels and ends',
      (distance) => {
        function ReopenApp() {
          const [open, setOpen] = createSignal(true, { ownedWrite: true });
          const { refs, store } = createTestFloating({
            open,
            onOpenChange: (value) => setOpen(value),
          });
          const dismiss = createDismiss(store);

          return (
            <>
              <button
                {...getInteractionProps([dismiss], 'reference', {
                  onClick: () => setOpen((value) => !value),
                })}
                ref={refs.setReference}
              />
              <Show when={open()}>
                <div
                  role="tooltip"
                  {...getFloatingTestProps([dismiss])}
                  ref={cleanupRef(refs.setFloating)}
                />
              </Show>
            </>
          );
        }

        render(() => <ReopenApp />);

        const touch = {
          identifier: 1,
          target: document.body,
          clientX: 10,
          clientY: 10,
        };
        fireEvent.touchStart(document.body, {
          touches: [touch],
          changedTouches: [touch],
        });

        fireEvent.click(screen.getByRole('button'));
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        // Both the deferred touchend dismissal and the immediate touchmove dismissal belong
        // to the previous session, even though the interaction never unmounted.
        const movedTouch = { ...touch, clientX: touch.clientX + distance };
        fireEvent.touchMove(document.body, {
          touches: [movedTouch],
          changedTouches: [movedTouch],
        });
        fireEvent.touchEnd(document.body, {
          touches: [],
          changedTouches: [movedTouch],
        });
        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        // A new gesture in this session must still dismiss normally.
        fireEvent.touchStart(document.body, {
          touches: [touch],
          changedTouches: [touch],
        });
        fireEvent.touchMove(document.body, {
          touches: [{ ...touch, clientX: 22 }],
          changedTouches: [{ ...touch, clientX: 22 }],
        });
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      },
    );

    test('dismisses with outside pointer press', async () => {
      render(() => <App />);
      await userEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    // The upstream StrictMode variant (`strict: true`) is React-only.
    test('clears the inside marker when the interaction owner unmounts', () => {
      function DismissInteraction(props: { store: FloatingRootStore; outsidePress: boolean }) {
        const dismiss = createDismiss(props.store, {
          get outsidePress() {
            return props.outsidePress;
          },
          outsidePressEvent: 'sloppy',
        });

        return <button type="button" {...getFloatingTestProps([dismiss])} />;
      }

      const [interactionMounted, setInteractionMounted] = createSignal(true);
      const [outsidePress, setOutsidePress] = createSignal(false);

      function PersistentRootApp() {
        const [open, setOpen] = createSignal(true, { ownedWrite: true });
        const { store, refs } = createTestFloating({
          open,
          onOpenChange: (value) => setOpen(value),
        });

        return (
          <Show when={open()}>
            <div role="tooltip" ref={cleanupRef(refs.setFloating)}>
              <Show when={interactionMounted()}>
                <DismissInteraction store={store} outsidePress={outsidePress()} />
              </Show>
            </div>
          </Show>
        );
      }

      render(() => <PersistentRootApp />);

      fireEvent.click(screen.getByRole('button'));
      setInteractionMounted(false);
      setOutsidePress(true);
      flush();
      setInteractionMounted(true);
      flush();
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('dismisses with reference press', () => {
      render(() => <App referencePress={() => true} />);
      fireEvent.pointerDown(screen.getByRole('button'));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('dismisses with native click', async () => {
      render(() => <App referencePress={() => true} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('outsidePress function guard', async () => {
      render(() => <App outsidePress={() => false} />);
      await userEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('outsidePress ignored for third party elements', async () => {
      function ThirdPartyApp() {
        const [isOpen, setIsOpen] = createSignal(true, { ownedWrite: true });
        const { store, refs } = createTestFloating({
          open: isOpen,
          onOpenChange: (value) => setIsOpen(value),
        });
        const dismiss = createDismiss(store);

        return (
          <>
            <button {...getInteractionProps([dismiss], 'reference')} ref={refs.setReference} />
            <Show when={isOpen()}>
              <FloatingFocusManager store={store}>
                <div
                  role="dialog"
                  {...getFloatingTestProps([dismiss])}
                  ref={cleanupRef(refs.setFloating)}
                />
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      render(() => <ThirdPartyApp />);
      await flushMicrotasks();

      const thirdParty = document.createElement('div');
      thirdParty.setAttribute('data-testid', 'third-party');
      document.body.append(thirdParty);
      await userEvent.click(thirdParty);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      thirdParty.remove();
    });

    function ShadowApp(props: { shadowRoot: ShadowRoot; focusManaged?: boolean }) {
      const [isOpen, setIsOpen] = createSignal(true, { ownedWrite: true });
      const { store, refs } = createTestFloating({
        open: isOpen,
        onOpenChange: (value) => setIsOpen(value),
      });
      const dismiss = createDismiss(store);

      const dialog = () => (
        <div
          role="dialog"
          {...getFloatingTestProps([dismiss])}
          ref={cleanupRef(refs.setFloating)}
        />
      );

      return (
        <>
          <button {...getInteractionProps([dismiss], 'reference')} ref={refs.setReference} />
          <Show when={isOpen()}>
            <FloatingPortal container={props.shadowRoot}>
              {props.focusManaged ? (
                <FloatingFocusManager store={store}>{dialog()}</FloatingFocusManager>
              ) : (
                dialog()
              )}
            </FloatingPortal>
          </Show>
        </>
      );
    }

    test('dismisses when clicking outside a shared shadow root', async () => {
      const host = document.body.appendChild(document.createElement('div'));
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadowRoot.appendChild(container);

      try {
        render(() => <ShadowApp shadowRoot={shadowRoot} />, { container });

        await userEvent.click(document.body);

        expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
      } finally {
        host.remove();
      }
    });

    test('dismisses when clicking outside a shared shadow root while focus is managed', async () => {
      const host = document.body.appendChild(document.createElement('div'));
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadowRoot.appendChild(container);

      try {
        render(() => <ShadowApp shadowRoot={shadowRoot} focusManaged />, {
          container,
        });
        await flushMicrotasks();

        await userEvent.click(document.body);

        expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
      } finally {
        host.remove();
      }
    });

    test('outsidePress not ignored for nested floating elements', async () => {
      function Popover(props: { children?: JSX.Element; id: string; modal?: boolean | null }) {
        const [isOpen, setIsOpen] = createSignal(true, { ownedWrite: true });
        const { store, refs } = createTestFloating({
          open: isOpen,
          onOpenChange: (value) => setIsOpen(value),
        });
        const dismiss = createDismiss(store);

        const dialogJsx = () => (
          <div
            role="dialog"
            data-testid={props.id}
            {...getFloatingTestProps([dismiss])}
            ref={cleanupRef(refs.setFloating)}
          >
            {props.children}
          </div>
        );

        return (
          <>
            <button {...getInteractionProps([dismiss], 'reference')} ref={refs.setReference} />
            <Show when={isOpen()}>
              {props.modal == null ? (
                dialogJsx()
              ) : (
                <FloatingFocusManager store={store} modal={props.modal}>
                  {dialogJsx()}
                </FloatingFocusManager>
              )}
            </Show>
          </>
        );
      }

      function NestedApp(props: { modal: [boolean, boolean] | null }) {
        return (
          <Popover id="popover-1" modal={props.modal ? props.modal[0] : true}>
            <Popover id="popover-2" modal={props.modal ? props.modal[1] : null} />
          </Popover>
        );
      }

      for (const modal of [[true, true], [true, false], [false, true], null] as Array<
        [boolean, boolean] | null
      >) {
        const { unmount } = render(() => <NestedApp modal={modal} />);
        // eslint-disable-next-line no-await-in-loop
        await flushMicrotasks();

        const popover1 = screen.getByTestId('popover-1');
        const popover2 = screen.getByTestId('popover-2');

        // eslint-disable-next-line no-await-in-loop
        await userEvent.click(popover2);
        expect(popover1).toBeInTheDocument();
        expect(popover2).toBeInTheDocument();
        // eslint-disable-next-line no-await-in-loop
        await userEvent.click(popover1);
        expect(popover2).not.toBeInTheDocument();

        unmount();
      }
    });
  });

  describe('options set to false', () => {
    test('does not dismiss with escape key', async () => {
      render(() => <App escapeKey={false} />);
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    test('does not dismiss with outside press', async () => {
      render(() => <App outsidePress={false} />);
      await userEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('does not dismiss with reference pointer down', async () => {
      render(() => <App referencePress={() => false} />);
      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('does not dismiss when clicking portaled children', async () => {
      function PortaledApp() {
        const [open, setOpen] = createSignal(true, { ownedWrite: true });
        const { refs, store } = createTestFloating({
          open,
          onOpenChange: (value) => setOpen(value),
        });
        const dismiss = createDismiss(store);

        return (
          <>
            <button ref={refs.setReference} {...getInteractionProps([dismiss], 'reference')} />
            <Show when={open()}>
              <div ref={cleanupRef(refs.setFloating)} {...getFloatingTestProps([dismiss])}>
                <FloatingPortal>
                  <button data-testid="portaled-button" />
                </FloatingPortal>
              </div>
            </Show>
          </>
        );
      }

      render(() => <PortaledApp />);

      fireEvent.pointerDown(screen.getByTestId('portaled-button'), {
        bubbles: true,
      });
      await flushMicrotasks();

      expect(screen.getByTestId('portaled-button')).toBeInTheDocument();
    });

    test('outsidePress function guard', async () => {
      render(() => <App outsidePress={() => true} />);
      await userEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('prop: bubbles', () => {
    function Dialog(props: CreateDismissOptions & { testId: string; children: JSX.Element }) {
      const [open, setOpen] = createSignal(true, { ownedWrite: true });
      const nodeId = createFloatingNodeId();

      const { refs, store } = createTestFloating({
        open,
        onOpenChange: (value) => setOpen(value),
        nodeId,
      });

      const dismiss = createDismiss(store, props);

      return (
        <FloatingNode id={nodeId}>
          <button {...getInteractionProps([dismiss], 'reference')} ref={refs.setReference} />
          <Show when={open()}>
            <FloatingFocusManager store={store}>
              <div
                {...getFloatingTestProps([dismiss])}
                ref={cleanupRef(refs.setFloating)}
                data-testid={props.testId}
              >
                {props.children}
              </div>
            </FloatingFocusManager>
          </Show>
        </FloatingNode>
      );
    }

    function NestedDialog(props: CreateDismissOptions & { testId: string; children: JSX.Element }) {
      const parentId = useFloatingParentNodeId();

      if (parentId == null) {
        return (
          <FloatingTree>
            <Dialog {...props} />
          </FloatingTree>
        );
      }

      return <Dialog {...props} />;
    }

    describe('normalizeProp', () => {
      test('undefined', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp();

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(true);
      });

      test('when false', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } =
          normalizeProp(false);

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(false);
      });

      test('{}', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp(
          {},
        );

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(true);
      });

      test('{ escapeKey: false }', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp({
          escapeKey: false,
        });

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(true);
      });

      test('{ outsidePress: false }', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp({
          outsidePress: false,
        });

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(false);
      });
    });

    describe('prop: bubbles.outsidePress', () => {
      test('when true', async () => {
        render(() => (
          <NestedDialog testId="outer">
            <NestedDialog testId="inner">
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('when false', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles={{ outsidePress: false }}>
            <NestedDialog testId="inner" bubbles={{ outsidePress: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('mixed', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles={{ outsidePress: true }}>
            <NestedDialog testId="inner" bubbles={{ outsidePress: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });
    });

    describe('prop: bubbles.escapeKey', () => {
      test('without FloatingTree', async () => {
        function TooltipInPopoverApp() {
          const [popoverOpen, setPopoverOpen] = createSignal(true, {
            ownedWrite: true,
          });
          const [tooltipOpen, setTooltipOpen] = createSignal(false, {
            ownedWrite: true,
          });

          const popover = createTestFloating({
            open: popoverOpen,
            onOpenChange: (value) => setPopoverOpen(value),
          });
          const tooltip = createTestFloating({
            open: tooltipOpen,
            onOpenChange: (value) => setTooltipOpen(value),
          });

          const popoverInteractions = [createDismiss(popover.store)];
          const tooltipInteractions = [createFocus(tooltip.store), createDismiss(tooltip.store)];

          return (
            <>
              <button
                ref={popover.refs.setReference}
                {...getInteractionProps(popoverInteractions, 'reference')}
              />
              <Show when={popoverOpen()}>
                <div
                  role="dialog"
                  ref={cleanupRef(popover.refs.setFloating)}
                  {...getFloatingTestProps(popoverInteractions)}
                >
                  <button
                    data-testid="focus-button"
                    ref={tooltip.refs.setReference}
                    {...getInteractionProps(tooltipInteractions, 'reference')}
                  />
                </div>
              </Show>
              <Show when={tooltipOpen()}>
                <div
                  role="tooltip"
                  ref={cleanupRef(tooltip.refs.setFloating)}
                  {...getFloatingTestProps(tooltipInteractions)}
                />
              </Show>
            </>
          );
        }

        render(() => <TooltipInPopoverApp />);

        await flushMicrotasks();
        screen.getByTestId('focus-button').focus();
        flush();

        await waitFor(() => {
          expect(screen.getByRole('tooltip')).toBeInTheDocument();
        });

        await userEvent.keyboard('{Escape}');

        await waitFor(() => {
          expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      test('when true', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles>
            <NestedDialog testId="inner" bubbles>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('when false', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles={{ escapeKey: false }}>
            <NestedDialog testId="inner" bubbles={{ escapeKey: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('mixed', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles={{ escapeKey: true }}>
            <NestedDialog testId="inner" bubbles={{ escapeKey: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      describe('when Escape reaches the document', () => {
        // Layers that share no FloatingTree, like a Dialog opened from a Popover.
        function Layer(
          props: CreateDismissOptions & {
            testId: string;
            defaultOpen?: boolean;
            children?: JSX.Element;
          },
        ) {
          // eslint-disable-next-line solid/reactivity
          const [open, setOpen] = createSignal(props.defaultOpen ?? false, {
            ownedWrite: true,
          });
          const { refs, store } = createTestFloating({
            open,
            onOpenChange: (value) => setOpen(value),
          });
          const interactions = [createClick(store), createDismiss(store, props)];

          return (
            <>
              <button
                data-testid={`${props.testId}-trigger`}
                {...getInteractionProps(interactions, 'reference')}
                ref={refs.setReference}
              />
              <Show when={open()}>
                <div
                  data-testid={props.testId}
                  {...getFloatingTestProps(interactions)}
                  ref={cleanupRef(refs.setFloating)}
                >
                  {props.children}
                </div>
              </Show>
            </>
          );
        }

        async function openInnerAndBlur() {
          await userEvent.click(screen.getByTestId('inner-trigger'));
          expect(screen.getByTestId('inner')).toBeInTheDocument();

          (document.activeElement as HTMLElement).blur();
          flush();
          expect(document.activeElement).toBe(document.body);
        }

        test('closes only the most recently opened layer', async () => {
          render(() => (
            <Layer testId="outer" defaultOpen>
              <Layer testId="inner" />
            </Layer>
          ));

          await openInnerAndBlur();

          fireEvent.keyDown(document.body, { key: 'Escape' });

          expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
          expect(screen.getByTestId('outer')).toBeInTheDocument();

          fireEvent.keyDown(document.body, { key: 'Escape' });

          expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        });

        test('closes the layers below when the layers above bubble', async () => {
          render(() => (
            <Layer testId="outer" defaultOpen>
              <Layer testId="inner" bubbles={{ escapeKey: true }} />
            </Layer>
          ));

          await openInnerAndBlur();

          fireEvent.keyDown(document.body, { key: 'Escape' });

          expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
          expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        });

        test('handles the Escape again once the layer above closed', async () => {
          render(() => (
            <>
              <Layer testId="outer" defaultOpen outsidePress={false} />
              <Layer testId="inner" />
            </>
          ));

          await openInnerAndBlur();

          fireEvent.keyDown(document.body, { key: 'Escape' });

          expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
          expect(screen.getByTestId('outer')).toBeInTheDocument();

          await userEvent.click(screen.getByTestId('inner-trigger'));
          expect(screen.getByTestId('inner')).toBeInTheDocument();

          (document.activeElement as HTMLElement).blur();
          flush();

          fireEvent.keyDown(document.body, { key: 'Escape' });

          expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
          expect(screen.getByTestId('outer')).toBeInTheDocument();

          fireEvent.keyDown(document.body, { key: 'Escape' });

          expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        });
      });
    });
  });

  describe('prop: capture', () => {
    describe('normalizeProp', () => {
      test('undefined', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp();

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(true);
      });

      test('{}', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp(
          {},
        );

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(true);
      });

      test('when true', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } =
          normalizeProp(true);

        expect(escapeKeyCapture).toBe(true);
        expect(outsidePressCapture).toBe(true);
      });

      test('when false', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } =
          normalizeProp(false);

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(false);
      });

      test('{ escapeKey: true }', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp({
          escapeKey: true,
        });

        expect(escapeKeyCapture).toBe(true);
        expect(outsidePressCapture).toBe(true);
      });

      test('{ outsidePress: false }', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp({
          outsidePress: false,
        });

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(false);
      });
    });

    function Overlay(props: { children: JSX.Element }) {
      return (
        <div
          style={{ width: '100vw', height: '100vh' }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
            }
          }}
        >
          <span>outside</span>
          {props.children}
        </div>
      );
    }

    function Dialog(props: CreateDismissOptions & { id: string; children: JSX.Element }) {
      const [open, setOpen] = createSignal(true, { ownedWrite: true });
      const nodeId = createFloatingNodeId();

      const { refs, store } = createTestFloating({
        open,
        onOpenChange: (value) => setOpen(value),
        nodeId,
      });

      const dismiss = createDismiss(store, props);

      return (
        <FloatingNode id={nodeId}>
          <button {...getInteractionProps([dismiss], 'reference')} ref={refs.setReference} />
          <Show when={open()}>
            <FloatingPortal>
              <FloatingFocusManager store={store}>
                <div {...getFloatingTestProps([dismiss])} ref={cleanupRef(refs.setFloating)}>
                  <span>{props.id}</span>
                  {props.children}
                </div>
              </FloatingFocusManager>
            </FloatingPortal>
          </Show>
        </FloatingNode>
      );
    }

    function NestedDialog(props: CreateDismissOptions & { id: string; children: JSX.Element }) {
      const parentId = useFloatingParentNodeId();

      if (parentId == null) {
        return (
          <FloatingTree>
            <Dialog {...props} />
          </FloatingTree>
        );
      }

      return <Dialog {...props} />;
    }

    describe('prop: capture.outsidePress', () => {
      test('when true', async () => {
        const user = userEvent.setup();
        render(() => (
          <Overlay>
            <NestedDialog id="outer">
              <NestedDialog id="inner">{null}</NestedDialog>
            </NestedDialog>
          </Overlay>
        ));

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.getByText('inner')).toBeInTheDocument();

        await user.click(screen.getByText('outer'));

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();

        await user.click(screen.getByText('outside'));

        expect(screen.queryByText('outer')).not.toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();
      });
    });

    describe('prop: capture.escapeKey', () => {
      test('when false', async () => {
        const user = userEvent.setup();
        render(() => (
          <Overlay>
            <NestedDialog id="outer">
              <NestedDialog id="inner">{null}</NestedDialog>
            </NestedDialog>
          </Overlay>
        ));

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.getByText('inner')).toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(screen.queryByText('outer')).not.toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();
      });
    });
  });

  describe('outsidePressEvent: intentional', () => {
    function AppWithPreventedPressStart() {
      const [open, setOpen] = createSignal(true, { ownedWrite: true });
      const { refs, store } = createTestFloating({
        open,
        onOpenChange: (value) => setOpen(value),
      });
      const dismiss = createDismiss(store, {
        outsidePressEvent: 'intentional',
      });

      return (
        <>
          <button {...getInteractionProps([dismiss], 'reference')} ref={refs.setReference} />
          <Show when={open()}>
            <div
              role="tooltip"
              {...getFloatingTestProps([dismiss])}
              ref={cleanupRef(refs.setFloating)}
            >
              <div data-testid="scrubber" onPointerDown={(event) => event.preventDefault()} />
            </div>
          </Show>
        </>
      );
    }

    /**
     * A popup whose store is exposed so the test can dispatch open changes directly.
     */
    function StoreApp(props: { onStore: (store: FloatingRootStore) => void }) {
      const [open, setOpen] = createSignal(true, { ownedWrite: true });
      const { refs, store } = createTestFloating({
        open,
        onOpenChange: (value) => setOpen(value),
      });
      props.onStore(store);
      const dismiss = createDismiss(store, {
        outsidePressEvent: 'intentional',
      });

      return (
        <>
          <button {...getInteractionProps([dismiss], 'reference')} ref={refs.setReference} />
          <Show when={open()}>
            <div
              role="tooltip"
              {...getFloatingTestProps([dismiss])}
              ref={cleanupRef(refs.setFloating)}
            />
          </Show>
        </>
      );
    }

    test('dragging outside the floating element does not close', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    test('dragging inside the floating element does not close', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.mouseDown(document.body);
      fireEvent.mouseUp(floatingEl);
      // The browser fires the gesture's click on the common ancestor of the
      // mousedown and mouseup targets; the mouseup inside the floating element
      // marks the component tree so this click must not dismiss.
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    test('dragging outside the floating element then clicking outside closes', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);
      // A click event will have fired before the proper outside click.
      fireEvent.click(document.body);
      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('dragging outside the floating element then clicking outside closes with mouse clicks', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.pointerDown(floatingEl, { pointerType: 'mouse' });
      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);

      // Real mouse clicks carry `detail: 1`. This one passes the press-observed guard
      // and is consumed by the one-shot drag suppression.
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The next press-backed mouse click closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('an outside click stopped before its target does not close on a later click inside', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      const input = screen.getByRole('textbox');

      // Another document capture listener, like a drag library's after a drop, stops the click
      // after createDismiss has seen it but before it reaches its target.
      const stopClick = (event: MouseEvent) => event.stopPropagation();
      document.addEventListener('click', stopClick, {
        capture: true,
        once: true,
      });
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // This click bubbles to the body, where the stopped click was headed.
      fireEvent.pointerDown(input, { pointerType: 'mouse' });
      fireEvent.mouseDown(input);
      fireEvent.mouseUp(input);
      fireEvent.click(input, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('mouse click whose press started before open does not close', async () => {
      render(() => <App outsidePressEvent="intentional" />);

      // The trailing click of a press that began before open, e.g. a menu item activated
      // by drag-release opening a dialog.
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A press observed while open still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('compatibility events whose pointerdown opened the floating element do not count as a new press', async () => {
      function OpenOnPointerDownApp() {
        const [open, setOpen] = createSignal(false, { ownedWrite: true });
        const { refs, store } = createTestFloating({
          open,
          onOpenChange: (value) => setOpen(value),
        });
        const dismiss = createDismiss(store, {
          outsidePressEvent: 'intentional',
        });

        return (
          <>
            <button onPointerDown={() => setOpen(true)}>Open</button>
            <Show when={open()}>
              <div
                role="tooltip"
                {...getFloatingTestProps([dismiss])}
                ref={cleanupRef(refs.setFloating)}
              />
            </Show>
          </>
        );
      }

      render(() => <OpenOnPointerDownApp />);

      const openButton = screen.getByRole('button', { name: 'Open' });
      fireEvent.pointerDown(openButton, { pointerType: 'mouse' });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The pointerdown happened before the floating element opened. Its
      // compatibility events arrive after opening but belong to the same press.
      fireEvent.mouseDown(openButton);
      fireEvent.mouseUp(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A new pointer press that begins while open still dismisses.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('keyboard-generated outside click without a prior press closes', async () => {
      render(() => <App outsidePressEvent="intentional" />);

      // Keyboard activations produce `detail: 0` clicks with no press.
      fireEvent.click(document.body, { detail: 0 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press-less outside click reporting a pointer type closes', async () => {
      render(() => <App outsidePressEvent="intentional" />);

      // Android assistive technology reports `pointerType: 'mouse'` with no press behind
      // it, so the click count is what separates the two.
      const click = new MouseEvent('click', { bubbles: true, detail: 0 });
      Object.defineProperty(click, 'pointerType', { value: 'mouse' });
      fireEvent(document.body, click);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press seen in a previous open session does not leak into a reopen', async () => {
      function ReopenApp() {
        const [open, setOpen] = createSignal(true, { ownedWrite: true });
        const { refs, store } = createTestFloating({
          open,
          onOpenChange: (value) => setOpen(value),
        });
        const dismiss = createDismiss(store, {
          outsidePressEvent: 'intentional',
        });

        return (
          <>
            <button
              {...getInteractionProps([dismiss], 'reference', {
                onClick: () => setOpen(true),
              })}
              ref={refs.setReference}
            />
            <Show when={open()}>
              <div
                role="tooltip"
                {...getFloatingTestProps([dismiss])}
                ref={cleanupRef(refs.setFloating)}
              />
            </Show>
          </>
        );
      }

      render(() => <ReopenApp />);

      // A genuine outside press closes and leaves a press on record.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The reopened session must not inherit the previous session's press:
      // a press-less trailing click still must not count as an outside press.
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A press observed in the new session still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press seen before a same-batch close and reopen does not leak into the new session', async () => {
      let store!: FloatingRootStore;

      render(() => <StoreApp onStore={(value) => (store = value)} />);

      // A press lands while the first session is open.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);

      // The open state never flushes as `false` here, so only `openchange` can observe the
      // session boundary.
      store.setOpen(false, createChangeEventDetails(REASONS.none));
      store.setOpen(true, createChangeEventDetails(REASONS.none));
      flush();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The gesture's trailing click belongs to the previous session and must
      // not dismiss the reopened floating element.
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A press observed in the new session still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press survives a redundant open dispatch while already open', async () => {
      let store!: FloatingRootStore;

      render(() => <StoreApp onStore={(value) => (store = value)} />);

      // A genuine outside press lands while open.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);

      // A redundant open dispatch mid-gesture (hovering an inactive trigger does this)
      // does not end the session, so the press stays on record.
      store.setOpen(true, createChangeEventDetails(REASONS.none));
      flush();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press survives listener re-attachment while open', async () => {
      const [escapeKey, setEscapeKey] = createSignal(true);
      render(() => <App outsidePressEvent="intentional" escapeKey={escapeKey()} />);

      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);

      // Changing an effect dependency mid-gesture re-attaches the document listeners;
      // the observed press must survive that.
      setEscapeKey(false);
      flush();

      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('pointerdown-only press while open allows the outside click to close', async () => {
      render(() => <App outsidePressEvent="intentional" />);

      // Pointer-event browsers may deliver `pointerdown` without a compat
      // `mousedown`; it must count as an observed press on its own.
      fireEvent.pointerDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('non-primary-button press does not count as an outside press', async () => {
      render(() => <App outsidePressEvent="intentional" />);

      // A right-button press produces `contextmenu`, not `click`, so it must
      // not vouch for a later press-less click.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 2 });
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A primary-button press still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('cancelled press does not count as an outside press', async () => {
      render(() => <App outsidePressEvent="intentional" />);

      // A press whose gesture is cancelled produces no click, so it must not
      // vouch for a later press-less click.
      fireEvent.pointerDown(document.body, { pointerType: 'touch' });
      fireEvent.pointerCancel(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A completed press still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('inside click then programmatic outside click closes', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      const insideInput = screen.getByRole('textbox');

      fireEvent.mouseDown(insideInput);
      fireEvent.mouseUp(insideInput);
      fireEvent.click(insideInput);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('inside click after drag does not cause immediate close on first outside click', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      const insideInput = screen.getByRole('textbox');

      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);

      // Inside clicks should never dismiss, and they should not consume the
      // one-shot outside click suppression from the drag that started inside.
      fireEvent.click(insideInput);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // First true outside click after that drag is still ignored once.
      fireEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The next outside click is a deliberate outside press and dismisses.
      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('drag ending on outsidePress-ignored target does not consume next outside click', async () => {
      render(() => (
        <App
          outsidePressEvent="intentional"
          outsidePress={(event) => !(event.target as Element)?.closest('[data-testid="ignore"]')}
        />
      ));
      const floatingEl = screen.getByRole('tooltip');
      const ignored = document.createElement('div');
      ignored.setAttribute('data-testid', 'ignore');
      document.body.append(ignored);

      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(ignored);

      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      ignored.remove();
    });

    test('press start prevented inside does not require double outside click', async () => {
      render(() => <AppWithPreventedPressStart />);
      const scrubber = screen.getByTestId('scrubber');

      fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(scrubber, { button: 0 });
      fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseUp(document.body, { button: 0 });

      // Wait a tick: if no immediate synthetic click occurred after pointerup,
      // the next user click should still dismiss.
      await wait(0);

      fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(document.body, { button: 0 });
      fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseUp(document.body, { button: 0 });
      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press start prevented inside suppresses only immediate outside click', async () => {
      render(() => <AppWithPreventedPressStart />);
      const scrubber = screen.getByTestId('scrubber');

      fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(scrubber, { button: 0 });
      fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseUp(document.body, { button: 0 });

      fireEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await wait(0);

      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('pointercancel after prevented press start suppresses immediate outside click', async () => {
      render(() => <AppWithPreventedPressStart />);
      const scrubber = screen.getByTestId('scrubber');

      fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(scrubber, { button: 0 });
      fireEvent.pointerCancel(document.body, { pointerType: 'mouse' });

      fireEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await wait(0);

      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  test('nested floating elements with different portal containers', async () => {
    function ButtonWithFloating(props: {
      children?: JSX.Element;
      portalContainer?: HTMLElement | null;
      triggerText: string;
    }) {
      const [open, setOpen] = createSignal(false, { ownedWrite: true });
      const { refs, store } = createTestFloating({
        open,
        onOpenChange: (value) => setOpen(value),
      });

      const interactions = [createClick(store), createDismiss(store)];

      return (
        <>
          <button ref={refs.setReference} {...getInteractionProps(interactions, 'reference')}>
            {props.triggerText}
          </button>
          <Show when={open()}>
            <FloatingPortal container={props.portalContainer}>
              <FloatingFocusManager store={store} modal={false}>
                <div ref={cleanupRef(refs.setFloating)} {...getFloatingTestProps(interactions)}>
                  {props.children}
                </div>
              </FloatingFocusManager>
            </FloatingPortal>
          </Show>
        </>
      );
    }

    function PortalsApp() {
      const [otherContainer, setOtherContainer] = createSignal<HTMLDivElement | null>(null, {
        ownedWrite: true,
      });

      return (
        <>
          <ButtonWithFloating portalContainer={undefined} triggerText="open 1">
            <ButtonWithFloating portalContainer={otherContainer()} triggerText="open 2">
              <button>nested</button>
            </ButtonWithFloating>
          </ButtonWithFloating>
          <div ref={(element) => setOtherContainer(element)} />
        </>
      );
    }

    render(() => <PortalsApp />);

    await userEvent.click(screen.getByText('open 1'));
    expect(screen.getByText('open 2')).toBeInTheDocument();

    await userEvent.click(screen.getByText('open 2'));
    await flushMicrotasks();

    expect(screen.getByText('open 1')).toBeInTheDocument();
    expect(screen.getByText('open 2')).toBeInTheDocument();
    expect(screen.getByText('nested')).toBeInTheDocument();
  });
});

describe('press ownership across independent non-modal layers', () => {
  function createTouch(target: HTMLElement, clientX: number) {
    const init = { identifier: 1, target, clientX, clientY: 0 };
    return typeof Touch === 'undefined' ? init : new Touch(init);
  }

  function Layer(props: {
    id: string;
    open: boolean;
    mode: 'intentional' | 'sloppy';
    onOpenChange: OnOpenChange;
  }) {
    const { refs, store } = createTestFloating({
      open: () => props.open,
      onOpenChange: (open, details) => props.onOpenChange(open, details),
    });
    const dismiss = createDismiss(store, {
      get outsidePressEvent() {
        return props.mode;
      },
    });
    return (
      <div
        data-testid={props.id}
        data-open={store.select('open') ? '' : undefined}
        {...getFloatingTestProps([dismiss])}
        ref={cleanupRef(refs.setFloating)}
      />
    );
  }

  describe.each([
    { name: 'later-opened', targetIsLater: true, expectedCloses: 0 },
    { name: 'earlier-opened', targetIsLater: false, expectedCloses: 1 },
  ])('$name layer', ({ targetIsLater, expectedCloses }) => {
    test.each([
      {
        name: 'intentional mouse click',
        mode: 'intentional' as const,
        press: (target: HTMLElement) => {
          firePointer.down(target, { pointerType: 'mouse', timeStamp: 1 });
          fireEvent.mouseDown(target);
          firePointer.up(target, { pointerType: 'mouse', timeStamp: 2 });
          fireEvent.mouseUp(target);
          fireEvent.click(target, { detail: 1 });
        },
      },
      {
        name: 'sloppy pointerdown',
        mode: 'sloppy' as const,
        press: (target: HTMLElement) => {
          firePointer.down(target, { pointerType: 'mouse', timeStamp: 1 });
        },
      },
      {
        name: 'sloppy mousedown',
        mode: 'sloppy' as const,
        press: (target: HTMLElement) => {
          fireEvent.mouseDown(target);
        },
      },
      {
        name: 'sloppy touchend',
        mode: 'sloppy' as const,
        press: (target: HTMLElement) => {
          const touch = createTouch(target, 0);
          fireEvent.touchStart(target, {
            touches: [touch],
            changedTouches: [touch],
          });
          const moved = createTouch(target, 6);
          fireEvent.touchMove(target, {
            touches: [moved],
            changedTouches: [moved],
          });
          fireEvent.touchEnd(target, { touches: [], changedTouches: [moved] });
        },
      },
      {
        name: 'sloppy touchmove',
        mode: 'sloppy' as const,
        press: (target: HTMLElement) => {
          const touch = createTouch(target, 0);
          fireEvent.touchStart(target, {
            touches: [touch],
            changedTouches: [touch],
          });
          const moved = createTouch(target, 12);
          fireEvent.touchMove(target, {
            touches: [moved],
            changedTouches: [moved],
          });
        },
      },
    ])('$name respects opening order', async ({ mode, press }) => {
      const onOlderOpenChange = vi.fn<OnOpenChange>();
      const onTargetOpenChange = vi.fn<OnOpenChange>();
      const [bothOpen, setBothOpen] = createSignal(false);

      function Fixture() {
        return (
          <>
            <Layer
              id="older"
              open={bothOpen() || targetIsLater}
              mode={mode}
              onOpenChange={onOlderOpenChange}
            />
            <Layer
              id="target"
              open={bothOpen() || !targetIsLater}
              mode={mode}
              onOpenChange={onTargetOpenChange}
            />
          </>
        );
      }

      render(() => <Fixture />);
      setBothOpen(true);
      flush();
      expect(screen.getByTestId('older')).toHaveAttribute('data-open');
      expect(screen.getByTestId('target')).toHaveAttribute('data-open');
      expect(onOlderOpenChange).not.toHaveBeenCalled();
      expect(onTargetOpenChange).not.toHaveBeenCalled();
      press(screen.getByTestId('target'));
      expect(onOlderOpenChange).toHaveBeenCalledTimes(expectedCloses);
      expect(
        onOlderOpenChange.mock.calls.map(([open, details]) => ({
          open,
          reason: details.reason,
        })),
      ).toEqual(expectedCloses ? [{ open: false, reason: REASONS.outsidePress }] : []);
      expect(onTargetOpenChange).not.toHaveBeenCalled();
    });
  });
});
