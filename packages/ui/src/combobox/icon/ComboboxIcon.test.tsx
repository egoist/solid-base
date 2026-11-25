import { render, screen } from '@solidjs/testing-library';
import { Combobox } from '..';

describe('<Combobox.Icon />', () => {
  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root open>
        <Combobox.Icon
          data-testid="icon"
          ref={(el) => {
            ref = el;
          }}
          class="icon"
          style={{ color: 'red' }}
          render={(props) => <i {...props} />}
        />
      </Combobox.Root>
    ));

    const icon = screen.getByTestId('icon');
    expect(ref).toBe(icon);
    expect(icon.tagName).toBe('I');
    expect(icon).toHaveClass('icon');
    expect(icon).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveTextContent('▼');
  });

  it('renders a span by default', () => {
    render(() => (
      <Combobox.Root>
        <Combobox.Icon data-testid="icon" />
      </Combobox.Root>
    ));

    expect(screen.getByTestId('icon')).toBeInstanceOf(window.HTMLSpanElement);
  });
});
