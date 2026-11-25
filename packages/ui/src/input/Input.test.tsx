import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Input } from '.';
import { Field } from '../field';

describe('<Input />', () => {
  it('renders an input and supports class, style and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Input
        data-testid="input"
        class={(state) => (state.disabled ? 'disabled' : 'enabled')}
        style={{ color: 'red' }}
        ref={(el) => {
          ref = el;
        }}
      />
    ));
    const input = screen.getByTestId('input');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveClass('enabled');
    expect(input).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(input);
  });

  it('supports the render prop', () => {
    render(() => <Input render={(props) => <input {...props} data-custom="" />} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('data-custom');
  });

  it('applies data-disabled when disabled', () => {
    render(() => <Input disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('data-disabled');
  });

  it('calls onValueChange and supports controlled values', () => {
    const [value, setValue] = createSignal('a');
    const handleValueChange = vi.fn((next: string) => setValue(next));
    render(() => <Input value={value()} onValueChange={handleValueChange} />);
    const input = screen.getByRole<HTMLInputElement>('textbox');
    expect(input.value).toBe('a');

    fireEvent.input(input, { target: { value: 'ab' } });
    flush();
    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(handleValueChange.mock.lastCall?.[0]).toBe('ab');
    expect(value()).toBe('ab');

    setValue('xyz');
    flush();
    expect(input.value).toBe('xyz');
  });

  it('works with Field', () => {
    render(() => (
      <Field.Root data-testid="root">
        <Field.Label>Name</Field.Label>
        <Input />
      </Field.Root>
    ));
    const input = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.input(input, { target: { value: 'x' } });
    flush();
    expect(screen.getByTestId('root')).toHaveAttribute('data-dirty');
    expect(input).toHaveAttribute('data-filled');
  });
});
