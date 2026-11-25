import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Radio } from '..';
import { RadioGroup } from '../../radio-group';
import { Field } from '../../field';

async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
  flush();
}

function click(element: Element) {
  fireEvent.click(element);
  flush();
}

describe('<Radio.Root />', () => {
  describe('conformance', () => {
    it('renders a span and supports class, style, render and ref', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Radio.Root
          value=""
          data-testid="radio"
          class={(state) => (state.checked ? 'is-checked' : 'is-unchecked')}
          style={{ color: 'red' }}
          ref={(element) => {
            ref = element;
          }}
        />
      ));

      const radio = screen.getByTestId('radio');
      expect(radio.tagName).toBe('SPAN');
      expect(ref).toBe(radio);
      // A standalone radio with an empty value is checked.
      expect(radio).toHaveClass('is-checked');
      expect(radio).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });

    it('supports the render prop', () => {
      render(() => (
        <RadioGroup>
          <Radio.Root
            value="a"
            data-testid="radio"
            render={(props, state) => <em {...props} data-state-checked={String(state.checked)} />}
          />
        </RadioGroup>
      ));

      const radio = screen.getByTestId('radio');
      expect(radio.tagName).toBe('EM');
      expect(radio).toHaveAttribute('data-state-checked', 'false');
      expect(radio).toHaveAttribute('role', 'radio');
    });

    it('forwards the ref inside a group', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <RadioGroup>
          <Radio.Root
            value="a"
            data-testid="radio"
            ref={(element) => {
              ref = element;
            }}
          />
        </RadioGroup>
      ));
      expect(ref).toBe(screen.getByTestId('radio'));
    });
  });

  // Skipped: hiddenInputSizeTests (they need layout, upstream skips them in JSDOM).

  it('sets checked and unchecked data attributes', () => {
    render(() => (
      <RadioGroup defaultValue="checked">
        <Radio.Root value="checked" data-testid="checked" />
        <Radio.Root value="unchecked" data-testid="unchecked" />
      </RadioGroup>
    ));

    expect(screen.getByTestId('checked')).toHaveAttribute('data-checked');
    expect(screen.getByTestId('checked')).not.toHaveAttribute('data-unchecked');
    expect(screen.getByTestId('unchecked')).toHaveAttribute('data-unchecked');
    expect(screen.getByTestId('unchecked')).not.toHaveAttribute('data-checked');
  });

  it('does not forward `value` prop', () => {
    render(() => (
      <RadioGroup>
        <Radio.Root value="test" data-testid="radio-root" />
      </RadioGroup>
    ));

    expect(screen.getByTestId('radio-root')).not.toHaveAttribute('value');
  });

  it('allows `null` value', () => {
    render(() => (
      <RadioGroup>
        <Radio.Root value={null} data-testid="radio-null" />
        <Radio.Root value="a" data-testid="radio-a" />
      </RadioGroup>
    ));

    const radioNull = screen.getByTestId('radio-null');
    const radioA = screen.getByTestId('radio-a');
    click(radioNull);
    expect(radioNull).toHaveAttribute('aria-checked', 'true');
    click(radioA);
    expect(radioNull).toHaveAttribute('aria-checked', 'false');
  });

  it('associates `id` with the native button when `nativeButton=true`', () => {
    render(() => (
      <div>
        <label data-testid="label" for="myRadio">
          A
        </label>

        <RadioGroup defaultValue="b">
          <Radio.Root value="a" id="myRadio" nativeButton render="button" data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
        </RadioGroup>
      </div>
    ));

    const radioA = screen.getByTestId('a');
    expect(radioA).toHaveAttribute('id', 'myRadio');

    const hiddenInput = radioA.nextElementSibling as HTMLInputElement | null;
    expect(hiddenInput?.tagName).toBe('INPUT');
    expect(hiddenInput).not.toHaveAttribute('id', 'myRadio');

    expect(radioA).toHaveAttribute('aria-checked', 'false');
    click(screen.getByTestId('label'));
    expect(radioA).toHaveAttribute('aria-checked', 'true');
  });

  it('sets `aria-labelledby` from a sibling label associated with the hidden input', () => {
    render(() => (
      <div>
        <label for="radio-input">Label</label>
        <RadioGroup>
          <Radio.Root value="a" id="radio-input" />
        </RadioGroup>
      </div>
    ));

    const label = screen.getByText('Label');
    expect(label.id).not.toBe('');
    expect(screen.getByRole('radio')).toHaveAttribute('aria-labelledby', label.id);
  });

  it('updates fallback `aria-labelledby` when the hidden input id changes', async () => {
    function TestCase() {
      const [id, setId] = createSignal('radio-input-a');

      return (
        <>
          <label for="radio-input-a">Label A</label>
          <label for="radio-input-b">Label B</label>
          <RadioGroup>
            <Radio.Root value="a" id={id()} />
          </RadioGroup>
          <button type="button" onClick={() => setId('radio-input-b')}>
            Toggle
          </button>
        </>
      );
    }

    render(() => <TestCase />);

    const radio = screen.getByRole('radio');
    const labelA = screen.getByText('Label A');

    expect(labelA.id).not.toBe('');
    expect(radio).toHaveAttribute('aria-labelledby', labelA.id);

    click(screen.getByRole('button', { name: 'Toggle' }));

    const labelB = screen.getByText('Label B');

    await waitFor(() => {
      expect(radio).toHaveAttribute('aria-labelledby', labelB.id);
    });
    expect(labelB.id).not.toBe('');
    expect(labelB.id).not.toBe(labelA.id);
  });

  it('prefers `aria-label` over an associated label', () => {
    render(() => (
      <RadioGroup>
        <label>
          <Radio.Root value="a" aria-label="Apple" />
          Apple
        </label>
      </RadioGroup>
    ));

    const radio = screen.getByRole('radio');
    expect(radio).not.toHaveAttribute('aria-labelledby');
    expect(radio).toHaveAccessibleName('Apple');
  });

  // Adapted: upstream reads the `aria-label` of a `render` element. In this port, `render` is a tag
  // or a function receiving the props, so the `aria-label` prop is the only source
  // (`resolveRenderedAriaLabel`). A render function that adds its own `aria-label` keeps the
  // `aria-labelledby` it receives in sync itself.
  it("uses a render tag's `aria-label` prop over an associated label", () => {
    render(() => (
      <RadioGroup>
        <label>
          <Radio.Root value="a" render="span" aria-label="Apple" />
          Apple
        </label>
      </RadioGroup>
    ));

    const radio = screen.getByRole('radio');
    expect(radio).not.toHaveAttribute('aria-labelledby');
    expect(radio).toHaveAccessibleName('Apple');
  });

  describe('prop: onClick', () => {
    it.each([false, true])(
      'propagates a single click event to ancestors per user click (nativeButton=%s)',
      (nativeButton) => {
        const handleParentClick = vi.fn();
        render(() => (
          <RadioGroup>
            <div onClick={handleParentClick}>
              <Radio.Root
                value="a"
                nativeButton={nativeButton}
                render={nativeButton ? 'button' : undefined}
                data-testid="radio"
              />
            </div>
          </RadioGroup>
        ));

        click(screen.getByTestId('radio'));

        expect(handleParentClick).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('radio')).toHaveAttribute('aria-checked', 'true');
      },
    );

    it.each([false, true])(
      'does not propagate to ancestors when stopPropagation() is called (nativeButton=%s)',
      (nativeButton) => {
        const handleParentClick = vi.fn();
        render(() => (
          <RadioGroup>
            <div onClick={handleParentClick}>
              <Radio.Root
                value="a"
                nativeButton={nativeButton}
                render={nativeButton ? 'button' : undefined}
                data-testid="radio"
                onClick={(event: MouseEvent) => event.stopPropagation()}
              />
            </div>
          </RadioGroup>
        ));

        click(screen.getByTestId('radio'));

        expect(handleParentClick).toHaveBeenCalledTimes(0);
        expect(screen.getByTestId('radio')).toHaveAttribute('aria-checked', 'true');
      },
    );

    it('does not propagate a click to ancestors when selecting with arrow keys', async () => {
      const handleParentClick = vi.fn();
      const user = userEvent.setup();
      render(() => (
        <div onClick={handleParentClick}>
          <RadioGroup defaultValue="a">
            <Radio.Root value="a" data-testid="radio-a" />
            <Radio.Root value="b" data-testid="radio-b" />
          </RadioGroup>
        </div>
      ));
      await flushMicrotasks();

      await user.click(screen.getByTestId('radio-a'));
      handleParentClick.mockClear();

      await user.keyboard('{ArrowDown}');

      expect(screen.getByTestId('radio-b')).toHaveAttribute('aria-checked', 'true');
      expect(handleParentClick).toHaveBeenCalledTimes(0);
    });
  });

  describe('prop: disabled', () => {
    it('uses aria-disabled instead of HTML disabled', () => {
      render(() => (
        <RadioGroup>
          <Radio.Root value="a" disabled data-testid="radio" />
        </RadioGroup>
      ));

      const radio = screen.getByTestId('radio');
      expect(radio).not.toHaveAttribute('disabled');
      expect(radio).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not acquire the field focused state when focused programmatically', () => {
      render(() => (
        <Field.Root data-testid="field">
          <Radio.Root value="a" disabled data-testid="radio" />
        </Field.Root>
      ));

      const radio = screen.getByTestId('radio');

      radio.focus();
      flush();

      expect(radio).toHaveFocus();
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
    });

    it('keeps the tab stop on a checked radio that is disabled', async () => {
      render(() => (
        <RadioGroup defaultValue="a">
          <Radio.Root value="a" disabled data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('a')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('b')).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('prop: readOnly', () => {
    it('acquires the field focused state on focus', () => {
      render(() => (
        <Field.Root data-testid="field">
          <Radio.Root value="a" readOnly data-testid="radio" />
        </Field.Root>
      ));

      screen.getByTestId('radio').focus();
      flush();

      expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
    });
  });
});
