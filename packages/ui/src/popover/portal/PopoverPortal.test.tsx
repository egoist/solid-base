import { Errored } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Popover } from '..';

describe('<Popover.Portal />', () => {
  it('forwards ref, class, style and renders a portal container into the body', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Popover.Root open>
        <Popover.Portal
          data-testid="portal"
          ref={(el) => {
            ref = el;
          }}
          class="portal"
          style={{ color: 'red' }}
        >
          <Popover.Positioner>
            <Popover.Popup />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
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
        <Popover.Root open>
          <Popover.Portal container={container}>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));
      expect(container).toContainElement(screen.getByRole('dialog'));
    } finally {
      container.remove();
    }
  });

  it('does not render while closed unless keepMounted', () => {
    render(() => (
      <Popover.Root>
        <Popover.Portal data-testid="portal">
          <Popover.Positioner>
            <Popover.Popup />
          </Popover.Positioner>
        </Popover.Portal>
        <Popover.Portal data-testid="kept" keepMounted>
          <Popover.Positioner>
            <Popover.Popup />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    expect(screen.queryByTestId('portal')).toBe(null);
    expect(screen.getByTestId('kept')).toBeInTheDocument();
  });

  it('throws a descriptive error when a positioner is rendered without <Popover.Portal>', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Popover.Root open>
          <Popover.Positioner />
        </Popover.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent('Base UI: <Popover.Portal> is missing.');
  });
});
