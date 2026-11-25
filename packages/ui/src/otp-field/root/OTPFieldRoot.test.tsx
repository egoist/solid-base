import { createSignal, flush, For, Show } from 'solid-js';
import { Portal } from '@solidjs/web';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { reset as resetWarnings } from '@egoist/solid-base-utils/warn';
import { OTPField as OTPFieldBase } from '..';
import { Field } from '../../field';
import { Form } from '../../form';
import { Input } from '../../input';
import { REASONS } from '../../internals/reasons';
import type { OTPFieldRoot } from './OTPFieldRoot';

const OTP_LENGTH = 6;

async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
  flush();
}

function change(element: Element, value: string) {
  fireEvent.input(element, { target: { value } });
  flush();
}

function focus(element: HTMLElement) {
  element.focus();
  flush();
}

function keyDown(element: Element, init: KeyboardEventInit) {
  const result = fireEvent.keyDown(element, init);
  flush();
  return result;
}

function pasteText(target: HTMLElement, value: string) {
  const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(pasteEvent, 'clipboardData', {
    value: {
      getData: (type: string) => (type === 'text/plain' ? value : ''),
    },
  });
  fireEvent(target, pasteEvent);
  flush();
}

type OTPFieldProps = Omit<OTPFieldRoot.Props, 'children' | 'length'>;

function OTPField(props: OTPFieldProps) {
  return (
    <OTPFieldBase.Root length={OTP_LENGTH} {...props}>
      {Array.from({ length: OTP_LENGTH }, () => (
        <OTPFieldBase.Input />
      ))}
    </OTPFieldBase.Root>
  );
}

async function renderOTP(ui: () => any) {
  const result = render(ui);
  await settle();
  return result;
}

function getTextboxes() {
  return screen.getAllByRole<HTMLInputElement>('textbox');
}

function getValues() {
  return getTextboxes()
    .map((input) => input.value)
    .join('');
}

function hiddenInput(name = 'otp') {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
}

describe('<OTPField.Root />', () => {
  // Skipped: hidden input size tests (need layout), SSR (`renderToString`) tests.

  describe('conformance', () => {
    it('renders a div with class, style, ref and render support', async () => {
      let ref: HTMLElement | undefined;
      await renderOTP(() => (
        <>
          <OTPFieldBase.Root
            length={1}
            data-testid="root"
            class={(state) => (state.complete ? 'complete' : 'incomplete')}
            style={{ color: 'red' }}
            ref={(element) => {
              ref = element;
            }}
          >
            <OTPFieldBase.Input />
          </OTPFieldBase.Root>
          <OTPFieldBase.Root length={1} render="section" data-testid="section">
            <OTPFieldBase.Input />
          </OTPFieldBase.Root>
        </>
      ));
      const root = screen.getByTestId('root');
      expect(root.tagName).toBe('DIV');
      expect(root).toHaveAttribute('role', 'group');
      expect(root).toHaveClass('incomplete');
      expect(root.style.color).toBe('red');
      expect(ref).toBe(root);
      expect(screen.getByTestId('section').tagName).toBe('SECTION');
    });
  });

  describe('value handling', () => {
    it('splits the default value across inputs', async () => {
      await renderOTP(() => <OTPField defaultValue="12a34b56" />);
      expect(getTextboxes().map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
    });

    it('renders slot values before slot indexes resolve', () => {
      render(() => <OTPField defaultValue="123" />);
      expect(getTextboxes().map((input) => input.value)).toEqual(['1', '2', '3', '', '', '']);
    });

    it('clamps an overlong default value to the rendered slot count', async () => {
      await renderOTP(() => <OTPField defaultValue="12a34b56c7" name="otp" />);

      const inputs = getTextboxes();
      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
      expect(inputs[0]).toHaveAttribute('maxlength', '6');
      inputs.slice(1).forEach((input) => {
        expect(input).not.toHaveAttribute('maxlength');
      });
      expect(hiddenInput()).toHaveValue('123456');
    });

    it('assigns slot indexes from render order when omitted', async () => {
      await renderOTP(() => (
        <OTPFieldBase.Root defaultValue="123" length={3}>
          <OTPFieldBase.Input />
          <OTPFieldBase.Input />
          <OTPFieldBase.Input />
        </OTPFieldBase.Root>
      ));
      expect(getTextboxes().map((input) => input.value)).toEqual(['1', '2', '3']);
    });

    it('supports grouped layouts without affecting slot counting', async () => {
      await renderOTP(() => (
        <OTPFieldBase.Root defaultValue="123456" length={6}>
          <div data-testid="first-group">
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
          </div>
          <OTPFieldBase.Separator>-</OTPFieldBase.Separator>
          <div data-testid="second-group">
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
          </div>
        </OTPFieldBase.Root>
      ));

      const root = screen.getByRole('group');
      expect(root).toContainElement(screen.getByTestId('first-group'));
      expect(root).toContainElement(screen.getByTestId('second-group'));
      expect(screen.getByText('-')).toBeVisible();
      expect(getTextboxes().map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
    });

    it('updates the rendered value in controlled mode', async () => {
      const [value, setValue] = createSignal('123456');
      await renderOTP(() => <OTPField value={value()} />);
      expect(getValues()).toBe('123456');

      setValue('654321');
      flush();
      expect(getValues()).toBe('654321');
    });

    describe('prop: validationType', () => {
      it('supports alphabetic values when set to `alpha`', async () => {
        await renderOTP(() => <OTPField defaultValue="1a2b3Cd4" validationType="alpha" />);
        expect(getTextboxes().map((input) => input.value)).toEqual(['a', 'b', 'C', 'd', '', '']);
      });

      it('supports typing alphabetic values when set to `alpha`', async () => {
        await renderOTP(() => <OTPField validationType="alpha" />);
        change(getTextboxes()[0], '1a2b3C');
        expect(getValues()).toBe('abC');
      });

      it('supports alphanumeric values when set to `alphanumeric`', async () => {
        await renderOTP(() => <OTPField validationType="alphanumeric" />);
        change(getTextboxes()[0], 'A1-B2c3');
        expect(getValues()).toBe('A1B2c3');
      });

      it('applies single-character validation to each visible slot', async () => {
        await renderOTP(() => <OTPField validationType="alphanumeric" />);
        expect(getTextboxes()[0]).toHaveAttribute('pattern', '[a-zA-Z0-9]{1}');
      });

      it('renders the hidden validation input with an alphanumeric pattern', async () => {
        await renderOTP(() => <OTPField name="otp" required validationType="alphanumeric" />);
        expect(hiddenInput()).toHaveAttribute('pattern', '[a-zA-Z0-9]{6}');
      });

      it('omits the hidden validation pattern when set to `none`', async () => {
        await renderOTP(() => <OTPField name="otp" validationType="none" />);
        expect(hiddenInput()).not.toBeNull();
        expect(hiddenInput()).not.toHaveAttribute('pattern');
      });

      it('allows a custom inputmode when validation is set to `none`', async () => {
        await renderOTP(() => <OTPField name="otp" validationType="none" inputmode="numeric" />);
        expect(getTextboxes()[0]).toHaveAttribute('inputmode', 'numeric');
        expect(hiddenInput()).toHaveAttribute('inputmode', 'numeric');
      });

      it('allows overriding the built-in inputmode when needed', async () => {
        await renderOTP(() => <OTPField name="otp" validationType="numeric" inputmode="text" />);
        expect(getTextboxes()[0]).toHaveAttribute('inputmode', 'text');
        expect(hiddenInput()).toHaveAttribute('inputmode', 'text');
      });
    });

    describe('prop: normalizeValue', () => {
      it('supports custom normalization when `validationType` is `none`', async () => {
        await renderOTP(() => (
          <OTPField
            validationType="none"
            normalizeValue={(value) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}
          />
        ));
        change(getTextboxes()[0], 'ab-12 cd');
        expect(getValues()).toBe('AB12CD');
      });

      it('composes with built-in validation and advances focus', async () => {
        const warnSpy = vi.spyOn(console, 'warn');
        try {
          await renderOTP(() => (
            <OTPField
              validationType="alphanumeric"
              normalizeValue={(value) => value.toUpperCase()}
            />
          ));
          const inputs = getTextboxes();
          change(inputs[0], 'a!');
          expect(getValues()).toBe('A');
          expect(inputs[1]).toHaveFocus();
          expect(warnSpy).not.toHaveBeenCalled();
        } finally {
          warnSpy.mockRestore();
        }
      });

      it('composes built-in validation and custom normalization for pasted values', async () => {
        await renderOTP(() => (
          <OTPField validationType="alphanumeric" normalizeValue={(value) => value.toUpperCase()} />
        ));
        pasteText(getTextboxes()[0], 'ab-12 cd!');
        expect(getValues()).toBe('AB12CD');
      });

      it('composes built-in validation and custom normalization from a non-first slot', async () => {
        await renderOTP(() => (
          <OTPField
            defaultValue="12"
            validationType="alphanumeric"
            normalizeValue={(value) => value.toUpperCase()}
          />
        ));
        const inputs = getTextboxes();
        focus(inputs[2]);
        change(inputs[2], 'a!');
        expect(getValues()).toBe('12A');
        expect(inputs[3]).toHaveFocus();
      });
    });

    describe('prop: onValueChange', () => {
      it('fires `input-change` when typing', async () => {
        const onValueChange = vi.fn();
        await renderOTP(() => <OTPField onValueChange={onValueChange} />);
        change(getTextboxes()[0], '1');
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.calls[0]?.[0]).toBe('1');
        expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires `input-clear` when clearing a slot by input', async () => {
        const onValueChange = vi.fn();
        await renderOTP(() => <OTPField defaultValue="1" onValueChange={onValueChange} />);
        change(getTextboxes()[0], '');
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.calls[0]?.[0]).toBe('');
        expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputClear);
      });
    });

    describe('prop: onValueInvalid', () => {
      it('fires when typing is normalized before the OTP value updates', async () => {
        const onValueInvalid = vi.fn();
        await renderOTP(() => <OTPField onValueInvalid={onValueInvalid} />);
        change(getTextboxes()[0], '1a');
        expect(getValues()).toBe('1');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1a');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires when custom normalization removes characters', async () => {
        const onValueInvalid = vi.fn();
        await renderOTP(() => (
          <OTPField
            validationType="none"
            inputmode="numeric"
            normalizeValue={(value) => value.replace(/[^0-3]/g, '')}
            onValueInvalid={onValueInvalid}
          />
        ));
        change(getTextboxes()[0], '1209');
        expect(getValues()).toBe('120');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1209');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires when custom normalization removes characters after built-in validation', async () => {
        const onValueInvalid = vi.fn();
        await renderOTP(() => (
          <OTPField
            validationType="numeric"
            normalizeValue={(value) => value.replace(/[^0-3]/g, '')}
            onValueInvalid={onValueInvalid}
          />
        ));
        change(getTextboxes()[0], '1209');
        expect(getValues()).toBe('120');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1209');
      });

      it('fires when built-in validation removes characters before custom normalization expands the value', async () => {
        const onValueInvalid = vi.fn();
        await renderOTP(() => (
          <OTPField
            validationType="numeric"
            normalizeValue={(value) => (value === '1' ? '12' : value)}
            onValueInvalid={onValueInvalid}
          />
        ));
        change(getTextboxes()[0], '1a');
        expect(getValues()).toBe('12');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1a');
      });

      it('fires when custom normalization removes all characters after built-in validation', async () => {
        const onValueInvalid = vi.fn();
        await renderOTP(() => (
          <OTPField
            validationType="numeric"
            normalizeValue={() => ''}
            onValueInvalid={onValueInvalid}
          />
        ));
        change(getTextboxes()[0], '1');
        expect(getValues()).toBe('');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires `input-paste` when pasted text is normalized before the OTP value updates', async () => {
        const onValueInvalid = vi.fn();
        await renderOTP(() => <OTPField onValueInvalid={onValueInvalid} />);
        pasteText(getTextboxes()[0], '12a34');
        expect(getValues()).toBe('1234');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('12a34');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
      });

      it('fires `input-paste` when custom normalization removes characters after built-in validation', async () => {
        const onValueInvalid = vi.fn();
        await renderOTP(() => (
          <OTPField
            validationType="numeric"
            normalizeValue={(value) => value.replace(/[^0-3]/g, '')}
            onValueInvalid={onValueInvalid}
          />
        ));
        pasteText(getTextboxes()[0], '1209');
        expect(getValues()).toBe('120');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
      });
    });

    describe('prop: onValueComplete', () => {
      it('fires when typing completes the OTP', async () => {
        const onValueComplete = vi.fn();
        await renderOTP(() => <OTPField onValueComplete={onValueComplete} />);
        change(getTextboxes()[0], '123456');
        expect(onValueComplete).toHaveBeenCalledTimes(1);
        expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
        expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires `input-paste` when pasting completes the OTP', async () => {
        const onValueComplete = vi.fn();
        await renderOTP(() => <OTPField onValueComplete={onValueComplete} />);
        pasteText(getTextboxes()[0], '123456');
        expect(onValueComplete).toHaveBeenCalledTimes(1);
        expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
        expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
      });

      it('fires `input-paste` when a complete paste replaces a complete OTP', async () => {
        const onValueComplete = vi.fn();
        await renderOTP(() => <OTPField onValueComplete={onValueComplete} />);
        const [firstInput] = getTextboxes();
        pasteText(firstInput, '123456');
        pasteText(firstInput, '654321');
        pasteText(firstInput, '654321');
        expect(onValueComplete.mock.calls.map((call) => call[0])).toEqual([
          '123456',
          '654321',
          '654321',
        ]);
        onValueComplete.mock.calls.forEach((call) => {
          expect(call[1].reason).toBe(REASONS.inputPaste);
        });
      });

      it('fires `input-paste` when pasting into a middle slot completes the OTP', async () => {
        const onValueComplete = vi.fn();
        await renderOTP(() => <OTPField defaultValue="12" onValueComplete={onValueComplete} />);
        const inputs = getTextboxes();
        focus(inputs[2]);
        pasteText(inputs[2], '3456');
        expect(onValueComplete).toHaveBeenCalledTimes(1);
        expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
        expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
      });

      it('does not fire when a completion-making paste is canceled', async () => {
        const onValueComplete = vi.fn();
        await renderOTP(() => (
          <OTPField
            onValueChange={(_, eventDetails) => {
              eventDetails.cancel();
            }}
            onValueComplete={onValueComplete}
          />
        ));
        pasteText(getTextboxes()[0], '123456');
        expect(onValueComplete).not.toHaveBeenCalled();
      });

      it('does not fire before the OTP becomes complete', async () => {
        const onValueComplete = vi.fn();
        await renderOTP(() => <OTPField onValueComplete={onValueComplete} />);
        change(getTextboxes()[0], '12345');
        expect(onValueComplete).not.toHaveBeenCalled();
      });

      it('does not fire later for a stale controlled completion attempt', async () => {
        const onValueComplete = vi.fn();
        const [value, setValue] = createSignal('');
        await renderOTP(() => (
          <OTPField value={value()} onValueChange={() => {}} onValueComplete={onValueComplete} />
        ));
        change(getTextboxes()[0], '123456');
        await settle();
        setValue('654321');
        flush();
        expect(onValueComplete).not.toHaveBeenCalled();
      });

      it('fires after an asynchronously accepted controlled completion', async () => {
        vi.useFakeTimers();
        try {
          const onValueComplete = vi.fn();
          const [value, setValue] = createSignal('');
          await renderOTP(() => (
            <OTPField
              value={value()}
              onValueChange={(nextValue) => {
                setTimeout(() => {
                  setValue(nextValue);
                }, 10);
              }}
              onValueComplete={onValueComplete}
            />
          ));
          change(getTextboxes()[0], '123456');
          vi.runAllTimers();
          flush();
          expect(onValueComplete).toHaveBeenCalledTimes(1);
          expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
          expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
        } finally {
          vi.useRealTimers();
        }
      });

      it('does not fire again when a controlled value changes from one complete value to another', async () => {
        const onValueComplete = vi.fn();
        const [value, setValue] = createSignal('123456');
        await renderOTP(() => (
          <OTPField value={value()} onValueChange={() => {}} onValueComplete={onValueComplete} />
        ));
        setValue('654321');
        flush();
        expect(onValueComplete).not.toHaveBeenCalled();
      });
    });
  });

  describe('Field', () => {
    it('associates Field.Label with the first slot', async () => {
      await renderOTP(() => (
        <Field.Root>
          <Field.Label>Verification code</Field.Label>
          <OTPField />
        </Field.Root>
      ));
      expect(screen.getByText('Verification code')).toHaveAttribute('for', getTextboxes()[0].id);
    });

    it('applies the Field description to the group', async () => {
      await renderOTP(() => (
        <Field.Root>
          <Field.Label data-testid="label">Verification code</Field.Label>
          <Field.Description data-testid="description">Enter the code.</Field.Description>
          <OTPField aria-describedby="external-description" />
        </Field.Root>
      ));

      const label = screen.getByTestId('label');
      const description = screen.getByTestId('description');
      const group = screen.getByRole('group', { name: 'Verification code' });

      expect(group).toHaveAttribute('aria-labelledby', label.id);
      expect(group).toHaveAttribute('aria-describedby', `external-description ${description.id}`);
    });

    it('validates the latest value only after focus leaves the OTP field in onBlur mode', async () => {
      const validate = vi.fn((_value: unknown) => null);

      await renderOTP(() => (
        <>
          <Form>
            <Field.Root name="otp" validationMode="onBlur" validate={validate}>
              <OTPField validationType="none" />
            </Field.Root>
          </Form>
          <button type="button">Outside</button>
        </>
      ));

      const inputs = getTextboxes();
      focus(inputs[0]);
      change(inputs[0], '1');

      fireEvent.blur(inputs[1], { relatedTarget: inputs[2] });
      flush();
      expect(validate).not.toHaveBeenCalled();

      fireEvent.blur(inputs[1], {
        relatedTarget: screen.getByRole('button', { name: 'Outside' }),
      });
      flush();

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.calls[0]).toEqual(['1', { otp: '1' }]);
    });
  });

  describe('accessibility', () => {
    it('forwards root `aria-describedby` to the group', async () => {
      await renderOTP(() => <OTPField aria-describedby="description-id" />);
      expect(screen.getByRole('group')).toHaveAttribute('aria-describedby', 'description-id');
    });

    it('forwards root `aria-labelledby` to the group only', async () => {
      await renderOTP(() => (
        <>
          <span id="label-id">Verification code</span>
          <OTPField aria-labelledby="label-id" />
        </>
      ));

      const group = screen.getByRole('group', { name: 'Verification code' });
      expect(group).toHaveAttribute('aria-labelledby', 'label-id');
      getTextboxes().forEach((input) => {
        expect(input).not.toHaveAttribute('aria-labelledby', 'label-id');
      });
    });

    it('applies the default autocomplete to the first slot only', async () => {
      await renderOTP(() => <OTPField />);
      const inputs = getTextboxes();
      expect(inputs[0]).toHaveAttribute('autocomplete', 'one-time-code');
      expect(inputs[1]).toHaveAttribute('autocomplete', 'off');
    });

    it('allows overriding the autocomplete attribute', async () => {
      await renderOTP(() => <OTPField autocomplete="off" name="otp" />);
      expect(getTextboxes()[0]).toHaveAttribute('autocomplete', 'off');
      expect(hiddenInput()).toHaveAttribute('autocomplete', 'off');
    });
  });

  describe('prop: disabled', () => {
    it('disables every slot and prevents value changes', async () => {
      const onValueChange = vi.fn();
      await renderOTP(() => <OTPField disabled onValueChange={onValueChange} />);
      const [firstInput] = getTextboxes();

      expect(firstInput).toBeDisabled();
      expect(screen.getByRole('group')).toHaveAttribute('data-disabled', '');

      // Solid's delegated handlers skip disabled elements, so the synthetic input event never
      // reaches the component (browsers don't fire it on disabled inputs at all).
      change(firstInput, '1');
      expect(screen.getByRole('group')).not.toHaveAttribute('data-filled');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('prop: readOnly', () => {
    it('marks every slot as readonly and prevents value changes', async () => {
      const onValueChange = vi.fn();
      await renderOTP(() => <OTPField readOnly onValueChange={onValueChange} />);
      const [firstInput] = getTextboxes();

      expect(firstInput).toHaveAttribute('readonly');
      expect(screen.getByRole('group')).toHaveAttribute('data-readonly', '');

      change(firstInput, '1');
      expect(getValues()).toBe('');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('tracks focus state when a readonly slot receives focus', async () => {
      await renderOTP(() => <OTPField readOnly />);
      focus(getTextboxes()[0]);
      expect(screen.getByRole('group')).toHaveAttribute('data-focused', '');
    });
  });

  describe('prop: mask', () => {
    it('renders password slot inputs when enabled', async () => {
      await renderOTP(() => <OTPField defaultValue="123" mask />);
      expect(document.querySelectorAll('input[type="password"]')).toHaveLength(6);
    });

    it('allows overriding the input type on individual slots', async () => {
      await renderOTP(() => (
        <OTPFieldBase.Root length={1} mask>
          <OTPFieldBase.Input type="tel" />
        </OTPFieldBase.Root>
      ));
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'tel');
    });
  });

  describe('interactions', () => {
    it('fills consecutive slots when typing multiple characters into the first input', async () => {
      await renderOTP(() => <OTPField />);
      change(getTextboxes()[0], '123456');
      expect(getValues()).toBe('123456');
    });

    it('replaces consecutive slots when typing multiple characters into a later input', async () => {
      await renderOTP(() => <OTPField defaultValue="123456" />);
      change(getTextboxes()[2], '99');
      expect(getValues()).toBe('129956');
    });

    it('fills consecutive slots when pasting a code', async () => {
      const onValueChange = vi.fn();
      await renderOTP(() => <OTPField onValueChange={onValueChange} />);
      pasteText(getTextboxes()[0], '123456');
      expect(getValues()).toBe('123456');
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBe('123456');
      expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
    });

    describe('external value changes', () => {
      it.each([
        { name: 'cleared', nextValue: '', expectedIndex: 0 },
        { name: 'shortened', nextValue: '12', expectedIndex: 2 },
      ])(
        'moves focus to the first empty slot when a controlled value is $name while focused',
        async ({ nextValue, expectedIndex }) => {
          const [value, setValue] = createSignal('111111');
          await renderOTP(() => <OTPField value={value()} onValueChange={() => {}} />);
          const inputs = getTextboxes();

          focus(inputs[5]);
          expect(inputs[5]).toHaveFocus();

          setValue(nextValue);
          flush();

          expect(inputs[expectedIndex]).toHaveFocus();
          expect(inputs[expectedIndex]).toHaveAttribute('tabindex', '0');
          expect(inputs[5]).toHaveAttribute('tabindex', '-1');
        },
      );

      it('keeps focus on the tab stop when leading slots unmount as the value is cleared', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
          const [length, setLength] = createSignal(OTP_LENGTH);
          const [value, setValue] = createSignal('123456');
          const keys = () =>
            Array.from({ length: length() }, (_, index) => OTP_LENGTH - length() + index);

          await renderOTP(() => (
            <OTPFieldBase.Root length={length()} value={value()} onValueChange={() => {}}>
              <For each={keys()}>{() => <OTPFieldBase.Input />}</For>
            </OTPFieldBase.Root>
          ));

          const lastInput = getTextboxes()[5];
          focus(lastInput);
          expect(lastInput).toHaveFocus();

          setLength(3);
          setValue('');
          flush();
          await settle();

          const inputs = getTextboxes();
          expect(inputs).toHaveLength(3);
          expect(inputs[0]).toHaveFocus();
          expect(inputs[0]).toHaveAttribute('tabindex', '0');
          expect(inputs[2]).toHaveAttribute('tabindex', '-1');
        } finally {
          warnSpy.mockRestore();
        }
      });

      it('keeps focus on a slot that is still reachable after a controlled value shrinks', async () => {
        const [value, setValue] = createSignal('111111');
        await renderOTP(() => <OTPField value={value()} onValueChange={() => {}} />);
        const inputs = getTextboxes();
        focus(inputs[1]);
        setValue('111');
        flush();
        expect(inputs[1]).toHaveFocus();
      });

      it('does not move focus into the field when the value is cleared while focus is outside', async () => {
        const [value, setValue] = createSignal('111111');
        await renderOTP(() => (
          <>
            <OTPField value={value()} onValueChange={setValue} />
            <button type="button" onClick={() => setValue('')}>
              Clear
            </button>
          </>
        ));

        const button = screen.getByRole('button', { name: 'Clear' });
        focus(button);
        fireEvent.click(button);
        flush();

        expect(getValues()).toBe('');
        expect(button).toHaveFocus();
      });

      it('accepts typing and Backspace after a controlled clear while focused', async () => {
        vi.useFakeTimers();
        try {
          const [value, setValue] = createSignal('');
          await renderOTP(() => (
            <OTPField
              value={value()}
              onValueChange={setValue}
              onValueComplete={() => {
                setTimeout(() => {
                  setValue('');
                }, 300);
              }}
            />
          ));

          const inputs = getTextboxes();
          focus(inputs[0]);
          change(inputs[0], '111111');
          expect(inputs[5]).toHaveFocus();

          vi.advanceTimersByTime(300);
          flush();

          expect(getValues()).toBe('');
          expect(inputs[0]).toHaveFocus();

          change(inputs[0], '9');
          expect(inputs[1]).toHaveFocus();

          change(inputs[1], '8');
          expect(getValues()).toBe('98');
          expect(inputs[2]).toHaveFocus();

          keyDown(inputs[2], { key: 'Backspace' });
          expect(inputs[1]).toHaveFocus();

          keyDown(inputs[1], { key: 'Backspace' });
          expect(getValues()).toBe('');
          expect(inputs[0]).toHaveFocus();
        } finally {
          vi.useRealTimers();
        }
      });
    });

    describe('keyboard', () => {
      it('removes a character and moves focus to the previous slot with backspace', async () => {
        const onValueChange = vi.fn();
        await renderOTP(() => <OTPField defaultValue="1234" onValueChange={onValueChange} />);
        const inputs = getTextboxes();
        focus(inputs[1]);
        keyDown(inputs[1], { key: 'Backspace' });

        expect(getValues()).toBe('134');
        expect(document.activeElement).toBe(inputs[0]);
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.calls[0]?.[0]).toBe('134');
        expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.keyboard);
      });

      it('does not fire `onValueChange` for Delete on an empty slot', async () => {
        const onValueChange = vi.fn();
        await renderOTP(() => <OTPField defaultValue="1" onValueChange={onValueChange} />);
        const inputs = getTextboxes();
        focus(inputs[1]);
        keyDown(inputs[1], { key: 'Delete' });
        expect(getValues()).toBe('1');
        expect(onValueChange).not.toHaveBeenCalled();
      });

      it('does not fire `onValueChange` for Backspace on an already-empty first slot', async () => {
        const onValueChange = vi.fn();
        await renderOTP(() => <OTPField onValueChange={onValueChange} />);
        const [firstInput] = getTextboxes();
        focus(firstInput);
        keyDown(firstInput, { key: 'Backspace' });
        expect(getValues()).toBe('');
        expect(document.activeElement).toBe(firstInput);
        expect(onValueChange).not.toHaveBeenCalled();
      });

      it('does not move focus later for a stale controlled change', async () => {
        const [value, setValue] = createSignal('');
        await renderOTP(() => (
          <>
            <OTPField value={value()} onValueChange={() => {}} />
            <button type="button" onClick={() => setValue('9')}>
              Apply value
            </button>
          </>
        ));
        const inputs = getTextboxes();
        focus(inputs[0]);
        change(inputs[0], '1');
        await settle();

        fireEvent.click(screen.getByRole('button', { name: 'Apply value' }));
        flush();
        expect(document.activeElement).toBe(inputs[0]);
      });

      it('moves focus after an asynchronously accepted controlled change', async () => {
        vi.useFakeTimers();
        try {
          const [value, setValue] = createSignal('');
          await renderOTP(() => (
            <OTPField
              value={value()}
              onValueChange={(nextValue) => {
                setTimeout(() => {
                  setValue(nextValue);
                }, 10);
              }}
            />
          ));
          const inputs = getTextboxes();
          focus(inputs[0]);
          change(inputs[0], '1');
          vi.runAllTimers();
          flush();
          expect(document.activeElement).toBe(inputs[1]);
        } finally {
          vi.useRealTimers();
        }
      });
    });
  });

  describe('Form', () => {
    it('blocks form submission while the code is incomplete', async () => {
      await renderOTP(() => (
        <form data-testid="form">
          <OTPField defaultValue="123" name="otp" required />
        </form>
      ));
      expect(screen.getByTestId<HTMLFormElement>('form').checkValidity()).toBe(false);
    });

    it('allows form submission when the code is complete', async () => {
      await renderOTP(() => (
        <form data-testid="form">
          <OTPField defaultValue="123456" name="otp" required />
        </form>
      ));
      expect(screen.getByTestId<HTMLFormElement>('form').checkValidity()).toBe(true);
    });

    it('renders the hidden validation input with the provided name, length and pattern', async () => {
      await renderOTP(() => <OTPField name="otp" required />);
      const input = hiddenInput();
      expect(input).not.toBeNull();
      expect(input).toHaveAttribute('minlength', '6');
      expect(input).toHaveAttribute('maxlength', '6');
      expect(input).toHaveAttribute('pattern', '\\d{6}');
      expect(input).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders visible inputs with unique IDs', async () => {
      await renderOTP(() => <OTPField data-testid="root" id="verification-code" />);
      const inputs = screen.getByTestId('root').querySelectorAll('input');
      expect(Array.from(inputs, (input) => input.id)).toEqual([
        'verification-code',
        'verification-code-2',
        'verification-code-3',
        'verification-code-4',
        'verification-code-5',
        'verification-code-6',
      ]);
    });

    it('redirects hidden validation input focus to the first visible slot', async () => {
      await renderOTP(() => <OTPField name="otp" />);
      focus(hiddenInput()!);
      expect(getTextboxes()[0]).toHaveFocus();
    });

    it('accepts valid hidden-input autofill and moves focus to the first slot when autofill is cleared', async () => {
      const onValueChange = vi.fn();
      const onValueInvalid = vi.fn();
      await renderOTP(() => (
        <OTPField name="otp" onValueChange={onValueChange} onValueInvalid={onValueInvalid} />
      ));

      const inputs = getTextboxes();
      change(hiddenInput()!, '123456');
      expect(getValues()).toBe('123456');
      expect(inputs[5]).toHaveFocus();
      expect(onValueInvalid).not.toHaveBeenCalled();

      change(hiddenInput()!, '');
      expect(getValues()).toBe('');
      expect(inputs[0]).toHaveFocus();
      expect(inputs[0]).toHaveAttribute('tabindex', '0');
      expect(inputs[5]).toHaveAttribute('tabindex', '-1');
      expect(onValueChange.mock.calls.map((call) => call[0])).toEqual(['123456', '']);
      expect(onValueInvalid).not.toHaveBeenCalled();
    });

    it('handles password manager autofill through the hidden input', async () => {
      const onValueChange = vi.fn();
      const onValueInvalid = vi.fn();
      const onValueComplete = vi.fn();
      await renderOTP(() => (
        <OTPField
          name="otp"
          onValueChange={onValueChange}
          onValueInvalid={onValueInvalid}
          onValueComplete={onValueComplete}
        />
      ));

      change(hiddenInput()!, '12a34b56');

      const inputs = getTextboxes();
      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
      expect(hiddenInput()).toHaveValue('123456');
      expect(document.activeElement).toBe(inputs[5]);
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBe('123456');
      expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      expect(onValueInvalid).toHaveBeenCalledTimes(1);
      expect(onValueInvalid.mock.calls[0]?.[0]).toBe('12a34b56');
      expect(onValueComplete).toHaveBeenCalledTimes(1);
      expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
      expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
    });

    it('composes validation and custom normalization during hidden input autofill', async () => {
      const onValueChange = vi.fn();
      const onValueInvalid = vi.fn();
      const onValueComplete = vi.fn();
      await renderOTP(() => (
        <OTPField
          name="otp"
          validationType="alphanumeric"
          normalizeValue={(value) => value.toUpperCase()}
          onValueChange={onValueChange}
          onValueInvalid={onValueInvalid}
          onValueComplete={onValueComplete}
        />
      ));

      change(hiddenInput()!, 'ab-12 cd!');

      const inputs = getTextboxes();
      expect(inputs.map((input) => input.value)).toEqual(['A', 'B', '1', '2', 'C', 'D']);
      expect(document.activeElement).toBe(inputs[5]);
      expect(onValueChange.mock.calls[0]?.[0]).toBe('AB12CD');
      expect(onValueInvalid.mock.calls[0]?.[0]).toBe('ab-12 cd!');
      expect(onValueComplete.mock.calls[0]?.[0]).toBe('AB12CD');
    });

    it.each([
      { lockState: 'readOnly', ariaInvalid: 'true' },
      { lockState: 'disabled', ariaInvalid: null },
    ] as const)(
      'ignores hidden-input autofill when $lockState inside Field',
      async ({ lockState, ariaInvalid }) => {
        const onValueChange = vi.fn();
        const onValueInvalid = vi.fn();
        const onValueComplete = vi.fn();

        await renderOTP(() => (
          <Form errors={{ otp: 'test' }}>
            <Field.Root name="otp">
              <OTPField
                readOnly={lockState === 'readOnly'}
                disabled={lockState === 'disabled'}
                onValueChange={onValueChange}
                onValueInvalid={onValueInvalid}
                onValueComplete={onValueComplete}
              />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>
        ));

        expect(hiddenInput()).not.toBeNull();
        expect(screen.getByTestId('error')).toHaveTextContent('test');
        const inputs = getTextboxes();
        expect(inputs.map((input) => input.getAttribute('aria-invalid'))).toEqual(
          inputs.map(() => ariaInvalid),
        );

        change(hiddenInput()!, '12a34b56');

        expect(getValues()).toBe('');
        if (lockState === 'readOnly') {
          // A disabled input never receives the event (see the `disabled` test above).
          expect(hiddenInput()).toHaveValue('');
        }
        expect(onValueChange).not.toHaveBeenCalled();
        expect(onValueInvalid).not.toHaveBeenCalled();
        expect(onValueComplete).not.toHaveBeenCalled();
        expect(screen.getByTestId('error')).toHaveTextContent('test');
      },
    );

    it.each([{ lockState: 'readOnly' }, { lockState: 'disabled' }] as const)(
      'ignores hidden-input autofill when $lockState outside Field',
      async ({ lockState }) => {
        const onValueChange = vi.fn();
        await renderOTP(() => (
          <OTPField
            readOnly={lockState === 'readOnly'}
            disabled={lockState === 'disabled'}
            name="otp"
            onValueChange={onValueChange}
          />
        ));

        const inputs = getTextboxes();
        expect(inputs.map((input) => input.getAttribute('aria-invalid'))).toEqual(
          inputs.map(() => null),
        );

        change(hiddenInput()!, '12a34b56');
        expect(getValues()).toBe('');
        expect(onValueChange).not.toHaveBeenCalled();
      },
    );

    describe('prop: autoSubmit', () => {
      it('does not auto-submit the owning form when the OTP becomes complete by default', async () => {
        const handleSubmit = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });
        await renderOTP(() => (
          <form onSubmit={handleSubmit}>
            <OTPField />
          </form>
        ));
        change(getTextboxes()[0], '123456');
        expect(getValues()).toBe('123456');
        expect(handleSubmit).not.toHaveBeenCalled();
      });

      it('submits its own form when an unscoped control in another form mounts later', async () => {
        const handleSubmit = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });
        const handleOtherSubmit = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });
        await renderOTP(() => (
          <>
            <form onSubmit={handleSubmit}>
              <OTPField autoSubmit />
            </form>
            <form onSubmit={handleOtherSubmit}>
              <Input aria-label="Unrelated input" />
            </form>
          </>
        ));

        change(getTextboxes()[0], '123456');
        expect(handleSubmit).toHaveBeenCalledTimes(1);
        expect(handleOtherSubmit).not.toHaveBeenCalled();
      });

      it('submits the hidden input form when the root is portaled through render', async () => {
        const handleSubmit = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });
        await renderOTP(() => (
          <form onSubmit={handleSubmit}>
            <OTPField
              autoSubmit
              render={(props) => (
                <Portal>
                  <div {...props} />
                </Portal>
              )}
            />
          </form>
        ));

        const [firstInput] = getTextboxes();
        expect(firstInput.form).toBe(null);
        change(firstInput, '123456');
        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });

      it('submits the hidden input form when the inputs are portaled', async () => {
        const handleSubmit = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });
        await renderOTP(() => (
          <form onSubmit={handleSubmit}>
            <OTPFieldBase.Root length={OTP_LENGTH} autoSubmit>
              <Portal>
                {Array.from({ length: OTP_LENGTH }, () => (
                  <OTPFieldBase.Input />
                ))}
              </Portal>
            </OTPFieldBase.Root>
          </form>
        ));

        const [firstInput] = getTextboxes();
        expect(firstInput.form).toBe(null);
        change(firstInput, '123456');
        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });

      it('submits the completed named OTP value from the owning form when enabled', async () => {
        const submitted: Array<FormDataEntryValue | null> = [];
        const handleSubmit = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
          submitted.push(new FormData(event.currentTarget as HTMLFormElement).get('otp'));
        });
        await renderOTP(() => (
          <form onSubmit={handleSubmit}>
            <OTPField name="otp" required autoSubmit />
          </form>
        ));

        change(getTextboxes()[0], '123456');
        expect(getValues()).toBe('123456');
        expect(handleSubmit).toHaveBeenCalledTimes(1);
        expect(submitted).toEqual(['123456']);
      });

      it('keeps the completed value when the owning form has no requestSubmit method', async () => {
        const handleSubmit = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });
        const onValueComplete = vi.fn();
        await renderOTP(() => (
          <form aria-label="verification" onSubmit={handleSubmit}>
            <OTPField name="otp" autoSubmit onValueComplete={onValueComplete} />
          </form>
        ));

        const form = screen.getByRole<HTMLFormElement>('form', { name: 'verification' });
        Object.defineProperty(form, 'requestSubmit', { configurable: true, value: undefined });

        change(getTextboxes()[0], '123456');
        expect(getValues()).toBe('123456');
        expect(onValueComplete).toHaveBeenCalledTimes(1);
        expect(handleSubmit).not.toHaveBeenCalled();
      });

      it('auto-submits a Base UI Form', async () => {
        const handleSubmit = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });
        await renderOTP(() => (
          <Form onSubmit={handleSubmit}>
            <Field.Root name="otp">
              <OTPField autoSubmit />
            </Field.Root>
          </Form>
        ));

        change(getTextboxes()[0], '123456');
        expect(getValues()).toBe('123456');
        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });

      it('blocks invalid Base UI Form auto-submit', async () => {
        const handleSubmit = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });
        await renderOTP(() => (
          <Form onSubmit={handleSubmit}>
            <Field.Root name="otp" validate={() => 'Invalid OTP'}>
              <OTPField autoSubmit />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>
        ));

        change(getTextboxes()[0], '123456');
        flush();
        expect(getValues()).toBe('123456');
        expect(handleSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid OTP');
      });

      it('keeps focus on the first invalid field when auto-submit is blocked', async () => {
        await renderOTP(() => (
          <Form>
            <Field.Root name="email" validate={() => 'Required'}>
              <Field.Label>Email</Field.Label>
              <Field.Control />
              <Field.Error />
            </Field.Root>
            <Field.Root name="otp">
              <OTPField autoSubmit />
            </Field.Root>
          </Form>
        ));

        const emailInput = screen.getByRole('textbox', { name: 'Email' });
        const otpInputs = getTextboxes().filter((input) => input !== emailInput);

        change(otpInputs[0], '123456');
        flush();

        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveFocus();
      });

      it('does not submit the owning form before the OTP becomes complete when enabled', async () => {
        const handleSubmit = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });
        await renderOTP(() => (
          <form onSubmit={handleSubmit}>
            <OTPField autoSubmit />
          </form>
        ));

        change(getTextboxes()[0], '12345');
        expect(getValues()).toBe('12345');
        expect(handleSubmit).not.toHaveBeenCalled();
      });
    });

    describe('prop: form', () => {
      it('submits an associated external form when used with `autoSubmit`', async () => {
        const submitted: Array<FormDataEntryValue | null> = [];
        const handleSubmit = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
          submitted.push(new FormData(event.currentTarget as HTMLFormElement).get('otp'));
        });
        await renderOTP(() => (
          <>
            <form id="verification-form" onSubmit={handleSubmit} />
            <OTPField form="verification-form" name="otp" autoSubmit />
          </>
        ));

        change(getTextboxes()[0], '123456');
        expect(getValues()).toBe('123456');
        expect(handleSubmit).toHaveBeenCalledTimes(1);
        expect(submitted).toEqual(['123456']);
      });

      it('does not submit an ancestor form when the explicit form id is not a form', async () => {
        const handleSubmit = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });
        await renderOTP(() => (
          <>
            <div id="verification-form" />
            <form onSubmit={handleSubmit}>
              <OTPField form="verification-form" name="otp" autoSubmit />
            </form>
          </>
        ));

        change(getTextboxes()[0], '123456');
        expect(getValues()).toBe('123456');
        expect(handleSubmit).not.toHaveBeenCalled();
      });
    });
  });

  describe('[data-focused] without a blur event', () => {
    it('is removed when the focused field becomes disabled', async () => {
      const [disabled, setDisabled] = createSignal(false);
      await renderOTP(() => (
        <Field.Root data-testid="field">
          <OTPField data-testid="first" disabled={disabled()} />
        </Field.Root>
      ));

      focus(getTextboxes()[0]);
      expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
      expect(screen.getByTestId('first')).toHaveAttribute('data-focused', '');

      setDisabled(true);
      flush();

      expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      expect(screen.getByTestId('first')).not.toHaveAttribute('data-focused');
    });

    it('is removed when the focused field unmounts', async () => {
      const [mounted, setMounted] = createSignal(true);
      await renderOTP(() => (
        <Field.Root data-testid="field">
          <Show when={mounted()}>
            <OTPField data-testid="first" />
          </Show>
        </Field.Root>
      ));

      focus(getTextboxes()[0]);
      expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

      setMounted(false);
      flush();

      expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
    });

    it('is kept when a previously focused slot unmounts after focus moves to a sibling', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const [firstMounted, setFirstMounted] = createSignal(true);
        await renderOTP(() => (
          <Field.Root data-testid="field">
            <OTPFieldBase.Root
              length={firstMounted() ? 3 : 2}
              defaultValue="1"
              data-testid="otp"
            >
              <Show when={firstMounted()}>
                <OTPFieldBase.Input />
              </Show>
              <OTPFieldBase.Input />
              <OTPFieldBase.Input />
            </OTPFieldBase.Root>
          </Field.Root>
        ));
        const [first, second] = getTextboxes();

        focus(first);
        focus(second);

        expect(second).toHaveFocus();
        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
        expect(screen.getByTestId('otp')).toHaveAttribute('data-focused', '');

        setFirstMounted(false);
        flush();
        await settle();

        expect(second).toHaveFocus();
        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
        expect(screen.getByTestId('otp')).toHaveAttribute('data-focused', '');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('is removed when the focused slot unmounts but its field remains', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const [firstMounted, setFirstMounted] = createSignal(true);
        await renderOTP(() => (
          <Field.Root data-testid="field">
            <OTPFieldBase.Root length={3} data-testid="otp">
              <Show when={firstMounted()}>
                <OTPFieldBase.Input />
              </Show>
              <OTPFieldBase.Input />
              <OTPFieldBase.Input />
            </OTPFieldBase.Root>
          </Field.Root>
        ));

        focus(getTextboxes()[0]);
        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
        expect(screen.getByTestId('otp')).toHaveAttribute('data-focused', '');

        setFirstMounted(false);
        flush();

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
        expect(screen.getByTestId('otp')).not.toHaveAttribute('data-focused');
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  it('updates standalone filled and focused state on the root', async () => {
    await renderOTP(() => <OTPField data-testid="root" />);

    const root = screen.getByTestId('root');
    const [firstInput] = getTextboxes();

    expect(root).not.toHaveAttribute('data-filled');
    expect(root).not.toHaveAttribute('data-focused');

    focus(firstInput);
    expect(root).toHaveAttribute('data-focused', '');

    change(firstInput, '1');
    expect(root).toHaveAttribute('data-filled', '');

    fireEvent.blur(firstInput);
    flush();
    expect(root).not.toHaveAttribute('data-focused');
  });

  it('sets `data-complete` when all slots are filled', async () => {
    await renderOTP(() => <OTPField data-testid="root" defaultValue="123456" />);
    expect(screen.getByTestId('root')).toHaveAttribute('data-complete', '');
  });

  it('renders a fallback hidden input id when name is not provided', async () => {
    await renderOTP(() => <OTPField id="verification-code" />);
    expect(document.querySelector('#verification-code-hidden-input')).not.toBeNull();
  });

  describe('dev warnings', () => {
    beforeEach(() => {
      resetWarnings();
    });

    it('warns when length does not match the rendered input count', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await renderOTP(() => (
          <OTPFieldBase.Root length={OTP_LENGTH}>
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
          </OTPFieldBase.Root>
        ));

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0]?.[0]).toContain(
          'Base UI: <OTPField.Root> `length` must match the number of rendered <OTPField.Input /> parts.',
        );
        expect(warnSpy.mock.calls[0]?.[0]).toContain(
          'Received `length={6}` but rendered 5 inputs.',
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('warns with singular input wording when one input is rendered', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await renderOTP(() => (
          <OTPFieldBase.Root length={2}>
            <OTPFieldBase.Input />
          </OTPFieldBase.Root>
        ));
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0]?.[0]).toContain('Received `length={2}` but rendered 1 input.');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it.each([0, -1, 3.7, Number.NaN, Number.POSITIVE_INFINITY])(
      'warns when length is not a positive integer (%p)',
      async (invalidLength) => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
          await renderOTP(() => <OTPFieldBase.Root length={invalidLength} />);
          expect(warnSpy).toHaveBeenCalledTimes(1);
          expect(warnSpy.mock.calls[0]?.[0]).toContain(
            `Base UI: <OTPField.Root> \`length\` must be a positive integer. Received \`length={${String(invalidLength)}}\`.`,
          );
        } finally {
          warnSpy.mockRestore();
        }
      },
    );
  });
});
