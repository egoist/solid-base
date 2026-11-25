import { Errored } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Dialog } from '..';

describe('<Dialog.Portal />', () => {
  it('forwards ref, class, style and renders a portal container into the body', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Dialog.Root open>
        <Dialog.Portal
          data-testid="portal"
          ref={(el) => {
            ref = el;
          }}
          class="portal"
          style={{ color: 'red' }}
        >
          <Dialog.Popup />
        </Dialog.Portal>
      </Dialog.Root>
    ));
    const portal = screen.getByTestId('portal');
    expect(ref).toBe(portal);
    expect(portal).toBeInstanceOf(window.HTMLDivElement);
    expect(portal.parentElement).toBe(document.body);
    expect(portal).toHaveClass('portal');
    expect(portal).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(portal).toContainElement(screen.getByRole('dialog'));
  });

  it('renders into a custom container', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    try {
      render(() => (
        <Dialog.Root open modal={false}>
          <Dialog.Portal container={container}>
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>
      ));
      expect(container).toContainElement(screen.getByRole('dialog'));
    } finally {
      container.remove();
    }
  });

  it('throws a descriptive error when a portaled part is rendered without <Dialog.Portal>', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Dialog.Root open>
          <Dialog.Viewport />
        </Dialog.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent('Base UI: <Dialog.Portal> is missing.');
  });

  // Upstream: React.Suspense + React.lazy integration (issue #3695) is React-only.
  it.skip('should not throw "Maximum update depth exceeded" when Suspense boundary is outside Portal', () => {});
});
