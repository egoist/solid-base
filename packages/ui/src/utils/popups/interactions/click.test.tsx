import { createSignal, flush, onCleanup, Show } from 'solid-js';
import { Dynamic } from '@solidjs/web';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { createTestFloating, getInteractionProps } from '../testUtils';
import { createClick, type CreateClickOptions } from './click';
import { createHoverPopupInteraction } from './hoverPopupInteraction';
import { createHoverTriggerInteraction } from './hoverTriggerInteraction';
import { REASONS } from '../../../internals/reasons';
import type { BaseUIChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import type { HTMLProps } from '../../../internals/types';

/**
 * The floating element: sets the floating ref while mounted (React calls ref callbacks with
 * `null` on unmount; Solid doesn't).
 */
function Popup(props: { setFloating: (element: HTMLElement | null) => void; props: HTMLProps }) {
  onCleanup(() => props.setFloating(null));
  return <div role="tooltip" {...props.props} ref={(element) => props.setFloating(element)} />;
}

function App(
  props: CreateClickOptions & {
    initialOpen?: boolean;
    onOpenChange?: (open: boolean, details: BaseUIChangeEventDetails<string>) => void;
    typeable?: boolean;
  },
) {
  // eslint-disable-next-line solid/reactivity -- read once, like upstream's `useState(initialOpen)`
  const [open, setOpen] = createSignal(props.initialOpen ?? false, { ownedWrite: true });
  const { refs, store } = createTestFloating({
    open,
    onOpenChange(nextOpen, details) {
      props.onOpenChange?.(nextOpen, details);
      setOpen(nextOpen);
    },
  });
  const click = createClick(store, props);
  const referenceProps = getInteractionProps([click], 'reference');
  const floatingProps = getInteractionProps([click], 'floating');

  return (
    <>
      <Dynamic
        component={props.typeable ? 'input' : 'button'}
        data-testid="reference"
        {...referenceProps}
        ref={refs.setReference}
      />
      <Show when={open()}>
        <Popup setFloating={refs.setFloating} props={floatingProps} />
      </Show>
    </>
  );
}

function createMouseEvent(type: string, options: MouseEventInit = {}) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...options,
  });
}

function createPointerEvent(type: string, pointerType: PointerEvent['pointerType']) {
  const event = createMouseEvent(type) as PointerEvent;
  Object.defineProperty(event, 'pointerType', {
    value: pointerType,
  });
  return event;
}

async function act(fn: () => void | Promise<void>) {
  await fn();
  flush();
  await Promise.resolve();
  flush();
}

async function click(element: Element) {
  await act(() => {
    element.dispatchEvent(createMouseEvent('click'));
  });
}

async function pressMouse(element: Element) {
  await act(() => {
    element.dispatchEvent(createPointerEvent('pointerdown', 'mouse'));
    element.dispatchEvent(createMouseEvent('mousedown'));
    element.dispatchEvent(createMouseEvent('click'));
  });
}

async function hover(element: Element) {
  await act(() => {
    element.dispatchEvent(createMouseEvent('mouseover', { relatedTarget: document.body }));
    element.dispatchEvent(createMouseEvent('mouseenter', { relatedTarget: document.body }));
  });
}

describe('createClick', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (callback: FrameRequestCallback): number => {
        callback(0);
        return 0;
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('opens and closes on repeated clicks', async () => {
    render(() => <App />);

    const button = screen.getByRole('button');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await click(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await click(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('keeps open on repeated clicks when toggle is false', async () => {
    render(() => <App toggle={false} />);

    const button = screen.getByRole('button');

    await click(button);
    await click(button);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  test('opens from the mousedown event path', async () => {
    render(() => <App event="mousedown" />);

    const button = screen.getByRole('button');

    await pressMouse(button);
    await act(() => {});
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  test('closes from the mousedown event path', async () => {
    render(() => <App event="mousedown" initialOpen />);

    const button = screen.getByRole('button');

    await pressMouse(button);
    await act(() => {});
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('ignores the click event after mousedown when event is mousedown-only', async () => {
    render(() => <App event="mousedown-only" />);

    const button = screen.getByRole('button');

    await pressMouse(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await click(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  test('ignores mouse input when ignoreMouse is true', async () => {
    render(() => <App ignoreMouse />);

    const button = screen.getByRole('button');

    fireEvent.pointerDown(button, { pointerType: 'mouse' });
    fireEvent.click(button);
    flush();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('delays touch opening when touchOpenDelay is set', async () => {
    vi.useFakeTimers();

    render(() => <App touchOpenDelay={100} />);

    const button = screen.getByRole('button');

    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.click(button);
    flush();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    vi.advanceTimersByTime(100);
    flush();

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  test('delays touch opening from the deferred mousedown event path', async () => {
    vi.useFakeTimers();

    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });

    render(() => <App event="mousedown" touchOpenDelay={100} />);

    const button = screen.getByRole('button');

    button.dispatchEvent(createPointerEvent('pointerdown', 'touch'));
    button.dispatchEvent(createMouseEvent('mousedown'));
    button.dispatchEvent(createMouseEvent('click'));
    flush();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    frameCallbacks.forEach((callback) => callback(0));
    flush();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    vi.advanceTimersByTime(100);
    flush();

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  test('does not delay touch closing', async () => {
    vi.useFakeTimers();

    render(() => <App initialOpen touchOpenDelay={100} />);

    const button = screen.getByRole('button');

    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.click(button);
    flush();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('uses the configured reason', async () => {
    const onOpenChange = vi.fn();

    render(() => <App onOpenChange={onOpenChange} reason={REASONS.inputPress} typeable />);

    await click(screen.getByRole('textbox'));

    expect(onOpenChange).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ reason: REASONS.inputPress }),
    );
  });

  function HoverClickApp(props: { stickIfOpen: boolean }) {
    const [open, setOpen] = createSignal(false, { ownedWrite: true });
    const { refs, store, elements } = createTestFloating({
      open,
      onOpenChange: (nextOpen) => setOpen(nextOpen),
    });
    const hoverReferenceProps = createHoverTriggerInteraction(store, {
      get triggerElement() {
        return elements.reference();
      },
    });
    createHoverPopupInteraction(store);
    const list = [
      { reference: hoverReferenceProps },
      createClick(store, {
        get stickIfOpen() {
          return props.stickIfOpen;
        },
      }),
    ];
    const referenceProps = getInteractionProps(list, 'reference');
    const floatingProps = getInteractionProps(list, 'floating');

    return (
      <>
        <button {...referenceProps} ref={refs.setReference} />
        <Show when={open()}>
          <Popup setFloating={refs.setFloating} props={floatingProps} />
        </Show>
      </>
    );
  }

  test('stickIfOpen true keeps a hover-opened popup open on first click', async () => {
    render(() => <HoverClickApp stickIfOpen />);

    const button = screen.getByRole('button');

    await hover(button);
    await click(button);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  test('stickIfOpen false closes a hover-opened popup on first click', async () => {
    render(() => <HoverClickApp stickIfOpen={false} />);

    const button = screen.getByRole('button');

    await hover(button);
    await click(button);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
