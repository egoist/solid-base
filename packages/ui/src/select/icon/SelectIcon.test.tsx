import { render, screen } from '@solidjs/testing-library';
import { Select } from '..';

describe('<Select.Icon />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Select.Root open>
        <Select.Icon
          data-testid="icon"
          ref={(el) => {
            ref = el;
          }}
          class={(state) => (state.open ? 'icon open' : 'icon')}
          style={{ color: 'red' }}
          render={(props, state) => <i {...props} data-state-open={String(state.open)} />}
        />
      </Select.Root>
    ));
    const icon = screen.getByTestId('icon');
    expect(ref).toBe(icon);
    expect(icon.tagName).toBe('I');
    expect(icon).toHaveClass('icon', 'open');
    expect(icon).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(icon).toHaveAttribute('data-state-open', 'true');
    expect(icon).toHaveAttribute('data-popup-open');
  });

  it('renders a hidden span with a default glyph', () => {
    render(() => (
      <Select.Root>
        <Select.Icon data-testid="icon" />
      </Select.Root>
    ));
    const icon = screen.getByTestId('icon');
    expect(icon).toBeInstanceOf(window.HTMLSpanElement);
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveTextContent('▼');
    expect(icon).not.toHaveAttribute('data-popup-open');
  });
});
