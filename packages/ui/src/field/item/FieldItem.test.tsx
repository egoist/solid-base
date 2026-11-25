import { render, screen } from '@solidjs/testing-library';
import { Field } from '..';

describe('<Field.Item />', () => {
  it('renders a div and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Field.Root>
        <Field.Item
          data-testid="item"
          class="item"
          style={{ color: 'red' }}
          ref={(el) => {
            ref = el;
          }}
        />
      </Field.Root>
    ));
    const item = screen.getByTestId('item');
    expect(item.tagName).toBe('DIV');
    expect(item).toHaveClass('item');
    expect(item).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(item);
  });

  describe('prop: disabled', () => {
    it('reflects disabled state on the item', () => {
      const renderItem = vi.fn();

      render(() => (
        <Field.Root>
          <Field.Item
            disabled
            data-testid="item"
            render={(props, state) => {
              renderItem(state);
              return <div {...props} />;
            }}
          />
        </Field.Root>
      ));

      expect(screen.getByTestId('item')).toHaveAttribute('data-disabled');
      expect(renderItem.mock.lastCall?.[0].disabled).toBe(true);
    });

    it('inherits the disabled state of Field.Root', () => {
      render(() => (
        <Field.Root disabled>
          <Field.Item data-testid="item" />
        </Field.Root>
      ));

      expect(screen.getByTestId('item')).toHaveAttribute('data-disabled');
    });
  });

  it('creates its own label scope', () => {
    render(() => (
      <Field.Root>
        <Field.Description>Shared</Field.Description>
        <Field.Item>
          <Field.Label>Item label</Field.Label>
          <Field.Control />
        </Field.Item>
      </Field.Root>
    ));

    const control = screen.getByRole('textbox', { name: 'Item label' });
    expect(screen.getByText('Item label')).toHaveAttribute('for', control.id);
    expect(control).toHaveAttribute('aria-describedby', screen.getByText('Shared').id);
  });

  // Upstream's checkbox/radio group tests are ported with those components.
});
