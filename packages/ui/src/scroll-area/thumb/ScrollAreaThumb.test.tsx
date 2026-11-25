import { Errored, createSignal, flush, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { ScrollArea } from '..';
import { DirectionProvider } from '../../direction-provider';
import { SCROLL_TIMEOUT } from '../constants';
import { mockElementSize, mockPointerCapture, mockViewportMetrics } from '../test-utils';

describe('<ScrollArea.Thumb />', () => {
  it('renders a div with class, style, ref and render support', () => {
    let refElement: HTMLElement | undefined;
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Scrollbar keepMounted>
          <ScrollArea.Thumb
            data-testid="thumb"
            class={(state) => `thumb-${state.orientation}`}
            style={{ color: 'red' }}
            ref={(element) => {
              refElement = element;
            }}
          />
        </ScrollArea.Scrollbar>
        <ScrollArea.Scrollbar keepMounted orientation="horizontal">
          <ScrollArea.Thumb render="span" data-testid="span" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));
    const thumb = screen.getByTestId('thumb');
    expect(thumb.tagName).toBe('DIV');
    expect(thumb).toHaveClass('thumb-vertical');
    expect(thumb).toHaveAttribute('data-orientation', 'vertical');
    expect(thumb.style.color).toBe('red');
    expect(thumb.style.height).toBe('var(--scroll-area-thumb-height)');
    expect(refElement).toBe(thumb);
    const span = screen.getByTestId('span');
    expect(span.tagName).toBe('SPAN');
    expect(span.style.width).toBe('var(--scroll-area-thumb-width)');
  });

  it('throws a descriptive error when rendered outside <ScrollArea.Scrollbar>', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <ScrollArea.Root>
          <ScrollArea.Thumb />
        </ScrollArea.Root>
      </Errored>
    ));
    flush();

    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: ScrollAreaScrollbarContext is missing. ScrollAreaScrollbar parts must be placed within <ScrollArea.Scrollbar>.',
    );
  });

  it('handles a thumb gesture when no viewport is mounted', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Scrollbar keepMounted>
          <ScrollArea.Thumb data-testid="thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));

    const thumb = screen.getByTestId('thumb');
    Object.defineProperties(thumb, {
      setPointerCapture: { configurable: true, value: () => {} },
      hasPointerCapture: { configurable: true, value: () => false },
    });

    fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientY: 20, pointerId: 1, buttons: 1 });
    flush();

    // Without a viewport there is nothing to scroll, so the drag never consumes the move.
    expect(thumb).not.toHaveAttribute('data-scrolling');
    expect(thumb.style.transform).toBe('');

    fireEvent.pointerUp(thumb, { pointerId: 1 });
    flush();
    expect(thumb).not.toHaveAttribute('data-scrolling');
  });

  it('handles the scrollbar unmounting from a user pointer-move callback', () => {
    const [mounted, setMounted] = createSignal(true);

    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport data-testid="viewport" />
        <Show when={mounted()}>
          <ScrollArea.Scrollbar keepMounted data-testid="scrollbar">
            <ScrollArea.Thumb
              data-testid="thumb"
              onPointerMove={() => {
                setMounted(false);
                flush();
              }}
            />
          </ScrollArea.Scrollbar>
        </Show>
      </ScrollArea.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const thumb = screen.getByTestId('thumb');
    Object.defineProperty(thumb, 'setPointerCapture', { configurable: true, value: () => {} });

    fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    expect(() =>
      fireEvent.pointerMove(thumb, { clientY: 20, pointerId: 1, buttons: 1 }),
    ).not.toThrow();

    expect(screen.queryByTestId('scrollbar')).toBe(null);
    expect(viewport.scrollTop).toBe(0);
  });

  it('handles the viewport unmounting from a user pointer-up callback', () => {
    const [mounted, setMounted] = createSignal(true);

    render(() => (
      <ScrollArea.Root>
        <Show when={mounted()}>
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ 'scroll-snap-type': 'y mandatory' }}
          />
        </Show>
        <ScrollArea.Scrollbar keepMounted>
          <ScrollArea.Thumb
            data-testid="thumb"
            onPointerUp={() => {
              setMounted(false);
              flush();
            }}
          />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const thumb = screen.getByTestId('thumb');
    Object.defineProperties(thumb, {
      setPointerCapture: { configurable: true, value: () => {} },
      hasPointerCapture: { configurable: true, value: () => false },
    });

    fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    expect(viewport.style.scrollSnapType).toBe('none');

    expect(() => fireEvent.pointerUp(thumb, { pointerId: 1 })).not.toThrow();
    expect(screen.queryByTestId('viewport')).toBe(null);
  });

  function renderDraggable(orientation: 'vertical' | 'horizontal', direction: 'ltr' | 'rtl' = 'ltr') {
    render(() => (
      <DirectionProvider direction={direction}>
        <ScrollArea.Root>
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ 'scroll-snap-type': 'y mandatory' }}
          />
          <ScrollArea.Scrollbar orientation={orientation} data-testid="scrollbar" keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </DirectionProvider>
    ));

    const viewport = screen.getByTestId('viewport');
    const scrollbar = screen.getByTestId('scrollbar');
    const thumb = screen.getByTestId('thumb');

    mockViewportMetrics(viewport);
    mockElementSize(scrollbar, { offsetHeight: 200, offsetWidth: 200 });
    mockElementSize(thumb, { offsetHeight: 40, offsetWidth: 40 });

    return { viewport, scrollbar, thumb };
  }

  it('scrolls the viewport while dragging the thumb', () => {
    const { viewport, scrollbar, thumb } = renderDraggable('vertical');
    mockPointerCapture(thumb);

    fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientY: 20, pointerId: 1, buttons: 1 });
    flush();

    // 20px of the 160px thumb travel, over the 800px scroll range.
    expect(viewport.scrollTop).toBe(100);
    expect(scrollbar).toHaveAttribute('data-scrolling');
    expect(thumb).toHaveAttribute('data-scrolling');
    expect(thumb.hasPointerCapture(1)).toBe(true);

    fireEvent.pointerUp(thumb, { pointerId: 1 });
    flush();
    expect(thumb.hasPointerCapture(1)).toBe(false);
    expect(scrollbar).not.toHaveAttribute('data-scrolling');
  });

  it('uses the negative RTL range when dragging horizontally', () => {
    const { viewport, thumb } = renderDraggable('horizontal', 'rtl');
    mockPointerCapture(thumb);

    fireEvent.pointerDown(thumb, { button: 0, clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: -20, pointerId: 1, buttons: 1 });

    expect(viewport.scrollLeft).toBe(-100);
  });

  it('ends a drag whose release was missed instead of scrolling on hover', () => {
    const { viewport, thumb } = renderDraggable('vertical');

    // The missed-release scenario means no capture is ever in effect.
    Object.defineProperties(thumb, {
      setPointerCapture: { configurable: true, value: () => {} },
      hasPointerCapture: { configurable: true, value: () => false },
    });

    fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    expect(viewport.style.scrollSnapType).toBe('none');

    fireEvent.pointerMove(thumb, { clientY: 20, pointerId: 1, buttons: 1 });
    expect(viewport.scrollTop).toBeGreaterThan(0);
    const scrolled = viewport.scrollTop;

    // A different pointer hovering over the thumb must not end the active drag.
    fireEvent.pointerMove(thumb, { clientY: 60, pointerId: 2, buttons: 0 });
    expect(viewport.scrollTop).toBe(scrolled);
    expect(viewport.style.scrollSnapType).toBe('none');

    fireEvent.pointerMove(thumb, { clientY: 60, pointerId: 1, buttons: 1 });
    flush();
    expect(viewport.scrollTop).toBeGreaterThan(scrolled);
    const continuedScroll = viewport.scrollTop;
    expect(thumb).toHaveAttribute('data-scrolling');

    // The release never arrived (e.g. pointer capture was lost mid-drag), so
    // the first buttonless move must end the drag rather than scroll. It must
    // clear the scrolling state immediately like a real release, not leave it
    // lingering until the scroll timeout fires.
    fireEvent.pointerMove(thumb, { clientY: 100, pointerId: 1, buttons: 0 });
    flush();
    expect(viewport.scrollTop).toBe(continuedScroll);
    expect(viewport.style.scrollSnapType).toBe('y mandatory');
    expect(thumb).not.toHaveAttribute('data-scrolling');

    fireEvent.pointerMove(thumb, { clientY: 140, pointerId: 1, buttons: 0 });
    expect(viewport.scrollTop).toBe(continuedScroll);
  });

  it('clears scrolling state on pointer cancel without releasing stale capture', () => {
    const { scrollbar, thumb } = renderDraggable('vertical');

    Object.defineProperties(thumb, {
      setPointerCapture: { configurable: true, value: () => {} },
      hasPointerCapture: { configurable: true, value: () => false },
      releasePointerCapture: {
        configurable: true,
        value: () => {
          throw new Error('releasePointerCapture should not be called');
        },
      },
    });

    fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientY: 20, pointerId: 1, buttons: 1 });
    flush();

    expect(scrollbar).toHaveAttribute('data-scrolling');

    expect(() => fireEvent.pointerCancel(thumb, { pointerId: 1 })).not.toThrow();
    flush();

    expect(scrollbar).not.toHaveAttribute('data-scrolling');
  });

  it('clears horizontal scrolling state on pointer cancel', () => {
    const { scrollbar, thumb } = renderDraggable('horizontal');

    Object.defineProperties(thumb, {
      setPointerCapture: { configurable: true, value: () => {} },
      hasPointerCapture: { configurable: true, value: () => false },
      releasePointerCapture: {
        configurable: true,
        value: () => {
          throw new Error('releasePointerCapture should not be called');
        },
      },
    });

    fireEvent.pointerDown(thumb, { button: 0, clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: 20, pointerId: 1, buttons: 1 });
    flush();

    expect(scrollbar).toHaveAttribute('data-scrolling');

    expect(() => fireEvent.pointerCancel(thumb, { pointerId: 1 })).not.toThrow();
    flush();

    expect(scrollbar).not.toHaveAttribute('data-scrolling');
  });

  describe('scroll snap', () => {
    it('disables viewport scroll snap while dragging and restores it on release', () => {
      const { viewport, thumb } = renderDraggable('vertical');
      mockPointerCapture(thumb);

      fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('none');

      fireEvent.pointerUp(thumb, { pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('restores viewport scroll snap on pointer cancel', () => {
      const { viewport, thumb } = renderDraggable('vertical');
      mockPointerCapture(thumb);

      fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('none');

      fireEvent.pointerCancel(thumb, { pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('ignores a second pointer while a drag is active', () => {
      const { viewport, thumb } = renderDraggable('vertical');
      mockPointerCapture(thumb);

      fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 2 });
      expect(viewport.style.scrollSnapType).toBe('none');

      fireEvent.pointerUp(thumb, { pointerId: 2 });
      expect(viewport.style.scrollSnapType).toBe('none');

      fireEvent.pointerUp(thumb, { pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('lets a new pointer take over when capture was silently dropped', () => {
      const { viewport, thumb } = renderDraggable('vertical');
      const capture = mockPointerCapture(thumb);

      fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('none');

      // The browser dropped capture without delivering `pointerup` or
      // `pointercancel`, and the contact's id never reappears (e.g. a lost
      // touch), so a new pointer must be able to take over the latched drag.
      capture.dropCapture();

      fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 2 });
      fireEvent.pointerUp(thumb, { pointerId: 2 });
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('ignores non-primary pointer presses', () => {
      const { viewport, thumb } = renderDraggable('vertical');
      const setPointerCapture = vi.fn();
      Object.defineProperty(thumb, 'setPointerCapture', {
        configurable: true,
        value: setPointerCapture,
      });

      fireEvent.pointerDown(thumb, { button: 2, clientY: 0, pointerId: 1 });

      expect(viewport.style.scrollSnapType).toBe('y mandatory');
      expect(setPointerCapture).not.toHaveBeenCalled();
    });
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
          <ScrollArea.Scrollbar orientation="vertical" keepMounted>
            <ScrollArea.Thumb data-testid="vertical" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" keepMounted>
            <ScrollArea.Thumb data-testid="horizontal" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));

      const verticalThumb = screen.getByTestId('vertical');
      const horizontalThumb = screen.getByTestId('horizontal');
      const viewport = screen.getByTestId('viewport');

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(verticalThumb).toHaveAttribute('data-scrolling', '');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');

      vi.advanceTimersByTime(SCROLL_TIMEOUT - 1);
      flush();

      expect(verticalThumb).toHaveAttribute('data-scrolling', '');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollLeft: 1 } });
      flush();

      vi.advanceTimersByTime(1);
      flush();

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).toHaveAttribute('data-scrolling');

      vi.advanceTimersByTime(SCROLL_TIMEOUT - 2);
      flush();

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).toHaveAttribute('data-scrolling');

      vi.advanceTimersByTime(1);
      flush();

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');
    });
  });
});
