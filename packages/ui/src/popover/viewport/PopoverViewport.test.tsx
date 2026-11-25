import { render, screen } from '@solidjs/testing-library';
import { Popover } from '..';

describe('<Popover.Viewport />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Popover.Root open>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Popover.Viewport
                data-testid="viewport"
                ref={(el) => {
                  ref = el;
                }}
                class={(state) => (state.transitioning ? 'viewport moving' : 'viewport')}
                style={{ color: 'red' }}
                render="section"
              >
                Content
              </Popover.Viewport>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    const viewport = screen.getByTestId('viewport');
    expect(ref).toBe(viewport);
    expect(viewport.tagName).toBe('SECTION');
    expect(viewport).toHaveClass('viewport');
    expect(viewport).not.toHaveClass('moving');
    expect(viewport).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(viewport).toHaveTextContent('Content');
  });
});
