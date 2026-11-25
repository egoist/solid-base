import { createSignal, flush, For, Show } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Field } from '..';
import { Form } from '../../form';

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe('<Field.Control />', () => {
  describe('conformance', () => {
    it('renders an input and supports class, style, render and ref', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Field.Root>
          <Field.Control
            data-testid="control"
            class={(state) => (state.disabled ? 'disabled' : 'enabled')}
            style={{ color: 'red' }}
            ref={(el) => {
              ref = el;
            }}
          />
        </Field.Root>
      ));
      const control = screen.getByTestId('control');
      expect(control.tagName).toBe('INPUT');
      expect(control).toHaveClass('enabled');
      expect(control).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(ref).toBe(control);
    });

    it('supports the render prop', () => {
      render(() => (
        <Field.Root>
          <Field.Control render={(props) => <input {...props} data-custom="" />} />
        </Field.Root>
      ));
      expect(screen.getByRole('textbox')).toHaveAttribute('data-custom');
    });
  });

  it('validates once when changed by the user', () => {
    const validate = vi.fn();

    render(() => (
      <Field.Root validationMode="onChange" validate={validate}>
        <Field.Control />
      </Field.Root>
    ));

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });
    flush();

    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.lastCall?.[0]).toBe('a');
  });

  it('validates once when a controlled value is changed by the user', () => {
    const validate = vi.fn(() => null);

    function App() {
      const [value, setValue] = createSignal('');
      return (
        <Field.Root validationMode="onChange" validate={validate}>
          <Field.Control value={value()} onValueChange={setValue} />
        </Field.Root>
      );
    }

    render(() => <App />);

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });
    flush();

    expect(validate).toHaveBeenCalledTimes(1);
  });

  it('clears dirty state when a numeric controlled value returns to its initial value', () => {
    function App() {
      const [value, setValue] = createSignal(5);
      return (
        <Field.Root data-testid="root">
          <Field.Control value={value()} onValueChange={(next) => setValue(Number(next))} />
        </Field.Root>
      );
    }

    render(() => <App />);

    const root = screen.getByTestId('root');
    const control = screen.getByRole('textbox');

    expect(root).not.toHaveAttribute('data-dirty');

    fireEvent.input(control, { target: { value: '56' } });
    flush();

    expect(root).toHaveAttribute('data-dirty', '');

    fireEvent.input(control, { target: { value: '5' } });
    flush();

    expect(root).not.toHaveAttribute('data-dirty');
  });

  it('syncs state and validates when the controlled value changes programmatically', () => {
    const validate = vi.fn((_value: unknown) => null);

    function App() {
      const [value, setValue] = createSignal('');
      return (
        <Field.Root data-testid="root" validationMode="onChange" validate={validate}>
          <Field.Control value={value()} onValueChange={setValue} />
          <button type="button" onClick={() => setValue('external')}>
            set
          </button>
        </Field.Root>
      );
    }

    render(() => <App />);

    fireEvent.click(screen.getByRole('button'));
    flush();

    const root = screen.getByTestId('root');

    expect(root).toHaveAttribute('data-filled', '');
    expect(root).toHaveAttribute('data-dirty', '');
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.lastCall?.[0]).toBe('external');
  });

  it('validates the final controlled value when it is normalized on blur', async () => {
    const validate = vi.fn((value: unknown) =>
      String(value).includes('@') ? null : 'Invalid email',
    );

    function App() {
      const [value, setValue] = createSignal('');
      return (
        <Field.Root validationMode="onBlur" validate={validate}>
          <Field.Control
            value={value()}
            onValueChange={setValue}
            onBlur={() => setValue((current) => current.trim())}
          />
          <Field.Error />
        </Field.Root>
      );
    }

    render(() => <App />);

    const control = screen.getByRole('textbox');
    fireEvent.input(control, { target: { value: 'foo ' } });
    flush();
    fireEvent.blur(control);
    flush();

    await flushMicrotasks();

    expect(validate.mock.lastCall?.[0]).toBe('foo');
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('keeps the final async validation when a controlled value is normalized on blur', async () => {
    const resolvers: Record<string, (value: string | null) => void> = {};
    const validate = vi.fn(
      (value: unknown) =>
        new Promise<string | null>((resolve) => {
          resolvers[String(value)] = resolve;
        }),
    );

    function App() {
      const [value, setValue] = createSignal('');
      return (
        <Field.Root validationMode="onBlur" validate={validate}>
          <Field.Control
            value={value()}
            onValueChange={setValue}
            onBlur={() => setValue((current) => current.trim())}
          />
          <Field.Error />
        </Field.Root>
      );
    }

    render(() => <App />);

    const control = screen.getByRole('textbox');
    fireEvent.input(control, { target: { value: 'foo ' } });
    flush();
    fireEvent.blur(control);
    flush();

    await flushMicrotasks();

    expect(validate).toHaveBeenCalledTimes(2);
    expect(validate.mock.lastCall?.[0]).toBe('foo');

    resolvers.foo('Invalid email');
    await flushMicrotasks();

    expect(screen.getByText('Invalid email')).toBeInTheDocument();

    resolvers['foo ']('Stale error');
    await flushMicrotasks();

    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('does not validate when a controlled value is reset to the initial value on blur', async () => {
    function App() {
      const [value, setValue] = createSignal('');
      return (
        <Field.Root validationMode="onBlur">
          <Field.Control
            required
            value={value()}
            onValueChange={setValue}
            onBlur={() => setValue('')}
          />
          <Field.Error match="valueMissing">Required</Field.Error>
        </Field.Root>
      );
    }

    render(() => <App />);

    const control = screen.getByRole('textbox');
    fireEvent.input(control, { target: { value: 'foo' } });
    flush();
    fireEvent.blur(control);
    flush();

    await flushMicrotasks();

    expect(screen.queryByText('Required')).toBe(null);
  });

  it('sets filled state on mount when the control is prefilled', () => {
    render(() => (
      <Field.Root data-testid="root">
        <Field.Control defaultValue="foo" />
      </Field.Root>
    ));

    expect(screen.getByTestId('root')).toHaveAttribute('data-filled', '');
  });

  it('does not set filled state on mount for an empty controlled value', () => {
    render(() => (
      <Field.Root data-testid="root">
        <Field.Control value="" onValueChange={() => {}} />
      </Field.Root>
    ));

    expect(screen.getByTestId('root')).not.toHaveAttribute('data-filled');
  });

  it('clears filled state when a controlled control remounts empty', () => {
    const [empty, setEmpty] = createSignal(false);
    render(() => (
      <Field.Root data-testid="root">
        <For each={[empty()]}>
          {(isEmpty) => <Field.Control value={isEmpty ? '' : 'value'} onValueChange={() => {}} />}
        </For>
      </Field.Root>
    ));

    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-filled', '');

    setEmpty(true);
    flush();

    expect(root).not.toHaveAttribute('data-filled');
  });

  it('clears filled state when an uncontrolled control remounts empty', () => {
    const [empty, setEmpty] = createSignal(false);
    render(() => (
      <Field.Root data-testid="root">
        <For each={[empty()]}>
          {(isEmpty) => <Field.Control defaultValue={isEmpty ? '' : 'value'} />}
        </For>
      </Field.Root>
    ));

    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-filled', '');

    setEmpty(true);
    flush();

    expect(root).not.toHaveAttribute('data-filled');
  });

  it('forwards a changing defaultValue', () => {
    const [defaultValue, setDefaultValue] = createSignal('');
    render(() => (
      <Field.Root data-testid="root">
        <Field.Control defaultValue={defaultValue()} />
      </Field.Root>
    ));

    const root = screen.getByTestId('root');
    expect(root).not.toHaveAttribute('data-filled');

    setDefaultValue('value');
    flush();

    expect(screen.getByRole('textbox')).toHaveValue('value');
    expect(root).toHaveAttribute('data-filled', '');
  });

  it('keeps filled state from the edited value when defaultValue changes', () => {
    const [defaultValue, setDefaultValue] = createSignal('');
    render(() => (
      <Field.Root data-testid="root">
        <Field.Control defaultValue={defaultValue()} />
      </Field.Root>
    ));

    const root = screen.getByTestId('root');
    const input = screen.getByRole('textbox');
    fireEvent.input(input, { target: { value: 'typed' } });
    flush();
    expect(root).toHaveAttribute('data-filled', '');

    setDefaultValue('next');
    flush();
    setDefaultValue('');
    flush();

    expect(input).toHaveValue('typed');
    expect(root).toHaveAttribute('data-filled', '');
  });

  it('sets filled state from a controlled value on a custom element', () => {
    render(() => (
      <Field.Root data-testid="root">
        <Field.Control value="value" onValueChange={() => {}} render="div" />
      </Field.Root>
    ));

    expect(screen.getByTestId('root')).toHaveAttribute('data-filled', '');
  });

  it('does not validate when the change is canceled', () => {
    const validate = vi.fn(() => null);

    render(() => (
      <Field.Root validationMode="onChange" validate={validate}>
        <Field.Control onValueChange={(_value, details) => details.cancel()} />
      </Field.Root>
    ));

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });
    flush();

    expect(validate).not.toHaveBeenCalled();
  });

  it('does not clear errors or validate when change is prevented', () => {
    const validate = vi.fn();
    const handleValueChange = vi.fn();

    render(() => (
      <Form errors={{ message: 'Server error' }}>
        <Field.Root name="message" validationMode="onChange" validate={validate}>
          <Field.Control onValueChange={handleValueChange} />
          <Field.Error />
        </Field.Root>
      </Form>
    ));

    const control = screen.getByRole<HTMLInputElement>('textbox');
    control.addEventListener('input', (event) => event.preventDefault(), {
      capture: true,
      once: true,
    });
    fireEvent.input(control, { cancelable: true, target: { value: 'a' } });
    flush();

    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(validate).not.toHaveBeenCalled();
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  // Skipped: implicit form submission on Enter is browser behavior that jsdom doesn't implement
  // (upstream skips these in jsdom too).

  it('validates the latest value when Enter does not submit the form', async () => {
    const validate = vi.fn((_value: unknown) => null);

    function App() {
      const [value, setValue] = createSignal('a');
      return (
        <Form
          onKeyDown={() => {
            setValue('');
            flush();
          }}
        >
          <Field.Root validate={validate}>
            <Field.Control value={value()} onValueChange={setValue} />
          </Field.Root>
          <input />
        </Form>
      );
    }

    render(() => <App />);

    const control = screen.getByDisplayValue<HTMLInputElement>('a');
    control.focus();
    fireEvent.keyDown(control, { key: 'Enter' });
    flush();

    await waitFor(() => {
      expect(validate).toHaveBeenCalledTimes(1);
    });

    expect(validate.mock.lastCall?.[0]).toBe('');
  });

  it('validates when Enter is pressed outside a form', () => {
    const validate = vi.fn(() => null);

    render(() => (
      <Field.Root validate={validate}>
        <Field.Control defaultValue="a" />
      </Field.Root>
    ));

    const control = screen.getByRole('textbox');
    control.focus();
    fireEvent.keyDown(control, { key: 'Enter' });
    flush();

    expect(validate).toHaveBeenCalledTimes(1);
  });

  it('shows a required error when a prefilled value is cleared', () => {
    render(() => (
      <Field.Root validationMode="onChange">
        <Field.Control data-testid="control" defaultValue="value" required />
        <Field.Error match="valueMissing">Required</Field.Error>
      </Field.Root>
    ));

    const control = screen.getByTestId('control');

    fireEvent.input(control, { target: { value: '' } });
    flush();

    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  describe('[data-focused]', () => {
    function setup() {
      const [firstMounted, setFirstMounted] = createSignal(true);
      const [firstDisabled, setFirstDisabled] = createSignal(false);
      render(() => (
        <>
          <Field.Root data-testid="root">
            <Field.Label data-testid="label">Name</Field.Label>
            <Show when={firstMounted()}>
              <Field.Control data-testid="first" disabled={firstDisabled()} />
            </Show>
          </Field.Root>
          <button type="button" data-testid="outside" />
        </>
      ));
      return { setFirstMounted, setFirstDisabled };
    }

    it('is removed when the focused control becomes disabled', () => {
      const { setFirstDisabled } = setup();

      const control = screen.getByTestId('first');
      control.focus();
      flush();

      expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
      expect(control).toHaveAttribute('data-focused', '');

      setFirstDisabled(true);
      flush();

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      expect(control).not.toHaveAttribute('data-focused');
      expect(screen.getByTestId('label')).not.toHaveAttribute('data-focused');
    });

    it('is removed when the field root becomes disabled', () => {
      const [disabled, setDisabled] = createSignal(false);
      render(() => (
        <Field.Root data-testid="root" disabled={disabled()}>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      screen.getByTestId('control').focus();
      flush();
      expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

      setDisabled(true);
      flush();

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
    });

    it('can be re-acquired after the control is re-enabled', () => {
      const { setFirstDisabled } = setup();

      const control = screen.getByTestId('first');
      control.focus();
      flush();
      expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

      setFirstDisabled(true);
      flush();
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');

      // Browsers move focus off a disabled control; jsdom leaves it as the active element.
      screen.getByTestId('outside').focus();
      flush();

      setFirstDisabled(false);
      flush();
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');

      control.focus();
      flush();
      expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
    });

    it('is removed when the focused control unmounts', () => {
      const { setFirstMounted } = setup();

      screen.getByTestId('first').focus();
      flush();

      expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

      setFirstMounted(false);
      flush();

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      expect(screen.getByTestId('label')).not.toHaveAttribute('data-focused');
    });
  });

  it('focuses on mount with autofocus and syncs the focused state', () => {
    render(() => (
      <Field.Root data-testid="root">
        <Field.Label>Name</Field.Label>
        <Field.Control autofocus />
      </Field.Root>
    ));
    flush();

    const control = screen.getByRole('textbox');
    expect(control).toHaveFocus();
    expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
    expect(screen.getByText('Name')).toHaveAttribute('data-focused', '');
  });

  describe('id', () => {
    it('updates the label association when the control is swapped', () => {
      const [controlKey, setControlKey] = createSignal('a');
      render(() => (
        <>
          <Field.Root>
            <Field.Label data-testid="label">Label</Field.Label>
            <For each={[controlKey()]}>{(key) => <Field.Control id={key} />}</For>
          </Field.Root>
          <button onClick={() => setControlKey('b')}>swap</button>
        </>
      ));

      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'a');
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

      fireEvent.click(screen.getByRole('button'));
      flush();

      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'b');
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'b');
    });
  });
});
