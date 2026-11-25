import { render, screen } from '@solidjs/testing-library';
import { Popover } from '..';

describe('<Popover.Arrow />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Popover.Root open>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Popover.Arrow
                data-testid="arrow"
                ref={(el) => {
                  ref = el;
                }}
                class={(state) => (state.open ? 'arrow open' : 'arrow')}
                style={{ color: 'red' }}
                render={(props, state) => <span {...props} data-side-state={state.side} />}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    const arrow = screen.getByTestId('arrow');
    expect(ref).toBe(arrow);
    expect(arrow.tagName).toBe('SPAN');
    expect(arrow).toHaveClass('arrow', 'open');
    expect(arrow).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveAttribute('data-side-state', 'bottom');
    expect(arrow).toHaveAttribute('data-side', 'bottom');
    expect(arrow).toHaveAttribute('data-align', 'center');
    expect(arrow).toHaveAttribute('data-open');
  });

  it('renders a div by default', () => {
    render(() => (
      <Popover.Root open>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Popover.Arrow data-testid="arrow" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    expect(screen.getByTestId('arrow')).toBeInstanceOf(window.HTMLDivElement);
  });
});
