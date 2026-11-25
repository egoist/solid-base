import { render, screen } from '@solidjs/testing-library';
import { Select } from '..';

describe('<Select.Backdrop />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Select.Root open>
          <Select.Backdrop
            data-testid="backdrop"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'backdrop open' : 'backdrop')}
            style={{ color: 'red' }}
            render={(props, state) => <section {...props} data-state-open={String(state.open)} />}
          />
        </Select.Root>
      ));
      const backdrop = screen.getByTestId('backdrop');
      expect(ref).toBe(backdrop);
      expect(backdrop.tagName).toBe('SECTION');
      expect(backdrop).toHaveClass('backdrop', 'open');
      expect(backdrop).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(backdrop).toHaveAttribute('data-state-open', 'true');
      expect(backdrop).toHaveAttribute('role', 'presentation');
      expect(backdrop).toHaveAttribute('data-open');
    });

    it('renders a div by default, hidden while unmounted', () => {
      render(() => (
        <Select.Root>
          <Select.Backdrop data-testid="backdrop" />
        </Select.Root>
      ));
      const backdrop = screen.getByTestId('backdrop');
      expect(backdrop).toBeInstanceOf(window.HTMLDivElement);
      expect(backdrop).toHaveAttribute('hidden');
      expect(backdrop).toHaveAttribute('data-closed');
    });
  });
});
