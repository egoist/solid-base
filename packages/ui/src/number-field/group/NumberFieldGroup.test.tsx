import { render, screen } from '@solidjs/testing-library';
import { NumberField } from '..';

describe('<NumberField.Group />', () => {
  it('renders a div and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <NumberField.Root>
        <NumberField.Group
          data-testid="part"
          class={(state) => (state.disabled ? 'disabled' : 'enabled')}
          style={{ color: 'red' }}
          ref={(element) => {
            ref = element;
          }}
        />
        <NumberField.Group data-testid="rendered" render="span" />
      </NumberField.Root>
    ));
    const element = screen.getByTestId('part');
    expect(element.tagName).toBe('DIV');
    expect(element).toHaveClass('enabled');
    expect(element).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(element);
    expect(screen.getByTestId('rendered').tagName).toBe('SPAN');
  });

  it('has role prop', async () => {
    render(() => (
      <NumberField.Root>
        <NumberField.Group />
      </NumberField.Root>
    ));
    expect(screen.queryByRole('group')).not.toBe(null);
  });
});
