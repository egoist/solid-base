import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Field } from '..';
import type { FieldValidityState } from './FieldValidity';
import { Form } from '../../form';

function change(element: HTMLElement, value: string) {
  fireEvent.input(element, { target: { value } });
  flush();
}

describe('<Field.Validity />', () => {
  // The children function is called once with a live state object: `lastState()` reads its
  // current values.
  function createHandler() {
    const handleValidity = vi.fn<(state: FieldValidityState) => undefined>();
    const lastState = () => handleValidity.mock.lastCall![0];
    return { handleValidity, lastState };
  }

  it.each([{ validationMode: 'onBlur' as const }, { validationMode: 'onSubmit' as const }])(
    'surfaces valueMissing immediately after a stale custom error in $validationMode mode',
    ({ validationMode }) => {
      const { handleValidity, lastState } = createHandler();
      const validate = vi.fn(() => 'custom error');

      render(() => (
        <Form>
          <Field.Root validationMode={validationMode} validate={validate}>
            <Field.Control required />
            <Field.Error match="valueMissing">Required</Field.Error>
            <Field.Validity>{handleValidity}</Field.Validity>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const input = screen.getByRole<HTMLInputElement>('textbox');
      const establishInvalidState = () => {
        if (validationMode === 'onBlur') {
          fireEvent.blur(input);
        } else {
          fireEvent.click(screen.getByText('submit'));
        }
        flush();
      };

      fireEvent.focus(input);
      change(input, 'invalid');
      establishInvalidState();

      expect(lastState().value).toBe('invalid');
      expect(lastState().validity.customError).toBe(true);
      expect(lastState().validity.valueMissing).toBe(false);
      expect(validate).toHaveBeenCalledTimes(1);

      fireEvent.focus(input);
      change(input, '');

      expect(lastState().value).toBe('');
      expect(lastState().validity.customError).toBe(validationMode === 'onSubmit');
      expect(lastState().validity.valueMissing).toBe(true);
      expect(screen.getByText('Required')).toBeVisible();
      expect(validate).toHaveBeenCalledTimes(validationMode === 'onBlur' ? 1 : 2);

      establishInvalidState();

      expect(lastState().value).toBe('');
      expect(lastState().validity.customError).toBe(validationMode === 'onSubmit');
      expect(lastState().validity.valueMissing).toBe(true);
      expect(screen.getByText('Required')).toBeVisible();
    },
  );

  // Skipped: "defers badInput during required change revalidation" needs a real browser to set
  // `badInput` on a number input (upstream skips it in jsdom too).

  it('renders the returned content reactively', () => {
    render(() => (
      <Field.Root validationMode="onBlur" validate={() => 'error'}>
        <Field.Control />
        <Field.Validity>
          {(state) => <span data-testid="validity">{state.errors.join(',')}</span>}
        </Field.Validity>
      </Field.Root>
    ));

    expect(screen.getByTestId('validity')).toHaveTextContent('');
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.blur(input);
    flush();
    expect(screen.getByTestId('validity')).toHaveTextContent('error');
  });

  it('combines the invalid prop into the validity', () => {
    const { handleValidity, lastState } = createHandler();
    render(() => (
      <Field.Root invalid>
        <Field.Control />
        <Field.Validity>{handleValidity}</Field.Validity>
      </Field.Root>
    ));

    expect(lastState().validity.valid).toBe(false);
  });

  describe('validationMode=onSubmit', () => {
    it('should pass validity data', () => {
      const { handleValidity, lastState } = createHandler();

      render(() => (
        <Form>
          <Field.Root>
            <Field.Control required />
            <Field.Validity>{handleValidity}</Field.Validity>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const input = screen.getByRole<HTMLInputElement>('textbox');

      expect(lastState().validity.valid).toBe(null);

      fireEvent.click(screen.getByText('submit'));
      flush();

      expect(lastState().validity.valid).toBe(false);
      expect(lastState().validity.valueMissing).toBe(true);
      expect(lastState()).toHaveProperty('transitionStatus');

      fireEvent.focus(input);
      change(input, 'test');

      expect(lastState().value).toBe('test');
      expect(lastState().validity.valid).toBe(true);
      expect(lastState().validity.valueMissing).toBe(false);
    });
  });

  describe('validationMode=onBlur', () => {
    it('should pass validity data', () => {
      const { handleValidity, lastState } = createHandler();

      render(() => (
        <Field.Root validationMode="onBlur">
          <Field.Control required />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('textbox');

      expect(lastState().validity.valid).toBe(null);

      fireEvent.focus(input);
      change(input, 'test');
      fireEvent.blur(input);
      flush();

      expect(lastState().value).toBe('test');
      expect(lastState().validity.valid).toBe(true);
      expect(lastState().validity.valueMissing).toBe(false);
    });

    it('should correctly pass errors when validate function returns a string', () => {
      const { handleValidity, lastState } = createHandler();

      render(() => (
        <Field.Root validationMode="onBlur" validate={() => 'error'}>
          <Field.Control />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('textbox');

      fireEvent.focus(input);
      fireEvent.blur(input);
      flush();

      expect(lastState().error).toBe('error');
      expect(lastState().errors).toEqual(['error']);
    });

    it('should correctly pass errors when validate function returns an array of strings', () => {
      const { handleValidity, lastState } = createHandler();

      render(() => (
        <Field.Root validationMode="onBlur" validate={() => ['1', '2']}>
          <Field.Control />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('textbox');

      fireEvent.focus(input);
      fireEvent.blur(input);
      flush();

      expect(lastState().error).toBe('1');
      expect(lastState().errors).toEqual(['1', '2']);
    });
  });
});
