import { render, screen } from '@solidjs/testing-library';
import { Menu } from '..';

describe('<Menu.Arrow />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Arrow
                data-testid="arrow"
                ref={(el) => {
                  ref = el;
                }}
                class={(state) => (state.open ? 'open' : 'closed')}
                style={{ color: 'red' }}
                render={(props) => <span {...props} />}
              />
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    const arrow = screen.getByTestId('arrow');
    expect(ref).toBe(arrow);
    expect(arrow.tagName).toBe('SPAN');
    expect(arrow).toHaveClass('open');
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveAttribute('data-open');
    expect(arrow).toHaveAttribute('data-side', 'bottom');
    expect(arrow).toHaveAttribute('data-align', 'center');
    expect(arrow.style.color).toBe('red');
  });
});
