import { render, screen, waitFor } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { ScrollArea } from '..';
import { mockViewportMetrics } from '../test-utils';

function renderWithScrollbars(corner: () => JSX.Element) {
  return render(() => (
    <ScrollArea.Root>
      <ScrollArea.Viewport
        ref={(el) =>
          mockViewportMetrics(el, {
            clientHeight: 100,
            clientWidth: 100,
            scrollHeight: 1000,
            scrollWidth: 1000,
          })
        }
      />
      <ScrollArea.Scrollbar orientation="vertical" keepMounted>
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar orientation="horizontal" keepMounted>
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      {corner()}
    </ScrollArea.Root>
  ));
}

describe('<ScrollArea.Corner />', () => {
  it('renders a div with class, style, ref and render support', async () => {
    let refElement: HTMLElement | undefined;
    renderWithScrollbars(() => (
      <>
        <ScrollArea.Corner
          data-testid="corner"
          class="corner"
          style={{ color: 'red' }}
          ref={(element) => {
            refElement = element;
          }}
        />
        <ScrollArea.Corner render="span" data-testid="span" />
      </>
    ));

    const corner = await screen.findByTestId('corner');
    expect(corner.tagName).toBe('DIV');
    expect(corner).toHaveClass('corner');
    expect(corner.style.color).toBe('red');
    expect(corner.style.position).toBe('absolute');
    expect(refElement).toBe(corner);
    expect(screen.getByTestId('span').tagName).toBe('SPAN');
  });

  it('is not rendered while a scrollbar is hidden', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport />
        <ScrollArea.Corner data-testid="corner" />
      </ScrollArea.Root>
    ));

    expect(screen.queryByTestId('corner')).toBe(null);
  });

  it('is hidden from the accessibility tree by default', async () => {
    renderWithScrollbars(() => <ScrollArea.Corner data-testid="corner" />);

    await waitFor(() =>
      expect(screen.getByTestId('corner')).toHaveAttribute('aria-hidden', 'true'),
    );
  });

  it('allows overriding aria-hidden', async () => {
    renderWithScrollbars(() => <ScrollArea.Corner data-testid="corner" aria-hidden={undefined} />);

    const corner = await screen.findByTestId('corner');
    expect(corner).not.toHaveAttribute('aria-hidden');
  });

  // Skipped: the corner sizing interaction needs real layout (see the mocked variant in the
  // root tests).
});
