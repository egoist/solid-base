import { Errored, createSignal, flush, Show } from 'solid-js';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { ScrollArea } from '..';
import { mockViewportMetrics } from '../test-utils';

describe('<ScrollArea.Content />', () => {
  it('renders a div with class, style, ref and render support', () => {
    let refElement: HTMLElement | undefined;
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport>
          <ScrollArea.Content
            data-testid="content"
            class="content"
            style={{ color: 'red' }}
            ref={(element) => {
              refElement = element;
            }}
          />
          <ScrollArea.Content render="section" data-testid="section" />
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    const content = screen.getByTestId('content');
    expect(content.tagName).toBe('DIV');
    expect(content).toHaveAttribute('role', 'presentation');
    expect(content).toHaveClass('content');
    expect(content.style.color).toBe('red');
    expect(content.style.minWidth).toBe('fit-content');
    expect(refElement).toBe(content);
    expect(screen.getByTestId('section').tagName).toBe('SECTION');
  });

  it('throws a descriptive error when rendered outside <ScrollArea.Viewport>', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <ScrollArea.Root>
          <ScrollArea.Content />
        </ScrollArea.Root>
      </Errored>
    ));
    flush();

    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: ScrollAreaViewportContext missing. ScrollAreaViewport parts must be placed within <ScrollArea.Viewport>.',
    );
  });

  it('recomputes overflow when observed content resizes', async () => {
    const originalResizeObserver = window.ResizeObserver;
    const callbacks = new Map<Element, ResizeObserverCallback>();
    window.ResizeObserver = class {
      callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe(element: Element) {
        callbacks.set(element, this.callback);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    try {
      let viewport: HTMLElement | undefined;
      render(() => (
        <ScrollArea.Root data-testid="root">
          <ScrollArea.Viewport
            ref={(el) => {
              viewport = el;
              mockViewportMetrics(el, { scrollHeight: 200, scrollWidth: 200 });
            }}
          >
            <ScrollArea.Content data-testid="content" />
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      ));

      const root = screen.getByTestId('root');
      const content = screen.getByTestId('content');
      await waitFor(() => expect(callbacks.has(content)).toBe(true));
      expect(root).not.toHaveAttribute('data-has-overflow-y');

      // The initial observer delivery is skipped.
      callbacks.get(content)!([], {} as ResizeObserver);
      mockViewportMetrics(viewport, { scrollHeight: 1000, scrollWidth: 200 });
      callbacks.get(content)!([], {} as ResizeObserver);
      flush();

      expect(root).toHaveAttribute('data-has-overflow-y');
    } finally {
      window.ResizeObserver = originalResizeObserver;
    }
  });

  it('measures content mounted after the viewport initial measurement', async () => {
    const [show, setShow] = createSignal(false);
    let viewport: HTMLElement | undefined;
    render(() => (
      <ScrollArea.Root data-testid="root">
        <ScrollArea.Viewport
          data-testid="viewport"
          ref={(el) => {
            viewport = el;
            mockViewportMetrics(el, { scrollHeight: 200, scrollWidth: 200 });
          }}
        >
          <Show when={show()}>
            <ScrollArea.Content>
              <div />
            </ScrollArea.Content>
          </Show>
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));

    const root = screen.getByTestId('root');

    // Empty viewport: no overflow and kept out of tab order.
    await waitFor(() => {
      expect(screen.getByTestId('viewport')).toHaveAttribute('tabindex', '-1');
    });
    expect(root).not.toHaveAttribute('data-has-overflow-y');

    // jsdom's `ResizeObserver` never fires on its own (when available at all), so this only
    // asserts that mounting late content doesn't throw; the metrics update comes from a scroll.
    mockViewportMetrics(viewport);
    setShow(true);
    flush();
    viewport!.dispatchEvent(new Event('scroll'));
    flush();

    expect(root).toHaveAttribute('data-has-overflow-x');
    expect(root).toHaveAttribute('data-has-overflow-y');
    expect(screen.getByTestId('viewport')).toHaveAttribute('tabindex', '0');
  });

  it('supports a custom content renderer that does not forward its ref', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport>
          <ScrollArea.Content
            data-testid="content"
            render={(props) => {
              const { ref: _ref, ...rest } = props;
              return <div {...rest} />;
            }}
          />
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });
});
