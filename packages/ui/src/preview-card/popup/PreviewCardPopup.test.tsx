import { Errored } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { PreviewCard } from '..';

describe('<PreviewCard.Popup />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <PreviewCard.Root open>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup
                data-testid="popup"
                ref={(el) => {
                  ref = el;
                }}
                class={(state) => (state.open ? 'popup open' : 'popup')}
                style={{ color: 'red' }}
                render={(props, state) => <section {...props} data-side-state={state.side} />}
              >
                Content
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));
      const popup = screen.getByTestId('popup');
      expect(ref).toBe(popup);
      expect(popup.tagName).toBe('SECTION');
      expect(popup).toHaveClass('popup', 'open');
      expect(popup).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(popup).toHaveAttribute('data-side-state', 'bottom');
      expect(popup).toHaveAttribute('data-open');
      expect(popup).toHaveTextContent('Content');
    });

    it('renders a div by default', () => {
      render(() => (
        <PreviewCard.Root open>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid="popup" />
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));
      expect(screen.getByTestId('popup')).toBeInstanceOf(window.HTMLDivElement);
    });
  });

  it('throws a descriptive error when rendered outside <PreviewCard.Root>', () => {
    expect(() => render(() => <PreviewCard.Popup />)).toThrow(
      'Base UI: PreviewCardRootContext is missing. PreviewCard parts must be placed within <PreviewCard.Root>.',
    );
  });

  it('throws a descriptive error when rendered outside <PreviewCard.Positioner>', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <PreviewCard.Root open>
          <PreviewCard.Portal>
            <PreviewCard.Popup />
          </PreviewCard.Portal>
        </PreviewCard.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: PreviewCardPositionerContext is missing. PreviewCardPositioner parts must be placed within <PreviewCard.Positioner>.',
    );
  });

  it('should render the children', () => {
    render(() => (
      <PreviewCard.Root open>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup>Content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));

    expect(screen.getByText('Content')).not.toBe(null);
  });
});
