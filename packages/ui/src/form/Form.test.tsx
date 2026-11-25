import { createSignal, flush, For, Show } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Form } from '.';
import { Field } from '../field';
import { Fieldset } from '../fieldset';

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe('<Form />', () => {
  describe('conformance', () => {
    it('renders a form and supports class, style and ref', () => {
      let ref: HTMLFormElement | undefined;
      render(() => (
        <Form
          data-testid="form"
          class="my-form"
          style={{ color: 'red' }}
          ref={(el) => {
            ref = el;
          }}
        />
      ));
      const form = screen.getByTestId('form');
      expect(form.tagName).toBe('FORM');
      expect(form).toHaveClass('my-form');
      expect(form).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(ref).toBe(form);
    });

    it('supports the render prop', () => {
      render(() => (
        <Form data-testid="form" render={(props) => <form {...props} data-custom="" />} />
      ));
      expect(screen.getByTestId('form')).toHaveAttribute('data-custom');
    });
  });

  it('does not submit if there are errors', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(() => (
      <Form onSubmit={onSubmit}>
        <Field.Root>
          <Field.Control required />
          <Field.Error data-testid="error" />
        </Field.Root>
        <button>Submit</button>
      </Form>
    ));

    await user.click(screen.getByRole('button'));

    expect(screen.getByTestId('error')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submit and focuses the first invalid field across custom and native validation', async () => {
    const user = userEvent.setup();
    const onFormSubmit = vi.fn();
    const select = vi.spyOn(HTMLInputElement.prototype, 'select');

    try {
      render(() => (
        <Form onFormSubmit={onFormSubmit}>
          <Field.Root name="custom" validate={() => 'custom error'}>
            <Field.Control data-testid="custom" />
          </Field.Root>
          <Field.Root name="native">
            <Field.Control data-testid="native" required />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(onFormSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('custom')).toHaveFocus();
      expect(select).toHaveBeenCalledTimes(1);
    } finally {
      select.mockRestore();
    }
  });

  // Skipped: the Checkbox-based focus tests (value change, disconnected shadow trees, keyed
  // reorder) and the Switch-based registration tests depend on components not ported yet.

  it('submits when a valid async validator is pending', () => {
    const onSubmit = vi.fn((event: SubmitEvent) => {
      event.preventDefault();
    });
    const validate = vi.fn(() => new Promise<null>(() => {}));

    render(() => (
      <Form onSubmit={onSubmit}>
        <Field.Root validate={validate}>
          <Field.Control />
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    flush();

    expect(validate).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('re-runs an onBlur cross-field validator on submit', () => {
    const onFormSubmit = vi.fn();
    const validate = vi.fn((value: unknown, formValues: Form.Values) =>
      value !== formValues.password ? 'Passwords do not match' : null,
    );

    render(() => (
      <Form onFormSubmit={onFormSubmit}>
        <Field.Root name="password" validationMode="onBlur">
          <Field.Control data-testid="password" />
        </Field.Root>
        <Field.Root name="confirmPassword" validationMode="onBlur" validate={validate}>
          <Field.Control data-testid="confirm" />
          <Field.Error data-testid="confirm-error" />
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>
    ));

    const password = screen.getByTestId('password');
    const confirm = screen.getByTestId('confirm');

    fireEvent.input(password, { target: { value: 'secret' } });
    flush();
    fireEvent.input(confirm, { target: { value: 'typo' } });
    flush();
    fireEvent.blur(confirm);
    flush();

    expect(validate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('confirm-error')).toHaveTextContent('Passwords do not match');

    fireEvent.input(password, { target: { value: 'typo' } });
    flush();
    fireEvent.blur(password);
    flush();

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    flush();

    expect(validate).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('confirm-error')).toBe(null);
    expect(onFormSubmit).toHaveBeenCalledTimes(1);
  });

  it('retires a stale async validation result on the next submit', async () => {
    const onFormSubmit = vi.fn();
    const validate = vi.fn((value: unknown) =>
      Promise.resolve(value === 'bad' ? 'async error' : null),
    );

    render(() => (
      <Form onFormSubmit={onFormSubmit}>
        <Field.Root name="field" validationMode="onSubmit" validate={validate}>
          <Field.Control data-testid="control" defaultValue="bad" />
          <Field.Error data-testid="error" />
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>
    ));

    const control = screen.getByTestId('control');
    const submit = screen.getByRole('button', { name: 'Submit' });

    fireEvent.click(submit);
    flush();

    expect(onFormSubmit).toHaveBeenCalledTimes(1);

    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('async error');
    });

    fireEvent.input(control, { target: { value: 'good' } });
    flush();
    fireEvent.click(submit);
    flush();

    expect(onFormSubmit).toHaveBeenCalledTimes(2);

    expect(screen.queryByTestId('error')).toBe(null);

    await flushMicrotasks();
  });

  it.each([{ validationMode: 'onBlur' as const }, { validationMode: 'onChange' as const }])(
    'blocks submission on a resolved async error in $validationMode mode',
    async ({ validationMode }) => {
      const onFormSubmit = vi.fn();
      const validate = vi.fn((value: unknown) =>
        Promise.resolve(value === 'taken' ? 'Username is taken' : null),
      );

      render(() => (
        <Form onFormSubmit={onFormSubmit}>
          <Field.Root name="username" validationMode={validationMode} validate={validate}>
            <Field.Control data-testid="control" />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const control = screen.getByTestId('control');

      fireEvent.input(control, { target: { value: 'taken' } });
      flush();
      fireEvent.blur(control);
      flush();
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Username is taken');
      });

      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
      flush();

      expect(onFormSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('error')).toHaveTextContent('Username is taken');

      await flushMicrotasks();
    },
  );

  it('unmounted fields should be removed from the form', async () => {
    const user = userEvent.setup();
    const submitSpy = vi.fn((event: SubmitEvent) => event.preventDefault());

    function App() {
      const [checked, setChecked] = createSignal(true);

      return (
        <Form onSubmit={submitSpy}>
          <Field.Root name="name">
            <Field.Control defaultValue="Alice" />
          </Field.Root>

          <input type="checkbox" checked={checked()} onChange={() => setChecked(!checked())} />

          <Show when={checked()}>
            <Field.Root name="email">
              <Field.Control defaultValue="" required data-testid="email" />
            </Field.Root>
          </Show>

          <button>Submit</button>
        </Form>
      );
    }

    render(() => <App />);

    const submit = screen.getByText('Submit');

    await user.click(submit);
    expect(submitSpy).toHaveBeenCalledTimes(0);
    expect(screen.getByTestId('email')).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('checkbox'));
    await user.click(submit);
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it('excludes disabled fieldset fields from validation and onFormSubmit values', () => {
    const handleSubmit = vi.fn();

    render(() => (
      <Form onFormSubmit={handleSubmit}>
        <Fieldset.Root disabled>
          <Field.Root name="disabled">
            <Field.Control required data-testid="disabled" />
          </Field.Root>
        </Fieldset.Root>
        <Field.Root name="enabled">
          <Field.Control defaultValue="sent" />
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    flush();

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit.mock.lastCall?.[0]).toEqual({ enabled: 'sent' });
    expect(screen.getByTestId('disabled')).not.toHaveAttribute('aria-invalid');
  });

  it('clears invalid UI when a fieldset field becomes disabled', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    function App() {
      const [disabled, setDisabled] = createSignal(false);

      return (
        <Form onFormSubmit={handleSubmit}>
          <Fieldset.Root disabled={disabled()}>
            <Field.Root name="disabled">
              <Field.Control required data-testid="control" />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Fieldset.Root>
          <button type="button" onClick={() => setDisabled(true)}>
            Disable
          </button>
          <button type="button" onClick={() => setDisabled(false)}>
            Enable
          </button>
          <button type="submit">Submit</button>
        </Form>
      );
    }

    render(() => <App />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('control')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('error')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disable' }));

    expect(screen.getByTestId('control')).toBeDisabled();
    expect(screen.getByTestId('control')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByTestId('error')).toBe(null);

    // jsdom (like browsers) doesn't dispatch clicks on buttons inside a disabled fieldset, but the
    // submit button is outside of it here.
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit.mock.lastCall?.[0]).toEqual({});

    await user.click(screen.getByRole('button', { name: 'Enable' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('control')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('error')).toBeInTheDocument();
  });

  it('clears invalid attributes when a field control becomes disabled', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    function App() {
      const [disabled, setDisabled] = createSignal(false);

      return (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="disabled">
            <Field.Control disabled={disabled()} required data-testid="control" />
          </Field.Root>
          <button type="button" onClick={() => setDisabled(true)}>
            Disable
          </button>
          <button type="submit">Submit</button>
        </Form>
      );
    }

    render(() => <App />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(screen.getByTestId('control')).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('button', { name: 'Disable' }));

    expect(screen.getByTestId('control')).toBeDisabled();
    expect(screen.getByTestId('control')).not.toHaveAttribute('aria-invalid');

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit.mock.lastCall?.[0]).toEqual({});
  });

  it('re-registers field controls when they become enabled again', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    function App() {
      const [disabled, setDisabled] = createSignal(false);

      return (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="control">
            <Field.Control disabled={disabled()} required data-testid="control" />
          </Field.Root>
          <button type="button" onClick={() => setDisabled(true)}>
            Disable
          </button>
          <button type="button" onClick={() => setDisabled(false)}>
            Enable
          </button>
          <button type="submit">Submit</button>
        </Form>
      );
    }

    render(() => <App />);
    const submit = screen.getByRole('button', { name: 'Submit' });

    await user.click(submit);

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('control')).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('button', { name: 'Disable' }));
    await user.click(submit);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit.mock.lastCall?.[0]).toEqual({});

    await user.click(screen.getByRole('button', { name: 'Enable' }));
    await user.click(submit);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('control')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByTestId('control'), 'sent');
    await user.click(submit);

    expect(handleSubmit).toHaveBeenCalledTimes(2);
    expect(handleSubmit.mock.lastCall?.[0]).toEqual({ control: 'sent' });
  });

  describe('prop: errors', () => {
    it('should mark <Field.Control> as invalid and populate <Field.Error>', () => {
      render(() => (
        <Form errors={{ foo: 'bar' }}>
          <Field.Root name="foo">
            <Field.Control />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));

      expect(screen.getByTestId('error')).toHaveTextContent('bar');
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('should not mark <Field.Control> as invalid if no error is provided', () => {
      render(() => (
        <Form>
          <Field.Root name="foo">
            <Field.Control />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));

      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
    });

    it('focuses asynchronously replaced external errors and clears only the changed own property', async () => {
      const user = userEvent.setup();

      function App() {
        const [errors, setErrors] = createSignal<Form.Props['errors']>();

        return (
          <Form
            errors={errors()}
            onFormSubmit={() => {
              const nextErrors = Object.create(null) as Record<string, string>;
              nextErrors.first = 'First error';
              nextErrors.second = 'Second error';
              Promise.resolve().then(() => setErrors(nextErrors));
            }}
          >
            <Field.Root name="first">
              <Field.Control data-testid="first" />
              <Field.Error data-testid="first-error" />
            </Field.Root>
            <Field.Root name="second">
              <Field.Control data-testid="second" />
              <Field.Error data-testid="second-error" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      render(() => <App />);

      await user.click(screen.getByRole('button', { name: 'Submit' }));
      await waitFor(() => expect(screen.getByTestId('first')).toHaveFocus());
      expect(screen.getByTestId('first-error')).toHaveTextContent('First error');
      expect(screen.getByTestId('second-error')).toHaveTextContent('Second error');

      await user.type(screen.getByTestId('first'), 'a');

      expect(screen.queryByTestId('first-error')).toBe(null);
      expect(screen.getByTestId('second-error')).toHaveTextContent('Second error');
    });

    function App() {
      const [errors, setErrors] = createSignal<Form.Props['errors']>({});

      return (
        <Form
          errors={errors()}
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget as HTMLFormElement);
            const name = formData.get('name') as string;
            const age = formData.get('age') as string;

            setErrors({
              ...(name === '' && { name: 'Name is required' }),
              ...(age === '' && { age: 'Age is required' }),
            });
          }}
        >
          <Field.Root name="name">
            <Field.Control data-testid="name" />
            <Field.Error data-testid="name-error" />
          </Field.Root>
          <Field.Root name="age">
            <Field.Control data-testid="age" />
            <Field.Error data-testid="age-error" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      );
    }

    it('focuses the first invalid field only on submit', async () => {
      const user = userEvent.setup();
      render(() => <App />);

      const submit = screen.getByRole('button');
      const name = screen.getByTestId('name');
      const age = screen.getByTestId('age');

      await user.click(submit);

      expect(name).toHaveFocus();

      fireEvent.input(name, { target: { value: 'John' } });
      flush();

      expect(age).not.toHaveFocus();

      await user.click(submit);

      expect(age).toHaveFocus();

      fireEvent.input(age, { target: { value: '42' } });
      flush();

      await user.click(submit);

      expect(age).not.toHaveFocus();
    });

    it('does not swap focus immediately on change after two submissions', async () => {
      const user = userEvent.setup();
      render(() => <App />);

      const submit = screen.getByRole('button');
      const name = screen.getByTestId('name');
      const age = screen.getByTestId('age');

      await user.click(submit);

      expect(name).toHaveFocus();

      await user.click(submit);

      fireEvent.input(name, { target: { value: 'John' } });
      flush();

      expect(age).not.toHaveFocus();
    });

    it('removes errors upon change', () => {
      render(() => <App />);

      const name = screen.getByTestId('name');
      const age = screen.getByTestId('age');

      fireEvent.click(screen.getByText('Submit'));
      flush();

      expect(screen.queryByTestId('name-error')).not.toBe(null);
      expect(screen.queryByTestId('age-error')).not.toBe(null);

      fireEvent.input(name, { target: { value: 'John' } });
      flush();
      fireEvent.input(age, { target: { value: '42' } });
      flush();
      expect(screen.queryByTestId('name-error')).toBe(null);
      expect(screen.queryByTestId('age-error')).toBe(null);
    });

    it('runs field validation on first change after Form error is set', async () => {
      const user = userEvent.setup();
      const validateSpy = vi.fn((value: unknown) => {
        if (value === 'abcd') {
          return 'field error';
        }
        return null;
      });

      function Test() {
        const [errors, setErrors] = createSignal<Form.Props['errors']>({});

        return (
          <Form
            errors={errors()}
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget as HTMLFormElement);
              const name = formData.get('name') as string;

              if (name === 'abcde') {
                setErrors({ name: 'submit error' });
              } else {
                setErrors({});
              }
            }}
          >
            <Field.Root name="name" validate={validateSpy}>
              <Field.Control data-testid="name" />
              <Field.Error data-testid="name-error" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      render(() => <Test />);

      const input = screen.getByTestId('name');
      await user.click(input);
      await user.keyboard('abcde');
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      expect(screen.queryByTestId('name-error')).not.toBe(null);
      expect(screen.getByTestId('name-error')).toHaveTextContent('submit error');

      validateSpy.mockClear();

      await user.click(input);
      // value changes from 'abcde' to 'abcd'
      await user.keyboard('{Backspace}');
      expect(validateSpy).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('name-error')).not.toBe(null);
      expect(screen.getByTestId('name-error')).toHaveTextContent('field error');
    });

    it('runs field validation on change when invalid prop is true and validationMode is onChange', async () => {
      const user = userEvent.setup();
      const validateSpy = vi.fn(() => 'field error');

      render(() => (
        <Form errors={{ name: 'server error' }}>
          <Field.Root name="name" invalid validate={validateSpy} validationMode="onChange">
            <Field.Control data-testid="name" />
            <Field.Error data-testid="name-error" />
          </Field.Root>
        </Form>
      ));

      const input = screen.getByTestId('name');
      expect(screen.getByTestId('name-error')).toHaveTextContent('server error');

      await user.click(input);
      await user.keyboard('a');

      expect(validateSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('name-error')).toHaveTextContent('field error');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not run field validation on change for onBlur mode when invalid prop is true', async () => {
      const user = userEvent.setup();
      const validateSpy = vi.fn(() => 'field error');

      render(() => (
        <Form errors={{ name: 'server error' }}>
          <Field.Root name="name" invalid validate={validateSpy} validationMode="onBlur">
            <Field.Control data-testid="name" />
            <Field.Error data-testid="name-error" />
          </Field.Root>
        </Form>
      ));

      const input = screen.getByTestId('name');
      expect(screen.getByTestId('name-error')).toHaveTextContent('server error');

      await user.click(input);
      await user.keyboard('a');
      expect(validateSpy).toHaveBeenCalledTimes(0);
      expect(screen.queryByTestId('name-error')).toBe(null);

      await user.tab();
      expect(validateSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('name-error')).toHaveTextContent('field error');
    });

    it('removes errors for every field that changes within a single batch', () => {
      const errors = { a: 'A error', b: 'B error', c: 'C error' };
      const [a, setA] = createSignal('');
      const [b, setB] = createSignal('');
      const [c, setC] = createSignal('');

      // Upstream uses Switch; Field.Control exercises the same controlled-value path.
      render(() => (
        <Form errors={errors}>
          <Field.Root name="a">
            <Field.Control value={a()} onValueChange={setA} />
            <Field.Error data-testid="a-error" />
          </Field.Root>
          <Field.Root name="b">
            <Field.Control value={b()} onValueChange={setB} />
            <Field.Error data-testid="b-error" />
          </Field.Root>
          <Field.Root name="c">
            <Field.Control value={c()} onValueChange={setC} />
            <Field.Error data-testid="c-error" />
          </Field.Root>
          <button
            type="button"
            onClick={() => {
              setA('a');
              setB('b');
            }}
          >
            Change both
          </button>
        </Form>
      ));

      expect(screen.queryByTestId('a-error')).not.toBe(null);
      expect(screen.queryByTestId('b-error')).not.toBe(null);
      expect(screen.queryByTestId('c-error')).not.toBe(null);

      fireEvent.click(screen.getByText('Change both'));
      flush();

      expect(screen.queryByTestId('a-error')).toBe(null);
      expect(screen.queryByTestId('b-error')).toBe(null);
      expect(screen.queryByTestId('c-error')).not.toBe(null);
    });

    it('follows changes of the errors prop', () => {
      const [errors, setErrors] = createSignal<Form.Props['errors']>({});
      render(() => (
        <Form errors={errors()}>
          <Field.Root name="foo">
            <Field.Control />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));

      expect(screen.queryByTestId('error')).toBe(null);

      setErrors({ foo: ['first', 'second'] });
      flush();

      const error = screen.getByTestId('error');
      expect(error.querySelectorAll('li')).toHaveLength(2);
      expect(error).toHaveTextContent('firstsecond');

      setErrors({});
      flush();
      expect(screen.queryByTestId('error')).toBe(null);
    });
  });

  describe('prop: onFormSubmit', () => {
    it('runs when the form is submitted', () => {
      const submitSpy = vi.fn((formValues: unknown, eventDetails: Form.SubmitEventDetails) => ({
        formValues,
        eventDetails,
      }));

      // Upstream also includes a NumberField, which isn't ported yet.
      render(() => (
        <Form onFormSubmit={submitSpy}>
          <Field.Root name="username">
            <Field.Control defaultValue="alice132" />
          </Field.Root>
          <Field.Root>
            <Field.Control name="quantity" defaultValue="5" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      fireEvent.click(screen.getByText('submit'));
      flush();

      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(submitSpy.mock.results.at(-1)?.value.formValues).toEqual({
        username: 'alice132',
        quantity: '5',
      });
      expect(submitSpy.mock.results.at(-1)?.value.eventDetails.reason).toBe('none');
      expect(submitSpy.mock.results.at(-1)?.value.eventDetails.event.defaultPrevented).toBe(true);
    });

    it('does not run when the form is invalid', () => {
      const submitSpy = vi.fn();

      render(() => (
        <Form onFormSubmit={submitSpy}>
          <Field.Root name="username">
            <Field.Control defaultValue="" required />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));
      expect(screen.queryByTestId('error')).toBe(null);
      fireEvent.click(screen.getByText('submit'));
      flush();
      expect(submitSpy).toHaveBeenCalledTimes(0);
      expect(screen.queryByTestId('error')).not.toBe(null);
    });
  });

  it('does not submit when invalid prop remains true even if validate returns null', async () => {
    const user = userEvent.setup();
    const submitSpy = vi.fn();
    const validateSpy = vi.fn(() => null);

    render(() => (
      <Form onSubmit={submitSpy}>
        <Field.Root name="name" invalid validate={validateSpy} validationMode="onChange">
          <Field.Control data-testid="name" />
          <Field.Error data-testid="name-error" />
        </Field.Root>
        <button type="submit">submit</button>
      </Form>
    ));

    const input = screen.getByTestId('name');
    await user.click(input);
    await user.keyboard('o');

    expect(validateSpy).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('submit'));

    expect(submitSpy).toHaveBeenCalledTimes(0);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  describe('prop: novalidate', () => {
    it('should disable native validation by default', () => {
      render(() => <Form data-testid="form" />);
      expect(screen.getByTestId('form')).toHaveAttribute('novalidate');
    });

    it('should enable native validation if set to false', () => {
      render(() => <Form novalidate={false} data-testid="form" />);
      expect(screen.getByTestId('form')).not.toHaveAttribute('novalidate');
    });
  });

  describe('prop: actionsRef', () => {
    // Upstream uses a NumberField for the second field, which isn't ported yet.
    it('validates the form when the `validate` method is called (object ref)', async () => {
      const user = userEvent.setup();
      const actionsRef: { current: Form.Actions | null } = { current: null };

      render(() => (
        <div>
          <Form actionsRef={actionsRef}>
            <Field.Root name="username">
              <Field.Control defaultValue="" required />
              <Field.Error data-testid="error" />
            </Field.Root>
            <Field.Root name="quantity" validate={() => 'error'}>
              <Field.Control defaultValue="5" />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
          <button type="button" onClick={() => actionsRef.current?.validate()}>
            validate
          </button>
        </div>
      ));

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('validate'));

      expect(screen.queryAllByTestId('error').length).toBe(2);
    });

    it('validates a field when the `validate` method is called with the field name (callback ref)', async () => {
      const user = userEvent.setup();
      let actions: Form.Actions | null = null;

      render(() => (
        <div>
          <Form
            actionsRef={(value) => {
              actions = value;
            }}
          >
            <Field.Root name="username">
              <Field.Control defaultValue="" required />
              <Field.Error data-testid="error" />
            </Field.Root>
            <Field.Root name="quantity" validate={() => 'quantity error'}>
              <Field.Control defaultValue="5" />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
          <button type="button" onClick={() => actions?.validate('quantity')}>
            validate
          </button>
        </div>
      ));

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('validate'));

      expect(screen.getByTestId('error')).toHaveTextContent('quantity error');
    });

    it('clears a callback actionsRef on unmount', () => {
      const actionsRef = vi.fn();
      const { unmount } = render(() => <Form actionsRef={actionsRef} />);
      expect(actionsRef).toHaveBeenLastCalledWith(
        expect.objectContaining({ validate: expect.any(Function) }),
      );
      unmount();
      expect(actionsRef).toHaveBeenLastCalledWith(null);
    });

    it('targets only the current registration after name, id, and control replacement', async () => {
      const user = userEvent.setup();
      const initialValidate = vi.fn(() => null);
      const renamedValidate = vi.fn(() => null);
      const replacementValidate = vi.fn(() => null);

      function App() {
        const actionsRef: { current: Form.Actions | null } = { current: null };
        const [step, setStep] = createSignal(0);
        const visible = () => step() !== 2;
        const name = () => (step() === 0 ? 'initial' : 'current');
        const validate = () => {
          const current = step();
          if (current === 1) {
            return renamedValidate;
          }
          if (current > 1) {
            return replacementValidate;
          }
          return initialValidate;
        };

        return (
          <>
            <Form actionsRef={actionsRef}>
              <Show when={visible()}>
                <For each={[step()]}>
                  {(key) => (
                    <Field.Root name={name()} validate={validate()}>
                      <Field.Control id={`control-${key}`} />
                    </Field.Root>
                  )}
                </For>
              </Show>
            </Form>
            <button type="button" onClick={() => setStep(1)}>
              Rename
            </button>
            <button type="button" onClick={() => setStep(2)}>
              Unmount
            </button>
            <button type="button" onClick={() => setStep(3)}>
              Replace
            </button>
            <button type="button" onClick={() => actionsRef.current?.validate('initial')}>
              Validate initial
            </button>
            <button type="button" onClick={() => actionsRef.current?.validate('current')}>
              Validate current
            </button>
          </>
        );
      }

      render(() => <App />);

      await user.click(screen.getByRole('button', { name: 'Rename' }));
      await user.click(screen.getByRole('button', { name: 'Validate initial' }));
      await user.click(screen.getByRole('button', { name: 'Validate current' }));

      expect(initialValidate).not.toHaveBeenCalled();
      expect(renamedValidate).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole('button', { name: 'Unmount' }));
      await user.click(screen.getByRole('button', { name: 'Validate current' }));
      expect(renamedValidate).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole('button', { name: 'Replace' }));
      await user.click(screen.getByRole('button', { name: 'Validate current' }));

      expect(replacementValidate).toHaveBeenCalledTimes(1);
    });
  });
});
