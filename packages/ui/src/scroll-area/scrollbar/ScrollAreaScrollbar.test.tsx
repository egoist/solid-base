import { flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { ScrollArea } from '..';
import { DirectionProvider } from '../../direction-provider';
import type { TextDirection } from '../../internals/direction-context/DirectionContext';
import { SCROLL_TIMEOUT } from '../constants';
import { mockElementSize, mockPointerCapture, mockViewportMetrics } from '../test-utils';

describe('<ScrollArea.Scrollbar />', () => {
  it('renders a div with class, style, ref and render support', () => {
    let refElement: HTMLElement | undefined;
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Scrollbar
          keepMounted
          data-testid="scrollbar"
          class={(state) => `scrollbar-${state.orientation}`}
          style={{ color: 'red' }}
          ref={(element) => {
            refElement = element;
          }}
        />
        <ScrollArea.Scrollbar
          keepMounted
          orientation="horizontal"
          render="section"
          data-testid="section"
        />
      </ScrollArea.Root>
    ));
    const scrollbar = screen.getByTestId('scrollbar');
    expect(scrollbar.tagName).toBe('DIV');
    expect(scrollbar).toHaveClass('scrollbar-vertical');
    expect(scrollbar.style.color).toBe('red');
    expect(scrollbar.style.position).toBe('absolute');
    expect(scrollbar.getAttribute('data-id')).toMatch(/^base-ui-.+-scrollbar$/);
    expect(refElement).toBe(scrollbar);
    expect(screen.getByTestId('section').tagName).toBe('SECTION');
  });

  it('is not rendered while the viewport does not overflow', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport />
        <ScrollArea.Scrollbar data-testid="scrollbar" />
      </ScrollArea.Root>
    ));

    expect(screen.queryByTestId('scrollbar')).toBe(null);
  });

  it('is rendered once the viewport overflows', async () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport ref={(el) => mockViewportMetrics(el, { scrollWidth: 200 })} />
        <ScrollArea.Scrollbar data-testid="vertical" />
        <ScrollArea.Scrollbar orientation="horizontal" data-testid="horizontal" />
      </ScrollArea.Root>
    ));

    await waitFor(() => expect(screen.getByTestId('vertical')).toBeInTheDocument());
    expect(screen.queryByTestId('horizontal')).toBe(null);
  });

  it('is hidden from the accessibility tree by default', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Scrollbar keepMounted data-testid="scrollbar" />
      </ScrollArea.Root>
    ));

    expect(screen.getByTestId('scrollbar')).toHaveAttribute('aria-hidden', 'true');
  });

  it('allows overriding aria-hidden', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Scrollbar keepMounted data-testid="scrollbar" aria-hidden={undefined} />
      </ScrollArea.Root>
    ));

    expect(screen.getByTestId('scrollbar')).not.toHaveAttribute('aria-hidden');
  });

  it('sets the orientation data attribute', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Scrollbar orientation="horizontal" keepMounted data-testid="scrollbar" />
      </ScrollArea.Root>
    ));

    expect(screen.getByTestId('scrollbar')).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('supports a custom scrollbar renderer that does not forward its ref', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport />
        <ScrollArea.Scrollbar
          data-testid="scrollbar"
          keepMounted
          render={(props) => {
            const { ref: _ref, ...rest } = props;
            return <div {...rest} />;
          }}
        />
      </ScrollArea.Root>
    ));

    expect(screen.getByTestId('scrollbar')).toBeInTheDocument();
  });

  describe('data-scrolling attribute', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('adds [data-scrolling] attribute when viewport is scrolled in the correct direction', () => {
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Viewport data-testid="viewport">
            <div />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical" keepMounted />
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="horizontal" keepMounted />
          <ScrollArea.Corner />
        </ScrollArea.Root>
      ));

      const verticalScrollbar = screen.getByTestId('vertical');
      const horizontalScrollbar = screen.getByTestId('horizontal');
      const viewport = screen.getByTestId('viewport');

      expect(verticalScrollbar).not.toHaveAttribute('data-scrolling');
      expect(horizontalScrollbar).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(verticalScrollbar).toHaveAttribute('data-scrolling', '');
      expect(horizontalScrollbar).not.toHaveAttribute('data-scrolling');

      vi.advanceTimersByTime(SCROLL_TIMEOUT - 1);
      flush();

      expect(verticalScrollbar).toHaveAttribute('data-scrolling', '');
      expect(horizontalScrollbar).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollLeft: 1 } });
      flush();

      vi.advanceTimersByTime(1); // vertical just finished
      flush();

      expect(verticalScrollbar).not.toHaveAttribute('data-scrolling');
      expect(horizontalScrollbar).toHaveAttribute('data-scrolling');

      vi.advanceTimersByTime(SCROLL_TIMEOUT - 2); // already ticked 1ms above
      flush();

      expect(verticalScrollbar).not.toHaveAttribute('data-scrolling');
      expect(horizontalScrollbar).toHaveAttribute('data-scrolling');

      vi.advanceTimersByTime(1);
      flush();

      expect(verticalScrollbar).not.toHaveAttribute('data-scrolling');
      expect(horizontalScrollbar).not.toHaveAttribute('data-scrolling');
    });
  });

  describe('data-hovering attribute', () => {
    it('detects a viewport that is already hovered on mount', async () => {
      const originalMatches = Element.prototype.matches;
      const matchesSpy = vi
        .spyOn(Element.prototype, 'matches')
        .mockImplementation(function matches(this: Element, selector: string) {
          if (selector === ':hover' && (this as HTMLElement).dataset.testid === 'viewport') {
            return true;
          }
          return originalMatches.call(this, selector);
        });

      try {
        render(() => (
          <ScrollArea.Root>
            <ScrollArea.Viewport data-testid="viewport" />
            <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted />
          </ScrollArea.Root>
        ));

        await waitFor(() =>
          expect(screen.getByTestId('scrollbar')).toHaveAttribute('data-hovering'),
        );
      } finally {
        matchesSpy.mockRestore();
      }
    });

    it('does not enter hover state for touch pointers', () => {
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Viewport data-testid="viewport" />
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted />
        </ScrollArea.Root>
      ));

      fireEvent.pointerMove(screen.getByTestId('viewport'), { pointerType: 'touch' });
      flush();

      expect(screen.getByTestId('scrollbar')).not.toHaveAttribute('data-hovering');
    });

    // Upstream dispatches `pointerover` because React emulates `onPointerEnter` with it; Solid
    // listens to the native events, so this uses `pointerenter`/`pointermove` on the root.
    it('toggles [data-hovering] as the pointer enters and leaves the root', () => {
      render(() => (
        <ScrollArea.Root data-testid="root">
          <ScrollArea.Viewport data-testid="viewport" />
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical" keepMounted />
        </ScrollArea.Root>
      ));

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');
      const verticalScrollbar = screen.getByTestId('vertical');

      expect(verticalScrollbar).not.toHaveAttribute('data-hovering');

      fireEvent.pointerEnter(root, { pointerType: 'mouse' });
      flush();
      expect(verticalScrollbar).toHaveAttribute('data-hovering', '');

      fireEvent.pointerLeave(root, { pointerType: 'mouse' });
      flush();
      expect(verticalScrollbar).not.toHaveAttribute('data-hovering');

      fireEvent.pointerMove(viewport, { pointerType: 'mouse' });
      flush();
      expect(verticalScrollbar).toHaveAttribute('data-hovering', '');
    });
  });

  describe('track pointer down', () => {
    it('ignores non-primary pointer presses', () => {
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ 'scroll-snap-type': 'y mandatory' }}
          />
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));

      const viewport = screen.getByTestId('viewport');
      fireEvent.pointerDown(screen.getByTestId('scrollbar'), {
        button: 2,
        clientY: 100,
        pointerId: 1,
      });

      expect(viewport.scrollTop).toBe(0);
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('handles a track press when no viewport is mounted', () => {
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));

      const scrollbar = screen.getByTestId('scrollbar');
      fireEvent.pointerDown(scrollbar, { button: 0, clientY: 100, pointerId: 1 });
      flush();

      expect(scrollbar).not.toHaveAttribute('data-scrolling');
    });

    it('does not start a track gesture without a thumb', () => {
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ 'scroll-snap-type': 'y mandatory' }}
          />
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted />
        </ScrollArea.Root>
      ));

      const viewport = screen.getByTestId('viewport');
      fireEvent.pointerDown(screen.getByTestId('scrollbar'), {
        button: 0,
        clientY: 100,
        pointerId: 1,
      });

      expect(viewport.scrollTop).toBe(0);
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    function renderTrack() {
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Viewport data-testid="viewport">
            <div />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical" keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));

      const viewport = screen.getByTestId('viewport');
      const verticalScrollbar = screen.getByTestId('vertical');
      const thumb = screen.getByTestId('thumb');

      mockViewportMetrics(viewport, { clientHeight: 200, scrollHeight: 1000 });
      mockElementSize(verticalScrollbar, { offsetHeight: 200 });
      Object.defineProperty(verticalScrollbar, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ top: 0, left: 0 }),
      });
      mockElementSize(thumb, { offsetHeight: 40 });

      return { viewport, verticalScrollbar, thumb };
    }

    // Solid's event delegation walks the composed path, so the thumb's own handler sees this
    // press as a thumb press, while the track handler must ignore it.
    it('ignores thumb clicks when the native path differs from the target', () => {
      const { viewport, verticalScrollbar, thumb } = renderTrack();
      mockPointerCapture(thumb);

      const event = new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientY: 160,
      });

      Object.defineProperty(event, 'composedPath', {
        configurable: true,
        value: () => [thumb, verticalScrollbar],
      });

      fireEvent(verticalScrollbar, event);

      expect(viewport.scrollTop).toBe(0);
    });

    it('scrolls to the pressed position and marks the scroll area as scrolling', () => {
      const { viewport, verticalScrollbar, thumb } = renderTrack();
      Object.defineProperty(thumb, 'setPointerCapture', { configurable: true, value: () => {} });

      fireEvent.pointerDown(verticalScrollbar, { button: 0, clientY: 160, pointerId: 1 });
      flush();

      // (160 - 40 / 2) / (200 - 40) of the 800px scroll range.
      expect(viewport.scrollTop).toBe(700);
      expect(verticalScrollbar).toHaveAttribute('data-scrolling');
    });

    it('clears track drag state on pointer cancel', () => {
      const { viewport, verticalScrollbar, thumb } = renderTrack();
      Object.defineProperties(thumb, {
        setPointerCapture: { configurable: true, value: () => {} },
        hasPointerCapture: { configurable: true, value: () => false },
      });

      fireEvent.pointerDown(verticalScrollbar, { button: 0, clientY: 160, pointerId: 1 });

      const scrollTopAfterTrackPress = viewport.scrollTop;

      fireEvent.pointerCancel(verticalScrollbar, { pointerId: 1 });
      fireEvent.pointerMove(thumb, { clientY: 180, pointerId: 1, buttons: 1 });

      expect(viewport.scrollTop).toBe(scrollTopAfterTrackPress);
    });

    it('does not jump the scroll when the thumb fills the track', () => {
      const { viewport, verticalScrollbar, thumb } = renderTrack();
      mockElementSize(thumb, { offsetHeight: 200 });

      fireEvent.pointerDown(verticalScrollbar, { button: 0, clientY: 160, pointerId: 1 });

      expect(viewport.scrollTop).toBe(0);
    });
  });

  // jsdom doesn't implement the focus side of a mouse press, so these assert the
  // cancellation that suppresses it rather than the resulting `activeElement`.
  describe('track mouse down', () => {
    function renderScrollbarWithThumb() {
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Viewport data-testid="viewport" />
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));
    }

    // Native scrollbars keep focus for every button, not just the primary one.
    it.each([
      { name: 'primary', button: 0 },
      { name: 'middle', button: 1 },
      { name: 'secondary', button: 2 },
    ])('cancels a $name press on the track so focus stays on the active element', ({ button }) => {
      renderScrollbarWithThumb();

      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button });
      screen.getByTestId('scrollbar').dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it('cancels the press on the thumb so focus stays on the active element', () => {
      renderScrollbarWithThumb();

      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
      screen.getByTestId('thumb').dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });
  });

  // Skipped: the track click by axis, scroll snap and non-positive thumb offset tests rely on
  // real layout. The RTL inversion of track clicks is covered with mocked metrics below.
  it('scrolls into the negative RTL range when clicking a horizontal RTL track', () => {
    render(() => (
      <DirectionProvider direction="rtl">
        <ScrollArea.Root>
          <ScrollArea.Viewport data-testid="viewport" />
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="horizontal" keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </DirectionProvider>
    ));

    const viewport = screen.getByTestId('viewport');
    const scrollbar = screen.getByTestId('horizontal');
    const thumb = screen.getByTestId('thumb');
    mockViewportMetrics(viewport, { clientWidth: 200, scrollWidth: 1000 });
    mockElementSize(scrollbar, { offsetWidth: 200 });
    Object.defineProperty(scrollbar, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 0, left: 0 }),
    });
    mockElementSize(thumb, { offsetWidth: 40 });
    mockPointerCapture(thumb);

    // Pressing the inline start (right) end of the track scrolls to the start of the content.
    fireEvent.pointerDown(scrollbar, { button: 0, clientX: 180, pointerId: 1 });
    expect(viewport.scrollLeft).toBe(-0);

    // Pressing the left end scrolls to the inline end (negative range in RTL).
    fireEvent.pointerUp(scrollbar, { pointerId: 1 });
    fireEvent.pointerDown(scrollbar, { button: 0, clientX: 20, pointerId: 2 });
    expect(viewport.scrollLeft).toBe(-800);
  });

  describe('wheel', () => {
    function renderWheelTest(
      props: {
        direction?: TextDirection;
        orientation?: 'horizontal' | 'vertical';
        scrollLeft?: number;
        scrollTop?: number;
      } = {},
    ) {
      const { direction = 'ltr', orientation = 'horizontal', scrollLeft = 0, scrollTop = 0 } = props;

      render(() => (
        <DirectionProvider direction={direction}>
          <ScrollArea.Root>
            <ScrollArea.Viewport data-testid="viewport">
              <div />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation={orientation} data-testid="scrollbar" keepMounted />
          </ScrollArea.Root>
        </DirectionProvider>
      ));

      const viewport = screen.getByTestId('viewport');
      const scrollbar = screen.getByTestId('scrollbar');

      mockViewportMetrics(viewport, { scrollLeft, scrollTop });

      return { viewport, scrollbar };
    }

    it('allows horizontal scrolling away from the RTL start edge', () => {
      const { viewport, scrollbar } = renderWheelTest({ direction: 'rtl' });

      fireEvent.wheel(scrollbar, { deltaX: -50 });

      expect(viewport.scrollLeft).toBe(-50);
    });

    it('clamps horizontal LTR wheel scrolling at both edges', () => {
      const { viewport, scrollbar } = renderWheelTest({ direction: 'ltr' });

      fireEvent.wheel(scrollbar, { deltaX: -50 });
      expect(viewport.scrollLeft).toBe(0);

      viewport.scrollLeft = 790;
      fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(800);

      fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(800);
    });

    it('clamps horizontal RTL wheel scrolling at both edges', () => {
      const { viewport, scrollbar } = renderWheelTest({ direction: 'rtl' });

      fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(0);

      viewport.scrollLeft = -100;
      fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(-50);

      viewport.scrollLeft = -790;
      fireEvent.wheel(scrollbar, { deltaX: -50 });
      expect(viewport.scrollLeft).toBe(-800);

      fireEvent.wheel(scrollbar, { deltaX: -50 });
      expect(viewport.scrollLeft).toBe(-800);

      viewport.scrollLeft = -10;
      fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(0);
    });

    it('clamps vertical wheel scrolling at both edges', () => {
      const { viewport, scrollbar } = renderWheelTest({ orientation: 'vertical' });

      fireEvent.wheel(scrollbar, { deltaY: -50 });
      expect(viewport.scrollTop).toBe(0);

      viewport.scrollTop = 790;
      fireEvent.wheel(scrollbar, { deltaY: 50 });
      expect(viewport.scrollTop).toBe(800);

      fireEvent.wheel(scrollbar, { deltaY: 50 });
      expect(viewport.scrollTop).toBe(800);
    });

    it('preventDefaults only when it consumes the scroll, allowing chaining at edges', () => {
      const { viewport, scrollbar } = renderWheelTest({ orientation: 'vertical' });

      // Mid-range: the wheel scroll is consumed, so the event is cancelled.
      viewport.scrollTop = 400;
      // `fireEvent` returns the `dispatchEvent` result: `false` when `preventDefault` was called.
      expect(fireEvent.wheel(scrollbar, { deltaY: 50 })).toBe(false);

      // At the end edge scrolling further: not consumed, so the event chains to the parent/page.
      viewport.scrollTop = 800;
      expect(fireEvent.wheel(scrollbar, { deltaY: 50 })).toBe(true);

      // At the start edge scrolling further backward, the event chains too.
      viewport.scrollTop = 0;
      expect(fireEvent.wheel(scrollbar, { deltaY: -50 })).toBe(true);
    });

    it('ignores zero-delta wheel events', () => {
      const { viewport, scrollbar } = renderWheelTest({
        orientation: 'vertical',
        scrollTop: 400,
      });

      expect(fireEvent.wheel(scrollbar, { deltaY: 0 })).toBe(true);
      flush();
      expect(viewport.scrollTop).toBe(400);
      expect(scrollbar).not.toHaveAttribute('data-scrolling');
    });

    it('does not intercept browser zoom gestures', () => {
      const { viewport, scrollbar } = renderWheelTest({
        orientation: 'vertical',
        scrollTop: 400,
      });

      expect(fireEvent.wheel(scrollbar, { ctrlKey: true, deltaY: 50 })).toBe(true);
      flush();
      expect(viewport.scrollTop).toBe(400);
      expect(scrollbar).not.toHaveAttribute('data-scrolling');
    });

    it('marks the scroll area as scrolling when wheeling over the scrollbar', () => {
      const { scrollbar } = renderWheelTest({ orientation: 'vertical' });

      fireEvent.wheel(scrollbar, { deltaY: 50 });
      flush();

      expect(scrollbar).toHaveAttribute('data-scrolling');
    });

    it('marks the scroll area as scrolling when wheeling over the horizontal scrollbar', () => {
      const { scrollbar } = renderWheelTest({ orientation: 'horizontal' });

      fireEvent.wheel(scrollbar, { deltaX: 50 });
      flush();

      expect(scrollbar).toHaveAttribute('data-scrolling');
    });

    it('does not mark the scroll area as scrolling when chaining at an edge', () => {
      const { viewport, scrollbar } = renderWheelTest({ orientation: 'vertical' });

      // At the end edge scrolling further chains to the page without consuming the
      // scroll, so the area must not be marked as scrolling.
      viewport.scrollTop = 800;
      fireEvent.wheel(scrollbar, { deltaY: 50 });
      flush();

      expect(scrollbar).not.toHaveAttribute('data-scrolling');
    });

    it('registers after the horizontal scrollbar becomes visible', async () => {
      render(() => (
        <DirectionProvider direction="rtl">
          <ScrollArea.Root>
            <ScrollArea.Viewport
              data-testid="viewport"
              ref={(el) => mockViewportMetrics(el, { scrollHeight: 200 })}
            />
            <ScrollArea.Scrollbar orientation="horizontal" data-testid="horizontal">
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </DirectionProvider>
      ));

      const horizontalScrollbar = await screen.findByTestId('horizontal');
      await waitFor(() => expect(horizontalScrollbar).toHaveAttribute('data-has-overflow-x'));

      fireEvent.wheel(horizontalScrollbar, { deltaX: -50 });

      expect(screen.getByTestId('viewport').scrollLeft).toBe(-50);
    });
  });
});
