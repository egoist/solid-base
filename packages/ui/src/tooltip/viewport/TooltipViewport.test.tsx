import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Tooltip } from '..';
import { act } from '../../dialog/test-utils';

describe('<Tooltip.Viewport />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Tooltip.Root open>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>
                <Tooltip.Viewport
                  data-testid="viewport"
                  ref={(el) => {
                    ref = el;
                  }}
                  class={(state) => (state.transitioning ? 'viewport moving' : 'viewport')}
                  style={{ color: 'red' }}
                  render={(props) => <section {...props} />}
                >
                  Content
                </Tooltip.Viewport>
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));
      const viewport = screen.getByTestId('viewport');
      expect(ref).toBe(viewport);
      expect(viewport.tagName).toBe('SECTION');
      expect(viewport).toHaveClass('viewport');
      expect(viewport).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(viewport).toHaveTextContent('Content');
    });
  });

  // jsdom has no layout: the positioner's offsets can't be measured.
  it.skip('anchors the positioner from the far edge while it transitions', () => {});

  it('should mirror the instant animation type of the tooltip', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger delay={0} closeDelay={0}>
          Trigger
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>
              <Tooltip.Viewport data-testid="viewport">Content</Tooltip.Viewport>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Trigger' });

    // jsdom doesn't match `:focus-visible` on programmatic focus; a keyboard focus does.
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Tab' });
      trigger.focus();
    });

    await waitFor(() => {
      expect(screen.getByTestId('viewport')).toHaveAttribute('data-instant', 'focus');
    });
  });
});
