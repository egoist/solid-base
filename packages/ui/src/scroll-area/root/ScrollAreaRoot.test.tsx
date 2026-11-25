import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { ScrollArea } from '..';
import { CSPProvider } from '../../csp-provider';
import { DirectionProvider } from '../../direction-provider';
import { SCROLL_TIMEOUT } from '../constants';
import { mockElementSize, mockViewportMetrics } from '../test-utils';

function getAttributeFlags(element: Element, names: string[]) {
  return Object.fromEntries(names.map((name) => [name, element.hasAttribute(name)]));
}

const ALL_ATTRIBUTES = [
  'data-has-overflow-x',
  'data-has-overflow-y',
  'data-overflow-x-start',
  'data-overflow-x-end',
  'data-overflow-y-start',
  'data-overflow-y-end',
];

describe('<ScrollArea.Root />', () => {
  afterEach(() => {
    document.head.querySelectorAll('style[data-base-ui-disable-scrollbar]').forEach((style) => {
      style.remove();
    });
  });

  it('renders a div with class, style, ref and render support', () => {
    let refElement: HTMLElement | undefined;
    render(() => (
      <>
        <ScrollArea.Root
          data-testid="root"
          class={(state) => (state.hasOverflowY ? 'overflow' : 'no-overflow')}
          style={{ color: 'red' }}
          ref={(element) => {
            refElement = element;
          }}
        />
        <ScrollArea.Root render="section" data-testid="section" />
      </>
    ));
    const root = screen.getByTestId('root');
    expect(root.tagName).toBe('DIV');
    expect(root).toHaveAttribute('role', 'presentation');
    expect(root).toHaveClass('no-overflow');
    expect(root.style.color).toBe('red');
    expect(root.style.position).toBe('relative');
    expect(root.style.getPropertyValue('--scroll-area-corner-height')).toBe('0px');
    expect(refElement).toBe(root);
    expect(screen.getByTestId('section').tagName).toBe('SECTION');
  });

  describe('disable scrollbar styles', () => {
    it('injects the scrollbar-hiding stylesheet once', () => {
      render(() => (
        <>
          <ScrollArea.Root>
            <ScrollArea.Viewport data-testid="viewport" />
          </ScrollArea.Root>
          <ScrollArea.Root />
        </>
      ));

      const styles = document.head.querySelectorAll('style[data-base-ui-disable-scrollbar]');
      expect(styles.length).toBe(1);
      expect(styles[0].textContent).toContain('.base-ui-disable-scrollbar');
      expect(screen.getByTestId('viewport')).toHaveClass('base-ui-disable-scrollbar');
    });

    it('applies the CSP nonce', () => {
      render(() => (
        <CSPProvider nonce="abc">
          <ScrollArea.Root />
        </CSPProvider>
      ));

      const style = document.head.querySelector<HTMLStyleElement>(
        'style[data-base-ui-disable-scrollbar]',
      );
      expect(style?.nonce).toBe('abc');
    });

    it('does not inject styles when style elements are disabled', () => {
      render(() => (
        <CSPProvider disableStyleElements>
          <ScrollArea.Root />
        </CSPProvider>
      ));

      expect(document.head.querySelector('style[data-base-ui-disable-scrollbar]')).toBe(null);
    });
  });

  describe('data-scrolling attribute', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('adds [data-scrolling] attribute when viewport is scrolled', () => {
      render(() => (
        <ScrollArea.Root data-testid="root" style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      ));

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      expect(root).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(root).toHaveAttribute('data-scrolling', '');

      vi.advanceTimersByTime(SCROLL_TIMEOUT);
      flush();

      expect(root).not.toHaveAttribute('data-scrolling');

      // Test horizontal scrolling
      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollLeft: 1 } });
      flush();

      expect(root).toHaveAttribute('data-scrolling', '');

      vi.advanceTimersByTime(SCROLL_TIMEOUT);
      flush();

      expect(root).not.toHaveAttribute('data-scrolling');
    });
  });

  // The upstream sizing tests measure real layout (thumb sizes from computed paddings/margins),
  // so they need a real browser. The overflow tests below mock the viewport metrics instead.
  describe('overflow data attributes', () => {
    it('applies data attributes on root, viewport, content and scrollbars based on overflow and edges', async () => {
      render(() => (
        <ScrollArea.Root data-testid="root">
          <ScrollArea.Viewport data-testid="viewport" ref={(el) => mockViewportMetrics(el)}>
            <ScrollArea.Content data-testid="content">
              <div />
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="scrollbar-vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar-horizontal">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');
      const content = screen.getByTestId('content');

      const atStart = {
        'data-has-overflow-x': true,
        'data-has-overflow-y': true,
        'data-overflow-x-start': false,
        'data-overflow-x-end': true,
        'data-overflow-y-start': false,
        'data-overflow-y-end': true,
      };

      await waitFor(() => {
        expect({
          root: getAttributeFlags(root, ALL_ATTRIBUTES),
          viewport: getAttributeFlags(viewport, ALL_ATTRIBUTES),
          content: getAttributeFlags(content, ALL_ATTRIBUTES),
          vScrollbar: getAttributeFlags(screen.getByTestId('scrollbar-vertical'), [
            'data-has-overflow-y',
            'data-overflow-y-start',
            'data-overflow-y-end',
          ]),
          hScrollbar: getAttributeFlags(screen.getByTestId('scrollbar-horizontal'), [
            'data-has-overflow-x',
            'data-overflow-x-start',
            'data-overflow-x-end',
          ]),
        }).toEqual({
          root: atStart,
          viewport: atStart,
          content: atStart,
          vScrollbar: {
            'data-has-overflow-y': true,
            'data-overflow-y-start': false,
            'data-overflow-y-end': true,
          },
          hScrollbar: {
            'data-has-overflow-x': true,
            'data-overflow-x-start': false,
            'data-overflow-x-end': true,
          },
        });
      });

      const vScrollbar = screen.getByTestId('scrollbar-vertical');
      const hScrollbar = screen.getByTestId('scrollbar-horizontal');

      // Scroll to middle
      fireEvent.scroll(viewport, { target: { scrollTop: 400, scrollLeft: 400 } });
      flush();

      for (const element of [root, viewport, content]) {
        expect(getAttributeFlags(element, ALL_ATTRIBUTES)).toEqual({
          'data-has-overflow-x': true,
          'data-has-overflow-y': true,
          'data-overflow-x-start': true,
          'data-overflow-x-end': true,
          'data-overflow-y-start': true,
          'data-overflow-y-end': true,
        });
      }
      expect(vScrollbar).toHaveAttribute('data-overflow-y-start');
      expect(vScrollbar).toHaveAttribute('data-overflow-y-end');
      expect(hScrollbar).toHaveAttribute('data-overflow-x-start');
      expect(hScrollbar).toHaveAttribute('data-overflow-x-end');

      // Scroll to end
      fireEvent.scroll(viewport, { target: { scrollTop: 800, scrollLeft: 800 } });
      flush();

      for (const element of [root, viewport, content]) {
        expect(getAttributeFlags(element, ALL_ATTRIBUTES)).toEqual({
          'data-has-overflow-x': true,
          'data-has-overflow-y': true,
          'data-overflow-x-start': true,
          'data-overflow-x-end': false,
          'data-overflow-y-start': true,
          'data-overflow-y-end': false,
        });
      }
      expect(vScrollbar).not.toHaveAttribute('data-overflow-y-end');
      expect(hScrollbar).not.toHaveAttribute('data-overflow-x-end');

      expect(viewport.style.getPropertyValue('--scroll-area-overflow-y-start')).toBe('800px');
      expect(viewport.style.getPropertyValue('--scroll-area-overflow-y-end')).toBe('0px');
    });

    it('treats near-edge scroll offsets as fully scrolled', async () => {
      render(() => (
        <ScrollArea.Root data-testid="root">
          <ScrollArea.Viewport data-testid="viewport" ref={(el) => mockViewportMetrics(el)} />
        </ScrollArea.Root>
      ));

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');
      await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-y'));

      fireEvent.scroll(viewport, { target: { scrollTop: 799.5, scrollLeft: 799.5 } });
      flush();

      expect(root).toHaveAttribute('data-overflow-y-start');
      expect(root).not.toHaveAttribute('data-overflow-y-end');
      expect(root).toHaveAttribute('data-overflow-x-start');
      expect(root).not.toHaveAttribute('data-overflow-x-end');
    });

    it('respects overflowEdgeThreshold and exposes scroll metrics', async () => {
      render(() => (
        <ScrollArea.Root data-testid="root" overflowEdgeThreshold={{ xStart: 20, yStart: 5 }}>
          <ScrollArea.Viewport data-testid="viewport" ref={(el) => mockViewportMetrics(el)} />
        </ScrollArea.Root>
      ));

      const viewport = screen.getByTestId('viewport');
      await waitFor(() => expect(viewport).toHaveAttribute('data-has-overflow-x'));

      fireEvent.scroll(viewport, { target: { scrollLeft: 15, scrollTop: 7 } });
      flush();

      expect(viewport).not.toHaveAttribute('data-overflow-x-start');
      expect(viewport).toHaveAttribute('data-overflow-y-start');

      fireEvent.scroll(viewport, { target: { scrollLeft: 35, scrollTop: 7 } });
      flush();

      expect(viewport).toHaveAttribute('data-overflow-x-start');
      expect(viewport.style.getPropertyValue('--scroll-area-overflow-x-start')).toBe('35px');
      expect(viewport.style.getPropertyValue('--scroll-area-overflow-x-end')).toBe('765px');
    });

    it('applies numeric overflowEdgeThreshold to every edge', async () => {
      render(() => (
        <ScrollArea.Root data-testid="root" overflowEdgeThreshold={20}>
          <ScrollArea.Viewport data-testid="viewport" ref={(el) => mockViewportMetrics(el)} />
        </ScrollArea.Root>
      ));

      const viewport = screen.getByTestId('viewport');
      await waitFor(() => expect(viewport).toHaveAttribute('data-has-overflow-x'));

      fireEvent.scroll(viewport, { target: { scrollLeft: 15, scrollTop: 15 } });
      flush();

      expect(viewport).not.toHaveAttribute('data-overflow-x-start');
      expect(viewport).not.toHaveAttribute('data-overflow-y-start');
      expect(viewport).toHaveAttribute('data-overflow-x-end');
      expect(viewport).toHaveAttribute('data-overflow-y-end');

      fireEvent.scroll(viewport, { target: { scrollLeft: 785, scrollTop: 785 } });
      flush();

      expect(viewport).toHaveAttribute('data-overflow-x-start');
      expect(viewport).toHaveAttribute('data-overflow-y-start');
      expect(viewport).not.toHaveAttribute('data-overflow-x-end');
      expect(viewport).not.toHaveAttribute('data-overflow-y-end');
    });

    it('recomputes overflow edges when overflowEdgeThreshold changes', async () => {
      const [yStart, setYStart] = createSignal(5);
      render(() => (
        <ScrollArea.Root data-testid="root" overflowEdgeThreshold={{ yStart: yStart() }}>
          <ScrollArea.Viewport data-testid="viewport" ref={(el) => mockViewportMetrics(el)} />
        </ScrollArea.Root>
      ));

      const viewport = screen.getByTestId('viewport');
      await waitFor(() => expect(viewport).toHaveAttribute('data-has-overflow-y'));

      fireEvent.scroll(viewport, { target: { scrollTop: 10 } });
      flush();
      expect(viewport).toHaveAttribute('data-overflow-y-start');

      // Raising the threshold above the current offset must clear the edge without a new scroll.
      setYStart(20);
      flush();
      await waitFor(() => expect(viewport).not.toHaveAttribute('data-overflow-y-start'));
    });

    it('does not add state attributes when content does not overflow', async () => {
      render(() => (
        <ScrollArea.Root data-testid="root">
          <ScrollArea.Viewport
            data-testid="viewport"
            ref={(el) => mockViewportMetrics(el, { scrollWidth: 200, scrollHeight: 200 })}
          >
            <ScrollArea.Content data-testid="content" />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" keepMounted data-testid="scrollbar-vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar
            orientation="horizontal"
            keepMounted
            data-testid="scrollbar-horizontal"
          >
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));

      const viewport = screen.getByTestId('viewport');
      // Wait for the mount measurement.
      await waitFor(() =>
        expect(screen.getByTestId('scrollbar-vertical').style.visibility).not.toBe('hidden'),
      );

      for (const element of [
        screen.getByTestId('root'),
        viewport,
        screen.getByTestId('content'),
        screen.getByTestId('scrollbar-vertical'),
        screen.getByTestId('scrollbar-horizontal'),
      ]) {
        expect(Object.values(getAttributeFlags(element, ALL_ATTRIBUTES))).not.toContain(true);
      }
      // Non-scrollable viewports stay out of the tab order.
      expect(viewport).toHaveAttribute('tabindex', '-1');
    });

    it('makes the viewport focusable once it overflows', async () => {
      render(() => (
        <ScrollArea.Root data-testid="root">
          <ScrollArea.Viewport data-testid="viewport" ref={(el) => mockViewportMetrics(el)} />
        </ScrollArea.Root>
      ));

      const viewport = screen.getByTestId('viewport');
      expect(viewport).toHaveAttribute('tabindex', '-1');
      await waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));
    });

    it('correctly handles RTL', async () => {
      render(() => (
        <DirectionProvider direction="rtl">
          <ScrollArea.Root data-testid="root">
            <ScrollArea.Viewport
              data-testid="viewport"
              ref={(el) => mockViewportMetrics(el, { scrollHeight: 200 })}
            />
            <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar-horizontal">
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </DirectionProvider>
      ));

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-x'));
      expect(root).not.toHaveAttribute('data-overflow-x-start');
      expect(root).toHaveAttribute('data-overflow-x-end');

      fireEvent.scroll(viewport, { target: { scrollLeft: -400 } });
      flush();

      expect(root).toHaveAttribute('data-overflow-x-start');
      expect(root).toHaveAttribute('data-overflow-x-end');

      fireEvent.scroll(viewport, { target: { scrollLeft: -800 } });
      flush();

      expect(root).toHaveAttribute('data-overflow-x-start');
      expect(root).not.toHaveAttribute('data-overflow-x-end');
    });

    it('recomputes horizontal overflow edges when direction changes', async () => {
      const [direction, setDirection] = createSignal<'ltr' | 'rtl'>('ltr');
      render(() => (
        <DirectionProvider direction={direction()}>
          <ScrollArea.Root data-testid="root">
            <ScrollArea.Viewport
              data-testid="viewport"
              ref={(el) => mockViewportMetrics(el, { scrollHeight: 200 })}
            />
          </ScrollArea.Root>
        </DirectionProvider>
      ));

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');
      const xEdges = ['data-overflow-x-start', 'data-overflow-x-end'];

      await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-x'));

      fireEvent.scroll(viewport, { target: { scrollLeft: 400 } });
      flush();
      expect(getAttributeFlags(root, xEdges)).toEqual({
        'data-overflow-x-start': true,
        'data-overflow-x-end': true,
      });

      viewport.scrollLeft = -800;
      setDirection('rtl');
      flush();

      await waitFor(() => {
        expect(getAttributeFlags(root, xEdges)).toEqual({
          'data-overflow-x-start': true,
          'data-overflow-x-end': false,
        });
      });
    });

    it('sizes the thumb from the viewport ratio', async () => {
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Viewport ref={(el) => mockViewportMetrics(el, { scrollWidth: 200 })} />
          <ScrollArea.Scrollbar
            orientation="vertical"
            data-testid="vertical-scrollbar"
            ref={(el) => mockElementSize(el, { offsetHeight: 200, offsetWidth: 10 })}
          >
            <ScrollArea.Thumb data-testid="vertical-thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));

      // 200px track * (200px viewport / 1000px content)
      await waitFor(() => {
        expect(
          screen
            .getByTestId('vertical-scrollbar')
            .style.getPropertyValue('--scroll-area-thumb-height'),
        ).toBe('40px');
      });
      expect(screen.getByTestId('vertical-thumb').style.height).toBe(
        'var(--scroll-area-thumb-height)',
      );
      await waitFor(() => {
        expect(screen.getByTestId('vertical-thumb').style.visibility).toBe('');
      });
    });

    it('clamps the thumb to its minimum size', async () => {
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Viewport
            ref={(el) => mockViewportMetrics(el, { scrollWidth: 200, scrollHeight: 100000 })}
          />
          <ScrollArea.Scrollbar
            orientation="vertical"
            data-testid="vertical-scrollbar"
            ref={(el) => mockElementSize(el, { offsetHeight: 200, offsetWidth: 10 })}
          >
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));

      await waitFor(() => {
        expect(
          screen
            .getByTestId('vertical-scrollbar')
            .style.getPropertyValue('--scroll-area-thumb-height'),
        ).toBe('16px');
      });
    });

    it('sizes the corner when both scrollbars are visible', async () => {
      render(() => (
        <ScrollArea.Root data-testid="root">
          <ScrollArea.Viewport ref={(el) => mockViewportMetrics(el)} />
          <ScrollArea.Scrollbar
            orientation="vertical"
            ref={(el) => mockElementSize(el, { offsetHeight: 200, offsetWidth: 11 })}
          >
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar
            orientation="horizontal"
            ref={(el) => mockElementSize(el, { offsetHeight: 13, offsetWidth: 200 })}
          >
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Corner data-testid="corner" />
        </ScrollArea.Root>
      ));

      await waitFor(() => expect(screen.getByTestId('corner').style.width).toBe('11px'));
      await waitFor(() => expect(screen.getByTestId('corner').style.height).toBe('13px'));
      expect(screen.getByTestId('root').style.getPropertyValue('--scroll-area-corner-width')).toBe(
        '11px',
      );
    });
  });
});
