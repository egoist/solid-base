import { render, screen } from '@solidjs/testing-library';
import { Select } from '..';

describe('<Select.Portal />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Select.Root open>
          <Select.Portal
            data-testid="portal"
            ref={(el) => {
              ref = el;
            }}
            class="portal"
            style={{ color: 'red' }}
            render={(props) => <section {...props} />}
          />
        </Select.Root>
      ));
      const portal = screen.getByTestId('portal');
      expect(ref).toBe(portal);
      expect(portal.tagName).toBe('SECTION');
      expect(portal).toHaveClass('portal');
      expect(portal).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });

    it('renders a div into the body', () => {
      render(() => (
        <Select.Root open>
          <Select.Portal data-testid="portal" />
        </Select.Root>
      ));
      const portal = screen.getByTestId('portal');
      expect(portal).toBeInstanceOf(window.HTMLDivElement);
      expect(portal.parentElement).toBe(document.body);
    });
  });

  it('does not render while the select is closed and never focused', () => {
    render(() => (
      <Select.Root>
        <Select.Portal data-testid="portal" />
      </Select.Root>
    ));
    expect(screen.queryByTestId('portal')).toBe(null);
  });
});
