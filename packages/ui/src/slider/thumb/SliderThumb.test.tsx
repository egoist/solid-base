import { createSignal, flush } from 'solid-js';
import { fireEvent as baseFireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Slider } from '..';
import { Field } from '../../field';

const fireEvent = new Proxy(baseFireEvent, {
  get(target, key) {
    const fn = (target as any)[key];
    if (typeof fn !== 'function') {
      return fn;
    }
    return (...args: any[]) => {
      const result = fn(...args);
      flush();
      return result;
    };
  },
}) as typeof baseFireEvent;

async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
  flush();
}

function focus(element: HTMLElement) {
  element.focus();
  flush();
}

describe('<Slider.Thumb />', () => {
  beforeAll(() => {
    // Synthetic pointer events have no active pointer to capture.
    Object.defineProperty(Element.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(Element.prototype, 'hasPointerCapture', {
      configurable: true,
      value: vi.fn(() => false),
    });
  });

  afterAll(() => {
    Reflect.deleteProperty(Element.prototype, 'setPointerCapture');
    Reflect.deleteProperty(Element.prototype, 'hasPointerCapture');
  });

  describe('conformance', () => {
    it('renders a div and supports class, style, render and ref', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Thumb
            data-testid="thumb"
            class={(state) => (state.disabled ? 'disabled' : 'enabled')}
            style={{ color: 'red' }}
            ref={(element) => {
              ref = element;
            }}
          />
          <Slider.Thumb render="span" data-testid="span-thumb" />
        </Slider.Root>
      ));
      const thumb = screen.getByTestId('thumb');
      expect(thumb.tagName).toBe('DIV');
      expect(thumb).toHaveClass('enabled');
      expect(thumb.style.color).toBe('red');
      // Positioning styles are kept alongside the user styles.
      expect(thumb.style.position).toBe('absolute');
      expect(ref).toBe(thumb);
      expect(screen.getByTestId('span-thumb').tagName).toBe('SPAN');
    });
  });

  it('adds data-disabled when only the thumb is disabled', () => {
    render(() => (
      <Slider.Root defaultValue={50}>
        <Slider.Control>
          <Slider.Thumb disabled data-testid="thumb" />
        </Slider.Control>
      </Slider.Root>
    ));

    expect(screen.getByTestId('thumb')).toHaveAttribute('data-disabled');
    expect(screen.getByRole('slider')).toBeDisabled();
  });

  it('sets the thumb index data attribute', () => {
    render(() => (
      <Slider.Root defaultValue={50}>
        <Slider.Control>
          <Slider.Thumb data-testid="thumb" />
        </Slider.Control>
      </Slider.Root>
    ));

    expect(screen.getByTestId('thumb')).toHaveAttribute('data-index', '0');
  });

  it('resolves the index of range thumbs without an explicit index', async () => {
    render(() => (
      <Slider.Root defaultValue={[20, 60]}>
        <Slider.Control>
          <Slider.Thumb data-testid="thumb-0" />
          <Slider.Thumb data-testid="thumb-1" />
        </Slider.Control>
      </Slider.Root>
    ));

    await flushMicrotasks();

    expect(screen.getByTestId('thumb-0')).toHaveAttribute('data-index', '0');
    expect(screen.getByTestId('thumb-1')).toHaveAttribute('data-index', '1');
    const [input0, input1] = screen.getAllByRole('slider');
    expect(input0).toHaveAttribute('aria-valuenow', '20');
    expect(input1).toHaveAttribute('aria-valuenow', '60');
  });

  describe('ARIA attributes', () => {
    it.each([
      { attr: 'aria-label' },
      { attr: 'aria-labelledby' },
      { attr: 'aria-describedby' },
      { attr: 'aria-valuetext' },
    ])('forwards $attr to the input', ({ attr }) => {
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb {...{ [attr]: 'test' }} data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>
      ));
      expect(screen.getByRole('slider')).toHaveAttribute(attr, 'test');
      expect(screen.getByTestId('thumb')).not.toHaveAttribute(attr);
    });

    it('prefers getAriaValueText over a direct aria-valuetext prop', () => {
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb
              aria-valuetext="ignored"
              getAriaValueText={(formatted) => `${formatted} percent`}
            />
          </Slider.Control>
        </Slider.Root>
      ));
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '50 percent');
    });

    // Skipped: the en-US-until-hydrated test needs SSR + hydration.
  });

  describe('prop: onKeyDown', () => {
    it('forwards key events that the slider does not handle', () => {
      const handleKeyDown = vi.fn();
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb onKeyDown={handleKeyDown} />
          </Slider.Control>
        </Slider.Root>
      ));

      const slider = screen.getByRole('slider');
      focus(slider);
      fireEvent.keyDown(slider, { key: 'Enter' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
    });

    it.each([{ key: 'ArrowRight' }, { key: 'PageUp' }])(
      'forwards handled $key key events',
      ({ key }) => {
        const handleKeyDown = vi.fn();
        render(() => (
          <Slider.Root defaultValue={50}>
            <Slider.Control>
              <Slider.Thumb onKeyDown={handleKeyDown} />
            </Slider.Control>
          </Slider.Root>
        ));

        const slider = screen.getByRole('slider');
        focus(slider);
        fireEvent.keyDown(slider, { key });

        expect(handleKeyDown).toHaveBeenCalledTimes(1);
      },
    );

    it('allows preventing the internal key handling', () => {
      const handleKeyDown = vi.fn((event: KeyboardEvent) => {
        event.preventDefault();
      });

      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb onKeyDown={handleKeyDown} />
          </Slider.Control>
        </Slider.Root>
      ));

      const slider = screen.getByRole('slider');
      focus(slider);
      fireEvent.keyDown(slider, { key: 'ArrowRight' });

      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(slider).toHaveAttribute('aria-valuenow', '50');
    });

    it('does not commit NaN when more thumbs are rendered than values', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();

      render(() => (
        <Slider.Root
          defaultValue={[10, 20]}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        >
          <Slider.Control>
            <Slider.Thumb />
            <Slider.Thumb />
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));

      await flushMicrotasks();

      const extraThumb = screen.getAllByRole('slider')[2];
      focus(extraThumb);
      fireEvent.keyDown(extraThumb, { key: 'ArrowRight' });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueCommitted).not.toHaveBeenCalled();
    });
  });

  describe('events', () => {
    describe('focus and blur', () => {
      it('single thumb', async () => {
        const user = userEvent.setup();
        const focusAndBlurSpy = vi.fn((event: FocusEvent) => event.target);
        render(() => (
          <Slider.Root defaultValue={50}>
            <Slider.Control>
              <Slider.Thumb onFocus={focusAndBlurSpy} onBlur={focusAndBlurSpy} />
            </Slider.Control>
          </Slider.Root>
        ));
        expect(document.body).toHaveFocus();
        const input = screen.getByRole('slider');
        expect(input.tagName).toBe('INPUT');
        expect(input).toHaveAttribute('type', 'range');

        await user.keyboard('[Tab]');
        expect(input).toHaveFocus();
        expect(focusAndBlurSpy.mock.calls.length).toBe(1);
        expect(focusAndBlurSpy.mock.results[0]?.value).toBe(input);

        await user.keyboard('[Tab]');
        expect(document.body).toHaveFocus();
        expect(focusAndBlurSpy.mock.calls.length).toBe(2);
        expect(focusAndBlurSpy.mock.results.at(-1)?.value).toBe(input);
      });

      it('multiple thumbs', async () => {
        const user = userEvent.setup();
        const focusSpy = vi.fn((event: FocusEvent) => event.target);
        const blurSpy = vi.fn((event: FocusEvent) => event.target);
        render(() => (
          <Slider.Root defaultValue={[50, 70]}>
            <Slider.Control>
              <Slider.Thumb onFocus={focusSpy} onBlur={blurSpy} />
              <Slider.Thumb onFocus={focusSpy} onBlur={blurSpy} />
            </Slider.Control>
          </Slider.Root>
        ));
        const [slider1, slider2] = screen.getAllByRole('slider');

        await user.keyboard('[Tab]');
        expect(slider1).toHaveFocus();
        expect(focusSpy.mock.calls.length).toBe(1);
        expect(focusSpy.mock.results.at(-1)?.value).toBe(slider1);

        await user.keyboard('[Tab]');
        expect(blurSpy.mock.calls.length).toBe(1);
        expect(blurSpy.mock.results.at(-1)?.value).toBe(slider1);
        expect(slider2).toHaveFocus();
        expect(focusSpy.mock.calls.length).toBe(2);
        expect(focusSpy.mock.results.at(-1)?.value).toBe(slider2);

        await user.keyboard('[Tab]');
        expect(blurSpy.mock.calls.length).toBe(2);
        expect(blurSpy.mock.results.at(-1)?.value).toBe(slider2);
        expect(document.body).toHaveFocus();
      });

      it('forwards focus and blur to the input so `currentTarget` is the input', async () => {
        const user = userEvent.setup();
        const focusSpy = vi.fn();
        const blurSpy = vi.fn();
        render(() => (
          <Slider.Root defaultValue={50}>
            <Slider.Control>
              <Slider.Thumb
                onFocus={(event) => focusSpy(event.currentTarget)}
                onBlur={(event) => blurSpy(event.currentTarget)}
              />
            </Slider.Control>
          </Slider.Root>
        ));

        await user.keyboard('[Tab]');
        expect(focusSpy).toHaveBeenCalledTimes(1);
        expect(focusSpy.mock.calls[0][0]).toHaveProperty('tagName', 'INPUT');

        await user.keyboard('[Tab]');
        expect(blurSpy).toHaveBeenCalledTimes(1);
        expect(blurSpy.mock.calls[0][0]).toHaveProperty('tagName', 'INPUT');
      });

      it('does not commit field validation when moving focus between range thumbs', async () => {
        const user = userEvent.setup();
        const validateSpy = vi.fn(() => null);
        render(() => (
          <Field.Root validationMode="onBlur" validate={validateSpy}>
            <Slider.Root defaultValue={[20, 50]}>
              <Slider.Control>
                <Slider.Thumb index={0} />
                <Slider.Thumb index={1} />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>
        ));

        const [thumb0, thumb1] = screen.getAllByRole('slider');

        await user.keyboard('[Tab]');
        expect(thumb0).toHaveFocus();

        validateSpy.mockClear();

        await user.keyboard('[Tab]');
        expect(thumb1).toHaveFocus();
        expect(validateSpy).not.toHaveBeenCalled();

        await user.keyboard('[Tab]');
        expect(thumb1).not.toHaveFocus();
        await waitFor(() => {
          expect(validateSpy).toHaveBeenCalledTimes(1);
        });
      });

      it('commits field validation when focus moves from a thumb to an arbitrary Control child', async () => {
        const user = userEvent.setup();
        const validateSpy = vi.fn(() => null);
        render(() => (
          <>
            <Field.Root validationMode="onBlur" validate={validateSpy} data-testid="field">
              <Slider.Root defaultValue={[20, 50]}>
                <Slider.Control>
                  <Slider.Thumb index={0} />
                  <Slider.Thumb index={1} />
                  <button type="button">Help</button>
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="button">Outside</button>
          </>
        ));

        const [thumb0, thumb1] = screen.getAllByRole('slider');

        await user.keyboard('[Tab]');
        expect(thumb0).toHaveFocus();
        validateSpy.mockClear();

        await user.keyboard('[Tab]');
        expect(thumb1).toHaveFocus();
        expect(validateSpy).not.toHaveBeenCalled();

        await user.keyboard('[Tab]');
        expect(screen.getByRole('button', { name: 'Help' })).toHaveFocus();
        await waitFor(() => {
          expect(validateSpy).toHaveBeenCalledTimes(1);
        });
        expect(screen.getByTestId('field')).toHaveAttribute('data-touched');
        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');

        await user.keyboard('[Tab]');
        expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
        expect(validateSpy).toHaveBeenCalledTimes(1);
      });

      // Skipped: restoring `:focus-visible` relies on real `:focus-visible` matching (jsdom
      // always reports a match, so the blur/focus dance never happens).
    });

    describe('change', () => {
      it('handles change events', () => {
        const handleValueChange = vi.fn();
        render(() => (
          <Slider.Root defaultValue={50} onValueChange={handleValueChange}>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        ));

        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-valuenow', '50');
        fireEvent.change(slider, { target: { value: '51' } });
        expect(handleValueChange.mock.calls.length).toBe(1);
        expect(slider).toHaveAttribute('aria-valuenow', '51');
      });

      it('does not change the value beyond min and max', () => {
        const handleValueChange = vi.fn();
        render(() => (
          <Slider.Root defaultValue={50} min={40} max={60} onValueChange={handleValueChange}>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        ));

        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-valuenow', '50');

        fireEvent.change(slider, { target: { value: '30' } });
        expect(slider).toHaveAttribute('aria-valuenow', '40');
        expect(handleValueChange.mock.calls.length).toBe(1);
        fireEvent.change(slider, { target: { value: '30' } });
        expect(handleValueChange.mock.calls.length).toBe(1);

        fireEvent.change(slider, { target: { value: '70' } });
        expect(slider).toHaveAttribute('aria-valuenow', '60');
        expect(handleValueChange.mock.calls.length).toBe(2);
        fireEvent.change(slider, { target: { value: '70' } });
        expect(handleValueChange.mock.calls.length).toBe(2);
      });

      it('handles non-integer values', () => {
        const handleValueChange = vi.fn();
        render(() => (
          <Slider.Root
            defaultValue={50}
            min={-100}
            max={100}
            step={0.00000001}
            onValueChange={handleValueChange}
          >
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        ));

        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-valuenow', '50');
        expect(slider).toHaveAttribute('step', '1e-8');

        fireEvent.change(slider, { target: { value: '51.1' } });
        expect(slider).toHaveAttribute('aria-valuenow', '51.1');

        fireEvent.change(slider, { target: { value: '0.00000005' } });
        expect(slider).toHaveAttribute('aria-valuenow', '5e-8');

        fireEvent.change(slider, { target: { value: '1e-7' } });
        expect(slider).toHaveAttribute('aria-valuenow', '1e-7');
      });
    });
  });

  describe('prop: tabindex', () => {
    it('does not apply tabindex to the thumb element by default', () => {
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>
      ));

      expect(screen.getByTestId('thumb')).not.toHaveAttribute('tabindex');
      expect(screen.getByRole('slider')).toHaveProperty('tabIndex', 0);
    });

    it('can be removed from the tab sequence', async () => {
      const user = userEvent.setup();
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb tabindex={-1} />
          </Slider.Control>
        </Slider.Root>
      ));

      expect(screen.getByRole('slider')).toHaveProperty('tabIndex', -1);
      expect(document.body).toHaveFocus();
      await user.keyboard('[Tab]');
      expect(document.body).toHaveFocus();
    });
  });

  describe('prop: children', () => {
    it('renders the nested input as a sibling to children', () => {
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb">
              <span data-testid="child" />
            </Slider.Thumb>
          </Slider.Control>
        </Slider.Root>
      ));

      const thumb = screen.getByTestId('thumb');
      expect(thumb.querySelector('input[type="range"]')).toBe(screen.getByRole('slider'));
      expect(thumb.querySelector('[data-testid="child"]')).toBe(screen.getByTestId('child'));
    });

    it('renders the nested input when using the tag render prop', () => {
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb render="span" data-testid="thumb">
              <span data-testid="child" />
            </Slider.Thumb>
          </Slider.Control>
        </Slider.Root>
      ));

      const thumb = screen.getByTestId('thumb');
      expect(thumb.tagName).toBe('SPAN');
      expect(thumb.querySelector('input[type="range"]')).toBe(screen.getByRole('slider'));
      expect(thumb.querySelector('[data-testid="child"]')).toBe(screen.getByTestId('child'));
    });

    it('renders the nested input when using the function render prop', () => {
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb render={(props) => <div data-testid="thumb" {...props} />}>
              <span data-testid="child" />
            </Slider.Thumb>
          </Slider.Control>
        </Slider.Root>
      ));

      const thumb = screen.getByTestId('thumb');
      expect(thumb.querySelector('input[type="range"]')).toBe(screen.getByRole('slider'));
      expect(thumb.querySelector('[data-testid="child"]')).toBe(screen.getByTestId('child'));
    });
  });

  describe('prop: inputRef', () => {
    it('can focus the input element', async () => {
      const user = userEvent.setup();
      let inputElement: HTMLInputElement | undefined;
      render(() => (
        <>
          <Slider.Root defaultValue={50}>
            <Slider.Control>
              <Slider.Thumb
                inputRef={(element) => {
                  inputElement = element;
                }}
              />
            </Slider.Control>
          </Slider.Root>
          <button type="button" onClick={() => inputElement?.focus()}>
            Button
          </button>
        </>
      ));

      expect(document.body).toHaveFocus();
      await user.click(screen.getByText('Button'));
      expect(screen.getByRole('slider')).toHaveFocus();
    });
  });

  it('preserves the grab offset when dragging a vertical thumb', () => {
    const onValueChange = vi.fn();

    render(() => (
      <Slider.Root defaultValue={50} orientation="vertical" onValueChange={onValueChange}>
        <Slider.Control data-testid="control">
          <Slider.Thumb data-testid="thumb" />
        </Slider.Control>
      </Slider.Root>
    ));

    const control = screen.getByTestId('control');
    const thumb = screen.getByTestId('thumb');
    vi.spyOn(control, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 10, 100));
    vi.spyOn(thumb, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 40, 10, 20));

    fireEvent.pointerDown(thumb, { button: 0, buttons: 1, clientX: 5, clientY: 60 });
    fireEvent.pointerMove(document.body, { buttons: 1, clientX: 5, clientY: 80 });

    expect(onValueChange).toHaveBeenLastCalledWith(
      30,
      expect.objectContaining({ activeThumbIndex: 0, reason: 'drag' }),
    );
  });

  describe('stacking order', () => {
    it('relies on DOM order before any thumb is used', () => {
      render(() => (
        <Slider.Root defaultValue={[20, 20]}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb-0" />
            <Slider.Thumb data-testid="thumb-1" />
          </Slider.Control>
        </Slider.Root>
      ));

      expect(screen.getByTestId('thumb-0').style.zIndex).toBe('');
      expect(screen.getByTestId('thumb-1').style.zIndex).toBe('');
    });

    it('keeps the most recently active thumb on top after focus moves away', async () => {
      const user = userEvent.setup();
      render(() => (
        <Slider.Root defaultValue={[20, 20]}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb-0" />
            <Slider.Thumb data-testid="thumb-1" />
          </Slider.Control>
        </Slider.Root>
      ));

      const [thumb0, thumb1] = [screen.getByTestId('thumb-0'), screen.getByTestId('thumb-1')];

      await user.keyboard('[Tab]');
      expect(screen.getAllByRole('slider')[0]).toHaveFocus();
      expect(thumb0.style.zIndex).toBe('2');

      await user.keyboard('[Tab]');
      expect(screen.getAllByRole('slider')[1]).toHaveFocus();
      expect(thumb1.style.zIndex).toBe('2');

      await user.keyboard('[Tab]');
      expect(document.body).toHaveFocus();
      expect(thumb1.style.zIndex).toBe('1');
      expect(thumb0.style.zIndex).toBe('');
    });
  });

  describe('positioning styles', () => {
    it('positions the thumb from the value', () => {
      const [value, setValue] = createSignal(30);
      render(() => (
        <Slider.Root value={value()}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>
      ));

      const thumb = screen.getByTestId('thumb');
      expect(thumb.style.position).toBe('absolute');
      expect(thumb.style.getPropertyValue('inset-inline-start')).toBe('30%');
      expect(thumb.style.top).toBe('50%');

      setValue(60);
      flush();
      expect(thumb.style.getPropertyValue('inset-inline-start')).toBe('60%');

      // The thumb doesn't go out of bounds when the controlled value does.
      setValue(150);
      flush();
      expect(thumb.style.getPropertyValue('inset-inline-start')).toBe('100%');
    });

    it('positions a vertical thumb from the bottom', () => {
      render(() => (
        <Slider.Root defaultValue={30} orientation="vertical">
          <Slider.Control>
            <Slider.Thumb data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>
      ));

      const thumb = screen.getByTestId('thumb');
      expect(thumb.style.bottom).toBe('30%');
      expect(thumb.style.left).toBe('50%');
    });

    it('is visually hidden when min equals max', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(() => (
        <Slider.Root value={0} min={0} max={0}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>
      ));
      flush();
      expect(screen.getByTestId('thumb').style.position).toBe('fixed');
      warn.mockRestore();
    });
  });

  describe('prop: thumbAlignment', () => {
    // jsdom has no layout: give the control a 100px width and the thumbs a 10px width.
    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement,
      ) {
        if (this.hasAttribute('data-base-ui-slider-control') || this.dataset.testid === 'control') {
          return new DOMRect(0, 0, 100, 10);
        }
        if (this.hasAttribute('data-index')) {
          return new DOMRect(0, 0, 10, 10);
        }
        return new DOMRect(0, 0, 0, 0);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('insets the thumb and the indicator within the control', async () => {
      render(() => (
        <Slider.Root defaultValue={30} thumbAlignment="edge">
          <Slider.Control data-testid="control">
            <Slider.Track>
              <Slider.Indicator data-testid="indicator" />
              <Slider.Thumb data-testid="thumb" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));

      const thumb = screen.getByTestId('thumb');
      const indicator = screen.getByTestId('indicator');

      await flushMicrotasks();

      expect(thumb.style.getPropertyValue('--position')).toBe('32%');
      expect(thumb.style.visibility).toBe('');
      expect(indicator.style.getPropertyValue('--start-position')).toBe('32%');
      expect(indicator.style.visibility).toBe('');
      expect(screen.getByTestId('control')).toHaveAttribute('data-base-ui-slider-control');
      expect(indicator).toHaveAttribute('data-base-ui-slider-indicator');
    });

    it('insets range thumbs', async () => {
      render(() => (
        <Slider.Root defaultValue={[30, 70]} thumbAlignment="edge-client-only">
          <Slider.Control data-testid="control">
            <Slider.Track>
              <Slider.Indicator data-testid="indicator" />
              <Slider.Thumb index={0} data-testid="start-thumb" />
              <Slider.Thumb index={1} data-testid="end-thumb" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));

      await flushMicrotasks();

      const indicator = screen.getByTestId('indicator');
      expect(screen.getByTestId('start-thumb').style.getPropertyValue('--position')).toBe('32%');
      expect(screen.getByTestId('end-thumb').style.getPropertyValue('--position')).toBe('68%');
      expect(indicator.style.getPropertyValue('--start-position')).toBe('32%');
      expect(indicator.style.getPropertyValue('--relative-size')).toBe('36%');
      expect(indicator.style.visibility).toBe('');
      // `edge-client-only` doesn't render the pre-hydration markers.
      expect(screen.getByTestId('control')).not.toHaveAttribute('data-base-ui-slider-control');
    });

    it('recomputes inset positions when the value changes', async () => {
      render(() => (
        <Slider.Root defaultValue={0} thumbAlignment="edge">
          <Slider.Control data-testid="control">
            <Slider.Thumb data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>
      ));

      await flushMicrotasks();
      const thumb = screen.getByTestId('thumb');
      expect(thumb.style.getPropertyValue('--position')).toBe('5%');

      const slider = screen.getByRole('slider');
      focus(slider);
      fireEvent.keyDown(slider, { key: 'End' });

      expect(slider).toHaveAttribute('aria-valuenow', '100');
      expect(thumb.style.getPropertyValue('--position')).toBe('95%');
    });

    // Skipped: visibility/resize-observer tests need real layout and ResizeObserver.
  });

  // Skipped: server-side rendering and pre-hydration script tests (no SSR in this test setup).
});
