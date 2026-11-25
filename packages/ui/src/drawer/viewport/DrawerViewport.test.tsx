import { describe, expect, it, vi } from 'vitest';
import { Portal, type JSX } from '@solidjs/web';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Drawer } from '..';
import { act, flushMicrotasks, renderWithProps } from '../../dialog/test-utils';

// Browser-only upstream (skipIf(isJSDOM)), not ported:
// - starts a swipe inside a shadow root using real hit testing
// - allows touch gestures on a portaled combobox popup without starting drawer swipe
// - starts a swipe away from the page scroll edge when the body is a scroll container

describe('<Drawer.Viewport />', () => {
  describe('conformance', () => {
    function renderViewport(props: Drawer.Viewport.Props) {
      return render(() => (
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport" {...props}>
              <Drawer.Popup>Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));
    }

    it('forwards the ref', () => {
      let element: HTMLElement | undefined;
      renderViewport({ ref: (el: HTMLElement) => (element = el) });
      expect(element).toBeInstanceOf(window.HTMLDivElement);
      expect(element).toBe(screen.getByTestId('viewport'));
    });

    it('applies class and style (static and state functions)', () => {
      renderViewport({
        class: (state) => (state.open ? 'is-open' : 'is-closed'),
        style: { color: 'red' },
      });
      const viewport = screen.getByTestId('viewport');
      expect(viewport).toHaveClass('is-open');
      expect(viewport.style.color).toBe('red');
    });

    it('supports the render prop', () => {
      render(() => (
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Viewport render={(props) => <section data-testid="viewport" {...props} />}>
              <Drawer.Popup>Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));
      const viewport = screen.getByTestId('viewport');
      expect(viewport.tagName).toBe('SECTION');
      expect(viewport).toHaveAttribute('data-open');
      expect(viewport).toHaveAttribute('role', 'presentation');
    });

    it('does not render the generic nested dialog attribute', () => {
      renderViewport({});
      expect(screen.getByTestId('viewport')).not.toHaveAttribute('data-nested-dialog-open');
    });
  });

  function createTouch(target: EventTarget, point: { clientX: number; clientY: number }) {
    if (typeof Touch === 'function') {
      return new Touch({
        identifier: 1,
        target,
        ...point,
      });
    }

    return point;
  }

  /**
   * jsdom stamps events with integer milliseconds, so a move and its release often share a
   * timestamp and the release velocity reads as 0. Give each event a distinct, advancing stamp
   * (one frame apart) where a test depends on release velocity.
   */
  function mockEventTimeStamps() {
    let now = 1000;
    const stamps = new WeakMap<Event, number>();
    const spy = vi
      .spyOn(Event.prototype, 'timeStamp', 'get')
      .mockImplementation(function getTimeStamp(this: Event) {
        if (!stamps.has(this)) {
          now += 16;
          stamps.set(this, now);
        }
        return stamps.get(this)!;
      });
    return () => spy.mockRestore();
  }

  function createNativeTouchMove(target: EventTarget, point: { clientX: number; clientY: number }) {
    const touchMove = new Event('touchmove', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(touchMove, 'touches', {
      value: [createTouch(target, point)],
      configurable: true,
    });
    return touchMove;
  }

  it('registers the non-passive document touchmove listener only while open', async () => {
    const activeListeners = new Set<EventListenerOrEventListenerObject>();
    const addSpy = vi
      .spyOn(document, 'addEventListener')
      .mockImplementation(function addEventListener(this: Document, type, listener, options) {
        if (type === 'touchmove' && typeof options === 'object' && options.passive === false) {
          activeListeners.add(listener);
        }
        return EventTarget.prototype.addEventListener.call(this, type, listener, options);
      });
    const removeSpy = vi
      .spyOn(document, 'removeEventListener')
      .mockImplementation(function removeEventListener(this: Document, type, listener, options) {
        if (type === 'touchmove') {
          activeListeners.delete(listener);
        }
        return EventTarget.prototype.removeEventListener.call(this, type, listener, options);
      });

    function TestCase(props: { open: boolean }) {
      return (
        <Drawer.Root open={props.open}>
          <Drawer.Portal keepMounted>
            <Drawer.Viewport>
              <Drawer.Popup>Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      );
    }

    try {
      const { setProps } = renderWithProps((props: { open: boolean }) => <TestCase {...props} />, {
        open: false,
      });
      expect(activeListeners.size).toBe(0);

      await setProps({ open: true });
      expect(activeListeners.size).toBe(1);

      await setProps({ open: false });
      expect(activeListeners.size).toBe(0);
    } finally {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });

  it('clears text selection on swipe start', async () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>
                <span data-testid="text">Selectable</span>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const text = screen.getByTestId('text');
    expect(text.firstChild).toBeTruthy();

    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    if (!selection || !text.firstChild) {
      return;
    }

    const range = document.createRange();
    range.setStart(text.firstChild, 0);
    range.setEnd(text.firstChild, 5);
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selection.isCollapsed).toBe(false);

    const popup = screen.getByTestId('popup');
    const viewport = screen.getByTestId('viewport');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(selection.rangeCount).toBe(0);
  });

  it('preserves text selection outside the popup when a swipe starts', async () => {
    render(() => (
      <div>
        <span data-testid="outside-text">Outside selection</span>
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    ));

    const outsideText = screen.getByTestId('outside-text');
    const textNode = outsideText.firstChild;
    const selection = window.getSelection();
    expect(textNode).not.toBeNull();
    expect(selection).not.toBeNull();
    if (!textNode || !selection) {
      return;
    }

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 7);
    selection.removeAllRanges();
    selection.addRange(range);

    const popup = screen.getByTestId('popup');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(screen.getByTestId('viewport'), {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(selection.rangeCount).toBe(1);
    expect(selection.toString()).toBe('Outside');
  });

  it('does not clear text selection on touch swipe start', async () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>
                <span data-testid="text">Selectable</span>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const text = screen.getByTestId('text');
    expect(text.firstChild).toBeTruthy();

    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    if (!selection || !text.firstChild) {
      return;
    }

    const range = document.createRange();
    range.setStart(text.firstChild, 0);
    range.setEnd(text.firstChild, 5);
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selection.isCollapsed).toBe(false);

    const popup = screen.getByTestId('popup');
    const viewport = screen.getByTestId('viewport');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.touchStart(viewport, {
        touches: [
          createTouch(viewport, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(selection.rangeCount).toBe(1);
  });

  it('starts touch swipes from interactive elements', async () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <button type="button" data-testid="button">
                Action
              </button>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const button = screen.getByTestId('button');
    const backdrop = screen.getByTestId('backdrop');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => button;

    try {
      fireEvent.touchStart(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('uses shadow-root hit testing for touch swipe targets', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const originalDocumentElementFromPoint = document.elementFromPoint;
    const originalShadowElementFromPoint = shadowRoot.elementFromPoint;

    try {
      render(() => (
        <Drawer.Root open>
          <Drawer.Portal container={shadowRoot}>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup>
                <div data-testid="target">Target</div>
                <div data-base-ui-swipe-ignore data-testid="ignored">
                  Ignore
                </div>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const target = shadowRoot.querySelector<HTMLElement>('[data-testid="target"]');
      const ignored = shadowRoot.querySelector<HTMLElement>('[data-testid="ignored"]');
      const backdrop = shadowRoot.querySelector<HTMLElement>('[data-testid="backdrop"]');
      expect(target).not.toBeNull();
      expect(ignored).not.toBeNull();
      expect(backdrop).not.toBeNull();
      if (!target || !ignored || !backdrop) {
        return;
      }

      // Returning an in-popup element from the document hit test would start the swipe if the
      // shadow root were not consulted, so this pins the shadow-root lookup rather than the
      // `contains()` rejection that a retargeted host would also trigger.
      document.elementFromPoint = () => target;
      shadowRoot.elementFromPoint = () => ignored;

      fireEvent.touchStart(ignored, {
        touches: [createTouch(ignored, { clientX: 0, clientY: 0 })],
      });

      await flushMicrotasks();

      expect(backdrop).not.toHaveAttribute('data-swiping');

      fireEvent.touchEnd(ignored, {
        changedTouches: [createTouch(ignored, { clientX: 0, clientY: 0 })],
      });
      shadowRoot.elementFromPoint = () => target;

      fireEvent.touchStart(target, {
        touches: [createTouch(target, { clientX: 0, clientY: 0 })],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
    } finally {
      document.elementFromPoint = originalDocumentElementFromPoint;
      shadowRoot.elementFromPoint = originalShadowElementFromPoint;
      host.remove();
    }
  });

  it('clears the backdrop data-swiping attribute when the drawer unmounts mid-swipe', async () => {
    const { unmount } = render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <button type="button" data-testid="button">
                Action
              </button>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const button = screen.getByTestId('button');
    const backdrop = screen.getByTestId('backdrop');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => button;

    try {
      fireEvent.touchStart(button, {
        touches: [createTouch(button, { clientX: 0, clientY: 0 })],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    await act(async () => {
      unmount();
    });

    // The detached node keeps its attributes, so this asserts the cleanup removed
    // `data-swiping` from the backdrop that was mounted while swiping.
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('uses the event target for non-keyboard touch scroll arbitration', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <button type="button" data-testid="button">
                  Action
                </button>
                <div style={{ height: '120px' }} />
              </div>
              <div
                data-testid="other-scroll"
                style={{ 'overflow-y': 'auto', 'max-height': '40px' }}
              >
                <div style={{ height: '120px' }} />
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const button = screen.getByTestId('button');
    const scroll = screen.getByTestId('scroll');
    const otherScroll = screen.getByTestId('other-scroll');
    const backdrop = screen.getByTestId('backdrop');

    Object.defineProperty(scroll, 'scrollHeight', {
      value: 160,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientHeight', {
      value: 40,
      configurable: true,
    });
    scroll.scrollTop = 0;
    Object.defineProperty(otherScroll, 'scrollHeight', {
      value: 160,
      configurable: true,
    });
    Object.defineProperty(otherScroll, 'clientHeight', {
      value: 40,
      configurable: true,
    });
    otherScroll.scrollTop = 40;

    const originalElementFromPoint = document.elementFromPoint;
    let hitTestCount = 0;
    document.elementFromPoint = () => {
      hitTestCount += 1;
      return hitTestCount === 1 ? otherScroll : button;
    };

    try {
      fireEvent.touchStart(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 40,
          }),
        ],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('scrolls instead of swiping when a touch drag starts on an SVG inside scrolled content', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <svg width={20} height={20}>
                  <rect data-testid="rect" width={20} height={20} />
                </svg>
                <div style={{ height: '120px' }} />
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const rect = screen.getByTestId('rect');
    const backdrop = screen.getByTestId('backdrop');

    Object.defineProperty(scroll, 'scrollHeight', {
      value: 160,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientHeight', {
      value: 40,
      configurable: true,
    });
    scroll.scrollTop = 40;

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => rect;

    try {
      fireEvent.touchStart(rect, {
        touches: [createTouch(rect, { clientX: 0, clientY: 0 })],
      });

      const prevented = !fireEvent.touchMove(rect, {
        touches: [createTouch(rect, { clientX: 0, clientY: 40 })],
      });

      await flushMicrotasks();

      expect(prevented).toBe(false);
      expect(backdrop).not.toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not start a mouse drag swipe from an SVG inside scrollable content', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup>
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <svg width={20} height={20}>
                  <rect data-testid="rect" width={20} height={20} />
                </svg>
                <div style={{ height: '120px' }} />
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const scroll = screen.getByTestId('scroll');
    const rect = screen.getByTestId('rect');
    const backdrop = screen.getByTestId('backdrop');

    Object.defineProperty(scroll, 'scrollHeight', {
      value: 160,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientHeight', {
      value: 40,
      configurable: true,
    });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => rect;

    try {
      fireEvent.pointerDown(rect, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 40,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(backdrop).not.toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('dismisses with a touch swipe down that starts on an SVG inside a top-edge scroll container', async () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <svg width={20} height={20}>
                  <rect data-testid="rect" width={20} height={20} />
                </svg>
                <div style={{ height: '120px' }} />
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const rect = screen.getByTestId('rect');
    const backdrop = screen.getByTestId('backdrop');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(scroll, 'scrollHeight', {
      value: 160,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientHeight', {
      value: 40,
      configurable: true,
    });
    scroll.scrollTop = 0;

    Object.defineProperty(popup, 'offsetHeight', {
      value: 200,
      configurable: true,
    });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => rect;

    try {
      fireEvent.touchStart(rect, {
        touches: [createTouch(rect, { clientX: 0, clientY: 0 })],
      });

      fireEvent.touchMove(rect, {
        touches: [createTouch(rect, { clientX: 0, clientY: 140 })],
      });

      expect(backdrop).toHaveAttribute('data-swiping', '');

      fireEvent.touchEnd(rect, {
        changedTouches: [createTouch(rect, { clientX: 0, clientY: 140 })],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'swipe' }),
    );
  });

  it('allows clicks on non-interactive elements without data-base-ui-swipe-ignore', async () => {
    const handleClick = vi.fn();
    const handleOpenChange = vi.fn();

    render(() => (
      <Drawer.Root open onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content>
                <div data-testid="target" onClick={handleClick}>
                  Action
                </div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const target = screen.getByTestId('target');
    const backdrop = screen.getByTestId('backdrop');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => target;

    try {
      fireEvent.touchStart(target, {
        touches: [
          createTouch(target, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });
      fireEvent.pointerDown(target, { pointerType: 'touch' });
      fireEvent.touchEnd(target, {
        changedTouches: [
          createTouch(target, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });
      fireEvent.click(target, { detail: 1 });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).not.toHaveBeenCalled();
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not start touch swipes from elements with data-base-ui-swipe-ignore', async () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Drawer.Root open onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup>
              <Drawer.Content>
                <div data-testid="target" data-base-ui-swipe-ignore>
                  Action
                </div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const target = screen.getByTestId('target');
    const backdrop = screen.getByTestId('backdrop');

    fireEvent.touchStart(target, {
      touches: [
        createTouch(target, {
          clientX: 0,
          clientY: 0,
        }),
      ],
    });

    fireEvent.touchMove(target, {
      touches: [
        createTouch(target, {
          clientX: 0,
          clientY: 40,
        }),
      ],
    });

    fireEvent.touchEnd(target, {
      changedTouches: [
        createTouch(target, {
          clientX: 0,
          clientY: 40,
        }),
      ],
    });

    await flushMicrotasks();

    expect(backdrop).not.toHaveAttribute('data-swiping');
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  describe('data-base-ui-swipe-ignore axis values', () => {
    type Point = { clientX: number; clientY: number };

    async function renderAxisDrawer(
      swipeDirection: 'down' | 'right',
      children: () => JSX.Element,
      handleOpenChange: Drawer.Root.Props['onOpenChange'],
    ) {
      render(() => (
        <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection={swipeDirection}>
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup">{children()}</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));
    }

    function swipe(target: HTMLElement, points: Point[]) {
      const originalElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => target;

      try {
        fireEvent.touchStart(target, {
          touches: [createTouch(target, { clientX: 100, clientY: 100 })],
        });
        return points.map((point) =>
          fireEvent.touchMove(target, {
            touches: [createTouch(target, point)],
          }),
        );
      } finally {
        document.elementFromPoint = originalElementFromPoint;
      }
    }

    function endSwipe(target: HTMLElement, point: Point) {
      fireEvent.touchEnd(target, {
        changedTouches: [createTouch(target, point)],
      });
    }

    it.each([
      ['down', 'y', { clientX: 100, clientY: 140 }],
      ['right', 'x', { clientX: 140, clientY: 100 }],
    ] as const)(
      'ignores %s touch swipes from elements with the drawer axis value "%s"',
      async (swipeDirection, axis, end) => {
        const handleOpenChange = vi.fn();
        await renderAxisDrawer(
          swipeDirection,
          () => (
            <div data-testid="target" data-base-ui-swipe-ignore={axis}>
              Carousel
            </div>
          ),
          handleOpenChange,
        );

        const target = screen.getByTestId('target');
        expect(swipe(target, [end])).toEqual([true]);
        expect(screen.getByTestId('backdrop')).not.toHaveAttribute('data-swiping');

        endSwipe(target, end);
        await flushMicrotasks();

        expect(handleOpenChange).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['down', 'x', { clientX: 103, clientY: 101 }, { clientX: 140, clientY: 104 }],
      ['right', 'y', { clientX: 101, clientY: 103 }, { clientX: 104, clientY: 140 }],
    ] as const)(
      'hands cross-axis drags in %s drawers to elements with the value "%s"',
      async (swipeDirection, axis, ambiguous, crossAxis) => {
        const handleOpenChange = vi.fn();
        await renderAxisDrawer(
          swipeDirection,
          () => (
            <div data-testid="target" data-base-ui-swipe-ignore={axis}>
              Carousel
            </div>
          ),
          handleOpenChange,
        );

        const target = screen.getByTestId('target');
        const popup = screen.getByTestId('popup');
        const handleTargetTouchMove = vi.fn();
        target.addEventListener('touchmove', handleTargetTouchMove);
        expect(swipe(target, [ambiguous, crossAxis])).toEqual([true, true]);
        expect(handleTargetTouchMove).toHaveBeenCalledTimes(2);
        expect(popup.style.getPropertyValue('--drawer-swipe-movement-x')).toBe('0px');
        expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');

        endSwipe(target, crossAxis);
        await flushMicrotasks();

        expect(handleOpenChange).not.toHaveBeenCalled();
      },
    );

    it.each(['marked', 'scrollable'] as const)(
      'does not swipe or settle snap points while a %s cross-axis target handles the drag',
      async (kind) => {
        const handleSnapPointChange = vi.fn();
        render(() => (
          <Drawer.Root open snapPoints={[200, 360]} onSnapPointChange={handleSnapPointChange}>
            <Drawer.Portal>
              <Drawer.Backdrop data-testid="backdrop" />
              <Drawer.Viewport>
                <Drawer.Popup data-testid="popup">
                  <div
                    data-testid="target"
                    data-base-ui-swipe-ignore={kind === 'marked' ? 'x' : undefined}
                    style={kind === 'scrollable' ? { 'overflow-x': 'auto' } : undefined}
                  >
                    Carousel
                  </div>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>
        ));

        const target = screen.getByTestId('target');
        if (kind === 'scrollable') {
          Object.defineProperty(target, 'scrollWidth', {
            value: 400,
            configurable: true,
          });
          Object.defineProperty(target, 'clientWidth', {
            value: 100,
            configurable: true,
          });
        }

        const crossAxis = { clientX: 140, clientY: 104 };
        expect(swipe(target, [{ clientX: 103, clientY: 101 }, crossAxis])).toEqual([true, true]);
        expect(screen.getByTestId('backdrop')).not.toHaveAttribute('data-swiping');
        expect(screen.getByTestId('popup')).not.toHaveAttribute('data-swiping');

        endSwipe(target, crossAxis);
        await flushMicrotasks();

        expect(handleSnapPointChange).not.toHaveBeenCalled();
      },
    );

    it.each([
      [
        'down',
        'x',
        [
          { clientX: 101, clientY: 103 },
          { clientX: 102, clientY: 140 },
          { clientX: 102, clientY: 200 },
        ],
      ],
      [
        'right',
        'y',
        [
          { clientX: 103, clientY: 101 },
          { clientX: 140, clientY: 102 },
          { clientX: 200, clientY: 102 },
        ],
      ],
    ] as const)(
      'still swipes %s drawers from elements with the cross-axis value "%s"',
      async (swipeDirection, axis, points) => {
        const handleOpenChange = vi.fn();
        await renderAxisDrawer(
          swipeDirection,
          () => (
            <div data-testid="target" data-base-ui-swipe-ignore={axis}>
              Carousel
            </div>
          ),
          handleOpenChange,
        );

        const target = screen.getByTestId('target');
        expect(swipe(target, [...points])).toEqual([true, false, false]);

        endSwipe(target, points[2]);
        await flushMicrotasks();

        expect(handleOpenChange).toHaveBeenCalledTimes(1);
        expect(handleOpenChange.mock.calls[0][0]).toBe(false);
        expect(handleOpenChange.mock.calls[0][1].reason).toBe('swipe');
      },
    );

    it('keeps an ancestor that ignores all directions in effect over a nested axis value', async () => {
      const handleOpenChange = vi.fn();
      await renderAxisDrawer(
        'down',
        () => (
          <div data-base-ui-swipe-ignore>
            <div data-testid="target" data-base-ui-swipe-ignore="x">
              Carousel
            </div>
          </div>
        ),
        handleOpenChange,
      );

      const target = screen.getByTestId('target');
      const end = { clientX: 100, clientY: 140 };
      expect(swipe(target, [end])).toEqual([true]);

      endSwipe(target, end);
      await flushMicrotasks();

      expect(handleOpenChange).not.toHaveBeenCalled();
    });
  });

  it('does not prevent native touch scrolling in portaled descendants', async () => {
    const portalContainer = document.createElement('div');
    document.body.append(portalContainer);

    function PortaledPopup() {
      return (
        <Portal mount={portalContainer}>
          <div data-testid="portaled-popup">Portaled popup</div>
        </Portal>
      );
    }

    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content>Content</Drawer.Content>
              <PortaledPopup />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const portaledPopup = screen.getByTestId('portaled-popup');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => portaledPopup;

    try {
      fireEvent.touchStart(portaledPopup, {
        touches: [
          createTouch(portaledPopup, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      const touchMove = createNativeTouchMove(portaledPopup, {
        clientX: 0,
        clientY: 40,
      });
      portaledPopup.dispatchEvent(touchMove);

      expect(touchMove.defaultPrevented).toBe(false);
    } finally {
      document.elementFromPoint = originalElementFromPoint;
      portalContainer.remove();
    }
  });

  it('still allows touch swipes from elements with legacy data-swipe-ignore', async () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup>
              <div data-testid="target" data-swipe-ignore>
                Action
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const target = screen.getByTestId('target');
    const backdrop = screen.getByTestId('backdrop');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => target;

    try {
      fireEvent.touchStart(target, {
        touches: [
          createTouch(target, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(target, {
        touches: [
          createTouch(target, {
            clientX: 0,
            clientY: 40,
          }),
        ],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');

      fireEvent.touchEnd(target, {
        changedTouches: [
          createTouch(target, {
            clientX: 0,
            clientY: 80,
          }),
        ],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('does not start non-touch swipes from Drawer.Content', async () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content>
                <div data-testid="target">Action</div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const target = screen.getByTestId('target');
    const backdrop = screen.getByTestId('backdrop');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => target;

    try {
      fireEvent.pointerDown(target, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(backdrop).not.toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not jump when touch starts outside the popup and then enters it', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>Content</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(popup, 'offsetHeight', {
      value: 200,
      configurable: true,
    });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = (_x, y) => (y < 100 ? viewport : popup);

    try {
      fireEvent.touchStart(viewport, {
        touches: [
          createTouch(viewport, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(viewport, {
        touches: [
          createTouch(viewport, {
            clientX: 0,
            clientY: 120,
          }),
        ],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
      expect(Number.parseFloat(popup.style.getPropertyValue('--drawer-swipe-movement-y'))).toBe(0);
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('dismisses when touch starts outside the popup, then continues swiping down inside it', async () => {
    const handleOpenChange = vi.fn();
    const restoreTimeStamps = mockEventTimeStamps();

    render(() => (
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>Content</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(popup, 'offsetHeight', {
      value: 200,
      configurable: true,
    });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = (_x, y) => (y < 100 ? viewport : popup);

    try {
      fireEvent.touchStart(viewport, {
        touches: [
          createTouch(viewport, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(viewport, {
        touches: [
          createTouch(viewport, {
            clientX: 0,
            clientY: 120,
          }),
        ],
      });

      fireEvent.touchMove(viewport, {
        touches: [
          createTouch(viewport, {
            clientX: 0,
            clientY: 170,
          }),
        ],
      });

      fireEvent.touchEnd(viewport, {
        changedTouches: [
          createTouch(viewport, {
            clientX: 0,
            clientY: 170,
          }),
        ],
      });

      await flushMicrotasks();
    } finally {
      restoreTimeStamps();
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'swipe' }),
    );
  });

  it('treats pen interactions on Drawer.Content as non-touch swipes', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup>
              <Drawer.Content>
                <button type="button" data-testid="button">
                  Action
                </button>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const button = screen.getByTestId('button');
    const backdrop = screen.getByTestId('backdrop');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => button;

    try {
      const pointerDownEvent = new Event('pointerdown', {
        bubbles: true,
        cancelable: true,
      }) as PointerEvent;

      Object.defineProperties(pointerDownEvent, {
        button: { value: 0 },
        buttons: { value: 1 },
        pointerId: { value: 1 },
        pointerType: { value: 'pen' },
        clientX: { value: 0 },
        clientY: { value: 0 },
      });

      fireEvent(button, pointerDownEvent);

      fireEvent.touchStart(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();

      expect(backdrop).not.toHaveAttribute('data-swiping');

      const prevented = fireEvent.touchMove(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 10,
          }),
        ],
      });

      expect(prevented).toBe(true);
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not mark nested drawers as swiping until movement passes the threshold', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Viewport data-testid="parent-viewport">
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open swipeDirection="down">
                <Drawer.Portal>
                  <Drawer.Viewport data-testid="child-viewport">
                    <Drawer.Popup data-testid="child-popup">
                      <button type="button" data-testid="child-button">
                        Action
                      </button>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const parentPopup = screen.getByTestId('parent-popup');
    const childPopup = screen.getByTestId('child-popup');
    const parentViewport = screen.getByTestId('parent-viewport');
    const childViewport = screen.getByTestId('child-viewport');
    const button = screen.getByTestId('child-button');
    Object.defineProperty(childPopup, 'offsetHeight', {
      value: 200,
      configurable: true,
    });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => childPopup;

    try {
      fireEvent.touchStart(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();

      expect(parentViewport).not.toHaveAttribute('data-nested-dialog-open');
      expect(childViewport).not.toHaveAttribute('data-nested-dialog-open');
      expect(parentPopup).not.toHaveAttribute('data-nested-drawer-swiping');

      fireEvent.touchMove(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 5,
          }),
        ],
      });

      fireEvent.touchMove(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 20,
          }),
        ],
      });

      await flushMicrotasks();

      expect(parentPopup).toHaveAttribute('data-nested-drawer-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('clears nested swiping when a nested drawer swipe is reversed before release', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open swipeDirection="down">
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup data-testid="child-popup">
                      <button type="button" data-testid="child-button">
                        Action
                      </button>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const parentPopup = screen.getByTestId('parent-popup');
    const childPopup = screen.getByTestId('child-popup');
    const button = screen.getByTestId('child-button');
    Object.defineProperty(childPopup, 'offsetHeight', {
      value: 200,
      configurable: true,
    });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => childPopup;

    try {
      fireEvent.touchStart(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();

      fireEvent.touchMove(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 5,
          }),
        ],
      });

      fireEvent.touchMove(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 20,
          }),
        ],
      });

      await flushMicrotasks();

      expect(parentPopup).toHaveAttribute('data-nested-drawer-swiping', '');

      fireEvent.touchMove(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();

      expect(parentPopup).not.toHaveAttribute('data-nested-drawer-swiping');
      expect(parentPopup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('prevents touchmove at scroll top when swiping down on scrollable content', async () => {
    const handleTouchMove = vi.fn();

    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <div
                data-testid="scroll"
                onTouchMove={handleTouchMove}
                style={{ 'overflow-y': 'auto', 'max-height': '40px' }}
              >
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    Object.defineProperty(scroll, 'scrollHeight', {
      value: 120,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientHeight', {
      value: 40,
      configurable: true,
    });
    scroll.scrollTop = 0;

    fireEvent.touchStart(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 0,
          clientY: 0,
        }),
      ],
    });

    const prevented = fireEvent.touchMove(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 0,
          clientY: 10,
        }),
      ],
    });

    expect(prevented).toBe(false);
    expect(handleTouchMove).not.toHaveBeenCalled();
  });

  it('prevents touchmove at scroll bottom when swiping up on scrollable content', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="up">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollHeight', {
      value: 120,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientHeight', {
      value: 40,
      configurable: true,
    });
    scroll.scrollTop = 80;

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 20,
          }),
        ],
      });

      const touchMove = createNativeTouchMove(scroll, {
        clientX: 0,
        clientY: 10,
      });

      await act(async () => {
        scroll.dispatchEvent(touchMove);
        await flushMicrotasks();
      });

      expect(touchMove.defaultPrevented).toBe(true);
      expect(backdrop).toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('prevents touchmove when a scrollable ancestor wraps the popup at the top', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
              <Drawer.Popup>
                <Drawer.Content>
                  <span data-testid="item">Scrollable content</span>
                </Drawer.Content>
              </Drawer.Popup>
            </div>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollHeight', {
      value: 120,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientHeight', {
      value: 40,
      configurable: true,
    });
    scroll.scrollTop = 0;

    const item = screen.getByTestId('item');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => item;

    try {
      fireEvent.touchStart(item, {
        touches: [
          createTouch(item, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      const touchMove = createNativeTouchMove(item, {
        clientX: 0,
        clientY: 10,
      });

      await act(async () => {
        item.dispatchEvent(touchMove);
        await flushMicrotasks();
      });

      expect(touchMove.defaultPrevented).toBe(true);
      expect(backdrop).toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('prevents touchmove when there is no scroll container', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>Content</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.touchStart(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      const touchMove = createNativeTouchMove(popup, {
        clientX: 0,
        clientY: 10,
      });

      await act(async () => {
        popup.dispatchEvent(touchMove);
        await flushMicrotasks();
      });

      expect(touchMove.defaultPrevented).toBe(true);
      expect(backdrop).toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not block touchmove on native range inputs', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <input type="range" data-testid="range" />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const range = screen.getByTestId('range');
    const backdrop = screen.getByTestId('backdrop');

    fireEvent.touchStart(range, {
      touches: [
        createTouch(range, {
          clientX: 0,
          clientY: 0,
        }),
      ],
    });

    const dispatched = fireEvent.touchMove(range, {
      touches: [
        createTouch(range, {
          clientX: 20,
          clientY: 0,
        }),
      ],
    });

    await flushMicrotasks();

    expect(dispatched).toBe(true);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not block touchmove on slider thumb range inputs', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              {/* Stand-in for Slider (ported concurrently): the thumb renders a nested range input. */}
              <div>
                <div>
                  <span>
                    <input type="range" role="slider" />
                  </span>
                </div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const sliderInput = screen.getByRole('slider');
    const backdrop = screen.getByTestId('backdrop');

    fireEvent.touchStart(sliderInput, {
      touches: [
        createTouch(sliderInput, {
          clientX: 0,
          clientY: 0,
        }),
      ],
    });

    const dispatched = fireEvent.touchMove(sliderInput, {
      touches: [
        createTouch(sliderInput, {
          clientX: 20,
          clientY: 0,
        }),
      ],
    });

    await flushMicrotasks();

    expect(dispatched).toBe(true);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not start swiping when adjusting input selection handles', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <input data-testid="input" value="Selectable text" />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const input = screen.getByTestId('input') as HTMLInputElement;
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');

    input.focus();
    input.setSelectionRange(0, 5);

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.touchStart(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      expect(backdrop).not.toHaveAttribute('data-swiping');

      const dispatched = fireEvent.touchMove(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 10,
          }),
        ],
      });

      await flushMicrotasks();

      expect(dispatched).toBe(true);
      expect(backdrop).not.toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not start swiping when adjusting textarea selection handles', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <textarea data-testid="textarea" value="Selectable text" />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');

    textarea.focus();
    textarea.setSelectionRange(0, 5);

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.touchStart(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      expect(backdrop).not.toHaveAttribute('data-swiping');

      const dispatched = fireEvent.touchMove(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 10,
          }),
        ],
      });

      await flushMicrotasks();

      expect(dispatched).toBe(true);
      expect(backdrop).not.toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not start swiping when adjusting contenteditable selection handles', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div contenteditable data-testid="editable">
                Selectable text
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const editable = screen.getByTestId('editable');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');
    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    expect(editable.firstChild).toBeTruthy();
    if (!selection || !editable.firstChild) {
      return;
    }

    editable.focus();
    const range = document.createRange();
    range.setStart(editable.firstChild, 0);
    range.setEnd(editable.firstChild, 5);
    selection.removeAllRanges();
    selection.addRange(range);

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.touchStart(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      expect(backdrop).not.toHaveAttribute('data-swiping');

      const dispatched = fireEvent.touchMove(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 10,
          }),
        ],
      });

      await flushMicrotasks();

      expect(dispatched).toBe(true);
      expect(backdrop).not.toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
      selection.removeAllRanges();
    }
  });

  it('does not start swiping when adjusting regular text selection handles', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <span data-testid="text">Selectable text</span>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const text = screen.getByTestId('text');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');
    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    expect(text.firstChild).toBeTruthy();
    if (!selection || !text.firstChild) {
      return;
    }

    const range = document.createRange();
    range.setStart(text.firstChild, 0);
    range.setEnd(text.firstChild, 5);
    selection.removeAllRanges();
    selection.addRange(range);

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.touchStart(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      expect(backdrop).not.toHaveAttribute('data-swiping');

      const dispatched = fireEvent.touchMove(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 10,
          }),
        ],
      });

      await flushMicrotasks();

      expect(dispatched).toBe(true);
      expect(backdrop).not.toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
      selection.removeAllRanges();
    }
  });

  it('allows touchmove when scrolling down from scroll top', async () => {
    const handleTouchMove = vi.fn();

    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <div
                data-testid="scroll"
                onTouchMove={handleTouchMove}
                style={{ 'overflow-y': 'auto', 'max-height': '40px' }}
              >
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    Object.defineProperty(scroll, 'scrollHeight', {
      value: 120,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientHeight', {
      value: 40,
      configurable: true,
    });
    scroll.scrollTop = 0;

    fireEvent.touchStart(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 0,
          clientY: 0,
        }),
      ],
    });

    const prevented = fireEvent.touchMove(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 0,
          clientY: -10,
        }),
      ],
    });

    expect(prevented).toBe(true);
    expect(handleTouchMove).toHaveBeenCalledTimes(1);
  });

  it('does not start an opposite-direction swipe from scroll bottom for down drawers with snap points', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down" snapPoints={['100px', 1]}>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollHeight', {
      value: 120,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientHeight', {
      value: 40,
      configurable: true,
    });
    scroll.scrollTop = 80;

    fireEvent.touchStart(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 0,
          clientY: 40,
        }),
      ],
    });

    const moveAllowed = fireEvent.touchMove(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 0,
          clientY: 20,
        }),
      ],
    });

    await flushMicrotasks();

    expect(moveAllowed).toBe(true);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('keeps damped snap-point styles when a duplicate-coordinate pointermove arrives', async () => {
    render(() => (
      <Drawer.Root open snapPoints={['100px', 1]}>
        <Drawer.Portal>
          <Drawer.Backdrop />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 100,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      // The first move only re-anchors the drag origin.
      fireEvent.pointerMove(viewport, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 100,
        pointerType: 'mouse',
      });

      // Drag upward past the fully-open edge; the snap-point progress handler replaces the raw
      // frozen transform with square-root-damped movement on every processed move.
      fireEvent.pointerMove(viewport, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(popup.style.transform).toBe('');
      const dampedMovementY = popup.style.getPropertyValue('--drawer-swipe-movement-y');
      expect(dampedMovementY).toBe('-10px');

      // A cursor pinned at a screen edge during an off-screen drag produces
      // duplicate-coordinate moves. They must not reinstate the raw frozen transform, which
      // would jump the popup to the undamped position.
      fireEvent.pointerMove(viewport, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(popup.style.transform).toBe('');
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe(dampedMovementY);

      // Only vertical directions are enabled, so horizontal jitter while the vertical
      // position is pinned leaves the drag offset unchanged. Such moves must not reinstate
      // the raw frozen transform either.
      fireEvent.pointerMove(viewport, {
        pointerId: 1,
        buttons: 1,
        clientX: 5,
        clientY: 0,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(popup.style.transform).toBe('');
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe(dampedMovementY);
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not start an opposite-direction swipe from scroll right edge for right drawers', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="right">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ 'overflow-x': 'auto', 'max-width': '40px' }}>
                <div style={{ width: '120px', height: '40px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollWidth', {
      value: 120,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientWidth', {
      value: 40,
      configurable: true,
    });
    scroll.scrollLeft = 80;

    fireEvent.touchStart(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 40,
          clientY: 0,
        }),
      ],
    });

    const moveAllowed = fireEvent.touchMove(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 20,
          clientY: 0,
        }),
      ],
    });

    await flushMicrotasks();

    expect(moveAllowed).toBe(true);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('starts swipe-to-dismiss after a scrollable container reaches the dismiss edge', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollHeight', {
      value: 120,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientHeight', {
      value: 40,
      configurable: true,
    });
    scroll.scrollTop = 30;

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 30,
          }),
        ],
      });

      const firstMovePrevented = fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 40,
          }),
        ],
      });

      expect(firstMovePrevented).toBe(true);
      expect(backdrop).not.toHaveAttribute('data-swiping');

      scroll.scrollTop = 0;

      const secondMovePrevented = fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 50,
          }),
        ],
      });

      expect(secondMovePrevented).toBe(false);

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('dismisses from a top-edge scroll container with a touch swipe down', async () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(scroll, 'scrollHeight', {
      value: 120,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientHeight', {
      value: 40,
      configurable: true,
    });
    scroll.scrollTop = 0;

    Object.defineProperty(popup, 'offsetHeight', {
      value: 200,
      configurable: true,
    });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 140,
          }),
        ],
      });

      expect(backdrop).toHaveAttribute('data-swiping', '');

      fireEvent.touchEnd(scroll, {
        changedTouches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 140,
          }),
        ],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'swipe' }),
    );
  });

  it('dismisses from a bottom-edge scroll container with a touch swipe up', async () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="up">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(scroll, 'scrollHeight', {
      value: 120,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientHeight', {
      value: 40,
      configurable: true,
    });
    scroll.scrollTop = 80;

    Object.defineProperty(popup, 'offsetHeight', {
      value: 200,
      configurable: true,
    });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 140,
          }),
        ],
      });

      fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      expect(backdrop).toHaveAttribute('data-swiping', '');

      fireEvent.touchEnd(scroll, {
        changedTouches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'swipe' }),
    );
  });

  it('dismisses from a left-edge horizontal scroll container with a touch swipe right', async () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="right">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div data-testid="scroll" style={{ 'overflow-x': 'auto', 'max-width': '40px' }}>
                <div style={{ width: '120px', height: '40px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(scroll, 'scrollWidth', {
      value: 120,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientWidth', {
      value: 40,
      configurable: true,
    });
    scroll.scrollLeft = 0;

    Object.defineProperty(popup, 'offsetWidth', {
      value: 200,
      configurable: true,
    });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 140,
            clientY: 0,
          }),
        ],
      });

      expect(backdrop).toHaveAttribute('data-swiping', '');

      fireEvent.touchEnd(scroll, {
        changedTouches: [
          createTouch(scroll, {
            clientX: 140,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'swipe' }),
    );
  });

  it('dismisses from a right-edge horizontal scroll container with a touch swipe left', async () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="left">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div data-testid="scroll" style={{ 'overflow-x': 'auto', 'max-width': '40px' }}>
                <div style={{ width: '120px', height: '40px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(scroll, 'scrollWidth', {
      value: 120,
      configurable: true,
    });
    Object.defineProperty(scroll, 'clientWidth', {
      value: 40,
      configurable: true,
    });
    scroll.scrollLeft = 80;

    Object.defineProperty(popup, 'offsetWidth', {
      value: 200,
      configurable: true,
    });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 140,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      expect(backdrop).toHaveAttribute('data-swiping', '');

      fireEvent.touchEnd(scroll, {
        changedTouches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'swipe' }),
    );
  });
});
