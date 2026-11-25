import { flush } from 'solid-js';
import { fireEvent as baseFireEvent, render, screen } from '@solidjs/testing-library';
import { NumberField } from '..';

// Synchronous events are flushed right away, like `fireEvent` from `@mui/internal-test-utils`.
const fireEvent = new Proxy(baseFireEvent, {
  apply(target, thisArg, args: Parameters<typeof baseFireEvent>) {
    const result = Reflect.apply(target, thisArg, args);
    flush();
    return result;
  },
  get(target, key, receiver) {
    const value = Reflect.get(target, key, receiver);
    if (typeof value !== 'function') {
      return value;
    }
    return (...args: unknown[]) => {
      const result = value(...args);
      flush();
      return result;
    };
  },
}) as typeof baseFireEvent;

describe('<NumberField.Decrement />', () => {
  it('renders a button and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <NumberField.Root>
        <NumberField.Decrement
          data-testid="part"
          class={(state) => (state.disabled ? 'disabled' : 'enabled')}
          style={{ color: 'red' }}
          ref={(element) => {
            ref = element;
          }}
        />
        <NumberField.Decrement data-testid="rendered" render="span" nativeButton={false} />
      </NumberField.Root>
    ));
    const element = screen.getByTestId('part');
    expect(element.tagName).toBe('BUTTON');
    expect(element).toHaveClass('enabled');
    expect(element).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(element);
    expect(screen.getByTestId('rendered').tagName).toBe('SPAN');
  });

  describe('prop: snapOnStep', () => {
    it('should decrement by exact step without rounding when snapOnStep is false', async () => {
      render(() => (
        <NumberField.Root defaultValue={2.7} step={2} snapOnStep={false}>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue((0.7).toLocaleString());
    });

    it('should snap on decrement when snapOnStep is true', async () => {
      render(() => (
        <NumberField.Root defaultValue={1.3} snapOnStep>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('1');

      fireEvent.input(screen.getByRole('textbox'), { target: { value: '1.9' } });
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('1');

      fireEvent.input(screen.getByRole('textbox'), { target: { value: '-0.2' } });
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('-1');
    });

    it('should decrement with respect to the min value', async () => {
      render(() => (
        <NumberField.Root defaultValue={8} min={1} step={2} snapOnStep>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.click(button);
      expect(input).toHaveValue('7');

      fireEvent.click(button);
      expect(input).toHaveValue('5');

      fireEvent.input(input, { target: { value: '9.112' } });
      fireEvent.click(button);
      expect(input).toHaveValue('9');

      fireEvent.input(input, { target: { value: '1.112' } });
      fireEvent.click(button);
      expect(input).toHaveValue('1');
    });
  });
});
