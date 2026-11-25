import { render, screen } from '@solidjs/testing-library';
import { Select } from '..';

describe('<Select.Positioner />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Select.Root open>
          <Select.Portal>
            <Select.Positioner
              data-testid="positioner"
              ref={(el) => {
                ref = el;
              }}
              class={(state) => (state.open ? 'positioner open' : 'positioner')}
              style={{ color: 'red' }}
              render={(props, state) => <section {...props} data-state-side={state.side} />}
            />
          </Select.Portal>
        </Select.Root>
      ));
      const positioner = screen.getByTestId('positioner');
      expect(ref).toBe(positioner);
      expect(positioner.tagName).toBe('SECTION');
      expect(positioner).toHaveClass('positioner', 'open');
      expect(positioner).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(positioner).toHaveAttribute('role', 'presentation');
      expect(positioner).toHaveAttribute('data-open');
    });

    it('renders a div by default', () => {
      render(() => (
        <Select.Root open>
          <Select.Portal>
            <Select.Positioner data-testid="positioner" />
          </Select.Portal>
        </Select.Root>
      ));
      expect(screen.getByTestId('positioner')).toBeInstanceOf(window.HTMLDivElement);
    });
  });

  it('reports side "none" and fixed positioning while aligned with the trigger', () => {
    render(() => (
      <Select.Root open>
        <Select.Trigger>Trigger</Select.Trigger>
        <Select.Portal>
          <Select.Positioner data-testid="positioner">
            <Select.Popup>Popup</Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));
    const positioner = screen.getByTestId('positioner');
    expect(positioner).toHaveAttribute('data-side', 'none');
    expect(positioner.style.position).toBe('fixed');
  });

  it('reports the anchored side when not aligned with the trigger', () => {
    render(() => (
      <Select.Root open>
        <Select.Trigger>Trigger</Select.Trigger>
        <Select.Portal>
          <Select.Positioner data-testid="positioner" alignItemWithTrigger={false}>
            <Select.Popup>Popup</Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));
    expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'bottom');
  });

  // Skipped: `positionerConformanceTests` (offsets, collision avoidance, transform positioning)
  // and 'kept-mounted positioner' need real layout; upstream skips them in jsdom too.
});
