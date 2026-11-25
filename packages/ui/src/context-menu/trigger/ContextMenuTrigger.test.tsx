import { Show, createSignal, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { ContextMenu } from '..';
import { act, flushMicrotasks, renderWithUser } from '../../menu/test-utils';

function tick(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
}

function touch(target: Element, clientX: number, clientY: number, identifier = 0) {
  return { identifier, target, clientX, clientY } as unknown as Touch;
}

describe('<ContextMenu.Trigger />', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    // Fire pending fake frames so module-level frame ids don't leak into later tests.
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <ContextMenu.Root>
          <ContextMenu.Trigger
            data-testid="trigger"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'open' : 'closed')}
            style={{ color: 'red' }}
            render={(props) => <section {...props} />}
          >
            Right click me
          </ContextMenu.Trigger>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(ref).toBe(trigger);
      expect(trigger.tagName).toBe('SECTION');
      expect(trigger).toHaveClass('closed');
      expect(trigger.style.color).toBe('red');
    });

    it('renders a div by default', () => {
      render(() => (
        <ContextMenu.Root>
          <ContextMenu.Trigger data-testid="trigger" />
        </ContextMenu.Root>
      ));
      expect(screen.getByTestId('trigger').tagName).toBe('DIV');
    });
  });

  it('throws when rendered outside ContextMenu.Root', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(() => <ContextMenu.Trigger />)).toThrow(
        'Base UI: ContextMenuRootContext is missing. ContextMenu parts must be placed within <ContextMenu.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('should open menu on right click (context menu event)', async () => {
    render(() => (
      <ContextMenu.Root>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    fireEvent.contextMenu(trigger);
    await flushMicrotasks();

    expect(screen.queryByRole('menu')).not.toBe(null);
  });

  it('adds open state attributes', async () => {
    const { user } = renderWithUser(() => (
      <ContextMenu.Root defaultOpen>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    expect(trigger).toHaveAttribute('data-popup-open', '');

    await user.keyboard('{Escape}');
    await flushMicrotasks();
    expect(trigger).not.toHaveAttribute('data-popup-open');
  });

  it('should call onOpenChange when menu is opened via right click', async () => {
    const onOpenChange = vi.fn();

    render(() => (
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    fireEvent.contextMenu(trigger);
    await flushMicrotasks();

    expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
  });

  it('does not cancel opening menu on mouseup after mousedown outside before 500ms', async () => {
    const onOpenChange = vi.fn();

    render(() => (
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    fireEvent.mouseDown(trigger);
    fireEvent.contextMenu(trigger);

    tick(499);

    expect(onOpenChange.mock.calls.length).toBe(1);
    expect(onOpenChange.mock.lastCall?.[0]).toBe(true);

    fireEvent.mouseUp(document.body);

    tick(1);

    expect(onOpenChange.mock.calls.length).toBe(1);
  });

  it('cancels opening menu on mouseup after mousedown outside after 500ms', async () => {
    const onOpenChange = vi.fn();

    render(() => (
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    fireEvent.mouseDown(trigger);
    fireEvent.contextMenu(trigger);

    tick(501);

    fireEvent.mouseUp(document.body);

    expect(onOpenChange.mock.calls.length).toBe(2);
    expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
  });

  it('keeps the menu open when the context-menu gesture ends inside its positioner', async () => {
    const onOpenChange = vi.fn();

    render(() => (
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner data-testid="positioner">
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    fireEvent.contextMenu(screen.getByTestId('trigger'));
    tick(501);
    fireEvent.mouseUp(screen.getByTestId('positioner'));
    flush();

    expect(onOpenChange.mock.calls).toHaveLength(1);
    expect(screen.queryByRole('menu')).not.toBe(null);
  });

  it('keeps the root menu open when the context-menu gesture ends in a portaled submenu', async () => {
    const onOpenChange = vi.fn();

    render(() => (
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup>
              <ContextMenu.SubmenuRoot defaultOpen>
                <ContextMenu.SubmenuTrigger>More</ContextMenu.SubmenuTrigger>
                <ContextMenu.Portal>
                  <ContextMenu.Positioner>
                    <ContextMenu.Popup data-testid="submenu-popup" />
                  </ContextMenu.Positioner>
                </ContextMenu.Portal>
              </ContextMenu.SubmenuRoot>
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    fireEvent.contextMenu(screen.getByTestId('trigger'));
    tick(501);
    fireEvent.mouseUp(screen.getByTestId('submenu-popup'));
    flush();

    expect(onOpenChange.mock.calls).toHaveLength(1);
    expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
  });

  it('aborts the pending document mouseup listener when the trigger unmounts', async () => {
    const onOpenChange = vi.fn();
    const [showTrigger, setShowTrigger] = createSignal(true);

    render(() => (
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <Show when={showTrigger()}>
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        </Show>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    fireEvent.contextMenu(screen.getByTestId('trigger'));

    await act(() => {
      setShowTrigger(false);
    });

    tick(501);
    fireEvent.mouseUp(document.body);
    flush();

    expect(onOpenChange.mock.calls).toHaveLength(1);
    expect(screen.queryByRole('menu')).not.toBe(null);
  });

  describe('prop: disabled', () => {
    it('does not open on right-click when disabled', async () => {
      const onOpenChange = vi.fn();

      render(() => (
        <ContextMenu.Root disabled onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup data-testid="popup" />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.contextMenu(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup')).toBe(null);
      expect(onOpenChange.mock.calls.length).toBe(0);
    });

    it('does not block the native context menu when disabled', async () => {
      render(() => (
        <ContextMenu.Root disabled>
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup data-testid="popup" />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

      await act(() => {
        trigger.dispatchEvent(event);
      });

      expect(event.defaultPrevented).toBe(false);
    });
  });

  it('blocks native context menus on both internal and external backdrops', async () => {
    render(() => (
      <ContextMenu.Root defaultOpen>
        <ContextMenu.Trigger>Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Backdrop data-testid="backdrop" />
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));
    await flushMicrotasks();

    const internalBackdrop = document.querySelector(
      '[data-base-ui-portal] > [data-base-ui-inert][role="presentation"]',
    )!;
    const externalBackdrop = screen.getByTestId('backdrop');
    const internalEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const externalEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const outsideEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    internalBackdrop.dispatchEvent(internalEvent);
    externalBackdrop.dispatchEvent(externalEvent);
    document.body.dispatchEvent(outsideEvent);

    expect(internalEvent.defaultPrevented).toBe(true);
    expect(externalEvent.defaultPrevented).toBe(true);
    expect(outsideEvent.defaultPrevented).toBe(false);
  });

  it('blocks native context menus in a portal mounted inside the trigger DOM subtree', async () => {
    const [container, setContainer] = createSignal<HTMLDivElement | null>(null);

    render(() => (
      <ContextMenu.Root defaultOpen>
        <ContextMenu.Trigger>
          Right click me
          <div ref={setContainer} />
        </ContextMenu.Trigger>
        <ContextMenu.Portal container={container}>
          <ContextMenu.Positioner>
            <ContextMenu.Popup data-testid="popup" />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));
    await flushMicrotasks();

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    screen.getByTestId('popup').dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('blocks the native context menu when onContextMenu skips the Base UI handler', async () => {
    render(() => (
      <ContextMenu.Root>
        <ContextMenu.Trigger
          data-testid="trigger"
          onContextMenu={(event) => event.preventBaseUIHandler()}
        >
          Right click me
        </ContextMenu.Trigger>
      </ContextMenu.Root>
    ));
    await flushMicrotasks();

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    screen.getByTestId('trigger').dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  // jsdom has no `Touch` constructor; plain touch-like objects stand in for it.
  describe('long press', () => {
    it('should open menu on long press on touchscreen devices', async () => {
      render(() => (
        <ContextMenu.Root>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      fireEvent.touchStart(trigger, { touches: [touch(trigger, 100, 100)] });

      tick(500);

      expect(screen.queryByRole('menu')).not.toBe(null);
    });

    it('should cancel long press when touch moves beyond threshold', async () => {
      const onOpenChange = vi.fn();

      render(() => (
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      fireEvent.touchStart(trigger, { touches: [touch(trigger, 100, 100)] });
      // Moving more than 10px cancels the long press.
      fireEvent.touchMove(trigger, { touches: [touch(trigger, 120, 100)] });

      tick(500);

      expect(screen.queryByRole('menu')).toBe(null);
      expect(onOpenChange.mock.calls.length).toBe(0);
    });

    it('keeps a pending long press when touch movement stays within the threshold', async () => {
      render(() => (
        <ContextMenu.Root>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.touchStart(trigger, { touches: [touch(trigger, 100, 100)] });
      fireEvent.touchMove(trigger, { touches: [touch(trigger, 105, 105)] });

      tick(500);

      expect(screen.queryByRole('menu')).not.toBe(null);
    });

    it('cancels a pending long press when the touch ends', async () => {
      const onOpenChange = vi.fn();

      render(() => (
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.touchStart(trigger, { touches: [touch(trigger, 100, 100)] });
      fireEvent.touchEnd(trigger);
      tick(500);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('cancels a pending long press when the gesture becomes multi-touch', async () => {
      const onOpenChange = vi.fn();

      render(() => (
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const firstTouch = touch(trigger, 100, 100);
      const touches = [firstTouch, touch(trigger, 120, 100, 1)];

      fireEvent.touchStart(trigger, { touches: [firstTouch] });
      fireEvent.touchMove(trigger, { touches });
      fireEvent.touchMove(trigger, { touches: [firstTouch] });
      tick(500);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).toBe(null);

      fireEvent.touchEnd(trigger);
      fireEvent.touchStart(trigger, { touches: [firstTouch] });
      fireEvent.touchStart(trigger, { touches });
      tick(500);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('delays outside-press dismissal after opening from a long press', async () => {
      render(() => (
        <ContextMenu.Root>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.touchStart(trigger, { touches: [touch(trigger, 100, 100)] });
      tick(500);

      fireEvent.mouseDown(document.body);
      flush();
      expect(screen.queryByRole('menu')).not.toBe(null);

      tick(500);
      fireEvent.mouseDown(document.body);
      flush();
      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('does not open on long press when disabled', async () => {
      const onOpenChange = vi.fn();

      render(() => (
        <ContextMenu.Root disabled onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup data-testid="popup" />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      fireEvent.touchStart(trigger, { touches: [touch(trigger, 100, 100)] });

      tick(500);

      expect(screen.queryByTestId('popup')).toBe(null);
      expect(onOpenChange.mock.calls.length).toBe(0);
    });
  });

  it('should handle nested context menus correctly', async () => {
    render(() => (
      <ContextMenu.Root>
        <ContextMenu.Trigger data-testid="outer-trigger">
          outer
          <ContextMenu.Root>
            <ContextMenu.Trigger>inner</ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Positioner>
                <ContextMenu.Popup data-testid="inner-menu" />
              </ContextMenu.Positioner>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup data-testid="outer-menu" />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    const innerTrigger = screen.getByText('inner');
    const outerTrigger = screen.getByText('outer');

    fireEvent.contextMenu(innerTrigger);
    await flushMicrotasks();

    expect(screen.queryByTestId('inner-menu')).not.toBe(null);
    expect(screen.queryByTestId('outer-menu')).toBe(null);

    fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
    await flushMicrotasks();

    expect(screen.queryByTestId('inner-menu')).toBe(null);

    fireEvent.contextMenu(outerTrigger);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-menu')).not.toBe(null);
    expect(screen.queryByTestId('inner-menu')).toBe(null);
  });
});
