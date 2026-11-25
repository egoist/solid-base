import { render, screen } from '@solidjs/testing-library';
import { Combobox } from '..';
import { useComboboxGroupContext } from './ComboboxGroupContext';

describe('<Combobox.Group />', () => {
  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root open>
        <Combobox.Group
          data-testid="group"
          ref={(el) => {
            ref = el;
          }}
          class="group"
          style={{ color: 'red' }}
          render={(props) => <section {...props} />}
        />
      </Combobox.Root>
    ));

    const group = screen.getByTestId('group');
    expect(ref).toBe(group);
    expect(group.tagName).toBe('SECTION');
    expect(group).toHaveClass('group');
    expect(group).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('should render group with label', () => {
    render(() => (
      <Combobox.Root open>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Group>
              <Combobox.GroupLabel>Fruits</Combobox.GroupLabel>
              <Combobox.Item value="apple">Apple</Combobox.Item>
              <Combobox.Item value="banana">Banana</Combobox.Item>
            </Combobox.Group>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby');
    // Without an anchor the positioner is never positioned, so it stays transparent
    // (`opacity: 0`): check presence instead of visibility.
    expect(screen.getByText('Fruits')).toBeInTheDocument();
  });

  it('should associate label with group', () => {
    render(() => (
      <Combobox.Root open>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Group>
              <Combobox.GroupLabel>Vegetables</Combobox.GroupLabel>
              <Combobox.Item value="carrot">Carrot</Combobox.Item>
              <Combobox.Item value="lettuce">Lettuce</Combobox.Item>
            </Combobox.Group>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const group = screen.getByRole('group');
    const label = screen.getByText('Vegetables');
    expect(group).toHaveAttribute('aria-labelledby', label.id);
  });

  it('uses the rowgroup role in grid mode', () => {
    render(() => (
      <Combobox.Root open grid>
        <Combobox.Group data-testid="group" />
      </Combobox.Root>
    ));

    expect(screen.getByTestId('group')).toHaveAttribute('role', 'rowgroup');
  });
});

describe('ComboboxGroupContext', () => {
  it('throws a descriptive error when used outside <Combobox.Group>', () => {
    function Consumer() {
      useComboboxGroupContext();
      return null;
    }

    expect(() => render(() => <Consumer />)).toThrow(
      'Base UI: ComboboxGroupContext is missing. ComboboxGroup parts must be placed within <Combobox.Group>.',
    );
  });
});
