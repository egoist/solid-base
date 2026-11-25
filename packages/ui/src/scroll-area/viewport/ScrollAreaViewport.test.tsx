import { createSignal, flush, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { ScrollArea } from '..';
import { SCROLL_TIMEOUT } from '../constants';

describe('<ScrollArea.Viewport />', () => {
  it('renders a div with class, style, ref and render support', () => {
    let refElement: HTMLElement | undefined;
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport
          data-testid="viewport"
          class="viewport"
          style={{ color: 'red' }}
          ref={(element) => {
            refElement = element;
          }}
        />
        <ScrollArea.Viewport render="section" data-testid="section" />
      </ScrollArea.Root>
    ));
    const viewport = screen.getByTestId('viewport');
    expect(viewport.tagName).toBe('DIV');
    expect(viewport).toHaveClass('viewport', 'base-ui-disable-scrollbar');
    expect(viewport.style.color).toBe('red');
    expect(viewport.style.overflow).toBe('scroll');
    expect(viewport.getAttribute('data-id')).toMatch(/^base-ui-.+-viewport$/);
    expect(refElement).toBe(viewport);
    expect(screen.getByTestId('section').tagName).toBe('SECTION');
  });

  it('does not use a presentational role on the focusable viewport', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport tabindex={0} data-testid="viewport" />
      </ScrollArea.Root>
    ));

    const viewport = screen.getByTestId('viewport');

    expect(viewport).not.toHaveAttribute('role', 'presentation');
    expect(viewport).toHaveAttribute('tabindex', '0');
  });

  it('handles a user scroll callback unmounting the viewport', () => {
    const [mounted, setMounted] = createSignal(true);

    render(() => (
      <ScrollArea.Root>
        <Show when={mounted()}>
          <ScrollArea.Viewport
            data-testid="viewport"
            onScroll={() => {
              setMounted(false);
              flush();
            }}
          />
        </Show>
      </ScrollArea.Root>
    ));

    expect(() => fireEvent.scroll(screen.getByTestId('viewport'))).not.toThrow();
    flush();
    expect(screen.queryByTestId('viewport')).toBe(null);
  });

  describe('data-scrolling attribute', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function renderScrollArea() {
      render(() => (
        <ScrollArea.Root data-testid="root">
          <ScrollArea.Viewport data-testid="viewport">
            <div />
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      ));
      return { root: screen.getByTestId('root'), viewport: screen.getByTestId('viewport') };
    }

    it('adds [data-scrolling] attribute when viewport is scrolled', () => {
      const { viewport } = renderScrollArea();

      expect(viewport).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(viewport).toHaveAttribute('data-scrolling', '');

      vi.advanceTimersByTime(SCROLL_TIMEOUT);
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');

      // Test horizontal scrolling
      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollLeft: 1 } });
      flush();

      expect(viewport).toHaveAttribute('data-scrolling', '');

      vi.advanceTimersByTime(SCROLL_TIMEOUT);
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('ignores data-scrolling during programmatic scroll', () => {
      const { viewport } = renderScrollArea();

      // No user interaction before the scroll event, as with `scrollTo()`.
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('adds [data-scrolling] in touch modality even when the gesture delivers no events', () => {
      const { viewport } = renderScrollArea();

      // The initial touch is delivered normally and establishes touch modality.
      fireEvent.pointerDown(viewport, { pointerType: 'touch' });
      flush();

      // A touch that catches an in-flight momentum scroll or rubber-band
      // bounce is consumed natively by WebKit: no touch/pointer events fire
      // for the whole gesture, only scroll events after an arbitrary pause.
      vi.advanceTimersByTime(200);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(viewport).toHaveAttribute('data-scrolling', '');

      vi.advanceTimersByTime(SCROLL_TIMEOUT);
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('keeps ignoring programmatic scrolls in mouse modality', () => {
      const { viewport } = renderScrollArea();

      fireEvent.pointerDown(viewport, { pointerType: 'mouse' });
      flush();

      vi.advanceTimersByTime(200);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('restores programmatic scroll suppression after modality flips back to mouse', () => {
      const { root, viewport } = renderScrollArea();

      fireEvent.pointerDown(viewport, { pointerType: 'touch' });
      flush();
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(viewport).toHaveAttribute('data-scrolling', '');

      vi.advanceTimersByTime(SCROLL_TIMEOUT);
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');

      // A mouse pointermove on the root (not the viewport, whose own
      // handlers mark user interaction) switches back to mouse modality.
      fireEvent.pointerMove(root, { pointerType: 'mouse' });
      flush();
      fireEvent.scroll(viewport, { target: { scrollTop: 2 } });
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('removes [data-scrolling] after timeout', () => {
      const { viewport } = renderScrollArea();

      // Start scrolling
      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(viewport).toHaveAttribute('data-scrolling', '');

      // Wait less than timeout - should still be scrolling
      vi.advanceTimersByTime(SCROLL_TIMEOUT - 1);
      flush();

      expect(viewport).toHaveAttribute('data-scrolling', '');

      // Wait for remaining timeout
      vi.advanceTimersByTime(1);
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });
  });

  // Skipped: the subtree animation, overscroll feedback and real-layout overflow tests need a
  // real browser (Web Animations API, rubber-band scrolling, layout).

  it('throws a descriptive error when rendered outside <ScrollArea.Root>', () => {
    expect(() => render(() => <ScrollArea.Viewport />)).toThrow(
      'Base UI: ScrollAreaRootContext is missing. ScrollArea parts must be placed within <ScrollArea.Root>.',
    );
  });
});
