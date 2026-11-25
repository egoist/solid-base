import { render, screen } from '@solidjs/testing-library';
import { Select } from '..';

describe('<Select.ItemText />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Select.Root open>
        <Select.Positioner>
          <Select.Item value="">
            <Select.ItemText
              data-testid="text"
              ref={(el) => {
                ref = el;
              }}
              class="text"
              style={{ color: 'red' }}
              render={(props) => <section {...props} />}
            >
              Apple
            </Select.ItemText>
          </Select.Item>
        </Select.Positioner>
      </Select.Root>
    ));
    const text = screen.getByTestId('text');
    expect(ref).toBe(text);
    expect(text.tagName).toBe('SECTION');
    expect(text).toHaveClass('text');
    expect(text).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('renders a div by default', () => {
    render(() => (
      <Select.Root open>
        <Select.Positioner>
          <Select.Item value="">
            <Select.ItemText data-testid="text">Apple</Select.ItemText>
          </Select.Item>
        </Select.Positioner>
      </Select.Root>
    ));
    expect(screen.getByTestId('text')).toBeInstanceOf(window.HTMLDivElement);
  });

  it('throws a descriptive error when rendered outside <Select.Item>', () => {
    // Rendered without a Root: a throw inside the Root's reactive children halts Solid.
    expect(() => render(() => <Select.ItemText />)).toThrow(
      'Base UI: SelectItemContext is missing. SelectItem parts must be placed within <Select.Item>.',
    );
  });
});
