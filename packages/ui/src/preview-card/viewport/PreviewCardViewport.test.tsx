import { Errored } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { PreviewCard } from '..';

describe('<PreviewCard.Viewport />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <PreviewCard.Root open>
        <PreviewCard.Trigger>Trigger</PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup>
              <PreviewCard.Viewport
                data-testid="viewport"
                ref={(el) => {
                  ref = el;
                }}
                class={(state) => (state.transitioning ? 'viewport transitioning' : 'viewport')}
                style={{ color: 'red' }}
                render={(props) => <section {...props} />}
              >
                Content
              </PreviewCard.Viewport>
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));
    const viewport = screen.getByTestId('viewport');
    expect(ref).toBe(viewport);
    expect(viewport.tagName).toBe('SECTION');
    expect(viewport).toHaveClass('viewport');
    expect(viewport).not.toHaveClass('transitioning');
    expect(viewport).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(viewport).toHaveTextContent('Content');
  });

  it('throws a descriptive error when rendered outside <PreviewCard.Positioner>', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <PreviewCard.Root open>
          <PreviewCard.Portal>
            <PreviewCard.Viewport />
          </PreviewCard.Portal>
        </PreviewCard.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: PreviewCardPositionerContext is missing. PreviewCardPositioner parts must be placed within <PreviewCard.Positioner>.',
    );
  });
});
