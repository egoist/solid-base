import { createSignal, flush, onCleanup, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { createTestFloating } from '../testUtils';
import { safePolygon } from './safePolygon';
import { createHoverPopupInteraction } from './hoverPopupInteraction';
import { getHoverIntent, type HoverIntent } from './hoverIntent';
import { createHoverTriggerInteraction } from './hoverTriggerInteraction';
import type { CreateHoverTriggerInteractionOptions } from './hoverTriggerInteraction';
import { REASONS } from '../../../internals/reasons';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';

/**
 * The floating element: sets the floating ref while mounted (React calls ref callbacks with
 * `null` on unmount; Solid doesn't).
 */
function Popup(props: { setFloating: (element: HTMLElement | null) => void }) {
  onCleanup(() => props.setFloating(null));
  return <div role="tooltip" ref={(element) => props.setFloating(element)} />;
}

function advance(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
}

describe('createHoverTriggerInteraction', () => {
  it('updates the handleClose options when they change', () => {
    let hoverIntent: HoverIntent | undefined;
    const [block, setBlock] = createSignal(false);

    function App() {
      const { store } = createTestFloating({ open: () => false });
      createHoverTriggerInteraction(store, {
        get handleClose() {
          return safePolygon({ blockPointerEvents: block() });
        },
      });
      hoverIntent = getHoverIntent(store);
      return null;
    }

    render(() => <App />);
    flush();
    expect(hoverIntent!.handleCloseOptions?.blockPointerEvents).toBe(false);

    setBlock(true);
    flush();
    expect(hoverIntent!.handleCloseOptions?.blockPointerEvents).toBe(true);
  });

  it('does not treat child target as inactive when handlers are on a wrapper', () => {
    const onOpenChange = vi.fn();

    function App() {
      const [open, setOpen] = createSignal(true, { ownedWrite: true });
      const [triggerElement, setTriggerElement] = createSignal<Element | null>(null, {
        ownedWrite: true,
      });
      const { refs, store } = createTestFloating({
        open,
        onOpenChange(nextOpen, details) {
          onOpenChange(nextOpen, details);
          setOpen(nextOpen);
        },
      });

      const hoverProps = createHoverTriggerInteraction(store, {
        mouseOnly: true,
        restMs: 100,
        delay: { close: 0 },
        move: false,
        get triggerElement() {
          return triggerElement();
        },
      });

      return (
        <>
          <div data-testid="wrapper" {...hoverProps}>
            <button
              data-testid="trigger"
              ref={(node) => {
                refs.setReference(node);
                setTriggerElement(node);
              }}
            />
          </div>
          <Show when={open()}>
            <Popup setFloating={refs.setFloating} />
          </Show>
        </>
      );
    }

    render(() => <App />);
    flush();

    const wrapper = screen.getByTestId('wrapper');
    const trigger = screen.getByTestId('trigger');

    fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    fireEvent.mouseEnter(wrapper);
    fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });
    flush();

    // Moving over the active trigger should not emit a redundant openchange.
    expect(onOpenChange).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole('tooltip')).not.toBe(null);
  });

  it('does not treat a child target as inactive when the composed path differs', () => {
    const onOpenChange = vi.fn();

    function App() {
      const [open, setOpen] = createSignal(true, { ownedWrite: true });
      const [triggerElement, setTriggerElement] = createSignal<Element | null>(null, {
        ownedWrite: true,
      });
      const { refs, store } = createTestFloating({
        open,
        onOpenChange(nextOpen, details) {
          onOpenChange(nextOpen, details);
          setOpen(nextOpen);
        },
      });

      const hoverProps = createHoverTriggerInteraction(store, {
        mouseOnly: true,
        restMs: 100,
        delay: { close: 0 },
        move: false,
        get triggerElement() {
          return triggerElement();
        },
      });

      return (
        <>
          <div data-testid="wrapper" {...hoverProps}>
            <button
              data-testid="trigger"
              ref={(node) => {
                refs.setReference(node);
                setTriggerElement(node);
                store.context.triggerElements.add('trigger', node);
              }}
            >
              <span data-testid="child" />
            </button>
          </div>
          <button
            data-testid="other-trigger"
            ref={(node) => {
              store.context.triggerElements.add('other-trigger', node);
            }}
          />
          <Show when={open()}>
            <Popup setFloating={refs.setFloating} />
          </Show>
        </>
      );
    }

    render(() => <App />);
    flush();

    const wrapper = screen.getByTestId('wrapper');
    const trigger = screen.getByTestId('trigger');
    const otherTrigger = screen.getByTestId('other-trigger');
    const child = screen.getByTestId('child');

    fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    // Entering the active trigger clears `blockMouseMove`, so a misclassified move would reopen.
    fireEvent.mouseEnter(trigger);
    flush();

    const event = new MouseEvent('mousemove', { bubbles: true });
    Object.defineProperties(event, {
      // Deliberately skew the composed path so `getTarget(event)` resolves to another
      // registered trigger while `event.target` remains `child`.
      composedPath: {
        configurable: true,
        value: () => [otherTrigger, wrapper],
      },
      movementX: {
        configurable: true,
        value: 10,
      },
      movementY: {
        configurable: true,
        value: 0,
      },
    });

    fireEvent(child, event);
    flush();

    expect(onOpenChange).toHaveBeenCalledTimes(0);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('treats disabled child trigger as inactive in wrapper fallback mode', () => {
    const onOpenChange = vi.fn();

    function App() {
      const [open, setOpen] = createSignal(true, { ownedWrite: true });
      const [triggerElement, setTriggerElement] = createSignal<Element | null>(null, {
        ownedWrite: true,
      });
      const { refs, store } = createTestFloating({
        open,
        onOpenChange(nextOpen, details) {
          onOpenChange(nextOpen, details);
          setOpen(nextOpen);
        },
      });

      const hoverProps = createHoverTriggerInteraction(store, {
        mouseOnly: true,
        restMs: 100,
        delay: { close: 0 },
        move: false,
        get triggerElement() {
          return triggerElement();
        },
      });

      return (
        <>
          <button
            data-testid="active-trigger"
            ref={(node) => {
              refs.setReference(node);
              setTriggerElement(node);
            }}
          />
          <div data-testid="inactive-wrapper" {...hoverProps}>
            <button
              data-testid="disabled-trigger"
              data-trigger-disabled
              ref={(node) => {
                store.context.triggerElements.add('disabled-trigger', node);
              }}
            />
          </div>
          <Show when={open()}>
            <Popup setFloating={refs.setFloating} />
          </Show>
        </>
      );
    }

    render(() => <App />);
    flush();

    const activeTrigger = screen.getByTestId('active-trigger');
    const wrapper = screen.getByTestId('inactive-wrapper');
    const disabledTrigger = screen.getByTestId('disabled-trigger');

    fireEvent.pointerEnter(activeTrigger, { pointerType: 'mouse' });
    fireEvent.mouseEnter(activeTrigger);
    fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    fireEvent.mouseMove(disabledTrigger, { movementX: 10, movementY: 0 });
    flush();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('tooltip')).not.toBe(null);
  });

  it('reopens immediately for same trigger in delegated wrapper mode during close transition', () => {
    const onOpenChange = vi.fn();
    let closeFromHover: (() => void) | null = null;

    function App() {
      const [open, setOpen] = createSignal(true, { ownedWrite: true });
      const [triggerElement, setTriggerElement] = createSignal<Element | null>(null, {
        ownedWrite: true,
      });
      const { refs, store } = createTestFloating({
        open,
        onOpenChange(nextOpen, details) {
          onOpenChange(nextOpen, details);
          setOpen(nextOpen);
          // Simulate active close transition lifecycle while closed.
          store.set('transitionStatus', nextOpen ? undefined : 'ending');
        },
      });

      closeFromHover = () => {
        store.setOpen(
          false,
          createChangeEventDetails(REASONS.triggerHover, new MouseEvent('mouseleave')),
        );
      };

      const hoverProps = createHoverTriggerInteraction(store, {
        mouseOnly: true,
        move: false,
        delay: { open: 500, close: 0 },
        get triggerElement() {
          return triggerElement();
        },
      });

      return (
        <>
          <div
            data-testid="wrapper"
            {...hoverProps}
            ref={(node) => {
              setTriggerElement(node);
            }}
          >
            <button
              data-testid="trigger"
              ref={(node) => {
                refs.setReference(node);
              }}
            />
          </div>
          <Show when={open()}>
            <Popup setFloating={refs.setFloating} />
          </Show>
        </>
      );
    }

    render(() => <App />);
    flush();

    const wrapper = screen.getByTestId('wrapper');

    closeFromHover!();
    flush();
    expect(screen.queryByRole('tooltip')).toBe(null);

    fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    fireEvent.mouseEnter(wrapper);
    flush();

    // Close from hover + immediate reopen without waiting open delay.
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange.mock.calls[1][0]).toBe(true);
    expect(screen.queryByRole('tooltip')).not.toBe(null);
  });

  describe('hover semantics', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function renderApp(options: CreateHoverTriggerInteractionOptions = {}) {
      function App() {
        const [open, setOpen] = createSignal(false, { ownedWrite: true });
        const [triggerElement, setTriggerElement] = createSignal<Element | null>(null, {
          ownedWrite: true,
        });
        const { refs, store } = createTestFloating({
          open,
          onOpenChange: (nextOpen) => setOpen(nextOpen),
        });
        const referenceProps = createHoverTriggerInteraction(store, {
          ...options,
          get triggerElement() {
            return triggerElement();
          },
        });
        createHoverPopupInteraction(store);

        return (
          <>
            <button
              {...referenceProps}
              ref={(node) => {
                refs.setReference(node);
                setTriggerElement(node);
              }}
            />
            <Show when={open()}>
              <Popup setFloating={refs.setFloating} />
            </Show>
          </>
        );
      }

      const result = render(() => <App />);
      flush();
      return result;
    }

    it('opens on mouseenter', () => {
      renderApp();

      fireEvent.mouseEnter(screen.getByRole('button'));
      flush();

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('closes on mouseleave', () => {
      renderApp();

      fireEvent.mouseEnter(screen.getByRole('button'));
      flush();
      fireEvent.mouseLeave(screen.getByRole('button'));
      flush();

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('closes when the pointer moves onto the floating element without safePolygon', () => {
      renderApp();

      fireEvent.mouseEnter(screen.getByRole('button'));
      flush();

      fireEvent(
        screen.getByRole('button'),
        new MouseEvent('mouseleave', { relatedTarget: screen.getByRole('tooltip') }),
      );
      flush();

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    describe('prop: delay', () => {
      it('symmetric number', () => {
        renderApp({ delay: 1000 });

        fireEvent.mouseEnter(screen.getByRole('button'));

        advance(999);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

        advance(1);
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      it('open', () => {
        renderApp({ delay: { open: 500 } });

        fireEvent.mouseEnter(screen.getByRole('button'));

        advance(499);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

        advance(1);
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      it('close', () => {
        renderApp({ delay: { close: 500 } });

        fireEvent.mouseEnter(screen.getByRole('button'));
        flush();
        fireEvent.mouseLeave(screen.getByRole('button'));

        advance(499);
        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        advance(1);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });

      it('open with close 0', () => {
        renderApp({ delay: { open: 500 } });

        fireEvent.mouseEnter(screen.getByRole('button'));

        advance(499);

        fireEvent.mouseLeave(screen.getByRole('button'));

        advance(1);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });

      it('restMs + nullish open delay should respect restMs', () => {
        renderApp({ restMs: 100, delay: { close: 100 } });

        fireEvent.mouseEnter(screen.getByRole('button'));

        advance(99);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });

    it('restMs', () => {
      renderApp({ restMs: 100 });

      const button = screen.getByRole('button');

      const originalDispatchEvent = button.dispatchEvent;
      const spy = vi.spyOn(button, 'dispatchEvent').mockImplementation((event) => {
        Object.defineProperty(event, 'movementX', { value: 10 });
        Object.defineProperty(event, 'movementY', { value: 10 });
        return originalDispatchEvent.call(button, event);
      });

      fireEvent.mouseMove(button);

      advance(99);

      fireEvent.mouseMove(button);

      advance(1);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      fireEvent.mouseMove(button);

      advance(100);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      spy.mockRestore();
    });

    it('restMs does not reset timer for minor mouse movement', () => {
      renderApp({ restMs: 100 });

      const button = screen.getByRole('button');

      const originalDispatchEvent = button.dispatchEvent;
      const spy = vi.spyOn(button, 'dispatchEvent').mockImplementation((event) => {
        Object.defineProperty(event, 'movementX', { value: 1 });
        Object.defineProperty(event, 'movementY', { value: 0 });
        return originalDispatchEvent.call(button, event);
      });

      fireEvent.mouseMove(button);

      advance(99);

      fireEvent.mouseMove(button);

      advance(1);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      spy.mockRestore();
    });

    it('reports the hover reason', () => {
      const reasons: string[] = [];

      function ReasonApp() {
        const [open, setOpen] = createSignal(false, { ownedWrite: true });
        const [triggerElement, setTriggerElement] = createSignal<Element | null>(null, {
          ownedWrite: true,
        });
        const { refs, store } = createTestFloating({
          open,
          onOpenChange(nextOpen, details) {
            reasons.push(details.reason);
            setOpen(nextOpen);
          },
        });
        const referenceProps = createHoverTriggerInteraction(store, {
          get triggerElement() {
            return triggerElement();
          },
        });

        return (
          <>
            <button
              {...referenceProps}
              ref={(node) => {
                refs.setReference(node);
                setTriggerElement(node);
              }}
            />
            <Show when={open()}>
              <Popup setFloating={refs.setFloating} />
            </Show>
          </>
        );
      }

      render(() => <ReasonApp />);
      flush();
      const button = screen.getByRole('button');
      fireEvent.mouseEnter(button);
      flush();
      fireEvent.mouseLeave(button);
      flush();

      expect(reasons).toEqual([REASONS.triggerHover, REASONS.triggerHover]);
    });

    it('mouseOnly ignores touch pointers', () => {
      renderApp({ mouseOnly: true });
      const button = screen.getByRole('button');

      fireEvent.pointerDown(button, { pointerType: 'touch' });
      fireEvent.mouseEnter(button);
      flush();

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('cancels a pending open when the pointer leaves before the delay', () => {
      renderApp({ delay: { open: 500 } });
      const button = screen.getByRole('button');

      fireEvent.mouseEnter(button);
      advance(200);
      fireEvent.mouseLeave(button);
      advance(500);

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('does nothing while disabled', () => {
      renderApp({ enabled: false });

      fireEvent.mouseEnter(screen.getByRole('button'));
      flush();

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
