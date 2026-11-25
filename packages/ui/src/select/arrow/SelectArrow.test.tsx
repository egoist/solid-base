import { render, screen } from '@solidjs/testing-library';
import { Select } from '..';

describe('<Select.Arrow />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Select.Root open>
          <Select.Positioner alignItemWithTrigger={false}>
            <Select.Arrow
              data-testid="arrow"
              ref={(el) => {
                ref = el;
              }}
              class={(state) => (state.open ? 'arrow open' : 'arrow')}
              style={{ color: 'red' }}
              render={(props, state) => <span {...props} data-state-side={state.side} />}
            />
          </Select.Positioner>
        </Select.Root>
      ));
      const arrow = screen.getByTestId('arrow');
      expect(ref).toBe(arrow);
      expect(arrow.tagName).toBe('SPAN');
      expect(arrow).toHaveClass('arrow', 'open');
      expect(arrow).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(arrow).toHaveAttribute('data-state-side', 'bottom');
      expect(arrow).toHaveAttribute('aria-hidden', 'true');
      expect(arrow).toHaveAttribute('data-open');
    });

    it('renders a div by default', () => {
      render(() => (
        <Select.Root open>
          <Select.Positioner alignItemWithTrigger={false}>
            <Select.Arrow data-testid="arrow" />
          </Select.Positioner>
        </Select.Root>
      ));
      expect(screen.getByTestId('arrow')).toBeInstanceOf(window.HTMLDivElement);
    });
  });

  it('does not render while the popup is aligned with the trigger', () => {
    render(() => (
      <Select.Root open>
        <Select.Positioner>
          <Select.Arrow data-testid="arrow" />
        </Select.Positioner>
      </Select.Root>
    ));
    expect(screen.queryByTestId('arrow')).toBe(null);
  });
});
