import { createSignal, flush, For, Show } from 'solid-js';
import { fireEvent, render as solidRender, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import type { JSX } from '@solidjs/web';
import { Switch } from '..';
import { Field } from '../../field';
import { Form } from '../../form';

function render(ui: () => JSX.Element) {
  const user = userEvent.setup();
  return { user, ...solidRender(ui) };
}

function click(element: Element) {
  fireEvent.click(element);
  flush();
}

/**
 * A submit handler that prevents the navigation and returns the submitted value of `name`.
 */
function createFormDataSpy(name: string) {
  return vi.fn((event: SubmitEvent) => {
    event.preventDefault();
    return new FormData(event.currentTarget as HTMLFormElement).get(name);
  });
}

describe('<Switch.Root />', () => {
  describe('conformance', () => {
    it('renders a span and supports ref, class and style', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Switch.Root
          ref={(element) => {
            ref = element;
          }}
          class={(state) => (state.checked ? 'on' : 'off')}
          style={{ color: 'red' }}
        />
      ));
      const switchElement = screen.getByRole('switch');
      expect(switchElement.tagName).toBe('SPAN');
      expect(ref).toBe(switchElement);
      expect(switchElement).toHaveClass('off');
      expect(switchElement).toHaveStyle({ color: 'rgb(255, 0, 0)' });

      click(switchElement);
      expect(switchElement).toHaveClass('on');
    });

    it('supports the render prop', () => {
      render(() => (
        <Switch.Root
          render={(props, state) => <div {...props} data-state-checked={String(state.checked)} />}
        />
      ));
      const switchElement = screen.getByRole('switch');
      expect(switchElement.tagName).toBe('DIV');
      expect(switchElement).toHaveAttribute('data-state-checked', 'false');
    });
  });

  // Skipped: hiddenInputSizeTests (needs layout).

  describe('interactions', () => {
    it('tolerates imperative interaction in its ref callback before the hidden input mounts', () => {
      render(() => (
        <Switch.Root
          ref={(element) => {
            element.focus();
            element.blur();
            element.click();
          }}
        />
      ));

      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    });

    it('should change its state when clicked', () => {
      render(() => <Switch.Root />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      click(switchElement);

      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('should update its state when changed from outside', () => {
      const [checked, setChecked] = createSignal(false);
      render(() => (
        <div>
          <button onClick={() => setChecked((c) => !c)}>Toggle</button>
          <Switch.Root checked={checked()} />
        </div>
      ));
      const switchElement = screen.getByRole('switch');
      const button = screen.getByText('Toggle');
      const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      click(button);
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
      expect(input.checked).toBe(true);

      click(button);
      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
    });

    it('keeps a controlled switch unchanged when the owner does not update `checked`', () => {
      const handleCheckedChange = vi.fn();
      render(() => <Switch.Root checked={false} onCheckedChange={handleCheckedChange} />);
      const switchElement = screen.getByRole('switch');
      const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });

      click(switchElement);

      expect(handleCheckedChange).toHaveBeenCalledTimes(1);
      expect(handleCheckedChange.mock.calls[0][0]).toBe(true);
      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
    });

    it('should update its state if the underlying input is toggled', () => {
      render(() => <Switch.Root />);
      const switchElement = screen.getByRole('switch');
      const internalInput = screen.getByRole('checkbox', { hidden: true });

      click(internalInput);

      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('ignores a hidden input click canceled before it is handled', () => {
      const handleCheckedChange = vi.fn();
      render(() => <Switch.Root onCheckedChange={handleCheckedChange} />);

      const switchElement = screen.getByRole('switch');
      const input = screen.getByRole('checkbox', { hidden: true });
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      event.preventDefault();

      fireEvent(input, event);
      flush();

      expect(handleCheckedChange).not.toHaveBeenCalled();
      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });

    it.each([{ key: 'Enter' }, { key: 'Space' }])(
      'can be activated with $key key',
      async ({ key }) => {
        const { user } = render(() => <Switch.Root />);

        const switchElement = screen.getByRole('switch');
        expect(switchElement).toHaveAttribute('aria-checked', 'false');

        await user.keyboard('[Tab]');
        expect(switchElement).toHaveFocus();

        await user.keyboard(`[${key}]`);
        expect(switchElement).toHaveAttribute('aria-checked', 'true');
      },
    );
  });

  describe('extra props', () => {
    it('should override the built-in attributes', () => {
      render(() => <Switch.Root role="checkbox" data-testid="switch" />);
      expect(screen.getByTestId('switch')).toHaveAttribute('role', 'checkbox');
    });

    it('sets `aria-labelledby` from a sibling label associated with the hidden input', () => {
      render(() => (
        <div>
          <label for="switch-input">Label</label>
          <Switch.Root id="switch-input" />
        </div>
      ));

      const label = screen.getByText('Label');
      expect(label.id).not.toBe('');
      expect(screen.getByRole('switch')).toHaveAttribute('aria-labelledby', label.id);
    });

    it('updates fallback `aria-labelledby` when the hidden input id changes', async () => {
      const [id, setId] = createSignal('switch-input-a');
      render(() => (
        <>
          <label for="switch-input-a">Label A</label>
          <label for="switch-input-b">Label B</label>
          <Switch.Root id={id()} />
          <button type="button" onClick={() => setId('switch-input-b')}>
            Toggle
          </button>
        </>
      ));

      const switchElement = screen.getByRole('switch');
      const labelA = screen.getByText('Label A');

      expect(labelA.id).not.toBe('');
      expect(switchElement).toHaveAttribute('aria-labelledby', labelA.id);

      click(screen.getByRole('button', { name: 'Toggle' }));

      const labelB = screen.getByText('Label B');

      await waitFor(() => {
        expect(switchElement).toHaveAttribute('aria-labelledby', labelB.id);
      });
      expect(labelB.id).not.toBe('');
      expect(labelB.id).not.toBe(labelA.id);
    });

    it('prefers `aria-label` over an associated label', () => {
      render(() => (
        <>
          <label>
            <Switch.Root aria-label="Wi-Fi" />
            Wi-Fi
          </label>
          <Field.Root>
            <Field.Label>
              <Switch.Root aria-label="Bluetooth" />
              Bluetooth
            </Field.Label>
          </Field.Root>
        </>
      ));

      const [nativeLabelled, fieldLabelled] = screen.getAllByRole('switch');
      expect(nativeLabelled).not.toHaveAttribute('aria-labelledby');
      expect(nativeLabelled).toHaveAccessibleName('Wi-Fi');
      expect(fieldLabelled).not.toHaveAttribute('aria-labelledby');
      expect(fieldLabelled).toHaveAccessibleName('Bluetooth');
    });

    // Skipped: "prefers a render element's `aria-label` over an associated label". In this port,
    // `render` is a tag or a function receiving the props, so the `aria-label` prop is the only
    // source (see `resolveRenderedAriaLabel`), which the test above covers.
  });

  describe('prop: onCheckedChange', () => {
    it('should call onCheckedChange when clicked', () => {
      const handleChange = vi.fn();
      render(() => <Switch.Root onCheckedChange={handleChange} />);
      const switchElement = screen.getByRole('switch');

      click(switchElement);

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(true);
      expect(handleChange.mock.calls[0][1].reason).toBe('none');
    });

    it('should report keyboard modifier event properties when calling onCheckedChange', async () => {
      const handleChange = vi.fn(
        (_checked: boolean, eventDetails: Switch.Root.ChangeEventDetails) => eventDetails,
      );
      const { user } = render(() => <Switch.Root onCheckedChange={handleChange} />);
      const switchElement = screen.getByRole('switch');

      await user.keyboard('{Shift>}');
      await user.click(switchElement);
      await user.keyboard('{/Shift}');

      expect(handleChange.mock.calls.length).toBe(1);
      expect((handleChange.mock.results[0]?.value.event as MouseEvent).shiftKey).toBe(true);
    });

    it('does not change state when canceled via a root click', async () => {
      const { user } = render(() => (
        <Field.Root>
          <Switch.Root
            data-testid="button"
            onCheckedChange={(_, eventDetails) => eventDetails.cancel()}
          />
        </Field.Root>
      ));

      const switchElement = screen.getByTestId('button');
      const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });

      await user.click(switchElement);

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
      expect(switchElement).not.toHaveAttribute('data-dirty');
      expect(switchElement).not.toHaveAttribute('data-filled');
    });

    it('does not change state when canceled via a hidden input click', async () => {
      const { user } = render(() => (
        <Field.Root>
          <Switch.Root
            data-testid="button"
            onCheckedChange={(_, eventDetails) => eventDetails.cancel()}
          />
        </Field.Root>
      ));

      const switchElement = screen.getByTestId('button');
      const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });

      await user.click(input);

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
      expect(switchElement).not.toHaveAttribute('data-dirty');
      expect(switchElement).not.toHaveAttribute('data-filled');
    });
  });

  describe('prop: onClick', () => {
    it('should call onClick when clicked', () => {
      const handleClick = vi.fn();
      render(() => <Switch.Root onClick={handleClick} />);
      const switchElement = screen.getByRole('switch');

      click(switchElement);

      expect(handleClick.mock.calls.length).toBe(1);
    });

    it.each([false, true])(
      'propagates a single click event to ancestors per user click (nativeButton=%s)',
      (nativeButton) => {
        const handleParentClick = vi.fn();
        render(() => (
          <div onClick={handleParentClick}>
            <Switch.Root nativeButton={nativeButton} render={nativeButton ? 'button' : undefined} />
          </div>
        ));

        click(screen.getByRole('switch'));

        expect(handleParentClick).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
      },
    );

    it.each([false, true])(
      'does not propagate to ancestors when stopPropagation() is called (nativeButton=%s)',
      (nativeButton) => {
        const handleParentClick = vi.fn();
        render(() => (
          <div onClick={handleParentClick}>
            <Switch.Root
              nativeButton={nativeButton}
              render={nativeButton ? 'button' : undefined}
              onClick={(event: MouseEvent) => event.stopPropagation()}
            />
          </div>
        ));

        click(screen.getByRole('switch'));

        expect(handleParentClick).toHaveBeenCalledTimes(0);
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
      },
    );
  });

  describe('prop: disabled', () => {
    it('uses aria-disabled instead of HTML disabled', () => {
      render(() => <Switch.Root disabled />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('disabled');
      expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not have the `disabled` attribute when `disabled` is not set', () => {
      render(() => <Switch.Root />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('disabled');
    });

    it('should not change its state when clicked', () => {
      render(() => <Switch.Root disabled />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      click(switchElement);

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: readOnly', () => {
    it('should have the `aria-readonly` attribute', () => {
      render(() => <Switch.Root readOnly />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-readonly', 'true');
    });

    it('should not have the aria attribute when `readOnly` is not set', () => {
      render(() => <Switch.Root />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('aria-readonly');
    });

    it('should not change its state when clicked', () => {
      render(() => <Switch.Root readOnly />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      click(switchElement);

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });

    it('should not change its state when its label is clicked', () => {
      render(() => (
        <label data-testid="label">
          <Switch.Root readOnly />
        </label>
      ));
      const switchElement = screen.getByRole('switch');
      const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      click(screen.getByTestId('label'));

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
    });
  });

  describe('prop: required', () => {
    it('should have the `aria-required` attribute', () => {
      render(() => <Switch.Root required />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-required', 'true');
    });

    it('should not have the aria attribute when `required` is not set', () => {
      render(() => <Switch.Root />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('aria-required');
    });
  });

  describe('prop: inputRef', () => {
    it('should be able to access the native input', () => {
      let inputRef: HTMLInputElement | undefined;
      render(() => (
        <Switch.Root
          inputRef={(element) => {
            inputRef = element;
          }}
        />
      ));
      const internalInput = screen.getByRole('checkbox', { hidden: true });

      expect(inputRef).toBe(internalInput);
    });
  });

  it('should place the style hooks on the root and the thumb', () => {
    const [disabled, setDisabled] = createSignal(true);
    const [readOnly, setReadOnly] = createSignal(true);
    render(() => (
      <Switch.Root defaultChecked disabled={disabled()} readOnly={readOnly()} required>
        <Switch.Thumb data-testid="thumb" />
      </Switch.Root>
    ));

    const switchElement = screen.getByRole('switch');
    const thumb = screen.getByTestId('thumb');

    expect(switchElement).toHaveAttribute('data-checked', '');
    expect(switchElement).toHaveAttribute('data-disabled', '');
    expect(switchElement).toHaveAttribute('data-readonly', '');
    expect(switchElement).toHaveAttribute('data-required', '');

    expect(thumb).toHaveAttribute('data-checked', '');
    expect(thumb).toHaveAttribute('data-disabled', '');
    expect(thumb).toHaveAttribute('data-readonly', '');
    expect(thumb).toHaveAttribute('data-required', '');

    setDisabled(false);
    setReadOnly(false);
    flush();
    click(switchElement);

    expect(switchElement).toHaveAttribute('data-unchecked', '');
    expect(switchElement).not.toHaveAttribute('data-checked');

    expect(thumb).toHaveAttribute('data-unchecked', '');
    expect(thumb).not.toHaveAttribute('data-checked');
  });

  it('should set the name attribute only on the input', () => {
    render(() => <Switch.Root name="switch-name" />);

    const switchElement = screen.getByRole('switch');
    const input = screen.getByRole('checkbox', { hidden: true });

    expect(input).toHaveAttribute('name', 'switch-name');
    expect(switchElement).not.toHaveAttribute('name');
  });

  it('should not set the value attribute by default', () => {
    render(() => <Switch.Root />);

    const input = screen.getByRole('checkbox', { hidden: true });

    expect(input).not.toHaveAttribute('value');
  });

  it('should set the value attribute only on the input', () => {
    render(() => <Switch.Root value="1" />);

    const switchElement = screen.getByRole('switch');
    const input = screen.getByRole('checkbox', { hidden: true });

    expect(input).toHaveAttribute('value', '1');
    expect(switchElement).not.toHaveAttribute('value');
  });

  describe('with native <label>', () => {
    it('should toggle the switch when a wrapping <label> is clicked', async () => {
      const { user } = render(() => (
        <label data-testid="label">
          <Switch.Root />
          Toggle
        </label>
      ));

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      await user.click(screen.getByTestId('label'));
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('should toggle the switch when a explicitly linked <label> is clicked', async () => {
      const { user } = render(() => (
        <div>
          <label data-testid="label" for="mySwitch">
            Toggle
          </label>

          <Switch.Root id="mySwitch" />
        </div>
      ));

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      await user.click(screen.getByTestId('label'));
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('should associate `id` with the native button when `nativeButton=true`', async () => {
      const { user } = render(() => (
        <div>
          <label data-testid="label" for="mySwitch">
            Toggle
          </label>

          <Switch.Root id="mySwitch" nativeButton render="button" />
        </div>
      ));

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('id', 'mySwitch');

      const hiddenInput = screen.getByRole('checkbox', { hidden: true });
      expect(hiddenInput).not.toHaveAttribute('id', 'mySwitch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      await user.click(screen.getByTestId('label'));
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Form', () => {
    // Upstream skips these in JSDOM; jsdom's `FormData(form)` and implicit `submit` events are
    // enough to run them here.
    it('preserves Field validation props through canceled changes, submit, and reset', async () => {
      let cancelChanges = true;
      const submitSpy = vi.fn((event: SubmitEvent) => {
        event.preventDefault();
      });
      const { user } = render(() => (
        <Form onSubmit={submitSpy}>
          <Field.Root name="notifications">
            <Switch.Root
              required
              aria-describedby="external-description"
              onCheckedChange={(_, details) => {
                if (cancelChanges) {
                  details.cancel();
                }
              }}
            />
            <Field.Description data-testid="description">Choose a setting</Field.Description>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
          <button type="reset">Reset</button>
        </Form>
      ));

      const switchElement = screen.getByRole('switch');
      const description = screen.getByTestId('description');
      expect(switchElement).toHaveAttribute(
        'aria-describedby',
        `external-description ${description.id}`,
      );

      await user.click(switchElement);
      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      await user.click(screen.getByRole('button', { name: 'Submit' }));
      expect(submitSpy).not.toHaveBeenCalled();
      expect(switchElement).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      cancelChanges = false;
      await user.click(switchElement);
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
      expect(switchElement).not.toHaveAttribute('aria-invalid');
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      expect(submitSpy).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole('button', { name: 'Reset' }));
      // Switch state is component-managed, so a native form reset does not change it.
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
      expect(switchElement).not.toHaveAttribute('aria-invalid');
      expect(switchElement).toHaveAttribute(
        'aria-describedby',
        `external-description ${description.id}`,
      );
    });

    it('should include the switch value in form submission, matching native checkbox behavior', async () => {
      const submitSpy = createFormDataSpy('test-switch');

      const { user } = render(() => (
        <Form onSubmit={submitSpy}>
          <Field.Root name="test-switch">
            <Switch.Root />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const switchElement = screen.getByRole('switch');
      const submitButton = screen.getByRole('button');

      await user.click(submitButton);

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe(null);

      await user.click(switchElement);
      await user.click(submitButton);

      expect(submitSpy.mock.calls.length).toBe(2);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('on');
    });

    it('submits to an external form when `form` is provided', async () => {
      const submitSpy = createFormDataSpy('test-switch');

      const { user } = render(() => (
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Switch.Root name="test-switch" form="external-form" />
        </>
      ));

      await user.click(screen.getByRole('switch'));
      await user.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('on');
    });

    it('submits uncheckedValue to an external form when off', () => {
      const submitSpy = createFormDataSpy('test-switch');

      render(() => (
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Switch.Root name="test-switch" form="external-form" uncheckedValue="off" />
        </>
      ));

      click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('off');
    });

    it('does not submit uncheckedValue when disabled', async () => {
      const submitSpy = createFormDataSpy('test-switch');

      const { user } = render(() => (
        <form onSubmit={submitSpy}>
          <Switch.Root name="test-switch" uncheckedValue="off" disabled />
          <button type="submit">Submit</button>
        </form>
      ));

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe(null);
    });

    it('matches native checkbox form submission behavior', async () => {
      const nativeSubmitSpy = vi.fn((event: SubmitEvent) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return { get: formData.get('native'), getAll: formData.getAll('native') };
      });

      const customSubmitSpy = vi.fn((event: SubmitEvent) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return { get: formData.get('custom'), getAll: formData.getAll('custom') };
      });

      const { user } = render(() => (
        <>
          <form onSubmit={nativeSubmitSpy}>
            <input type="checkbox" name="native" />
            <button type="submit">Native submit</button>
          </form>
          <Form onSubmit={customSubmitSpy}>
            <Field.Root name="custom">
              <Switch.Root />
            </Field.Root>
            <button type="submit">Custom submit</button>
          </Form>
        </>
      ));

      const nativeCheckbox = screen.getByRole('checkbox');
      const nativeSubmitButton = screen.getByRole('button', { name: 'Native submit' });

      await user.click(nativeSubmitButton);
      expect(nativeSubmitSpy.mock.results.at(-1)?.value.get).toBe(null);
      expect(nativeSubmitSpy.mock.results.at(-1)?.value.getAll).toEqual([]);

      await user.click(nativeCheckbox);
      await user.click(nativeSubmitButton);
      expect(nativeSubmitSpy.mock.results.at(-1)?.value.get).toBe('on');

      const customSwitch = screen.getByRole('switch');
      const customSubmitButton = screen.getByRole('button', { name: 'Custom submit' });

      await user.click(customSubmitButton);
      expect(customSubmitSpy.mock.results.at(-1)?.value.get).toBe(null);
      expect(customSubmitSpy.mock.results.at(-1)?.value.getAll).toEqual([]);

      await user.click(customSwitch);
      await user.click(customSubmitButton);
      expect(customSubmitSpy.mock.results.at(-1)?.value.get).toBe('on');
    });

    it('should submit uncheckedValue when switch is off and uncheckedValue is specified', async () => {
      const submitSpy = createFormDataSpy('test-switch');

      const { user } = render(() => (
        <Form onSubmit={submitSpy}>
          <Field.Root name="test-switch">
            <Switch.Root uncheckedValue="off" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const switchElement = screen.getByRole('switch');
      const submitButton = screen.getByRole('button');

      await user.click(submitButton);
      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('off');

      await user.click(switchElement);
      await user.click(submitButton);
      expect(submitSpy.mock.calls.length).toBe(2);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('on');

      await user.click(switchElement);
      await user.click(submitButton);
      expect(submitSpy.mock.calls.length).toBe(3);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('off');
    });

    it('should submit custom uncheckedValue when switch is off', async () => {
      const submitSpy = createFormDataSpy('test-switch');

      const { user } = render(() => (
        <Form onSubmit={submitSpy}>
          <Field.Root name="test-switch">
            <Switch.Root uncheckedValue="false" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const switchElement = screen.getByRole('switch');
      const submitButton = screen.getByRole('button');

      await user.click(submitButton);
      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('false');

      await user.click(switchElement);
      await user.click(submitButton);
      expect(submitSpy.mock.calls.length).toBe(2);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('on');
    });

    it('submits custom value and uncheckedValue across an off/on/off cycle', async () => {
      const submitSpy = createFormDataSpy('test-switch');

      const { user } = render(() => (
        <Form onSubmit={submitSpy}>
          <Field.Root name="test-switch">
            <Switch.Root value="yes" uncheckedValue="no" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const switchElement = screen.getByRole('switch');
      const submitButton = screen.getByRole('button');

      await user.click(submitButton);
      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('no');

      await user.click(switchElement);
      await user.click(submitButton);
      expect(submitSpy.mock.calls.length).toBe(2);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('yes');

      await user.click(switchElement);
      await user.click(submitButton);
      expect(submitSpy.mock.calls.length).toBe(3);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('no');
    });

    it('triggers native HTML validation on submit', async () => {
      const { user } = render(() => (
        <Form>
          <Field.Root name="test">
            <Switch.Root name="switch" required />
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const submit = screen.getByText('Submit');

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(submit);

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');
    });

    it('clears external errors on change', () => {
      render(() => (
        <Form errors={{ test: 'test' }}>
          <Field.Root name="test" data-testid="field">
            <Switch.Root data-testid="switch" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));

      const switchElement = screen.getByTestId('switch');

      expect(switchElement).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).toHaveTextContent('test');

      click(switchElement);

      expect(switchElement).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
    });
  });

  describe('Field', () => {
    it('should receive disabled prop from Field.Root', () => {
      render(() => (
        <Field.Root disabled>
          <Switch.Root />
        </Field.Root>
      ));

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-disabled');
    });

    it('should receive name prop from Field.Root', () => {
      render(() => (
        <Field.Root name="field-switch">
          <Switch.Root />
        </Field.Root>
      ));

      const input = screen.getByRole('checkbox', { hidden: true });
      expect(input).toHaveAttribute('name', 'field-switch');
    });

    it('[data-touched]', () => {
      render(() => (
        <Field.Root>
          <Switch.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      fireEvent.focus(button);
      fireEvent.blur(button);
      flush();

      expect(button).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', () => {
      render(() => (
        <Field.Root>
          <Switch.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('data-dirty');

      click(button);

      expect(button).toHaveAttribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when checked after being initially unchecked', () => {
        render(() => (
          <Field.Root>
            <Switch.Root data-testid="button" />
          </Field.Root>
        ));

        const button = screen.getByTestId('button');

        expect(button).not.toHaveAttribute('data-filled');

        click(button);

        expect(button).toHaveAttribute('data-filled', '');

        click(button);

        expect(button).not.toHaveAttribute('data-filled');
      });

      it('clears [data-filled] when a controlled switch remounts unchecked', () => {
        const [unchecked, setUnchecked] = createSignal(false);
        render(() => (
          <Field.Root data-testid="root">
            {/* A keyed `For` remounts the switch, like upstream's `key` */}
            <For each={[unchecked()]}>
              {(value) => <Switch.Root checked={!value} onCheckedChange={() => {}} />}
            </For>
            <button type="button" onClick={() => setUnchecked(true)}>
              clear
            </button>
          </Field.Root>
        ));

        const root = screen.getByTestId('root');
        expect(root).toHaveAttribute('data-filled', '');

        click(screen.getByText('clear'));

        expect(root).not.toHaveAttribute('data-filled');
      });

      it('removes [data-filled] attribute when unchecked after being initially checked', () => {
        render(() => (
          <Field.Root>
            <Switch.Root data-testid="button" defaultChecked />
          </Field.Root>
        ));

        const button = screen.getByTestId('button');

        expect(button).toHaveAttribute('data-filled');

        click(button);

        expect(button).not.toHaveAttribute('data-filled', '');
      });
    });

    it('[data-focused]', () => {
      render(() => (
        <Field.Root>
          <Switch.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('data-focused');

      fireEvent.focus(button);
      flush();

      expect(button).toHaveAttribute('data-focused', '');

      fireEvent.blur(button);
      flush();

      expect(button).not.toHaveAttribute('data-focused');
    });

    it('does not set [data-focused] when disabled', () => {
      render(() => (
        <Field.Root>
          <Switch.Root disabled data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      fireEvent.focus(button);
      flush();

      expect(button).not.toHaveAttribute('data-focused');
    });

    describe('[data-focused] without a blur event', () => {
      it('is removed when the focused switch becomes disabled', () => {
        const [disabled, setDisabled] = createSignal(false);
        render(() => (
          <Field.Root data-testid="root">
            <Switch.Root data-testid="first" disabled={disabled()} />
          </Field.Root>
        ));

        const button = screen.getByTestId('first');
        button.focus();
        flush();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
        expect(button).toHaveAttribute('data-focused', '');

        setDisabled(true);
        flush();

        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
        expect(button).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused switch unmounts', () => {
        const [mounted, setMounted] = createSignal(true);
        render(() => (
          <Field.Root data-testid="root">
            <Show when={mounted()}>
              <Switch.Root data-testid="first" />
            </Show>
          </Field.Root>
        ));

        screen.getByTestId('first').focus();
        flush();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        setMounted(false);
        flush();

        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      });
    });

    it('prop: validationMode=onSubmit', () => {
      render(() => (
        <Form>
          <Field.Root>
            <Switch.Root required />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const button = screen.getByRole('switch');
      expect(button).not.toHaveAttribute('aria-invalid');

      click(screen.getByText('submit'));
      expect(button).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).not.toBe(null);

      click(button);
      expect(button).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);

      click(button);
      expect(button).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).not.toBe(null);
    });

    it('prop: validationMode=onChange', () => {
      render(() => (
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? 'error' : null;
          }}
        >
          <Switch.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('aria-invalid');

      click(button);

      expect(button).toHaveAttribute('aria-invalid', 'true');
    });

    it('keeps its elements when the validity changes', () => {
      render(() => (
        <Field.Root validationMode="onChange" validate={(value) => (value ? 'error' : null)}>
          <Switch.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');
      const input = screen.getByRole('checkbox', { hidden: true });

      click(button);

      expect(screen.getByTestId('button')).toBe(button);
      expect(screen.getByRole('checkbox', { hidden: true })).toBe(input);
      expect(button).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('validates once when changed by the user', async () => {
      const validate = vi.fn();

      const { user } = render(() => (
        <Field.Root validationMode="onChange" validate={validate}>
          <Switch.Root />
        </Field.Root>
      ));

      await user.click(screen.getByRole('switch'));

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe(true);
    });

    it('revalidates when a controlled value changes externally', () => {
      const validateSpy = vi.fn((value: unknown) => ((value as boolean) ? 'error' : null));
      const [checked, setChecked] = createSignal(false);

      render(() => (
        <>
          <Field.Root validationMode="onChange" validate={validateSpy} name="newsletters">
            <Switch.Root
              data-testid="button"
              checked={checked()}
              onCheckedChange={(next) => setChecked(next)}
            />
          </Field.Root>
          <button type="button" onClick={() => setChecked((prev) => !prev)}>
            Toggle externally
          </button>
        </>
      ));

      const button = screen.getByTestId('button');
      const toggle = screen.getByText('Toggle externally');

      expect(button).not.toHaveAttribute('aria-invalid');
      const initialCallCount = validateSpy.mock.calls.length;

      click(toggle);

      expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
      expect(validateSpy.mock.lastCall?.[0]).toBe(true);
      expect(button).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onBlur', () => {
      render(() => (
        <Field.Root
          validationMode="onBlur"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? 'error' : null;
          }}
        >
          <Switch.Root data-testid="button" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('aria-invalid');

      click(button);
      fireEvent.blur(button);
      flush();

      expect(button).toHaveAttribute('aria-invalid', 'true');
    });

    describe('Field.Label', () => {
      describe('implicit', () => {
        it('sets `for` on the label', () => {
          render(() => (
            <Field.Root>
              <Field.Label data-testid="label">
                <Switch.Root />
                OK
              </Field.Label>
            </Field.Root>
          ));

          const label = screen.getByTestId('label');
          expect(label.getAttribute('for')).not.toBe(null);

          const input = document.querySelector('input[type="checkbox"]');
          expect(label.getAttribute('for')).toBe(input?.getAttribute('id'));

          const switchElement = screen.getByRole('switch');
          expect(switchElement.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));
          expect(switchElement).toHaveAttribute('aria-checked', 'false');

          click(label);
          expect(switchElement).toHaveAttribute('aria-checked', 'true');
        });
      });

      describe('explicit association', () => {
        it('when the label is sibling to the switch', () => {
          render(() => (
            <Field.Root>
              <Field.Label data-testid="label">Label</Field.Label>
              <Switch.Root />
            </Field.Root>
          ));

          const label = screen.getByTestId('label');
          const switchElement = screen.getByRole('switch');
          const input = document.querySelector('input[type="checkbox"]');

          expect(label.getAttribute('for')).not.toBe(null);

          expect(label.getAttribute('for')).toBe(input?.getAttribute('id'));
          expect(switchElement.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));

          expect(switchElement).toHaveAttribute('aria-checked', 'false');

          click(label);
          expect(switchElement).toHaveAttribute('aria-checked', 'true');
        });

        it('when rendering a non-native button', () => {
          render(() => (
            <Field.Root>
              <Field.Label data-testid="label">OK</Field.Label>
              <Switch.Root render="span" nativeButton={false} />
            </Field.Root>
          ));

          const label = screen.getByTestId('label');
          expect(label.getAttribute('for')).not.toBe(null);
          const input = document.querySelector('input[type="checkbox"]');
          expect(input?.getAttribute('id')).toBe(label.getAttribute('for'));
          const switchElement = screen.getByRole('switch');
          expect(switchElement.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));
        });

        it('when rendering a non-native label', () => {
          render(() => (
            <Field.Root>
              <Field.Label data-testid="label" render="span" nativeLabel={false}>
                <Switch.Root data-testid="button" />
              </Field.Label>
            </Field.Root>
          ));

          const label = screen.getByTestId('label');
          const switchElement = screen.getByRole('switch');

          expect(label.getAttribute('for')).toBe(null);
          expect(label.getAttribute('id')).not.toBe(null);

          expect(switchElement.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));
          expect(switchElement).toHaveAttribute('aria-checked', 'false');

          // non-native labels cannot toggle a non-native-button switch
          click(label);
          expect(switchElement).not.toHaveAttribute('aria-checked', 'true');
        });
      });
    });

    it('Field.Description', () => {
      render(() => (
        <Field.Root>
          <Switch.Root data-testid="button" aria-describedby="external-description" />
          <Field.Description data-testid="description" />
        </Field.Root>
      ));

      const internalInput = screen.queryByRole<HTMLInputElement>('checkbox', { hidden: true });
      const description = screen.getByTestId('description');

      expect(internalInput).toHaveAttribute('aria-describedby', description.id);
      expect(screen.getByRole('switch')).toHaveAttribute(
        'aria-describedby',
        `external-description ${description.id}`,
      );
    });
  });

  it('can render a native button', async () => {
    const { container, user } = render(() => <Switch.Root render="button" nativeButton />);

    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'false');
    expect(container.querySelector('button')).toBe(switchElement);

    await user.keyboard('[Tab]');
    expect(switchElement).toHaveFocus();

    await user.keyboard('[Enter]');
    expect(switchElement).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('[Space]');
    expect(switchElement).toHaveAttribute('aria-checked', 'false');

    await user.click(switchElement);
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
  });
});
