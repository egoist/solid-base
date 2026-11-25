import { Show, createSignal, flush } from 'solid-js';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { Select } from '..';
import { Field } from '../../field';
import { Form } from '../../form';
import { act, flushMicrotasks, renderWithProps, renderWithUser } from '../test-utils';

function click(element: Element) {
  fireEvent.click(element);
  flush();
}

describe('<Select.Root /> (Field and Form)', () => {
  describe('with Field.Root parent', () => {
    it('applies the root id to the trigger', () => {
      renderWithUser(() => (
        <Field.Root>
          <Field.Label data-testid="label">Label</Field.Label>
          <Select.Root id="test-id">
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
          </Select.Root>
        </Field.Root>
      ));
      flush();

      expect(screen.getByTestId('trigger')).toHaveAttribute('id', 'test-id');
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'test-id');
    });

    it('should receive disabled prop from Field.Root', () => {
      renderWithUser(() => (
        <Field.Root disabled>
          <Select.Root>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>
      ));

      expect(screen.getByTestId('trigger')).toHaveAttribute('disabled');
    });

    it('should receive name prop from Field.Root', () => {
      renderWithUser(() => (
        <Field.Root name="field-select">
          <Select.Root>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>
      ));
      flush();

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('name', 'field-select');
    });
  });

  it('resets selected index when value is set to null without a null item', async () => {
    const [value, setValue] = createSignal<string | null>(null);
    const { user } = renderWithUser(() => (
      <div>
        <button onClick={() => setValue('1')}>1</button>
        <button onClick={() => setValue('2')}>2</button>
        <button onClick={() => setValue(null)}>null</button>
        <Select.Root value={value()} onValueChange={setValue}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value">{(val: string | null) => val ?? 'initial'}</Select.Value>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="1">1</Select.Item>
                <Select.Item value="2">2</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </div>
    ));

    await user.click(screen.getByText('initial'));

    await user.click(screen.getByRole('button', { name: '1' }));
    expect(screen.getByTestId('value')).toHaveTextContent('1');

    await user.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByTestId('value')).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: 'null' }));
    expect(screen.getByTestId('value')).toHaveTextContent('initial');

    await user.click(screen.getByTestId('trigger'));
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: '2' })).not.toHaveAttribute('data-selected', '');
    });
  });

  it('does not force-mount the popup on a programmatic value change', async () => {
    const [withItems, setWithItems] = createSignal<string | null>(null);
    const [withoutItems, setWithoutItems] = createSignal<string | null>(null);
    const { user } = renderWithUser(() => (
      <div>
        <button
          type="button"
          onClick={() => {
            setWithItems('b');
            setWithoutItems('b');
          }}
        >
          set
        </button>
        <Select.Root
          items={{ a: 'Apple', b: 'Banana' }}
          value={withItems()}
          onValueChange={setWithItems}
        >
          <Select.Trigger>
            <Select.Value data-testid="items-value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">Apple</Select.Item>
                <Select.Item value="b">Banana</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
        <Select.Root value={withoutItems()} onValueChange={setWithoutItems}>
          <Select.Trigger>
            <Select.Value data-testid="plain-value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </div>
    ));

    expect(screen.queryAllByRole('listbox', { hidden: true })).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'set' }));
    await flushMicrotasks();

    // A programmatic value change must not force-mount the popup (which would leave it in the DOM
    // permanently). The label resolves without the list mounted, with or without `items`.
    expect(screen.queryAllByRole('listbox', { hidden: true })).toHaveLength(0);
    expect(screen.getByTestId('items-value')).toHaveTextContent('Banana');
    expect(screen.getByTestId('plain-value')).toHaveTextContent('b');
  });

  describe('Form', () => {
    it('submits stringified value to onFormSubmit when itemToStringValue is provided', async () => {
      const items = [
        { code: 'US', label: 'United States' },
        { code: 'CA', label: 'Canada' },
      ];
      const handleFormSubmit = vi.fn();

      const { user } = renderWithUser(() => (
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="country">
            <Select.Root
              defaultValue={items[0]}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => item.code}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value={items[0]}>United States</Select.Item>
                    <Select.Item value={items[1]}>Canada</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      await user.click(screen.getByText('Submit'));

      expect(handleFormSubmit.mock.calls.length).toBe(1);
      expect(handleFormSubmit.mock.calls[0][0]).toEqual({ country: 'US' });
    });

    it('submits to an external form when `form` is provided', () => {
      // Upstream skips this in jsdom; it passes here.
      const submitSpy = vi.fn((event: SubmitEvent) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return formData.get('country');
      });

      renderWithUser(() => (
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Select.Root name="country" form="external-form" defaultValue="US">
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="US">United States</Select.Item>
                  <Select.Item value="CA">Canada</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </>
      ));

      click(screen.getByText('Submit'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('US');
    });

    it('submits multiple values to an external form when `form` is provided', () => {
      // Upstream skips this in jsdom; it passes here.
      const submitSpy = vi.fn((event: SubmitEvent) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return formData.getAll('countries');
      });

      renderWithUser(() => (
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Select.Root multiple name="countries" form="external-form" value={['US', 'CA']}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="US">United States</Select.Item>
                  <Select.Item value="CA">Canada</Select.Item>
                  <Select.Item value="AU">Australia</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </>
      ));

      click(screen.getByText('Submit'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toEqual(['US', 'CA']);
    });

    it('triggers native HTML validation on submit', async () => {
      const { user } = renderWithUser(() => (
        <Form>
          <Field.Root name="test" data-testid="field">
            <Select.Root required>
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner />
              </Select.Portal>
            </Select.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('Submit'));

      expect(screen.getByTestId('error')).toHaveTextContent('required');
    });

    it('clears external errors on change', async () => {
      const { user } = renderWithUser(() => (
        <Form errors={{ select: 'test' }}>
          <Field.Root name="select">
            <Select.Root>
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="a">a</Select.Item>
                    <Select.Item value="b">b</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));
      flush();

      expect(screen.getByTestId('error')).toHaveTextContent('test');

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');

      await user.click(trigger);
      await flushMicrotasks();

      const option = await screen.findByRole('option', { name: 'b' });
      await user.click(option);
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);
      expect(trigger).not.toHaveAttribute('aria-invalid');
    });

    it('revalidates immediately after form submission errors', async () => {
      const { user } = renderWithUser(() => (
        <Form>
          <Field.Root name="select">
            <Select.Root required>
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="a">a</Select.Item>
                    <Select.Item value="b">b</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit" data-testid="submit">
            Submit
          </button>
        </Form>
      ));

      await user.click(screen.getByTestId('submit'));

      expect(screen.getByTestId('error')).toHaveTextContent('required');
      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');

      await user.click(trigger);
      await flushMicrotasks();
      await user.click(await screen.findByRole('option', { name: 'b' }));
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);
      expect(trigger).not.toHaveAttribute('aria-invalid');
    });
  });

  describe('Field', () => {
    it('[data-touched]', async () => {
      renderWithUser(() => (
        <Field.Root>
          <Select.Root>
            <Select.Trigger data-testid="trigger" />
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="">Select</Select.Item>
                  <Select.Item value="1">Option 1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-dirty');

      fireEvent.focus(trigger);
      fireEvent.blur(trigger);

      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      const { user } = renderWithUser(() => (
        <Field.Root>
          <Select.Root>
            <Select.Trigger data-testid="trigger" />
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="">Select</Select.Item>
                  <Select.Item value="1">Option 1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(trigger);
      await flushMicrotasks();

      const option = await screen.findByRole('option', { name: 'Option 1' });

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await user.click(option);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when filled', async () => {
        const { user } = renderWithUser(() => (
          <Field.Root>
            <Select.Root>
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="">Select</Select.Item>
                    <Select.Item value="1">Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>
        ));

        const trigger = screen.getByTestId('trigger');

        expect(trigger).not.toHaveAttribute('data-filled');

        await user.click(trigger);
        await flushMicrotasks();

        const option = await screen.findByRole('option', { name: 'Option 1' });

        // Arrow Down to focus the Option 1
        await user.keyboard('{ArrowDown}');
        await user.click(option);
        await flushMicrotasks();

        expect(trigger).toHaveAttribute('data-filled', '');

        await user.click(trigger);
        await flushMicrotasks();

        const select = await screen.findByRole('listbox');
        expect(select).not.toHaveAttribute('data-filled');
      });

      it('adds [data-filled] attribute when already filled', () => {
        renderWithUser(() => (
          <Field.Root>
            <Select.Root defaultValue="1">
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="1">Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>
        ));
        flush();

        expect(screen.getByTestId('trigger')).toHaveAttribute('data-filled');
      });

      it('does not add [data-filled] attribute when single value serializes to empty string', () => {
        renderWithUser(() => (
          <Field.Root>
            <Select.Root value="">
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="">Select</Select.Item>
                    <Select.Item value="1">Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>
        ));
        flush();

        expect(screen.getByTestId('trigger')).not.toHaveAttribute('data-filled');
      });

      it('does not add [data-filled] attribute when a non-string value serializes to empty string', () => {
        const emptyValue = { id: 1, label: 'Empty option' };

        renderWithUser(() => (
          <Field.Root>
            <Select.Root
              value={emptyValue}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={() => ''}
            >
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value={emptyValue}>Empty option</Select.Item>
                    <Select.Item value={{ id: 2, label: 'Option 1' }}>Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>
        ));
        flush();

        expect(screen.getByTestId('trigger')).not.toHaveAttribute('data-filled');
      });

      it('does not add [data-filled] attribute when multiple value is empty', async () => {
        const { user } = renderWithUser(() => (
          <Field.Root>
            <Select.Root multiple>
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="">Select</Select.Item>
                    <Select.Item value="1">Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>
        ));

        const trigger = screen.getByTestId('trigger');

        expect(trigger).not.toHaveAttribute('data-filled');

        await user.click(trigger);
        await flushMicrotasks();

        const option = await screen.findByRole('option', { name: 'Option 1' });

        await user.click(option);
        await flushMicrotasks();

        expect(trigger).toHaveAttribute('data-filled', '');

        await user.click(option);
        await flushMicrotasks();

        expect(trigger).not.toHaveAttribute('data-filled');
      });

      it('does not add [data-filled] attribute when multiple defaultValue is empty array', async () => {
        const { user } = renderWithUser(() => (
          <Field.Root>
            <Select.Root multiple defaultValue={[]}>
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="">Select</Select.Item>
                    <Select.Item value="1">Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>
        ));

        const trigger = screen.getByTestId('trigger');

        expect(trigger).not.toHaveAttribute('data-filled');

        await user.click(trigger);
        await flushMicrotasks();

        const option = await screen.findByRole('option', { name: 'Option 1' });

        await user.click(option);
        await flushMicrotasks();

        expect(trigger).toHaveAttribute('data-filled', '');

        await user.click(option);
        await flushMicrotasks();

        expect(trigger).not.toHaveAttribute('data-filled');
      });
    });

    it('[data-focused]', () => {
      renderWithUser(() => (
        <Field.Root>
          <Select.Root>
            <Select.Trigger data-testid="trigger" />
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="">Select</Select.Item>
                  <Select.Item value="1">Option 1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-focused');

      fireEvent.focus(trigger);
      flush();

      expect(trigger).toHaveAttribute('data-focused', '');

      fireEvent.blur(trigger);
      flush();

      expect(trigger).not.toHaveAttribute('data-focused');
    });

    describe('[data-focused] without a blur event', () => {
      function renderSelects(initialProps: { firstMounted?: boolean; firstDisabled?: boolean }) {
        return renderWithProps(
          (props: { firstMounted?: boolean; firstDisabled?: boolean }) => (
            <Field.Root data-testid="field">
              <Show when={props.firstMounted ?? true}>
                <Select.Root disabled={props.firstDisabled ?? false}>
                  <Select.Trigger data-testid="first" />
                </Select.Root>
              </Show>
            </Field.Root>
          ),
          initialProps,
        );
      }

      it('is removed when the focused trigger becomes disabled', async () => {
        const { setProps } = renderSelects({});

        const trigger = screen.getByTestId('first');
        await act(() => {
          trigger.focus();
        });

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
        expect(trigger).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused trigger unmounts', async () => {
        const { setProps } = renderSelects({});

        await act(() => {
          screen.getByTestId('first').focus();
        });

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      });
    });

    it('does not mark as touched when focus moves into the popup', async () => {
      const validateSpy = vi.fn(() => 'error');

      renderWithUser(() => (
        <>
          <Field.Root validationMode="onBlur" validate={validateSpy}>
            <Select.Root>
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="1">Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>
          <button data-testid="outside">Outside</button>
        </>
      ));

      const trigger = screen.getByTestId('trigger');

      fireEvent.focus(trigger);
      fireEvent.click(trigger);
      flush();

      await flushMicrotasks();

      const listbox = await screen.findByRole('listbox');

      fireEvent.blur(trigger, { relatedTarget: listbox });
      fireEvent.focus(listbox);
      flush();

      await flushMicrotasks();

      expect(validateSpy.mock.calls.length).toBe(0);
      expect(trigger).toHaveAttribute('data-focused', '');
      expect(trigger).not.toHaveAttribute('data-touched');
      expect(trigger).not.toHaveAttribute('aria-invalid');
    });

    it('validates when the popup is blurred', async () => {
      const validateSpy = vi.fn(() => 'error');

      renderWithUser(() => (
        <>
          <Field.Root validationMode="onBlur" validate={validateSpy}>
            <Select.Root>
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="1">Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>
          <button data-testid="outside">Outside</button>
        </>
      ));

      const trigger = screen.getByTestId('trigger');
      const outside = screen.getByTestId('outside');

      fireEvent.focus(trigger);
      fireEvent.click(trigger);
      flush();

      await flushMicrotasks();

      const listbox = await screen.findByRole('listbox');

      // React Testing Library's `blur` also dispatches `focusout`, which the popup listens to.
      fireEvent.focusOut(trigger, { relatedTarget: listbox });
      fireEvent.blur(trigger, { relatedTarget: listbox });
      fireEvent.focus(listbox);

      fireEvent.focusOut(listbox, { relatedTarget: outside });
      fireEvent.blur(listbox, { relatedTarget: outside });
      fireEvent.focus(outside);
      flush();

      await waitFor(() => {
        expect(validateSpy.mock.calls.length).toBe(1);
      });

      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-touched', '');
      });
      expect(trigger).not.toHaveAttribute('data-focused');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validate', async () => {
      renderWithUser(() => (
        <Field.Root validationMode="onBlur" validate={() => 'error'}>
          <Select.Root>
            <Select.Trigger data-testid="trigger" />
            <Select.Portal>
              <Select.Positioner />
            </Select.Portal>
          </Select.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('aria-invalid');

      fireEvent.focus(trigger);
      fireEvent.blur(trigger);

      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });

    it('passes raw value to validate when itemToStringValue is provided', async () => {
      const items = [
        { code: 'US', label: 'United States' },
        { code: 'CA', label: 'Canada' },
      ];
      const validateSpy = vi.fn((value: unknown) => {
        expect(value).toBe(items[0]);
        return 'error';
      });

      renderWithUser(() => (
        <Field.Root validationMode="onBlur" validate={validateSpy}>
          <Select.Root
            defaultValue={items[0]}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.code}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner />
            </Select.Portal>
          </Select.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      fireEvent.focus(trigger);
      fireEvent.blur(trigger);

      await waitFor(() => {
        expect(validateSpy.mock.calls.length).toBe(1);
      });
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validateMode=onSubmit', async () => {
      const { user } = renderWithUser(() => (
        <Form>
          <Field.Root validate={(val) => (val === '2' ? 'error' : null)}>
            <Select.Root required>
              <Select.Trigger />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="1">Option 1</Select.Item>
                    <Select.Item value="2">Option 2</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const trigger = screen.getByRole('combobox');
      expect(trigger).not.toHaveAttribute('aria-invalid');

      await user.click(screen.getByText('submit'));
      expect(trigger).toHaveAttribute('aria-invalid', 'true');

      // Arrow Down to focus Option 1 (valid)
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(screen.getByRole('option', { name: 'Option 1' })).toHaveFocus());
      await user.keyboard('{Enter}');
      await flushMicrotasks();
      expect(trigger).not.toHaveAttribute('aria-invalid');

      await user.click(trigger);
      // Arrow Down to focus Option 2 (invalid)
      await waitFor(() => expect(screen.getByRole('option', { name: 'Option 1' })).toHaveFocus());
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-invalid', 'true');

      await user.click(trigger);
      // Arrow Up to focus Option 1 (valid)
      await waitFor(() => expect(screen.getByRole('option', { name: 'Option 2' })).toHaveFocus());
      await user.keyboard('{ArrowUp}');
      await user.keyboard('{Enter}');
      await flushMicrotasks();
      expect(trigger).not.toHaveAttribute('aria-invalid');
    });

    it('prop: validationMode=onChange', async () => {
      const { user } = renderWithUser(() => (
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            return value === '1' ? 'error' : null;
          }}
        >
          <Select.Root>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="1">Option 1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('aria-invalid');

      await user.click(trigger);
      await flushMicrotasks();

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(screen.getByRole('option', { name: 'Option 1' })).toHaveFocus());
      await user.keyboard('{Enter}');
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });

    it('revalidates when the controlled value changes externally', async () => {
      const validateSpy = vi.fn((value: unknown) => ((value as string) === 'b' ? 'error' : null));
      const [value, setValue] = createSignal('a');

      renderWithUser(() => (
        <>
          <Field.Root validationMode="onChange" validate={validateSpy} name="flavor">
            <Select.Root value={value()} onValueChange={(next) => setValue(next as string)}>
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="a">Option A</Select.Item>
                    <Select.Item value="b">Option B</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>
          <button type="button" onClick={() => setValue('b')}>
            Select externally
          </button>
        </>
      ));
      await flushMicrotasks();

      const trigger = screen.getByTestId('trigger');
      const toggle = screen.getByText('Select externally');

      expect(trigger).not.toHaveAttribute('aria-invalid');
      const initialCallCount = validateSpy.mock.calls.length;

      click(toggle);
      await flushMicrotasks();

      expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
      expect(validateSpy.mock.lastCall?.[0]).toBe('b');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onBlur', async () => {
      const { user } = renderWithUser(() => (
        <Field.Root
          validationMode="onBlur"
          validate={(value) => {
            return value === '1' ? 'error' : null;
          }}
        >
          <Select.Root>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="1">Option 1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('aria-invalid');

      await user.click(trigger);
      await flushMicrotasks();

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(screen.getByRole('option', { name: 'Option 1' })).toHaveFocus());
      await user.keyboard('{Enter}');

      fireEvent.blur(trigger);
      await flushMicrotasks();

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('Field.Label', () => {
      renderWithUser(() => (
        <Field.Root>
          <Select.Root>
            <Select.Trigger data-testid="trigger" />
            <Select.Portal>
              <Select.Positioner />
            </Select.Portal>
          </Select.Root>
          <Field.Label data-testid="label" nativeLabel={false} render="span" />
        </Field.Root>
      ));
      flush();

      expect(screen.getByTestId('trigger')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('Select.Label', () => {
      renderWithUser(() => (
        <Select.Root>
          <Select.Label data-testid="label" />
          <Select.Trigger data-testid="trigger" />
          <Select.Portal>
            <Select.Positioner />
          </Select.Portal>
        </Select.Root>
      ));
      flush();

      expect(screen.getByTestId('trigger')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('does not set fallback aria-labelledby when no label is rendered', async () => {
      renderWithUser(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger" aria-label="Font" />
          <Select.Portal>
            <Select.Positioner />
          </Select.Portal>
        </Select.Root>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('trigger')).not.toHaveAttribute('aria-labelledby');
      });
    });

    it('updates Select.Label linkage when root id changes', async () => {
      const { setProps } = renderWithProps(
        (props: { id: string }) => (
          <Select.Root id={props.id}>
            <Select.Label data-testid="label">Theme</Select.Label>
            <Select.Trigger data-testid="trigger" />
            <Select.Portal>
              <Select.Positioner />
            </Select.Portal>
          </Select.Root>
        ),
        { id: 'first' },
      );

      await setProps({ id: 'second' });

      const label = screen.getByTestId('label');
      const trigger = screen.getByTestId('trigger');
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-labelledby', 'second-label');
      });
      expect(trigger).toHaveAttribute('id', 'second');
      expect(label).toHaveAttribute('id', 'second-label');
    });

    it('Select.Label focuses trigger without opening', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root>
          <Select.Label data-testid="label">Font</Select.Label>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="sans">Sans-serif</Select.Item>
                <Select.Item value="serif">Serif</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      await user.click(screen.getByTestId('label'));

      expect(screen.getByTestId('trigger')).toHaveFocus();
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('Field.Label links to trigger and focuses it', async () => {
      const { user } = renderWithUser(() => (
        <Field.Root>
          <Field.Label data-testid="label">Font</Field.Label>
          <Select.Root>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="sans">Sans-serif</Select.Item>
                  <Select.Item value="serif">Serif</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>
      ));
      flush();

      const label = screen.getByTestId<HTMLLabelElement>('label');
      const trigger = screen.getByTestId('trigger');

      expect(label).toHaveAttribute('for', trigger.id);
      expect(trigger).toHaveAttribute('id', label.htmlFor);

      await user.click(label);

      await waitFor(() => expect(screen.getByRole('listbox')).toHaveFocus());
    });

    it('Field.Label links to trigger when trigger has an explicit id', async () => {
      const { user } = renderWithUser(() => (
        <Field.Root>
          <Field.Label data-testid="label">Font</Field.Label>
          <Select.Root>
            <Select.Trigger data-testid="trigger" id="x-id">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="sans">Sans-serif</Select.Item>
                  <Select.Item value="serif">Serif</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>
      ));
      flush();

      const label = screen.getByTestId<HTMLLabelElement>('label');
      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveAttribute('id', 'x-id');
      expect(label).toHaveAttribute('for', 'x-id');
      expect(trigger).toHaveAttribute('id', label.htmlFor);

      await user.click(label);

      await waitFor(() => expect(screen.getByRole('listbox')).toHaveFocus());
    });

    it('Field.Description', () => {
      renderWithUser(() => (
        <Field.Root>
          <Select.Root>
            <Select.Trigger data-testid="trigger" aria-describedby="external-description" />
            <Select.Portal>
              <Select.Positioner />
            </Select.Portal>
          </Select.Root>
          <Field.Description data-testid="description" />
        </Field.Root>
      ));
      flush();

      expect(screen.getByTestId('trigger')).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });
});
