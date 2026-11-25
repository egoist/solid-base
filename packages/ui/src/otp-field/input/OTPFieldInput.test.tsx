import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { reset as resetWarnings } from '@egoist/solid-base-utils/warn';
import { OTPField } from '..';
import { Field } from '../../field';
import { DirectionProvider } from '../../direction-provider';
import { REASONS } from '../../internals/reasons';
import type { OTPFieldRoot } from '../root/OTPFieldRoot';
import type { BaseUIEvent } from '../../types';

const OTP_LENGTH = 6;
const modifierKeys = [
  ['Ctrl', { ctrlKey: true }],
  ['Cmd', { metaKey: true }],
] as const;

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

function pasteWithError(target: HTMLElement, error: Error) {
  const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(pasteEvent, 'clipboardData', {
    value: {
      getData() {
        throw error;
      },
    },
  });
  fireEvent(target, pasteEvent);
  flush();
}

type OTPFieldTestProps = Omit<OTPFieldRoot.Props, 'children' | 'length'>;

function OTPFieldTest(props: OTPFieldTestProps) {
  return (
    <OTPField.Root length={OTP_LENGTH} {...props}>
      {Array.from({ length: OTP_LENGTH }, () => (
        <OTPField.Input />
      ))}
    </OTPField.Root>
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
  return getTextboxes().map((input) => input.value);
}

describe('<OTPField.Input />', () => {
  it('renders an input with class, style, ref and render support', async () => {
    let ref: HTMLInputElement | undefined;
    await renderOTP(() => (
      <OTPField.Root length={2} defaultValue="1">
        <OTPField.Input
          data-testid="input"
          class={(state) => `slot-${state.index} ${state.filled ? 'filled' : 'empty'}`}
          style={{ color: 'red' }}
          ref={(element) => {
            ref = element;
          }}
        />
        <OTPField.Input
          render={(props) => <input {...props} data-custom="" />}
          data-testid="custom"
        />
      </OTPField.Root>
    ));
    const input = screen.getByTestId('input');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveClass('slot-0', 'filled');
    expect(input.style.color).toBe('red');
    expect(ref).toBe(input);
    expect(input).toHaveAttribute('data-filled', '');
    expect(input).not.toHaveAttribute('data-index');
    expect(input).not.toHaveAttribute('data-value');
    expect(screen.getByTestId('custom')).toHaveAttribute('data-custom');
  });

  it('renders one textbox per slot', async () => {
    await renderOTP(() => <OTPFieldTest />);
    expect(getTextboxes()).toHaveLength(6);
  });

  it('moves focus with arrow keys', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="12" />);
    const inputs = getTextboxes();
    focus(inputs[1]);

    keyDown(inputs[1], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(inputs[2]);

    keyDown(inputs[2], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('moves focus with arrow keys in RTL', async () => {
    await renderOTP(() => (
      <DirectionProvider direction="rtl">
        <OTPFieldTest defaultValue="12" />
      </DirectionProvider>
    ));
    const inputs = getTextboxes();
    focus(inputs[1]);

    keyDown(inputs[1], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(inputs[2]);

    keyDown(inputs[2], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('redirects focus to the first empty slot when a later empty slot is focused', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="12" />);
    const inputs = getTextboxes();
    focus(inputs[4]);
    expect(document.activeElement).toBe(inputs[2]);
  });

  it('moves focus to the next slot after typing', async () => {
    await renderOTP(() => <OTPFieldTest />);
    const inputs = getTextboxes();
    focus(inputs[0]);
    change(inputs[0], '1');
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('selects the last slot after typing into it for the first time', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="12345" />);
    const lastInput = getTextboxes()[5];
    focus(lastInput);
    change(lastInput, '6');

    expect(document.activeElement).toBe(lastInput);
    expect(lastInput.selectionStart).toBe(0);
    expect(lastInput.selectionEnd).toBe(1);
  });

  it('keeps focus in place when typing is canceled', async () => {
    await renderOTP(() => (
      <OTPFieldTest
        onValueChange={(_, eventDetails) => {
          eventDetails.cancel();
        }}
      />
    ));
    const inputs = getTextboxes();
    focus(inputs[0]);
    change(inputs[0], '1');

    expect(getValues()).toEqual(['', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('keeps the filled slot selected when typing an invalid character', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="1" />);
    const [firstInput] = getTextboxes();
    focus(firstInput);
    change(firstInput, 'a');

    expect(firstInput).toHaveValue('1');
    expect(document.activeElement).toBe(firstInput);
    expect(firstInput.selectionStart).toBe(0);
    expect(firstInput.selectionEnd).toBe(1);
  });

  it('commits an IME composition once on compositionend instead of per intermediate change', async () => {
    const onValueChange = vi.fn();
    await renderOTP(() => (
      <OTPFieldTest validationType="alphanumeric" onValueChange={onValueChange} />
    ));
    const inputs = getTextboxes();
    const firstInput = inputs[0];
    focus(firstInput);

    fireEvent.compositionStart(firstInput);
    // Safari can surface in-progress IME text through `input` as an accumulating string.
    fireEvent.input(firstInput, { target: { value: 'd' } });
    fireEvent.input(firstInput, { target: { value: 'dd' } });
    fireEvent.input(firstInput, { target: { value: 'ddd' } });
    flush();

    // No value commits while the composition is active; the text is only buffered for display.
    expect(onValueChange).not.toHaveBeenCalled();
    expect(getValues()).toEqual(['ddd', '', '', '', '', '']);

    fireEvent.compositionEnd(firstInput, { target: { value: 'ddd' } });
    flush();

    // The final composed value commits once across three slots, not six.
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith('ddd', expect.anything());
    expect(getValues()).toEqual(['d', 'd', 'd', '', '', '']);
    expect(document.activeElement).toBe(inputs[3]);
  });

  it('reports characters rejected from a committed IME composition', async () => {
    const onValueChange = vi.fn();
    const onValueInvalid = vi.fn();
    await renderOTP(() => (
      <OTPFieldTest onValueChange={onValueChange} onValueInvalid={onValueInvalid} />
    ));
    const inputs = getTextboxes();
    const firstInput = inputs[0];
    focus(firstInput);

    fireEvent.compositionStart(firstInput);
    change(firstInput, '1a');
    expect(onValueInvalid).not.toHaveBeenCalled();

    fireEvent.compositionEnd(firstInput, { target: { value: '1a' } });
    flush();

    expect(onValueInvalid).toHaveBeenCalledTimes(1);
    expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1a');
    expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith('1', expect.anything());
    expect(getValues()).toEqual(['1', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('ignores keyboard commands while a composition is buffered', async () => {
    const onValueChange = vi.fn();
    await renderOTP(() => (
      <OTPFieldTest
        validationType="alphanumeric"
        defaultValue="12"
        onValueChange={onValueChange}
      />
    ));
    const inputs = getTextboxes();
    const thirdInput = inputs[2];
    focus(thirdInput);

    fireEvent.compositionStart(thirdInput);
    change(thirdInput, 'a');

    // iOS Safari fires a real `Backspace` keydown while the IME is still composing.
    keyDown(thirdInput, { key: 'Backspace' });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(thirdInput);
    expect(getValues()).toEqual(['1', '2', 'a', '', '', '']);

    // The IME deleted its own text, so the composition ends empty and nothing commits.
    fireEvent.compositionEnd(thirdInput, { target: { value: '' } });
    flush();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(getValues()).toEqual(['1', '2', '', '', '', '']);
  });

  it.each([{ prop: 'disabled' as const }, { prop: 'readOnly' as const }])(
    'does not commit a composition that ends after the field becomes $prop',
    async ({ prop }) => {
      const onValueChange = vi.fn();
      const [locked, setLocked] = createSignal(false);
      await renderOTP(() => (
        <OTPFieldTest
          validationType="alphanumeric"
          onValueChange={onValueChange}
          disabled={prop === 'disabled' && locked()}
          readOnly={prop === 'readOnly' && locked()}
        />
      ));
      const inputs = getTextboxes();
      const firstInput = inputs[0];
      focus(firstInput);

      fireEvent.compositionStart(firstInput);
      change(firstInput, 'abc');

      setLocked(true);
      flush();

      fireEvent.compositionEnd(firstInput, { target: { value: 'abc' } });
      flush();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(getValues()).toEqual(['', '', '', '', '', '']);
    },
  );

  it('selects the slot value on mousedown', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="1" />);
    const [firstInput] = getTextboxes();
    fireEvent.mouseDown(firstInput);
    flush();
    expect(firstInput.selectionStart).toBe(0);
    expect(firstInput.selectionEnd).toBe(1);
  });

  it('allows a composed mousedown handler to prevent focus', async () => {
    await renderOTP(() => (
      <OTPField.Root length={2}>
        <OTPField.Input
          onMouseDown={(event) => {
            event.preventDefault();
          }}
        />
        <OTPField.Input />
      </OTPField.Root>
    ));
    const [firstInput] = getTextboxes();
    expect(fireEvent.mouseDown(firstInput)).toBe(false);
    flush();
    expect(firstInput).not.toHaveFocus();
  });

  it('allows a composed focus handler to skip internal focus state', async () => {
    await renderOTP(() => (
      <OTPField.Root data-testid="root" length={1}>
        <OTPField.Input
          onFocus={(event) => {
            // `focus` isn't cancelable for native events (upstream relies on React's synthetic
            // `preventDefault`), so the Solid way is `preventBaseUIHandler()`.
            (event as unknown as BaseUIEvent<FocusEvent>).preventBaseUIHandler();
          }}
        />
      </OTPField.Root>
    ));
    const input = screen.getByRole<HTMLInputElement>('textbox');
    focus(input);
    expect(input).toHaveFocus();
    expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
  });

  it('allows a composed blur handler to preserve internal focus state', async () => {
    await renderOTP(() => (
      <>
        <OTPField.Root data-testid="root" length={1}>
          <OTPField.Input
            onBlur={(event) => {
              // See the focus test above.
              (event as unknown as BaseUIEvent<FocusEvent>).preventBaseUIHandler();
            }}
          />
        </OTPField.Root>
        <button type="button">Outside</button>
      </>
    ));
    const root = screen.getByTestId('root');
    const input = screen.getByRole<HTMLInputElement>('textbox');
    const outside = screen.getByRole('button', { name: 'Outside' });

    focus(input);
    expect(root).toHaveAttribute('data-focused', '');

    focus(outside);
    expect(outside).toHaveFocus();
    expect(root).toHaveAttribute('data-focused', '');
  });

  it('moves focus to the next slot when typing the same character into a filled slot', async () => {
    const user = userEvent.setup();
    await renderOTP(() => <OTPFieldTest defaultValue="12" />);
    const inputs = getTextboxes();
    focus(inputs[1]);

    await user.keyboard('2');
    flush();

    expect(document.activeElement).toBe(inputs[2]);
  });

  it.each([
    ['ArrowUp', 0],
    ['ArrowDown', 4],
  ] as const)('moves focus to the field boundary with %s', async (key, targetIndex) => {
    await renderOTP(() => <OTPFieldTest defaultValue="1234" />);
    const inputs = getTextboxes();
    focus(inputs[1]);
    expect(keyDown(inputs[1], { key })).toBe(false);
    expect(inputs[targetIndex]).toHaveFocus();
  });

  it('stops propagation when ArrowDown moves focus to the empty end slot', async () => {
    const onKeyDown = vi.fn();
    await renderOTP(() => (
      <div onKeyDown={onKeyDown}>
        <OTPFieldTest defaultValue="1234" />
      </div>
    ));
    const inputs = getTextboxes();
    focus(inputs[1]);
    expect(keyDown(inputs[1], { key: 'ArrowDown' })).toBe(false);
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(inputs[4]).toHaveFocus();
  });

  it('keeps focus on the empty end slot with ArrowDown', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="12" />);
    const inputs = getTextboxes();
    focus(inputs[2]);
    expect(keyDown(inputs[2], { key: 'ArrowDown' })).toBe(false);
    expect(inputs[2]).toHaveFocus();
  });

  it('keeps focus on the final slot with ArrowDown when the value is complete', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="123456" />);
    const inputs = getTextboxes();
    focus(inputs[5]);
    expect(keyDown(inputs[5], { key: 'ArrowDown' })).toBe(false);
    expect(inputs[5]).toHaveFocus();
  });

  it('does not reselect the final slot when typing the same character', async () => {
    const user = userEvent.setup();
    await renderOTP(() => <OTPFieldTest defaultValue="123456" />);
    const lastInput = getTextboxes()[5];
    focus(lastInput);

    const select = vi.spyOn(lastInput, 'select');
    try {
      await user.keyboard('6');
      flush();
      expect(select).not.toHaveBeenCalled();
      expect(lastInput).toHaveFocus();
    } finally {
      select.mockRestore();
    }
  });

  it('moves focus to the first slot with Home', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="1234" />);
    const inputs = getTextboxes();
    focus(inputs[3]);
    keyDown(inputs[3], { key: 'Home' });
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('moves focus to the empty end slot with End', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="1234" />);
    const inputs = getTextboxes();
    focus(inputs[0]);
    keyDown(inputs[0], { key: 'End' });
    expect(document.activeElement).toBe(inputs[4]);
  });

  it.each(modifierKeys)(
    'moves focus to the field boundaries with %s + arrow keys',
    async (_, modifierKey) => {
      await renderOTP(() => <OTPFieldTest defaultValue="1234" />);
      const inputs = getTextboxes();
      focus(inputs[2]);

      keyDown(inputs[2], { key: 'ArrowLeft', ...modifierKey });
      expect(document.activeElement).toBe(inputs[0]);

      keyDown(inputs[0], { key: 'ArrowRight', ...modifierKey });
      expect(document.activeElement).toBe(inputs[4]);
    },
  );

  it.each(modifierKeys)(
    'moves focus to the field boundaries with %s + arrow keys in RTL',
    async (_, modifierKey) => {
      await renderOTP(() => (
        <DirectionProvider direction="rtl">
          <OTPFieldTest defaultValue="1234" />
        </DirectionProvider>
      ));
      const inputs = getTextboxes();
      focus(inputs[2]);

      keyDown(inputs[2], { key: 'ArrowLeft', ...modifierKey });
      expect(document.activeElement).toBe(inputs[4]);

      keyDown(inputs[4], { key: 'ArrowRight', ...modifierKey });
      expect(document.activeElement).toBe(inputs[0]);
    },
  );

  it('keeps arrow and home/end navigation working in readonly mode', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="1234" readOnly />);
    const inputs = getTextboxes();
    focus(inputs[1]);

    keyDown(inputs[1], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(inputs[2]);

    keyDown(inputs[2], { key: 'Home' });
    expect(document.activeElement).toBe(inputs[0]);

    keyDown(inputs[0], { key: 'End' });
    expect(document.activeElement).toBe(inputs[4]);

    keyDown(inputs[4], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(inputs[0]);

    keyDown(inputs[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(inputs[4]);
  });

  it('leaves vertical arrow navigation unhandled in disabled mode', async () => {
    const onKeyDown = vi.fn();
    await renderOTP(() => (
      <div onKeyDown={onKeyDown}>
        <OTPFieldTest defaultValue="12" disabled />
      </div>
    ));
    const inputs = getTextboxes();

    const arrowUpEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowUp',
    });
    const arrowDownEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowDown',
    });

    expect(inputs[1].dispatchEvent(arrowUpEvent)).toBe(true);
    expect(inputs[1].dispatchEvent(arrowDownEvent)).toBe(true);
    expect(onKeyDown).toHaveBeenCalledTimes(2);
  });

  it('blocks Delete and Backspace from changing the value in readonly mode', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="1234" readOnly />);
    const inputs = getTextboxes();
    focus(inputs[1]);

    keyDown(inputs[1], { key: 'Delete' });
    expect(getValues()).toEqual(['1', '2', '3', '4', '', '']);
    expect(document.activeElement).toBe(inputs[1]);

    keyDown(inputs[1], { key: 'Backspace' });
    expect(getValues()).toEqual(['1', '2', '3', '4', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('blocks paste from changing the value in readonly mode', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="1234" readOnly />);
    const inputs = getTextboxes();
    focus(inputs[1]);
    pasteText(inputs[1], '99');
    expect(getValues()).toEqual(['1', '2', '3', '4', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('warns in development when clipboard text cannot be read during paste handling', async () => {
    resetWarnings();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await renderOTP(() => <OTPFieldTest defaultValue="12" />);
      const inputs = getTextboxes();
      focus(inputs[1]);

      pasteWithError(inputs[1], new DOMException('Blocked', 'SecurityError'));

      expect(getValues()).toEqual(['1', '2', '', '', '', '']);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain(
        'Base UI: <OTPField.Input> could not read clipboard text during paste handling.',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('ignores a paste event when clipboard text is unavailable', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="12" />);
    const inputs = getTextboxes();
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    expect(inputs[1].dispatchEvent(pasteEvent)).toBe(false);
    flush();
    expect(getValues()).toEqual(['1', '2', '', '', '', '']);
  });

  it('allows tabbing out of the field from the active slot', async () => {
    const user = userEvent.setup();
    await renderOTP(() => (
      <>
        <OTPFieldTest />
        <button type="button">Next</button>
      </>
    ));
    const inputs = getTextboxes();
    focus(inputs[0]);
    change(inputs[0], '1');
    expect(document.activeElement).toBe(inputs[1]);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }));
  });

  it('deletes the current character and moves focus to the previous slot on backspace', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="1234" />);
    const inputs = getTextboxes();
    focus(inputs[1]);
    keyDown(inputs[1], { key: 'Backspace' });
    expect(getValues()).toEqual(['1', '3', '4', '', '', '']);
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('deletes the previous filled slot when backspacing on an empty non-first slot', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="12" />);
    const inputs = getTextboxes();
    focus(inputs[2]);
    keyDown(inputs[2], { key: 'Backspace' });
    expect(getValues()).toEqual(['1', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it.each(modifierKeys)('clears all slots with %s + Backspace', async (_, modifierKey) => {
    await renderOTP(() => <OTPFieldTest defaultValue="1234" />);
    const inputs = getTextboxes();
    focus(inputs[2]);
    keyDown(inputs[2], { key: 'Backspace', ...modifierKey });
    expect(getValues()).toEqual(['', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('keeps focus in place when backspace is canceled', async () => {
    await renderOTP(() => (
      <OTPFieldTest
        defaultValue="1234"
        onValueChange={(_, eventDetails) => {
          eventDetails.cancel();
        }}
      />
    ));
    const inputs = getTextboxes();
    focus(inputs[1]);
    keyDown(inputs[1], { key: 'Backspace' });
    expect(getValues()).toEqual(['1', '2', '3', '4', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('deletes the current character with Delete without moving focus', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="1234" />);
    const inputs = getTextboxes();
    focus(inputs[1]);
    keyDown(inputs[1], { key: 'Delete' });
    expect(getValues()).toEqual(['1', '3', '4', '', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
    expect(inputs[1].selectionStart).toBe(0);
    expect(inputs[1].selectionEnd).toBe(1);
  });

  it('selects the previous slot value after backspacing into the first slot', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="12" />);
    const inputs = getTextboxes();
    focus(inputs[1]);
    keyDown(inputs[1], { key: 'Backspace' });
    expect(document.activeElement).toBe(inputs[0]);
    expect(inputs[0].selectionStart).toBe(0);
    expect(inputs[0].selectionEnd).toBe(1);
  });

  it('keeps focus in place when paste is canceled', async () => {
    await renderOTP(() => (
      <OTPFieldTest
        onValueChange={(_, eventDetails) => {
          eventDetails.cancel();
        }}
      />
    ));
    const inputs = getTextboxes();
    focus(inputs[0]);
    pasteText(inputs[0], '1234');
    expect(getValues()).toEqual(['', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('replaces values from the middle when pasting into a later slot', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="123456" />);
    const inputs = getTextboxes();
    focus(inputs[2]);
    pasteText(inputs[2], '99');
    expect(getValues()).toEqual(['1', '2', '9', '9', '5', '6']);
    expect(document.activeElement).toBe(inputs[4]);
  });

  it('marks each input as complete when all slots are filled', async () => {
    await renderOTP(() => <OTPFieldTest defaultValue="123456" />);
    getTextboxes().forEach((input) => {
      expect(input).toHaveAttribute('data-complete', '');
    });
  });

  it('adds disabled and readonly state attributes to each slot', async () => {
    const [mode, setMode] = createSignal<'disabled' | 'readOnly'>('disabled');
    await renderOTP(() => (
      <OTPFieldTest disabled={mode() === 'disabled'} readOnly={mode() === 'readOnly'} />
    ));
    getTextboxes().forEach((input) => {
      expect(input).toHaveAttribute('data-disabled', '');
    });

    setMode('readOnly');
    flush();
    getTextboxes().forEach((input) => {
      expect(input).toHaveAttribute('data-readonly', '');
      expect(input).not.toHaveAttribute('data-disabled');
    });
  });

  it('applies the Field label to every slot', async () => {
    await renderOTP(() => (
      <Field.Root>
        <Field.Label data-testid="label">Verification code</Field.Label>
        <Field.Description data-testid="description">Enter the code.</Field.Description>
        <OTPFieldTest />
      </Field.Root>
    ));
    const label = screen.getByTestId('label');
    const description = screen.getByTestId('description');
    getTextboxes().forEach((input) => {
      expect(input).toHaveAttribute('aria-labelledby', label.id);
      expect(input).not.toHaveAttribute('aria-describedby', description.id);
    });
  });

  it('applies a native label to every slot', async () => {
    await renderOTP(() => (
      <>
        <label for="verification-code">Verification code</label>
        <OTPField.Root id="verification-code" length={OTP_LENGTH}>
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
        </OTPField.Root>
      </>
    ));
    getTextboxes().forEach((input) => {
      expect(input).toHaveAccessibleName('Verification code');
    });
  });

  it('keeps the shared label on the first slot even if an aria-label is provided', async () => {
    await renderOTP(() => (
      <>
        <label for="verification-code">Verification code</label>
        <OTPField.Root id="verification-code" length={OTP_LENGTH}>
          <OTPField.Input aria-label="Character 1 of 6" />
          <OTPField.Input aria-label="Character 2 of 6" />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
        </OTPField.Root>
      </>
    ));
    const inputs = getTextboxes();
    expect(inputs[0]).toHaveAccessibleName('Verification code');
    expect(inputs[0]).not.toHaveAttribute('aria-label', 'Character 1 of 6');
    expect(inputs[1]).toHaveAttribute('aria-label', 'Character 2 of 6');
  });

  describe('aria-label warning', () => {
    beforeEach(() => {
      resetWarnings();
    });

    it('warns when aria-label is provided on the first slot without an associated label', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await renderOTP(() => (
          <OTPField.Root length={OTP_LENGTH}>
            <OTPField.Input aria-label="Character 1 of 6" />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
          </OTPField.Root>
        ));
        // Only count Base UI's own warnings: Solid may log timing hints under load.
        const baseUIWarnings = warnSpy.mock.calls.filter((call) =>
          String(call[0]).startsWith('Base UI:'),
        );
        expect(baseUIWarnings).toHaveLength(1);
        expect(baseUIWarnings[0]?.[0]).toContain(
          'Base UI: <OTPField.Input> ignores `aria-label` on the first input.',
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('does not warn for a first-slot aria-label when a native label is associated', async () => {
      const warnSpy = vi.spyOn(console, 'warn');
      try {
        await renderOTP(() => (
          <>
            <label for="verification-code">Verification code</label>
            <OTPField.Root id="verification-code" length={OTP_LENGTH}>
              <OTPField.Input aria-label="Character 1 of 6" />
              <OTPField.Input />
              <OTPField.Input />
              <OTPField.Input />
              <OTPField.Input />
              <OTPField.Input />
            </OTPField.Root>
          </>
        ));
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('does not warn for a first-slot aria-label when Field.Label is associated', async () => {
      const warnSpy = vi.spyOn(console, 'warn');
      try {
        await renderOTP(() => (
          <Field.Root>
            <Field.Label>Verification code</Field.Label>
            <OTPField.Root length={OTP_LENGTH}>
              <OTPField.Input aria-label="Character 1 of 6" />
              <OTPField.Input />
              <OTPField.Input />
              <OTPField.Input />
              <OTPField.Input />
              <OTPField.Input />
            </OTPField.Root>
          </Field.Root>
        ));
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  it('throws a descriptive error when rendered outside <OTPField.Root>', () => {
    expect(() => render(() => <OTPField.Input />)).toThrow(
      'Base UI: OTPFieldRootContext is missing. OTPField parts must be placed within <OTPField.Root>.',
    );
  });
});
