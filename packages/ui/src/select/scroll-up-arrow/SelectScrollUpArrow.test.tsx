import { render, screen } from '@solidjs/testing-library';
import { Select } from '..';

describe('<Select.ScrollUpArrow />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Select.Root open>
          <Select.Positioner>
            <Select.ScrollUpArrow
              keepMounted
              data-testid="arrow"
              ref={(el) => {
                ref = el;
              }}
              class={(state) => `arrow-${state.direction}`}
              style={{ color: 'red' }}
              render={(props) => <section {...props} />}
            />
          </Select.Positioner>
        </Select.Root>
      ));
      const arrow = screen.getByTestId('arrow');
      expect(ref).toBe(arrow);
      expect(arrow.tagName).toBe('SECTION');
      expect(arrow).toHaveClass('arrow-up');
      expect(arrow).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(arrow).toHaveAttribute('aria-hidden', 'true');
      expect(arrow).toHaveAttribute('data-direction', 'up');
    });

    it('renders a div by default', () => {
      render(() => (
        <Select.Root open>
          <Select.Positioner>
            <Select.ScrollUpArrow keepMounted data-testid="arrow" />
          </Select.Positioner>
        </Select.Root>
      ));
      expect(screen.getByTestId('arrow')).toBeInstanceOf(window.HTMLDivElement);
    });
  });

  it('does not render while not scrollable unless kept mounted', () => {
    render(() => (
      <Select.Root open>
        <Select.Positioner>
          <Select.ScrollUpArrow data-testid="arrow" />
        </Select.Positioner>
      </Select.Root>
    ));
    expect(screen.queryByTestId('arrow')).toBe(null);
  });
});
