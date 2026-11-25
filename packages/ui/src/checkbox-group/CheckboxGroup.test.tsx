import { createSignal, flush, onSettled, Show } from 'solid-js';
import { Portal } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { CheckboxGroup } from '.';
import { Checkbox } from '../checkbox';
import { Field } from '../field';
import { Form } from '../form';
import { createRefObject } from '@egoist/solid-base-utils/refObject';

function click(element: Element) {
  fireEvent.click(element);
  flush();
}

async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
  flush();
}

describe('<CheckboxGroup />', () => {
  describe('conformance', () => {
    it('renders a div and supports class, style, render and ref', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <CheckboxGroup
          data-testid="group"
          disabled
          class={(state) => (state.disabled ? 'is-disabled' : '')}
          style={{ color: 'red' }}
          ref={(el) => {
            ref = el;
          }}
        />
      ));
      const group = screen.getByTestId('group');
      expect(group.tagName).toBe('DIV');
      expect(group).toHaveClass('is-disabled');
      expect(group).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(ref).toBe(group);
    });

    it('supports the render prop', () => {
      render(() => <CheckboxGroup data-testid="group" render="section" />);
      expect(screen.getByTestId('group').tagName).toBe('SECTION');
    });
  });

  describe('prop: id', () => {
    it('is forwarded to the root element', () => {
      render(() => <CheckboxGroup id="group-id" />);

      expect(screen.getByRole('group')).toHaveAttribute('id', 'group-id');
    });
  });

  describe('prop: value', () => {
    it('should control the value', () => {
      function App() {
        const [value, setValue] = createSignal(['red']);
        return (
          <CheckboxGroup value={value()} onValueChange={setValue}>
            <Checkbox.Root name="red" data-testid="red" />
            <Checkbox.Root name="green" data-testid="green" />
            <Checkbox.Root name="blue" data-testid="blue" />
          </CheckboxGroup>
        );
      }

      render(() => <App />);

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'false');
      expect(blue).toHaveAttribute('aria-checked', 'false');

      click(green);

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'true');
      expect(blue).toHaveAttribute('aria-checked', 'false');

      click(blue);

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'true');
      expect(blue).toHaveAttribute('aria-checked', 'true');

      click(green);

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'false');
      expect(blue).toHaveAttribute('aria-checked', 'true');
    });

    it('supports an empty string item value', () => {
      function App() {
        const [value, setValue] = createSignal(['']);
        return (
          <CheckboxGroup value={value()} onValueChange={setValue}>
            <Checkbox.Root value="" data-testid="empty" />
            <Checkbox.Root value="other" data-testid="other" />
          </CheckboxGroup>
        );
      }

      render(() => <App />);

      const empty = screen.getByTestId('empty');
      const other = screen.getByTestId('other');

      expect(empty).toHaveAttribute('aria-checked', 'true');
      expect(other).toHaveAttribute('aria-checked', 'false');

      click(empty);

      expect(empty).toHaveAttribute('aria-checked', 'false');
    });

    it('treats a controlled value that becomes undefined as an empty array', () => {
      const [value, setValue] = createSignal<string[] | undefined>(['red']);
      render(() => (
        <>
          <CheckboxGroup value={value()}>
            <Checkbox.Root value="red" data-testid="red" />
          </CheckboxGroup>
          <button type="button" onClick={() => setValue(undefined)}>
            Clear
          </button>
        </>
      ));

      expect(screen.getByTestId('red')).toHaveAttribute('aria-checked', 'true');

      click(screen.getByText('Clear'));

      expect(screen.getByTestId('red')).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: onValueChange', () => {
    it('should be called when the value changes', () => {
      const handleValueChange = vi.fn();

      function App() {
        const [value, setValue] = createSignal<string[]>([]);
        return (
          <CheckboxGroup
            value={value()}
            onValueChange={(nextValue) => {
              setValue(nextValue);
              handleValueChange(nextValue);
            }}
          >
            <Checkbox.Root name="red" data-testid="red" />
            <Checkbox.Root name="green" data-testid="green" />
            <Checkbox.Root name="blue" data-testid="blue" />
          </CheckboxGroup>
        );
      }

      render(() => <App />);

      click(screen.getByTestId('red'));

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['red']);

      click(screen.getByTestId('green'));

      expect(handleValueChange.mock.calls.length).toBe(2);
      expect(handleValueChange.mock.calls[1][0]).toEqual(['red', 'green']);

      click(screen.getByTestId('blue'));

      expect(handleValueChange.mock.calls.length).toBe(3);
      expect(handleValueChange.mock.calls[2][0]).toEqual(['red', 'green', 'blue']);
    });

    it('should treat an omitted defaultValue as an empty array', () => {
      const handleValueChange = vi.fn();

      render(() => (
        <CheckboxGroup onValueChange={handleValueChange}>
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>
      ));

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');

      click(red);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['red']);

      click(green);
      expect(handleValueChange.mock.calls[1][0]).toEqual(['red', 'green']);

      click(red);
      expect(handleValueChange.mock.calls[2][0]).toEqual(['green']);
    });

    it('does not update the group when onValueChange cancels the event', () => {
      const handleValueChange = vi.fn((_, eventDetails: CheckboxGroup.ChangeEventDetails) => {
        eventDetails.cancel();
      });

      render(() => (
        <CheckboxGroup onValueChange={handleValueChange}>
          <Checkbox.Root value="red" data-testid="red" />
          <Checkbox.Root value="green" data-testid="green" />
        </CheckboxGroup>
      ));

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');

      click(red);

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['red']);
      expect(red).toHaveAttribute('aria-checked', 'false');
      expect(green).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: defaultValue', () => {
    it('treats null as an empty array', () => {
      // @ts-expect-error Simulates a JavaScript consumer passing an unsupported value.
      render(() => <CheckboxGroup defaultValue={null} />);

      expect(screen.getByRole('group')).toBeInTheDocument();
    });

    it('should set the initial value', () => {
      render(() => (
        <CheckboxGroup defaultValue={['red']}>
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>
      ));

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'false');
      expect(blue).toHaveAttribute('aria-checked', 'false');

      click(green);

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'true');
      expect(blue).toHaveAttribute('aria-checked', 'false');
    });

    // Upstream wraps this in React.StrictMode; the isolation itself is still worth covering.
    it('keeps omitted defaults isolated between groups', async () => {
      const user = userEvent.setup();
      render(() => (
        <>
          <CheckboxGroup allValues={['a-1', 'a-2']}>
            <Checkbox.Root parent data-testid="a-parent" />
            <Checkbox.Root value="a-1" data-testid="a-1" />
            <Checkbox.Root value="a-2" data-testid="a-2" />
          </CheckboxGroup>
          <CheckboxGroup allValues={['b-1', 'b-2']}>
            <Checkbox.Root parent data-testid="b-parent" />
            <Checkbox.Root value="b-1" data-testid="b-1" />
            <Checkbox.Root value="b-2" data-testid="b-2" />
          </CheckboxGroup>
        </>
      ));

      const aParent = screen.getByTestId('a-parent');
      const a1 = screen.getByTestId('a-1');
      const a2 = screen.getByTestId('a-2');
      const bParent = screen.getByTestId('b-parent');
      const b1 = screen.getByTestId('b-1');
      const b2 = screen.getByTestId('b-2');

      await user.click(a1);
      expect(aParent).toHaveAttribute('aria-checked', 'mixed');
      expect(bParent).toHaveAttribute('aria-checked', 'false');
      expect(b1).toHaveAttribute('aria-checked', 'false');
      expect(b2).toHaveAttribute('aria-checked', 'false');

      await user.click(bParent);
      expect(b1).toHaveAttribute('aria-checked', 'true');
      expect(b2).toHaveAttribute('aria-checked', 'true');
      expect(a1).toHaveAttribute('aria-checked', 'true');
      expect(a2).toHaveAttribute('aria-checked', 'false');

      await user.click(aParent);
      expect(a1).toHaveAttribute('aria-checked', 'true');
      expect(a2).toHaveAttribute('aria-checked', 'true');
      expect(bParent).toHaveAttribute('aria-checked', 'true');

      await user.click(b1);
      expect(bParent).toHaveAttribute('aria-checked', 'mixed');
      expect(aParent).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('prop: disabled', () => {
    it('disables all checkboxes when `true`', () => {
      render(() => (
        <CheckboxGroup disabled>
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>
      ));

      for (const id of ['red', 'green', 'blue']) {
        expect(screen.getByTestId(id)).toHaveAttribute('aria-disabled', 'true');
      }
    });

    it('does not disable all checkboxes when `false`', () => {
      render(() => (
        <CheckboxGroup disabled={false}>
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>
      ));

      for (const id of ['red', 'green', 'blue']) {
        expect(screen.getByTestId(id)).not.toHaveAttribute('aria-disabled', 'true');
      }
    });

    it('takes precedence over individual checkboxes', () => {
      render(() => (
        <CheckboxGroup disabled>
          <Checkbox.Root name="red" data-testid="red" disabled={false} />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>
      ));

      for (const id of ['red', 'green', 'blue']) {
        expect(screen.getByTestId(id)).toHaveAttribute('aria-disabled', 'true');
      }
    });
  });

  describe('Field', () => {
    it('[data-dirty]', () => {
      render(() => (
        <Field.Root name="fruits">
          <CheckboxGroup defaultValue={['apple']}>
            <Field.Item>
              <Checkbox.Root value="apple" data-testid="apple" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="banana" data-testid="banana" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));

      const group = screen.getByRole('group');
      const banana = screen.getByTestId('banana');

      expect(group).not.toHaveAttribute('data-dirty');

      click(banana);
      expect(group).toHaveAttribute('data-dirty', '');

      click(banana);
      expect(group).not.toHaveAttribute('data-dirty');
    });

    it('[data-filled] follows the group value even without a matching rendered checkbox', () => {
      render(() => (
        <Field.Root name="fruits">
          <CheckboxGroup defaultValue={['cherry']}>
            <Field.Item>
              <Checkbox.Root value="apple" data-testid="apple" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));

      const group = screen.getByRole('group');
      const apple = screen.getByTestId('apple');

      expect(group).toHaveAttribute('data-filled', '');

      click(apple);
      click(apple);

      expect(group).toHaveAttribute('data-filled', '');
    });

    it('keeps a required error while another required checkbox in the group is unchecked', async () => {
      const user = userEvent.setup();
      render(() => (
        <Form onSubmit={(event) => event.preventDefault()}>
          <Field.Root name="protocols">
            <CheckboxGroup defaultValue={[]}>
              <Field.Item>
                <Checkbox.Root value="http" data-testid="checkbox" required />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="https" data-testid="checkbox" required />
              </Field.Item>
            </CheckboxGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const checkboxes = screen.getAllByTestId('checkbox');

      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      // Checking only one of the two required checkboxes must not clear the error.
      await user.click(checkboxes[1]);
      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      await user.click(checkboxes[0]);
      await user.click(screen.getByText('submit'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('ignores a disabled required checkbox when validating the group', async () => {
      const user = userEvent.setup();
      render(() => (
        <Form onSubmit={(event) => event.preventDefault()}>
          <Field.Root name="protocols">
            <CheckboxGroup defaultValue={[]}>
              <Field.Item>
                <Checkbox.Root value="https" data-testid="cb-enabled" required />
              </Field.Item>
              {/* Mounted last so it would otherwise win the shared input ref. */}
              <Field.Item>
                <Checkbox.Root value="http" data-testid="cb-disabled" required disabled />
              </Field.Item>
            </CheckboxGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      // A disabled checkbox is exempt from constraint validation, so checking the only
      // enabled required checkbox is enough to satisfy the field.
      await user.click(screen.getByTestId('cb-enabled'));
      await user.click(screen.getByText('submit'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('keeps validating the remaining required checkbox after a checked sibling unmounts', async () => {
      const user = userEvent.setup();
      function App() {
        const [showHttps, setShowHttps] = createSignal(true);
        return (
          <Form onSubmit={(event) => event.preventDefault()}>
            <Field.Root name="protocols">
              <CheckboxGroup defaultValue={[]}>
                <Field.Item>
                  <Checkbox.Root value="http" data-testid="checkbox-http" required />
                </Field.Item>
                <Show when={showHttps()}>
                  <Field.Item>
                    <Checkbox.Root value="https" data-testid="checkbox-https" required />
                  </Field.Item>
                </Show>
              </CheckboxGroup>
              <Field.Error match="valueMissing" data-testid="error">
                required
              </Field.Error>
            </Field.Root>
            <button type="button" onClick={() => setShowHttps(false)}>
              remove
            </button>
            <button type="submit">submit</button>
          </Form>
        );
      }

      render(() => <App />);

      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      await user.click(screen.getByTestId('checkbox-https'));
      await user.click(screen.getByText('remove'));
      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      await user.click(screen.getByTestId('checkbox-http'));
      await user.click(screen.getByText('submit'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('validationMode=onChange keeps the error until every required checkbox is ticked', async () => {
      const user = userEvent.setup();
      render(() => (
        <Field.Root name="protocols" validationMode="onChange">
          <CheckboxGroup defaultValue={[]}>
            <Field.Item>
              <Checkbox.Root value="http" data-testid="cb-http" required />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="https" data-testid="cb-https" required />
            </Field.Item>
          </CheckboxGroup>
          <Field.Error match="valueMissing" data-testid="error">
            required
          </Field.Error>
        </Field.Root>
      ));

      expect(screen.queryByTestId('error')).toBe(null);

      // Ticking the second (last-mounted) checkbox must not clear the requirement on the first.
      await user.click(screen.getByTestId('cb-https'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      await user.click(screen.getByTestId('cb-http'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('validationMode=onBlur keeps the error until every required checkbox is ticked', async () => {
      const user = userEvent.setup();
      render(() => (
        <Field.Root name="protocols" validationMode="onBlur">
          <CheckboxGroup defaultValue={[]}>
            <Field.Item>
              <Checkbox.Root value="http" data-testid="cb-http" required />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="https" data-testid="cb-https" required />
            </Field.Item>
          </CheckboxGroup>
          <Field.Error match="valueMissing" data-testid="error">
            required
          </Field.Error>
        </Field.Root>
      ));

      await user.click(screen.getByTestId('cb-https'));
      expect(screen.queryByTestId('error')).toBe(null);

      fireEvent.blur(screen.getByTestId('cb-https'));
      flush();
      await flushMicrotasks();
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      await user.click(screen.getByTestId('cb-http'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('does not leave a stale custom error when toggling checkboxes in a group', () => {
      const validateSpy = vi.fn((value: unknown) =>
        (value as string[]).length < 2 ? 'pick two' : null,
      );
      render(() => (
        <Field.Root name="protocols" validationMode="onChange" validate={validateSpy}>
          <CheckboxGroup defaultValue={[]}>
            <Field.Item>
              <Checkbox.Root value="http" data-testid="cb-http" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="https" data-testid="cb-https" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));

      const http = screen.getByTestId('cb-http');
      const https = screen.getByTestId('cb-https');

      click(http);
      expect(http).toHaveAttribute('aria-invalid', 'true');

      click(https);
      expect(http).not.toHaveAttribute('aria-invalid');
      expect(https).not.toHaveAttribute('aria-invalid');

      click(http);
      expect(https).toHaveAttribute('aria-invalid', 'true');
    });

    it('clears custom validity from disabled registered inputs when the group becomes valid', async () => {
      const user = userEvent.setup();
      function App() {
        const [disabled, setDisabled] = createSignal(false);
        const [value, setValue] = createSignal<string[]>([]);
        const validate = (nextValue: unknown) =>
          (nextValue as string[]).length < 2 ? 'pick two' : null;

        return (
          <Field.Root name="protocols" validationMode="onChange" validate={validate}>
            <CheckboxGroup value={value()} onValueChange={setValue}>
              <Field.Item>
                <Checkbox.Root value="http" data-testid="cb-http" disabled={disabled()} />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="https" data-testid="cb-https" />
              </Field.Item>
            </CheckboxGroup>
            <button type="button" onClick={() => setDisabled(true)}>
              disable
            </button>
          </Field.Root>
        );
      }

      render(() => <App />);

      await user.click(screen.getByTestId('cb-http'));

      const httpInput = document.querySelector<HTMLInputElement>(
        'input[type="checkbox"][value="http"]',
      );
      expect(httpInput?.validity.customError).toBe(true);

      await user.click(screen.getByText('disable'));
      await user.click(screen.getByTestId('cb-https'));

      expect(httpInput?.validity.customError).toBe(false);
    });

    it('prop: validationMode=onSubmit', async () => {
      const user = userEvent.setup();
      const validateSpy = vi.fn((value: unknown) => {
        const v = value as string[];
        if (v.length === 0) {
          return 'custom error 1';
        }
        if (v.length < 2) {
          return 'custom error 2';
        }
        if (v.includes('two')) {
          return 'custom error 3';
        }
        return null;
      });
      render(() => (
        <Form>
          <Field.Root validate={validateSpy} name="test">
            <CheckboxGroup defaultValue={[]}>
              <Field.Item>
                <Checkbox.Root value="one" data-testid="checkbox" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="two" data-testid="checkbox" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="three" data-testid="checkbox" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const checkboxes = screen.getAllByTestId('checkbox');
      const [checkbox1, checkbox2, checkbox3] = checkboxes;
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      await user.click(checkbox2);
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      await user.click(screen.getByText('submit'));
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid'));

      await user.click(checkbox1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['two', 'one']);
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid'));
      await user.click(checkbox2);
      await user.click(checkbox3);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['one', 'three']);
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
    });

    it('prop: validationMode=onChange', () => {
      const validateSpy = vi.fn((value: unknown) => {
        const v = value as string[];
        return v.includes('one') ? 'error' : null;
      });
      render(() => (
        <Field.Root validationMode="onChange" validate={validateSpy} name="apple">
          <CheckboxGroup defaultValue={['one']}>
            <Field.Item>
              <Checkbox.Root value="one" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="two" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="three" data-testid="checkbox" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));

      const checkboxes = screen.getAllByTestId('checkbox');
      const [checkbox1, checkbox2, checkbox3] = checkboxes;

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      click(checkbox1);
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual([]);

      click(checkbox2);
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
      expect(validateSpy.mock.calls.length).toBe(2);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['two']);

      click(checkbox1);
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
      expect(validateSpy.mock.calls.length).toBe(3);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['two', 'one']);

      click(checkbox3);
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
    });

    it('validates with the group value when toggling the parent checkbox', async () => {
      const user = userEvent.setup();
      const validateSpy = vi.fn((_value: unknown) => null);

      render(() => (
        <Field.Root validationMode="onChange" validate={validateSpy} name="fruits">
          <CheckboxGroup allValues={['apple', 'orange']}>
            <Checkbox.Root parent data-testid="parent" />
            <Checkbox.Root value="apple" />
            <Checkbox.Root value="orange" />
          </CheckboxGroup>
        </Field.Root>
      ));

      const parent = screen.getByTestId('parent');

      await user.click(parent);
      expect(validateSpy).toHaveBeenCalledTimes(1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['apple', 'orange']);

      await user.click(parent);
      expect(validateSpy).toHaveBeenCalledTimes(2);
      expect(validateSpy.mock.lastCall?.[0]).toEqual([]);
    });

    it('revalidates when the controlled value changes externally', () => {
      const validateSpy = vi.fn((value: unknown) => {
        const values = value as string[];
        return values.includes('one') ? 'error' : null;
      });

      function App() {
        const [selected, setSelected] = createSignal<string[]>([]);

        return (
          <>
            <Field.Root validationMode="onChange" validate={validateSpy} name="apple">
              <CheckboxGroup value={selected()}>
                <Field.Item>
                  <Checkbox.Root value="one" data-testid="checkbox" />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="two" data-testid="checkbox" />
                </Field.Item>
              </CheckboxGroup>
            </Field.Root>
            <button type="button" onClick={() => setSelected(['one'])}>
              Select externally
            </button>
          </>
        );
      }

      render(() => <App />);

      const checkboxes = screen.getAllByTestId('checkbox');
      const toggle = screen.getByText('Select externally');

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
      const initialCallCount = validateSpy.mock.calls.length;

      click(toggle);

      expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['one']);
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
    });

    it('prop: validationMode=onBlur', () => {
      const validateSpy = vi.fn((value: unknown) => {
        const v = value as string[];
        return v.includes('one') ? 'error' : null;
      });
      render(() => (
        <Field.Root validationMode="onBlur" validate={validateSpy} name="apple">
          <CheckboxGroup defaultValue={['one']}>
            <Field.Item>
              <Checkbox.Root value="one" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="two" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="three" data-testid="checkbox" />
            </Field.Item>
          </CheckboxGroup>
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const checkboxes = screen.getAllByTestId('checkbox');
      const [checkbox1, , checkbox3] = checkboxes;

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      click(checkbox1);
      expect(validateSpy.mock.calls.length).toBe(0);
      fireEvent.blur(checkbox1);
      flush();
      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual([]);

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      click(checkbox3);
      expect(validateSpy.mock.calls.length).toBe(1);
      fireEvent.blur(checkbox3);
      flush();
      expect(validateSpy.mock.calls.length).toBe(2);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['three']);

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      click(checkbox1);
      expect(validateSpy.mock.calls.length).toBe(2);
      fireEvent.blur(checkbox1);
      flush();
      expect(validateSpy.mock.calls.length).toBe(3);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['three', 'one']);

      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
    });
  });

  describe('Field.Label', () => {
    function SharedFieldRootGroup(props: { nativeButton: boolean }) {
      return (
        <Field.Root name="apples">
          <Field.Label>Apples</Field.Label>
          <CheckboxGroup allValues={['fuji', 'gala']}>
            <Checkbox.Root
              parent
              data-testid="parent"
              nativeButton={props.nativeButton}
              render={props.nativeButton ? 'button' : undefined}
            />
            <Checkbox.Root
              value="fuji"
              data-testid="fuji"
              nativeButton={props.nativeButton}
              render={props.nativeButton ? 'button' : undefined}
            />
            <Checkbox.Root
              value="gala"
              data-testid="gala"
              nativeButton={props.nativeButton}
              render={props.nativeButton ? 'button' : undefined}
            />
          </CheckboxGroup>
        </Field.Root>
      );
    }

    // `expectedCount` is required: a set of unique ids is trivially unique when it is empty,
    // so a regression that drops every id would otherwise pass.
    function expectUniqueIds(expectedCount: number) {
      const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
      expect(ids).toHaveLength(expectedCount);
      expect(new Set(ids).size).toBe(ids.length);
    }

    it.each([false, true])(
      'keeps checkbox ids unique when the group shares one Field.Root (nativeButton=%s)',
      (nativeButton) => {
        render(() => <SharedFieldRootGroup nativeButton={nativeButton} />);

        expectUniqueIds(nativeButton ? 4 : 7);
        // Queried without `hidden`, so the relationship has to reach the exposed checkboxes
        // rather than the hidden inputs behind them.
        expect(screen.getByTestId('parent').getAttribute('aria-controls')!.split(' ')).toEqual([
          screen.getByTestId('fuji').id,
          screen.getByTestId('gala').id,
        ]);
      },
    );

    // Skipped: 'keeps checkbox ids unique in a shared Field.Root during SSR' (no SSR renderer in
    // this jsdom suite); the client-side variant above covers the same ids.

    it.each([false, true])(
      'keeps ids unique without allValues in a shared Field.Root (nativeButton=%s)',
      (nativeButton) => {
        render(() => (
          <Field.Root name="apples">
            <Field.Label>Apples</Field.Label>
            <CheckboxGroup>
              <Checkbox.Root
                value="fuji"
                nativeButton={nativeButton}
                render={nativeButton ? 'button' : undefined}
              />
              <Checkbox.Root
                value="gala"
                nativeButton={nativeButton}
                render={nativeButton ? 'button' : undefined}
              />
            </CheckboxGroup>
          </Field.Root>
        ));

        expectUniqueIds(nativeButton ? 3 : 5);
      },
    );

    // Upstream checks the SSR markup, then hydration; this checks the client render.
    it('labels the group rather than pointing Field.Label at one checkbox inside it', async () => {
      render(() => <SharedFieldRootGroup nativeButton={false} />);

      const label = screen.getByText('Apples');
      await waitFor(() => {
        expect(label).not.toHaveAttribute('for');
      });
      expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', label.id);
    });

    it('gives each checkbox in a shared Field.Root its own accessible name', () => {
      render(() => (
        <Field.Root name="apples">
          <CheckboxGroup allValues={['fuji', 'gala']}>
            <label>
              <Checkbox.Root parent data-testid="parent" />
              All
            </label>
            <label>
              <Checkbox.Root value="fuji" data-testid="fuji" />
              Fuji
            </label>
            <label>
              <Checkbox.Root value="gala" data-testid="gala" />
              Gala
            </label>
          </CheckboxGroup>
        </Field.Root>
      ));

      ['All', 'Fuji', 'Gala'].forEach((name, index) => {
        const testId = ['parent', 'fuji', 'gala'][index];
        const labelId = screen.getByTestId(testId).getAttribute('aria-labelledby')!;
        expect(document.getElementById(labelId)).toHaveTextContent(name);
      });
    });

    // Upstream renders these to a string (SSR); this checks the client render.
    it.each([
      { nativeButton: false, parent: false },
      { nativeButton: true, parent: false },
      { nativeButton: false, parent: true },
      { nativeButton: true, parent: true },
    ])(
      'associates Field.Label with a grouped Checkbox (nativeButton=$nativeButton, parent=$parent)',
      ({ nativeButton, parent }) => {
        render(() => (
          <Field.Root name="apple">
            <CheckboxGroup allValues={['fuji']}>
              <Field.Item>
                <Field.Label data-testid="label">Fuji</Field.Label>
                <Checkbox.Root
                  parent={parent}
                  value={parent ? undefined : 'fuji'}
                  nativeButton={nativeButton}
                  render={nativeButton ? 'button' : undefined}
                />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
        ));

        const control = nativeButton
          ? screen.getByRole('checkbox')
          : document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
        expect(control.id).not.toBe('');
        expect(screen.getByTestId('label')).toHaveAttribute('for', control.id);
      },
    );

    // Upstream checks the SSR markup before hydration; this checks the client render.
    it.each([false, true])(
      'points parent aria-controls at the children once they register (nativeButton=%s)',
      async (nativeButton) => {
        render(() => (
          <Field.Root name="apple">
            <CheckboxGroup allValues={['fuji']}>
              <Field.Item>
                <Field.Label data-testid="label">All</Field.Label>
                <Checkbox.Root
                  parent
                  data-testid="parent"
                  nativeButton={nativeButton}
                  render={nativeButton ? 'button' : undefined}
                />
              </Field.Item>
              <Field.Item>
                <Field.Label data-testid="label">Fuji</Field.Label>
                <Checkbox.Root
                  value="fuji"
                  data-testid="fuji"
                  nativeButton={nativeButton}
                  render={nativeButton ? 'button' : undefined}
                />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
        ));

        // Each label must reach its own item's labelable element: the button itself with
        // `nativeButton`, the hidden input rendered next to it otherwise.
        [screen.getByTestId('parent'), screen.getByTestId('fuji')].forEach((control, index) => {
          const labelable = nativeButton ? control : control.nextElementSibling;
          expect(labelable).not.toBe(null);
          expect(screen.getAllByTestId('label')[index]).toHaveAttribute('for', labelable!.id);
        });

        await waitFor(() => {
          expect(screen.getByTestId('parent')).toHaveAttribute(
            'aria-controls',
            screen.getByTestId('fuji').id,
          );
        });
      },
    );

    it('implicit association', () => {
      const changeSpy = vi.fn();
      render(() => (
        <Field.Root name="apple">
          <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
            <Field.Item>
              <Field.Label data-testid="label">
                <Checkbox.Root value="fuji-apple" />
                Fuji
              </Field.Label>
            </Field.Item>
            <Field.Item>
              <Field.Label data-testid="label">
                <Checkbox.Root value="gala-apple" />
                Gala
              </Field.Label>
            </Field.Item>
            <Field.Item>
              <Field.Label data-testid="label">
                <Checkbox.Root value="granny-smith-apple" onCheckedChange={changeSpy} />
                Granny Smith
              </Field.Label>
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));

      const checkboxes = screen.getAllByRole('checkbox');
      const labels = screen.getAllByTestId('label');
      const inputs = document.querySelectorAll('input[type="checkbox"]');

      checkboxes.forEach((checkbox, index) => {
        const label = labels[index];
        const input = inputs[index];

        expect(label.getAttribute('for')).not.toBe(null);
        expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
        expect(label.getAttribute('id')).not.toBe(null);
        expect(label.getAttribute('id')).toBe(checkbox.getAttribute('aria-labelledby'));
      });

      click(labels[2]);
      expect(changeSpy.mock.calls.length).toBe(1);
    });

    it('explicit association', () => {
      const changeSpy = vi.fn();

      render(() => (
        <Field.Root name="apple">
          <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
            <Field.Item>
              <Checkbox.Root value="fuji-apple" />
              <Field.Label data-testid="label">Fuji</Field.Label>
              <Field.Description data-testid="description">
                A fuji apple is the round, edible fruit of an apple tree
              </Field.Description>
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="gala-apple" onCheckedChange={changeSpy} />
              <Field.Label data-testid="label">Gala</Field.Label>
              <Field.Description data-testid="description">
                A gala apple is the round, edible fruit of an apple tree
              </Field.Description>
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));

      const checkboxes = screen.getAllByRole('checkbox');
      const labels = screen.getAllByTestId('label');
      const descriptions = screen.getAllByTestId('description');
      const inputs = document.querySelectorAll('input[type="checkbox"]');

      checkboxes.forEach((checkbox, index) => {
        const label = labels[index];
        const description = descriptions[index];
        const input = inputs[index];

        expect(label.getAttribute('for')).not.toBe(null);
        expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
        expect(label.getAttribute('id')).not.toBe(null);
        expect(label.getAttribute('id')).toBe(checkbox.getAttribute('aria-labelledby'));
        expect(description.getAttribute('id')).not.toBe(null);
        expect(description.getAttribute('id')).toBe(checkbox.getAttribute('aria-describedby'));
      });

      click(screen.getByText('Gala'));
      expect(changeSpy.mock.calls.length).toBe(1);
    });
  });

  describe('Field.Description', () => {
    it('links the group and individual checkboxes', () => {
      render(() => (
        <Field.Root name="apple">
          <CheckboxGroup defaultValue={[]} aria-describedby="external-description">
            <Field.Description data-testid="group-description">Group description</Field.Description>
            <Field.Item>
              <Field.Label>
                <Checkbox.Root value="fuji-apple" aria-describedby="checkbox-description" />
                Fuji
              </Field.Label>
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));

      const groupDescription = screen.getByTestId('group-description');
      const groupDescriptionId = groupDescription.getAttribute('id');
      expect(groupDescriptionId).not.toBe(null);
      expect(screen.getByRole('group').getAttribute('aria-describedby')).toContain(
        groupDescriptionId,
      );
      expect(screen.getByRole('checkbox')).toHaveAttribute(
        'aria-describedby',
        `checkbox-description ${groupDescriptionId}`,
      );
      expect(screen.getByRole('group')).toHaveAttribute(
        'aria-describedby',
        `external-description ${groupDescriptionId}`,
      );
    });
  });

  describe('Form values', () => {
    it('projects selected enabled checkboxes while preserving the logical validation value', () => {
      const handleSubmit = vi.fn();
      const validateGroup = vi.fn((_value: unknown, _formValues: Form.Values) => null);
      const validateOther = vi.fn((_value: unknown, _formValues: Form.Values) => null);

      function App() {
        const [disabled, setDisabled] = createSignal(true);

        return (
          <Form onFormSubmit={handleSubmit} data-testid="form">
            <Field.Root name="fruits" validate={validateGroup}>
              <CheckboxGroup defaultValue={['apple', 'banana']}>
                <Checkbox.Root value="apple" />
                <Checkbox.Root value="banana" disabled={disabled()} />
              </CheckboxGroup>
            </Field.Root>
            <Field.Root name="other" validate={validateOther}>
              <Field.Control defaultValue="value" />
            </Field.Root>
            <button type="button" onClick={() => setDisabled(false)}>
              Enable
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      render(() => <App />);

      click(screen.getByText('Submit'));

      expect(validateGroup).toHaveBeenLastCalledWith(['apple', 'banana'], {
        fruits: ['apple'],
        other: 'value',
      });
      expect(validateOther.mock.lastCall?.[1].fruits).toEqual(['apple']);
      expect(handleSubmit.mock.lastCall?.[0].fruits).toEqual(['apple']);

      click(screen.getByText('Enable'));
      click(screen.getByText('Submit'));

      expect(validateGroup).toHaveBeenLastCalledWith(['apple', 'banana'], {
        fruits: ['apple', 'banana'],
        other: 'value',
      });
      expect(validateOther.mock.lastCall?.[1].fruits).toEqual(['apple', 'banana']);
      expect(handleSubmit.mock.lastCall?.[0].fruits).toEqual(['apple', 'banana']);
    });

    it('omits selected unmounted checkboxes while retaining group state across remounts', () => {
      const handleSubmit = vi.fn();

      function App() {
        const [mounted, setMounted] = createSignal(true);

        return (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="fruits">
              <CheckboxGroup defaultValue={['apple', 'banana']}>
                <Checkbox.Root value="apple" />
                <Show when={mounted()}>
                  <Checkbox.Root value="banana" data-testid="banana" />
                </Show>
              </CheckboxGroup>
            </Field.Root>
            <button type="button" onClick={() => setMounted((value) => !value)}>
              Toggle
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      render(() => <App />);

      click(screen.getByText('Toggle'));
      click(screen.getByText('Submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });

      click(screen.getByText('Toggle'));
      expect(screen.getByTestId('banana')).toHaveAttribute('aria-checked', 'true');

      click(screen.getByText('Submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple', 'banana'] });
    });

    it('preserves the logical field-name value when Checkbox.Root has no value prop', () => {
      const handleSubmit = vi.fn();

      render(() => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="fruits">
            <CheckboxGroup defaultValue={['fruits']}>
              <Checkbox.Root />
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      click(screen.getByText('Submit'));

      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['fruits'] });
    });

    it('updates duplicate-value registrations before a parent effect submits', () => {
      const handleSubmit = vi.fn();

      function App() {
        const [trimmed, setTrimmed] = createSignal(false);
        let formElement: HTMLFormElement | undefined;

        return (
          <Form
            ref={(element) => {
              formElement = element;
            }}
            onFormSubmit={handleSubmit}
          >
            <Field.Root name="items">
              <CheckboxGroup defaultValue={['one', 'two']}>
                <Show when={!trimmed()}>
                  <Checkbox.Root value="one" />
                </Show>
                <Checkbox.Root value="two" />
                <Show when={!trimmed()}>
                  <Checkbox.Root value="two" />
                </Show>
              </CheckboxGroup>
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                setTrimmed(true);
                // Submit once the trimmed tree settled.
                onSettled(() => {
                  formElement?.requestSubmit();
                });
              }}
            >
              Trim
            </button>
          </Form>
        );
      }

      render(() => <App />);

      click(screen.getByText('Trim'));

      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ items: ['two'] });
    });

    it('omits selected checkboxes associated with another form', () => {
      const handleSubmit = vi.fn();

      render(() => (
        <>
          <form id="external-form" />
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="fruits">
              <CheckboxGroup defaultValue={['apple', 'banana']}>
                <Checkbox.Root value="apple" />
                <Checkbox.Root value="banana" form="external-form" />
              </CheckboxGroup>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        </>
      ));

      click(screen.getByText('Submit'));

      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });
    });

    it('includes a context-portaled checkbox without native form association', () => {
      const handleSubmit = vi.fn();
      const portalContainer = document.createElement('div');
      document.body.append(portalContainer);

      render(() => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="fruits">
            <CheckboxGroup defaultValue={['apple']}>
              <Portal mount={portalContainer}>
                <Checkbox.Root value="apple" />
              </Portal>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      click(screen.getByText('Submit'));

      // Field registration is context-driven, so a portaled checkbox with no explicit `form`
      // association still projects its value into `onFormSubmit`, like other field controls.
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });
      portalContainer.remove();
    });

    it('includes a group fully portaled outside the form element', () => {
      const handleSubmit = vi.fn();
      const portalContainer = document.createElement('div');
      document.body.append(portalContainer);

      render(() => (
        <Form onFormSubmit={handleSubmit}>
          <Portal mount={portalContainer}>
            <Field.Root name="fruits">
              <CheckboxGroup defaultValue={['apple', 'banana']}>
                <Checkbox.Root value="apple" />
                <Checkbox.Root value="banana" disabled />
              </CheckboxGroup>
            </Field.Root>
          </Portal>
          <button type="submit">Submit</button>
        </Form>
      ));

      click(screen.getByText('Submit'));

      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });
      portalContainer.remove();
    });

    it('includes a portaled checkbox explicitly associated with the Form', () => {
      const handleSubmit = vi.fn();
      const portalContainer = document.createElement('div');
      document.body.append(portalContainer);

      render(() => (
        <Form id="current-form" onFormSubmit={handleSubmit}>
          <Field.Root name="fruits">
            <CheckboxGroup defaultValue={['apple']}>
              <Portal mount={portalContainer}>
                <Checkbox.Root value="apple" form="current-form" />
              </Portal>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      click(screen.getByText('Submit'));

      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });
      portalContainer.remove();
    });

    it('omits checkboxes disabled by a fieldset', () => {
      const handleSubmit = vi.fn();
      const validate = vi.fn((_value: unknown, _formValues: Form.Values) => null);

      render(() => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="fruits">
            <CheckboxGroup defaultValue={['apple', 'banana']}>
              <Checkbox.Root value="apple" />
              <fieldset disabled>
                <Checkbox.Root value="banana" />
              </fieldset>
            </CheckboxGroup>
          </Field.Root>
          <Field.Root name="other" validate={validate}>
            <Field.Control defaultValue="value" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      click(screen.getByText('Submit'));

      expect(validate.mock.lastCall?.[1].fruits).toEqual(['apple']);
      expect(handleSubmit.mock.lastCall?.[0].fruits).toEqual(['apple']);
    });
  });

  // Upstream skips this block in JSDOM; the tests that also hold in jsdom are kept here.
  describe('Form', () => {
    it('includes the checkbox group value in form submission', () => {
      let formData: FormData | undefined;
      render(() => (
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            formData = new FormData(event.currentTarget as HTMLFormElement);
          }}
        >
          <Field.Root name="apple">
            <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
              <Field.Item>
                <Checkbox.Root value="fuji-apple" data-testid="button-1" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="gala-apple" data-testid="button-2" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="granny-smith-apple" data-testid="button-3" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      click(screen.getByText('Submit'));
      expect(formData?.getAll('apple')).toEqual(['fuji-apple', 'gala-apple']);
    });

    it('is validated as a group upon form submission', () => {
      const validateSpy = vi.fn();

      render(() => (
        <Form onSubmit={(event) => event.preventDefault()}>
          <Field.Root name="apple" validate={validateSpy}>
            <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
              <Field.Item>
                <Checkbox.Root value="fuji-apple" data-testid="button-1" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="gala-apple" data-testid="button-2" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="granny-smith-apple" data-testid="button-3" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      click(screen.getByText('Submit'));
      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.calls[0][0]).toEqual(['fuji-apple', 'gala-apple']);
    });

    it('focuses the first checkbox when the field receives an error from Form', async () => {
      const user = userEvent.setup();
      function App() {
        const [errors, setErrors] = createSignal<Form.Props['errors']>({});
        return (
          <Form
            errors={errors()}
            onSubmit={(event) => {
              event.preventDefault();
              setErrors({ group: 'server error' });
            }}
          >
            <Field.Root name="group" data-testid="field">
              <CheckboxGroup defaultValue={['one']}>
                <Field.Item>
                  <Checkbox.Root value="one" />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="two" />
                </Field.Item>
              </CheckboxGroup>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      render(() => <App />);
      expect(screen.queryByTestId('error')).toBe(null);
      await user.click(screen.getByText('Submit'));

      const [checkbox1] = screen.getAllByRole('checkbox');
      expect(checkbox1).toHaveFocus();
      expect(checkbox1).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).toHaveTextContent('server error');
    });

    it('focuses the invalid checkbox when a later checkbox in the group fails validation', async () => {
      const user = userEvent.setup();
      render(() => (
        <Form>
          <Field.Root name="group">
            <CheckboxGroup defaultValue={['one']}>
              <Field.Item>
                <Checkbox.Root value="one" data-testid="checkbox" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="two" data-testid="checkbox" required />
              </Field.Item>
            </CheckboxGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const checkboxes = screen.getAllByTestId('checkbox');

      await user.click(screen.getByText('Submit'));

      expect(screen.getByTestId('error')).toHaveTextContent('required');
      expect(checkboxes[1]).toHaveFocus();
    });

    it('ignores required checkboxes associated with a different form', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      render(() => (
        <>
          <form id="external-form" />
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="group">
              <CheckboxGroup defaultValue={[]}>
                <Checkbox.Root value="external" form="external-form" required />
                <Checkbox.Root value="current" />
              </CheckboxGroup>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        </>
      ));

      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledOnce();
    });

    it('stops validating a checkbox after it changes form owner', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      function App() {
        const [external, setExternal] = createSignal(false);

        return (
          <>
            <form id="external-form" />
            <Form onFormSubmit={handleSubmit}>
              <Field.Root name="group">
                <CheckboxGroup defaultValue={[]}>
                  <Checkbox.Root
                    value="checkbox"
                    form={external() ? 'external-form' : undefined}
                    required
                  />
                </CheckboxGroup>
              </Field.Root>
              <button type="button" onClick={() => setExternal(true)}>
                Move
              </button>
              <button type="submit">Submit</button>
            </Form>
          </>
        );
      }

      render(() => <App />);

      await user.click(screen.getByText('Submit'));
      expect(handleSubmit).not.toHaveBeenCalled();

      await user.click(screen.getByText('Move'));
      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledOnce();
    });

    it('validates and focuses required portaled checkboxes within the form', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();
      const portalContainer = document.createElement('div');
      document.body.append(portalContainer);

      render(() => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="group">
            <CheckboxGroup defaultValue={[]}>
              <Portal mount={portalContainer}>
                <Checkbox.Root value="portaled" required data-testid="portaled" />
              </Portal>
              <Checkbox.Root value="current" />
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('portaled')).toHaveFocus();

      await user.click(screen.getByTestId('portaled'));
      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledOnce();
      portalContainer.remove();
    });

    it('ignores a checkbox portaled into another form without a form attribute', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();
      const externalForm = document.createElement('form');
      document.body.append(externalForm);

      render(() => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="group">
            <CheckboxGroup defaultValue={[]}>
              <Portal mount={externalForm}>
                <Checkbox.Root value="external" required />
              </Portal>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledOnce();
      externalForm.remove();
    });

    it('skips a checkbox disabled by a fieldset when focusing Form errors', async () => {
      const user = userEvent.setup();
      function App() {
        const [errors, setErrors] = createSignal<Form.Props['errors']>({});

        return (
          <Form
            errors={errors()}
            onSubmit={(event) => {
              event.preventDefault();
              setErrors({ group: 'server error' });
            }}
          >
            <Field.Root name="group">
              <CheckboxGroup defaultValue={[]}>
                <fieldset disabled>
                  <Checkbox.Root value="disabled" data-testid="disabled" />
                </fieldset>
                <Checkbox.Root value="enabled" data-testid="enabled" />
              </CheckboxGroup>
              <Field.Error />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      render(() => <App />);

      await user.click(screen.getByText('Submit'));

      expect(screen.getByTestId('enabled')).toHaveFocus();
      expect(screen.getByTestId('disabled')).not.toHaveFocus();
    });

    it('focuses a remaining checkbox when Form errors unmount the first checkbox', async () => {
      const user = userEvent.setup();
      function App() {
        const [showFirst, setShowFirst] = createSignal(true);
        const [errors, setErrors] = createSignal<Form.Props['errors']>({});

        return (
          <Form
            errors={errors()}
            onSubmit={(event) => {
              event.preventDefault();
              setShowFirst(false);
              setErrors({ group: 'server error' });
            }}
          >
            <Field.Root name="group">
              <CheckboxGroup defaultValue={[]}>
                <Show when={showFirst()}>
                  <Checkbox.Root value="one" data-testid="first" />
                </Show>
                <Checkbox.Root value="two" data-testid="second" />
              </CheckboxGroup>
              <Field.Error />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      render(() => <App />);

      await user.click(screen.getByText('Submit'));

      expect(screen.queryByTestId('first')).toBe(null);
      expect(screen.getByTestId('second')).toHaveFocus();
    });

    it('unblocks submission after every checkbox in the group unmounts', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      function App() {
        const [mounted, setMounted] = createSignal(true);

        return (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="group">
              <CheckboxGroup defaultValue={[]}>
                <Show when={mounted()}>
                  <Checkbox.Root value="one" required data-testid="checkbox" />
                </Show>
              </CheckboxGroup>
            </Field.Root>
            <button type="button" onClick={() => setMounted(false)}>
              Remove
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      render(() => <App />);

      await user.click(screen.getByText('Submit'));
      expect(handleSubmit).not.toHaveBeenCalled();

      await user.click(screen.getByText('Remove'));
      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledOnce();
    });

    it('still runs custom validation after every checkbox in the group unmounts', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();
      const validate = vi.fn((value: unknown) =>
        (value as string[]).length > 0 ? null : 'required',
      );

      function App() {
        const [mounted, setMounted] = createSignal(true);

        return (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="group" validate={validate}>
              <CheckboxGroup defaultValue={[]}>
                <Show when={mounted()}>
                  <Checkbox.Root value="one" data-testid="checkbox" />
                </Show>
              </CheckboxGroup>
            </Field.Root>
            <button type="button" onClick={() => setMounted(false)}>
              Remove
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      render(() => <App />);

      await user.click(screen.getByText('Remove'));

      validate.mockClear();
      await user.click(screen.getByText('Submit'));

      // The custom validator still runs against the preserved value and blocks submission, even
      // though no checkbox is mounted to carry a native constraint.
      expect(validate).toHaveBeenCalled();
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('clears a custom error when an inputless group becomes valid after submission', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();
      const validate = vi.fn((value: unknown) =>
        (value as string[]).length > 0 ? null : 'required',
      );

      function App() {
        const [mounted, setMounted] = createSignal(true);
        const [value, setValue] = createSignal<string[]>([]);

        return (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="group" validate={validate}>
              <CheckboxGroup value={value()}>
                <Show when={mounted()}>
                  <Checkbox.Root value="one" />
                </Show>
              </CheckboxGroup>
              <Field.Error />
            </Field.Root>
            <button type="button" onClick={() => setMounted(false)}>
              Remove
            </button>
            <button type="button" onClick={() => setValue(['one'])}>
              Select
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      render(() => <App />);

      await user.click(screen.getByText('Submit'));
      expect(screen.getByText('required')).not.toBe(null);

      await user.click(screen.getByText('Remove'));
      await user.click(screen.getByText('Select'));

      expect(screen.queryByText('required')).toBe(null);

      await user.click(screen.getByText('Submit'));
      expect(handleSubmit).toHaveBeenCalledOnce();
    });

    it.each(['onSubmit', 'onBlur'] as const)(
      'does not validate on change with validationMode=%s after the final checkbox unmounts',
      async (validationMode) => {
        const user = userEvent.setup();
        const validate = vi.fn((_value: unknown, _formValues: Form.Values) => 'invalid');

        function App() {
          const [mounted, setMounted] = createSignal(true);
          const [value, setValue] = createSignal<string[]>([]);

          return (
            <Form>
              <Field.Root name="group" validationMode={validationMode} validate={validate}>
                <CheckboxGroup value={value()}>
                  <Show when={mounted()}>
                    <Checkbox.Root value="one" />
                  </Show>
                </CheckboxGroup>
              </Field.Root>
              <button type="button" onClick={() => setMounted(false)}>
                Remove
              </button>
              <button type="button" onClick={() => setValue(['one'])}>
                Select
              </button>
              <button type="submit">Submit</button>
            </Form>
          );
        }

        render(() => <App />);

        await user.click(screen.getByText('Remove'));
        validate.mockClear();
        await user.click(screen.getByText('Select'));

        expect(validate).not.toHaveBeenCalled();

        await user.click(screen.getByText('Submit'));

        expect(validate).toHaveBeenCalledExactlyOnceWith(['one'], { group: [] });
      },
    );

    it.each(['onSubmit', 'onBlur'] as const)(
      'respects validationMode=%s when a controlled group starts without inputs',
      async (validationMode) => {
        const user = userEvent.setup();
        const validate = vi.fn((_value: unknown, _formValues: Form.Values) => 'invalid');

        function App() {
          const [value, setValue] = createSignal<string[]>([]);

          return (
            <Form>
              <Field.Root name="group" validationMode={validationMode} validate={validate}>
                <CheckboxGroup value={value()} />
              </Field.Root>
              <button type="button" onClick={() => setValue(['one'])}>
                Select one
              </button>
              <button type="button" onClick={() => setValue(['two'])}>
                Select two
              </button>
              <button type="submit">Submit</button>
            </Form>
          );
        }

        render(() => <App />);

        validate.mockClear();
        await user.click(screen.getByText('Select one'));

        expect(validate).not.toHaveBeenCalled();

        await user.click(screen.getByText('Submit'));

        expect(validate).toHaveBeenCalledExactlyOnceWith(['one'], { group: [] });

        await user.click(screen.getByText('Select two'));

        expect(validate).toHaveBeenCalledTimes(validationMode === 'onSubmit' ? 2 : 1);
      },
    );

    it('validates an inputless controlled group on change with validationMode=onChange', async () => {
      const user = userEvent.setup();
      const validate = vi.fn((_value: unknown, _formValues: Form.Values) => null);

      function App() {
        const [value, setValue] = createSignal<string[]>([]);

        return (
          <Field.Root name="group" validationMode="onChange" validate={validate}>
            <CheckboxGroup value={value()} />
            <button type="button" onClick={() => setValue(['one'])}>
              Select
            </button>
          </Field.Root>
        );
      }

      render(() => <App />);
      validate.mockClear();

      await user.click(screen.getByText('Select'));

      expect(validate).toHaveBeenCalledExactlyOnceWith(['one'], { group: ['one'] });
    });

    it('validates an initially empty group through the imperative action', async () => {
      const user = userEvent.setup();
      const validate = vi.fn((_value: unknown, _formValues: Form.Values) => 'invalid');

      function App() {
        const actionsRef = createRefObject<Field.Root.Actions | null>(null);

        return (
          <Field.Root name="group" actionsRef={actionsRef} validate={validate}>
            <CheckboxGroup defaultValue={[]} />
            <button type="button" onClick={() => actionsRef.current?.validate()}>
              Validate
            </button>
          </Field.Root>
        );
      }

      render(() => <App />);
      validate.mockClear();

      await user.click(screen.getByText('Validate'));

      expect(validate).toHaveBeenCalledExactlyOnceWith([], { group: [] });
    });

    it('skips a disabled representative checkbox on a later focus attempt', async () => {
      const user = userEvent.setup();
      function App() {
        const [firstDisabled, setFirstDisabled] = createSignal(false);
        const [errors, setErrors] = createSignal<Form.Props['errors']>({});

        return (
          <Form
            errors={errors()}
            onSubmit={(event) => {
              event.preventDefault();
              setErrors({ group: 'server error' });
            }}
          >
            <Field.Root name="group">
              <CheckboxGroup defaultValue={[]}>
                <Checkbox.Root value="one" data-testid="first" disabled={firstDisabled()} />
                <Checkbox.Root value="two" data-testid="second" />
              </CheckboxGroup>
              <Field.Error />
            </Field.Root>
            <button type="button" onClick={() => setFirstDisabled(true)}>
              Disable first
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      render(() => <App />);

      await user.click(screen.getByText('Submit'));
      expect(screen.getByTestId('first')).toHaveFocus();

      await user.click(screen.getByText('Disable first'));
      await user.click(screen.getByText('Submit'));

      expect(screen.getByTestId('second')).toHaveFocus();
    });

    it('focuses the first child checkbox instead of a parent checkbox for Form errors', async () => {
      const user = userEvent.setup();
      function App() {
        const [errors, setErrors] = createSignal<Form.Props['errors']>({});

        return (
          <Form
            errors={errors()}
            onSubmit={(event) => {
              event.preventDefault();
              setErrors({ group: 'server error' });
            }}
          >
            <Field.Root name="group">
              <CheckboxGroup defaultValue={[]} allValues={['one', 'two']}>
                <Checkbox.Root parent data-testid="parent" />
                <Checkbox.Root value="one" data-testid="first" />
                <Checkbox.Root value="two" />
              </CheckboxGroup>
              <Field.Error />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      render(() => <App />);

      await user.click(screen.getByText('Submit'));

      expect(screen.getByTestId('first')).toHaveFocus();
      expect(screen.getByTestId('parent')).not.toHaveFocus();
    });

    it('focuses a later invalid field when an inputless group is invalid without a control', async () => {
      const user = userEvent.setup();
      render(() => (
        <Form>
          <Field.Root name="group" validate={() => 'Invalid group'}>
            <CheckboxGroup value={[]} />
          </Field.Root>
          <Field.Root name="email">
            <Field.Control required data-testid="email" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      await user.click(screen.getByText('Submit'));

      // The group is invalid but has no focusable control, so focus must skip to the next invalid field.
      expect(screen.getByTestId('email')).toHaveFocus();
    });

    it('focuses a later invalid field when every checkbox in an invalid group is disabled', async () => {
      const user = userEvent.setup();
      render(() => (
        <Form>
          <Field.Root name="group" validate={() => 'Invalid group'}>
            <CheckboxGroup defaultValue={[]}>
              <Checkbox.Root value="one" disabled />
            </CheckboxGroup>
          </Field.Root>
          <Field.Root name="email">
            <Field.Control required data-testid="email" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      await user.click(screen.getByText('Submit'));

      expect(screen.getByTestId('email')).toHaveFocus();
    });

    it('excludes parent checkboxes from form submission', async () => {
      const user = userEvent.setup();
      const allValues = ['fuji-apple', 'gala-apple', 'granny-smith-apple'];
      let formData: FormData | undefined;

      function App() {
        const [value, setValue] = createSignal<string[]>(['fuji-apple', 'gala-apple']);
        return (
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              formData = new FormData(event.currentTarget as HTMLFormElement);
            }}
          >
            <Field.Root name="apple">
              <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
                <Field.Item>
                  <Checkbox.Root parent />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="fuji-apple" />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="gala-apple" />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="granny-smith-apple" />
                </Field.Item>
              </CheckboxGroup>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      render(() => <App />);

      const [parentCheckbox, , , checkbox3] = screen.getAllByRole('checkbox');

      expect(parentCheckbox).toHaveAttribute('aria-checked', 'mixed');

      await user.click(checkbox3);

      expect(parentCheckbox).toHaveAttribute('aria-checked', 'true');

      click(screen.getByText('Submit'));
      expect(formData?.getAll('apple')).toEqual([
        'fuji-apple',
        'gala-apple',
        'granny-smith-apple',
      ]);
    });

    it('appends the id attribute of the error to aria-describedby of individual checkboxes', () => {
      render(() => (
        <Form errors={{ group: 'error' }}>
          <Field.Root name="group">
            <CheckboxGroup defaultValue={['one']}>
              <Field.Item>
                <Checkbox.Root value="one" />
                <Field.Description>Description</Field.Description>
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="two" />
              </Field.Item>
            </CheckboxGroup>
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      const error = screen.getByTestId('error');
      expect(error).not.toBe(null);

      const [checkbox1] = screen.getAllByRole('checkbox');
      expect(checkbox1.getAttribute('aria-describedby')).toContain(error.getAttribute('id'));
      expect(checkbox1.getAttribute('aria-describedby')).toContain(
        screen.getByText('Description').getAttribute('id'),
      );
    });
  });
});
