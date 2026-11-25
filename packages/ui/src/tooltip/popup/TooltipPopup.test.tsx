import { Errored } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Tooltip } from '..';

describe('<Tooltip.Popup />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Tooltip.Root open>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup
                data-testid="popup"
                ref={(el) => {
                  ref = el;
                }}
                class={(state) => (state.open ? 'popup open' : 'popup')}
                style={{ color: 'red' }}
                render={(props, state) => <section {...props} data-side-state={state.side} />}
              />
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));
      const popup = screen.getByTestId('popup');
      expect(ref).toBe(popup);
      expect(popup.tagName).toBe('SECTION');
      expect(popup).toHaveClass('popup', 'open');
      expect(popup).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(popup).toHaveAttribute('data-side-state', 'top');
      expect(popup).toHaveAttribute('data-open');
      expect(popup).toHaveAttribute('data-side', 'top');
    });

    it('renders a div by default', () => {
      render(() => (
        <Tooltip.Root open>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup" />
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));
      expect(screen.getByTestId('popup')).toBeInstanceOf(window.HTMLDivElement);
    });
  });

  it('should render the children', () => {
    render(() => (
      <Tooltip.Root open>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    expect(screen.getByText('Content')).not.toBe(null);
  });

  it('throws a descriptive error when rendered outside <Tooltip.Positioner>', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Tooltip.Root open>
          <Tooltip.Portal>
            <Tooltip.Popup />
          </Tooltip.Portal>
        </Tooltip.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: TooltipPositionerContext is missing. TooltipPositioner parts must be placed within <Tooltip.Positioner>.',
    );
  });
});
