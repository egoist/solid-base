import { createSignal, flush, Show } from 'solid-js';
import { fireEvent as baseFireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { DirectionProvider } from '../../direction-provider';
import type { TextDirection } from '../../internals/direction-context/DirectionContext';
import { Field } from '../../field';
import { Form } from '../../form';
import { Slider } from '..';
import { REASONS } from '../../internals/reasons';
import {
  ARROW_RIGHT,
  ARROW_LEFT,
  ARROW_UP,
  ARROW_DOWN,
  HOME,
  END,
} from '../../internals/composite/composite';
import type { Orientation } from '../../internals/types';
import type { SliderRoot } from './SliderRoot';
import { createTouches, getHorizontalSliderRect } from '../utils/test-utils';

const USD_NUMBER_FORMAT: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'USD',
};

/**
 * `fireEvent` followed by `flush()`, so that each event sees the state committed by the previous
 * one (like separate browser tasks).
 */
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

function TestSlider(props: SliderRoot.Props) {
  return (
    <Slider.Root data-testid="root" {...props}>
      <Slider.Value data-testid="value" />
      <Slider.Control data-testid="control">
        <Slider.Track>
          <Slider.Indicator />
          <Slider.Thumb data-testid="thumb" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

function TestRangeSlider(props: SliderRoot.Props) {
  return (
    <Slider.Root data-testid="root" {...props}>
      <Slider.Value data-testid="value" />
      <Slider.Control data-testid="control">
        <Slider.Track>
          <Slider.Indicator />
          <Slider.Thumb index={0} data-testid="thumb" />
          <Slider.Thumb index={1} data-testid="thumb" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

function mockControlRect(control: HTMLElement, width = 100) {
  vi.spyOn(control, 'getBoundingClientRect').mockImplementation(() =>
    getHorizontalSliderRect(width),
  );
}

describe('<Slider.Root />', () => {
  const pointerCaptureMethods = [
    'setPointerCapture',
    'hasPointerCapture',
    'releasePointerCapture',
  ] as const;
  const pointerCaptureDescriptors = pointerCaptureMethods.map((method) =>
    Object.getOwnPropertyDescriptor(Element.prototype, method),
  );

  beforeAll(() => {
    // Synthetic pointer events have no active pointer to capture.
    pointerCaptureMethods.forEach((method) => {
      Object.defineProperty(Element.prototype, method, {
        configurable: true,
        value: vi.fn(() => false),
      });
    });
  });

  afterAll(() => {
    pointerCaptureMethods.forEach((method, index) => {
      const descriptor = pointerCaptureDescriptors[index];
      if (descriptor) {
        Object.defineProperty(Element.prototype, method, descriptor);
      } else {
        Reflect.deleteProperty(Element.prototype, method);
      }
    });
  });

  describe('conformance', () => {
    it('renders a div and supports class, style, render and ref', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <>
          <Slider.Root
            defaultValue={50}
            data-testid="root"
            class={(state) => `values-${state.values.join('-')}`}
            style={{ color: 'red' }}
            ref={(element) => {
              ref = element;
            }}
          />
          <Slider.Root defaultValue={50} render="section" data-testid="section" />
        </>
      ));
      const root = screen.getByTestId('root');
      expect(root.tagName).toBe('DIV');
      expect(root).toHaveClass('values-50');
      expect(root.style.color).toBe('red');
      expect(ref).toBe(root);
      expect(screen.getByTestId('section').tagName).toBe('SECTION');
    });
  });

  it('warns when max is not greater than min', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(() => <TestSlider defaultValue={10} min={10} max={10} />);
    flush();
    expect(warn.mock.calls.some((call) => String(call.join(' ')).includes('Slider `max` must be greater than `min`.'))).toBe(true);
    warn.mockRestore();
  });

  describe('ARIA attributes', () => {
    it('has the correct aria attributes', () => {
      render(() => (
        <Slider.Root defaultValue={30} aria-labelledby="labelId" data-testid="root">
          <Slider.Value />
          <Slider.Control>
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));

      const root = screen.getByTestId('root');
      const slider = screen.getByRole('slider');

      expect(slider.tagName).toBe('INPUT');
      expect(root).toHaveAttribute('role', 'group');
      expect(root).toHaveAttribute('aria-labelledby', 'labelId');

      expect(slider).toHaveAttribute('aria-valuenow', '30');
      expect(slider).toHaveAttribute('aria-orientation', 'horizontal');
      expect(slider).toHaveAttribute('aria-labelledby', 'labelId');
      expect(slider).toHaveAttribute('step', '1');
      expect(slider).toHaveAttribute('type', 'range');
    });

    it('should update aria-valuenow', () => {
      render(() => <TestSlider defaultValue={50} />);
      const slider = screen.getByRole('slider');

      focus(slider);

      fireEvent.change(slider, { target: { value: '51' } });
      expect(slider).toHaveAttribute('aria-valuenow', '51');

      fireEvent.keyDown(slider, { key: ARROW_RIGHT });
      expect(slider).toHaveAttribute('aria-valuenow', '52');
    });

    it('handles `input` events from the hidden input', () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={50} onValueChange={handleValueChange} />);
      const slider = screen.getByRole('slider') as HTMLInputElement;

      fireEvent.input(slider, { target: { value: '60' } });
      expect(slider).toHaveAttribute('aria-valuenow', '60');
      // The `change` event that follows doesn't apply the same value twice.
      fireEvent.change(slider, { target: { value: '60' } });
      expect(handleValueChange).toHaveBeenCalledTimes(1);
    });

    it('should set default aria-valuetext on range slider thumbs', () => {
      render(() => <TestRangeSlider defaultValue={[44, 50]} />);

      const [thumb1, thumb2] = screen.getAllByTestId('thumb');

      expect(thumb1.querySelector('input')).toHaveAttribute('aria-valuetext', '44 start range');
      expect(thumb2.querySelector('input')).toHaveAttribute('aria-valuetext', '50 end range');
    });
  });

  describe('rtl', () => {
    it('should handle RTL', () => {
      const handleValueChange = vi.fn((newValue) => newValue);

      render(() => (
        <div dir="rtl">
          <DirectionProvider direction="rtl">
            <TestSlider value={30} onValueChange={handleValueChange} />
          </DirectionProvider>
        </div>
      ));

      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);

      fireEvent.pointerDown(sliderControl, { buttons: 1, clientX: 20 });
      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 22 });
      fireEvent.pointerUp(document.body, { buttons: 1, clientX: 22 });

      expect(handleValueChange.mock.calls.length).toBe(2);
      expect(handleValueChange.mock.results[0]?.value).toBe(80);
      expect(handleValueChange.mock.results.at(-1)?.value).toBe(78);
    });
  });

  describe('prop: disabled', () => {
    it('should render data-disabled on all subcomponents', () => {
      render(() => (
        <Slider.Root defaultValue={30} disabled data-testid="root">
          <Slider.Value data-testid="value" />
          <Slider.Control data-testid="control">
            <Slider.Track data-testid="track">
              <Slider.Indicator data-testid="indicator" />
              <Slider.Thumb data-testid="thumb" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));

      ['root', 'value', 'control', 'track', 'indicator', 'thumb'].forEach((testId) => {
        expect(screen.getByTestId(testId)).toHaveAttribute('data-disabled', '');
      });
    });

    it('explicitly blurs the focused thumb when disabled', () => {
      const [disabled, setDisabled] = createSignal(false);
      render(() => <TestSlider defaultValue={30} disabled={disabled()} />);
      const input = screen.getByRole('slider');

      focus(input);
      expect(input).toHaveFocus();
      const blurSpy = vi.spyOn(input, 'blur');

      setDisabled(true);
      flush();

      expect(blurSpy).toHaveBeenCalled();
    });

    it('should not respond to drag events if disabled', () => {
      const handleValueChange = vi.fn();
      render(() => (
        <TestSlider defaultValue={21} disabled onValueChange={handleValueChange} />
      ));

      const control = screen.getByTestId('control');
      mockControlRect(control);
      const thumb = screen.getByRole('slider');

      fireEvent.pointerDown(control, { buttons: 1, clientX: 21 });
      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 30 });
      fireEvent.pointerUp(document.body, { buttons: 1, clientX: 30 });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(thumb).toHaveAttribute('aria-valuenow', '21');
    });

    it('does not drag a thumb disabled via the `disabled` prop', () => {
      const handleValueChange = vi.fn();
      render(() => (
        <Slider.Root defaultValue={[20, 80]} onValueChange={handleValueChange}>
          <Slider.Control data-testid="control">
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb index={0} data-testid="thumb-0" />
              <Slider.Thumb index={1} disabled data-testid="thumb-1" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));

      const control = screen.getByTestId('control');
      mockControlRect(control);

      const disabledInput = screen.getByTestId('thumb-1').querySelector('input')!;
      expect(disabledInput).toBeDisabled();

      fireEvent.pointerDown(screen.getByTestId('thumb-1'), { buttons: 1, clientX: 80 });
      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 40 });
      fireEvent.pointerUp(document.body, { buttons: 1, clientX: 40 });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(disabledInput).toHaveAttribute('aria-valuenow', '80');
    });

    it('does not change a single disabled thumb when pressing the track', () => {
      const handleValueChange = vi.fn();
      render(() => (
        <Slider.Root defaultValue={20} onValueChange={handleValueChange}>
          <Slider.Control data-testid="control">
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb disabled />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));

      const control = screen.getByTestId('control');
      mockControlRect(control);

      const input = screen.getByRole('slider');
      expect(input).toBeDisabled();

      fireEvent.pointerDown(control, { buttons: 1, clientX: 80 });
      fireEvent.pointerUp(control, { buttons: 1, clientX: 80 });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(input).toHaveAttribute('aria-valuenow', '20');
    });

    it('does not select a disabled thumb when pressing the track', () => {
      render(() => (
        <Slider.Root defaultValue={[20, 80]} thumbCollisionBehavior="none">
          <Slider.Control data-testid="control">
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb index={0} data-testid="thumb-0" />
              <Slider.Thumb index={1} disabled data-testid="thumb-1" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));

      const control = screen.getByTestId('control');
      mockControlRect(control, 1000);
      // jsdom has no layout: give the thumbs the rects they would have at 20% and 80%.
      vi.spyOn(screen.getByTestId('thumb-0'), 'getBoundingClientRect').mockImplementation(
        () => new DOMRect(195, 0, 10, 10),
      );
      vi.spyOn(screen.getByTestId('thumb-1'), 'getBoundingClientRect').mockImplementation(
        () => new DOMRect(795, 0, 10, 10),
      );

      const [, disabledInput] = screen.getAllByRole('slider');
      expect(disabledInput).toBeDisabled();

      // Press the track closest to the disabled thumb.
      fireEvent.pointerDown(control, { buttons: 1, clientX: 950 });
      fireEvent.pointerUp(control, { buttons: 1, clientX: 950 });

      // The enabled thumb is selected instead, so the disabled thumb stays put.
      expect(disabledInput).toHaveAttribute('aria-valuenow', '80');
    });
  });

  describe('prop: orientation', () => {
    it('sets the `aria-orientation` attribute', () => {
      render(() => <TestSlider orientation="vertical" />);
      expect(screen.getByRole('slider')).toHaveAttribute('aria-orientation', 'vertical');
    });

    it('sets the data-orientation attribute', () => {
      render(() => <TestSlider />);

      expect(screen.getByRole('group')).toHaveAttribute('data-orientation', 'horizontal');
      expect(screen.getByTestId('control')).toHaveAttribute('data-orientation', 'horizontal');
      expect(screen.getByTestId('value')).toHaveAttribute('data-orientation', 'horizontal');
    });

    it('should report the right position', () => {
      const handleValueChange = vi.fn();
      render(() => (
        <TestSlider orientation="vertical" defaultValue={20} onValueChange={handleValueChange} />
      ));

      const sliderControl = screen.getByTestId('control');
      vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(
        () => new DOMRect(0, 0, 10, 100),
      );

      fireEvent.pointerDown(sliderControl, { buttons: 1, clientX: 0, clientY: 20 });
      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 0, clientY: 22 });

      expect(handleValueChange.mock.calls.length).toBe(2);
      expect(handleValueChange.mock.calls[0][0]).toBe(80);
      expect(handleValueChange.mock.calls[1][0]).toBe(78);
    });
  });

  describe('prop: step', () => {
    it('supports non-integer values', () => {
      render(() => (
        <>
          <TestSlider value={51.1} min={-100} max={100} step={0.00000001} />
          <TestSlider value={0.00000005} min={-100} max={100} step={0.00000001} />
          <TestSlider value={1e-7} min={-100} max={100} step={0.00000001} />
        </>
      ));
      const [slider1, slider2, slider3] = screen.getAllByRole('slider');

      expect(slider1).toHaveAttribute('aria-valuenow', '51.1');
      expect(slider2).toHaveAttribute('aria-valuenow', '5e-8');
      expect(slider3).toHaveAttribute('aria-valuenow', '1e-7');
    });

    it('should round value to step precision', () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={0.2} min={0} max={1} step={0.1} onValueChange={handleValueChange} />);
      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);

      fireEvent.pointerDown(sliderControl, { buttons: 1, clientX: 20 });
      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 33 });

      expect(handleValueChange.mock.calls.at(-1)?.[0]).toBe(0.3);
    });
  });

  describe('prop: max', () => {
    it('sets the max attribute on the input', () => {
      render(() => <TestSlider defaultValue={150} step={100} max={750} />);
      expect(screen.getByRole('slider')).toHaveAttribute('max', '750');
    });

    it('should not go more than the max', async () => {
      const user = userEvent.setup();
      render(() => <TestSlider defaultValue={100} step={100} max={200} />);

      const slider = screen.getByRole('slider');

      await user.keyboard('[Tab]');

      await user.keyboard(`[${ARROW_RIGHT}]`);
      expect(slider).toHaveAttribute('aria-valuenow', '200');

      await user.keyboard(`[${ARROW_RIGHT}]`);
      expect(slider).toHaveAttribute('aria-valuenow', '200');
    });

    it('should reach right edge value', () => {
      const handleValueChange = vi.fn();
      render(() => (
        <TestSlider defaultValue={90} min={6} max={108} step={10} onValueChange={handleValueChange} />
      ));

      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);

      fireEvent.pointerDown(sliderControl, { buttons: 1, clientX: 100 });
      expect(handleValueChange.mock.calls.at(-1)?.[0]).toBe(106);

      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 110 });
      expect(handleValueChange.mock.calls.at(-1)?.[0]).toBe(106);
    });
  });

  describe('prop: min', () => {
    it('sets the min attribute on the input', () => {
      render(() => <TestSlider defaultValue={150} step={100} min={150} max={200} />);
      expect(screen.getByRole('slider')).toHaveAttribute('min', '150');
    });

    it('should use min as the step origin', () => {
      render(() => <TestSlider defaultValue={150} step={100} max={750} min={150} />);
      const slider = screen.getByRole('slider');
      focus(slider);
      expect(slider).toHaveAttribute('aria-valuenow', '150');
    });

    it('should not go less than the min', async () => {
      const user = userEvent.setup();
      render(() => <TestSlider defaultValue={1} step={1} min={0} />);
      const slider = screen.getByRole('slider');

      await user.keyboard('[Tab]');

      await user.keyboard(`[${ARROW_LEFT}]`);
      expect(slider).toHaveAttribute('aria-valuenow', '0');
      await user.keyboard(`[${ARROW_LEFT}]`);
      expect(slider).toHaveAttribute('aria-valuenow', '0');
    });

    it('clamps range values that fall outside the min and max bounds', () => {
      render(() => <TestRangeSlider defaultValue={[19, 41]} min={20} max={40} />);

      const thumbs = screen.getAllByRole('slider');
      expect(thumbs.map((thumb) => thumb.getAttribute('aria-valuenow'))).toEqual(['20', '40']);
    });
  });

  describe('prop: minStepsBetweenValues', () => {
    it('should enforce a minimum difference between range slider values', async () => {
      const user = userEvent.setup();
      const handleValueChange = vi.fn();

      render(() => (
        <TestRangeSlider
          onValueChange={handleValueChange}
          defaultValue={[44, 50]}
          step={2}
          minStepsBetweenValues={2}
        />
      ));

      await user.keyboard('[Tab]');

      await user.keyboard(`[${ARROW_UP}]`);
      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual([46, 50]);
      await user.keyboard(`[${ARROW_UP}]`);
      expect(handleValueChange.mock.calls.length).toBe(1);

      await user.keyboard('[Tab]');

      await user.keyboard(`[${ARROW_UP}]`);
      expect(handleValueChange.mock.calls.length).toBe(2);
      expect(handleValueChange.mock.calls[1][0]).toEqual([46, 52]);
      await user.keyboard(`[${ARROW_DOWN}]`);
      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(handleValueChange.mock.calls.length).toBe(3);
      expect(handleValueChange.mock.calls[2][0]).toEqual([46, 50]);
    });
  });

  describe('prop: onValueCommitted', () => {
    it('single value', () => {
      const handleValueCommitted = vi.fn((newValue: number, eventDetails) => ({
        newValue,
        reason: eventDetails.reason,
      }));

      render(() => (
        <Slider.Root onValueCommitted={handleValueCommitted} defaultValue={0}>
          <Slider.Control data-testid="control">
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));

      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);

      const slider = screen.getByRole('slider');

      fireEvent.pointerDown(sliderControl, { buttons: 1, clientX: 10 });
      fireEvent.pointerUp(sliderControl, { buttons: 1, clientX: 10 });

      expect(handleValueCommitted.mock.calls.length).toBe(1);
      expect(handleValueCommitted.mock.results.at(-1)?.value.newValue).toBe(10);
      expect(handleValueCommitted.mock.results.at(-1)?.value.reason).toBe(REASONS.trackPress);

      focus(slider);

      fireEvent.change(slider, { target: { value: 23 } });
      expect(handleValueCommitted.mock.calls.length).toBe(2);
      expect(handleValueCommitted.mock.results.at(-1)?.value.reason).toBe(REASONS.inputChange);
    });

    it.each(['touch', 'pen'])('commits a %s track tap', (pointerType) => {
      const handleValueCommitted = vi.fn();

      function ControlledSlider() {
        const [value, setValue] = createSignal(0);
        return (
          <Slider.Root
            value={value()}
            onValueChange={setValue}
            onValueCommitted={handleValueCommitted}
          >
            <Slider.Control data-testid="control">
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        );
      }

      render(() => <ControlledSlider />);

      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);

      const touches = createTouches([{ identifier: 1, clientX: 50, clientY: 0 }]);

      // Browsers fire pointer events before the compatibility touch events, including for
      // Apple Pencil.
      fireEvent.pointerDown(sliderControl, { pointerType, pointerId: 1, buttons: 1, clientX: 50 });
      fireEvent.touchStart(sliderControl, touches);
      fireEvent.pointerUp(sliderControl, { pointerType, pointerId: 1, clientX: 50 });
      fireEvent.touchEnd(document.body, touches);

      expect(handleValueCommitted.mock.calls.length).toBe(1);
      expect(handleValueCommitted.mock.calls[0][0]).toBe(50);
    });

    it('keeps tracking a touch drag with touch listeners after the browser cancels the pointer', () => {
      const handleValueCommitted = vi.fn();

      render(() => (
        <Slider.Root defaultValue={0} onValueCommitted={handleValueCommitted}>
          <Slider.Control data-testid="control">
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));

      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);

      fireEvent.pointerDown(sliderControl, {
        pointerType: 'touch',
        pointerId: 1,
        buttons: 1,
        clientX: 50,
      });
      fireEvent.touchStart(sliderControl, createTouches([{ identifier: 1, clientX: 50, clientY: 0 }]));
      // Without `touch-action: none`, the browser cancels the pointer once it starts panning.
      fireEvent.pointerCancel(sliderControl, { pointerType: 'touch', pointerId: 1 });
      fireEvent.touchMove(document.body, createTouches([{ identifier: 1, clientX: 70, clientY: 0 }]));
      fireEvent.touchEnd(document.body, createTouches([{ identifier: 1, clientX: 70, clientY: 0 }]));

      expect(handleValueCommitted.mock.calls.length).toBe(1);
      expect(handleValueCommitted.mock.calls[0][0]).toBe(70);
    });

    it.each(['mouse', 'pen', 'touch'])(
      'handles a touch press normally after a cancelled %s gesture',
      (pointerType) => {
        const handleValueChange = vi.fn();
        const handleValueCommitted = vi.fn();
        let preventPointerDown = false;

        render(() => (
          <Slider.Root
            defaultValue={0}
            onValueChange={handleValueChange}
            onValueCommitted={handleValueCommitted}
          >
            <Slider.Control
              data-testid="control"
              onPointerDown={(event) => {
                if (preventPointerDown) {
                  event.preventDefault();
                }
              }}
            >
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        ));

        const sliderControl = screen.getByTestId('control');
        mockControlRect(sliderControl);

        fireEvent.pointerDown(sliderControl, { pointerType, pointerId: 1, buttons: 1, clientX: 50 });
        if (pointerType === 'touch') {
          fireEvent.touchStart(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 50, clientY: 0 }]),
          );
        }
        expect(handleValueChange.mock.calls.at(-1)?.[0]).toBe(50);
        fireEvent.pointerCancel(sliderControl, { pointerType, pointerId: 1 });
        if (pointerType === 'touch') {
          fireEvent.touchCancel(document.body);
        }

        handleValueCommitted.mockClear();

        // Harness only: a prevented pointerdown still resets the flag but leaves the press to the
        // touch handler.
        preventPointerDown = true;
        fireEvent.pointerDown(sliderControl, {
          pointerType: 'touch',
          pointerId: 2,
          buttons: 1,
          clientX: 30,
        });
        const touches = createTouches([{ identifier: 2, clientX: 30, clientY: 0 }]);
        fireEvent.touchStart(sliderControl, touches);
        expect(handleValueChange.mock.calls.at(-1)?.[0]).toBe(30);

        fireEvent.pointerUp(sliderControl, { pointerType: 'touch', pointerId: 2, clientX: 30 });
        fireEvent.touchEnd(document.body, touches);
        expect(handleValueCommitted.mock.calls.length).toBe(1);
        expect(handleValueCommitted.mock.calls[0][0]).toBe(30);
      },
    );

    it.each(['touch', 'pen'])('does not change the value on a %s tap on the thumb', (pointerType) => {
      const handleValueChange = vi.fn();

      render(() => (
        <Slider.Root defaultValue={100} step={3} onValueChange={handleValueChange}>
          <Slider.Control data-testid="control">
            <Slider.Thumb data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>
      ));

      const sliderControl = screen.getByTestId('control');
      const thumb = screen.getByTestId('thumb');

      mockControlRect(sliderControl);
      vi.spyOn(thumb, 'getBoundingClientRect').mockImplementation(
        () => new DOMRect(95, 0, 10, 10),
      );

      const touches = createTouches([{ identifier: 1, clientX: 100, clientY: 0 }]);

      fireEvent.pointerDown(thumb, { pointerType, pointerId: 1, buttons: 1, clientX: 100 });
      fireEvent.touchStart(thumb, touches);
      fireEvent.pointerUp(thumb, { pointerType, pointerId: 1, clientX: 100 });
      fireEvent.touchEnd(document.body, touches);

      expect(handleValueChange.mock.calls.length).toBe(0);
    });

    it('array value', () => {
      const handleValueCommitted = vi.fn((newValue: readonly number[], eventDetails) => ({
        newValue,
        reason: eventDetails.reason,
      }));

      render(() => (
        <Slider.Root onValueCommitted={handleValueCommitted} defaultValue={[10, 20]}>
          <Slider.Control data-testid="control">
            <Slider.Thumb index={0} data-testid="thumb-0" />
            <Slider.Thumb index={1} data-testid="thumb-1" />
          </Slider.Control>
        </Slider.Root>
      ));

      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);
      vi.spyOn(screen.getByTestId('thumb-1'), 'getBoundingClientRect').mockImplementation(
        () => new DOMRect(15, 0, 10, 10),
      );

      const [thumb1] = screen.getAllByRole('slider');

      fireEvent.pointerDown(screen.getByTestId('thumb-1'), { buttons: 1, clientX: 20 });
      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 30 });

      expect(handleValueCommitted.mock.calls.length).toBe(0);

      fireEvent.pointerUp(document.body, { buttons: 1, clientX: 30 });

      expect(handleValueCommitted.mock.calls.length).toBe(1);
      expect(handleValueCommitted.mock.results.at(-1)?.value.newValue).toEqual([10, 30]);
      expect(handleValueCommitted.mock.results.at(-1)?.value.reason).toBe(REASONS.drag);

      focus(thumb1);

      fireEvent.change(thumb1, { target: { value: 23 } });
      expect(handleValueCommitted.mock.calls.length).toBe(2);
      expect(handleValueCommitted.mock.results.at(-1)?.value.reason).toBe(REASONS.inputChange);
    });

    it('does not commit a canceled change', () => {
      const handleValueChange = vi.fn((_value, details) => details.cancel());
      const handleValueCommitted = vi.fn();

      render(() => (
        <Slider.Root
          defaultValue={50}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        >
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));

      const slider = screen.getByRole('slider');
      focus(slider);

      fireEvent.keyDown(slider, { key: ARROW_RIGHT });

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueCommitted).not.toHaveBeenCalled();
      expect(slider).toHaveAttribute('aria-valuenow', '50');
    });

    it('reverts the hidden input when a change is canceled', () => {
      render(() => (
        <Slider.Root defaultValue={50} onValueChange={(_value, details) => details.cancel()}>
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));

      const slider = screen.getByRole('slider') as HTMLInputElement;
      fireEvent.change(slider, { target: { value: '60' } });
      expect(slider.value).toBe('50');
      expect(slider).toHaveAttribute('aria-valuenow', '50');
    });

    it('does not commit when keyboard interaction leaves the value unchanged', () => {
      const handleValueChange = vi.fn();
      const handleValueCommitted = vi.fn();

      render(() => (
        <Slider.Root
          defaultValue={100}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        >
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));

      const slider = screen.getByRole('slider');
      focus(slider);

      fireEvent.keyDown(slider, { key: ARROW_RIGHT });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(handleValueCommitted).not.toHaveBeenCalled();
      expect(slider).toHaveAttribute('aria-valuenow', '100');
    });

    it('does not commit when keyboard interaction leaves a range value unchanged', () => {
      const handleValueChange = vi.fn();
      const handleValueCommitted = vi.fn();

      render(() => (
        <TestRangeSlider
          defaultValue={[50, 50]}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        />
      ));

      const [slider1, slider2] = screen.getAllByRole('slider');
      focus(slider1);

      fireEvent.keyDown(slider1, { key: ARROW_RIGHT });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(handleValueCommitted).not.toHaveBeenCalled();
      expect(slider1).toHaveAttribute('aria-valuenow', '50');
      expect(slider2).toHaveAttribute('aria-valuenow', '50');
    });

    it('does not commit when thumb press leaves the value unchanged', () => {
      const handleValueChange = vi.fn();
      const handleValueCommitted = vi.fn();

      render(() => (
        <Slider.Root
          defaultValue={50}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        >
          <Slider.Control data-testid="control">
            <Slider.Thumb data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>
      ));

      mockControlRect(screen.getByTestId('control'));
      const thumb = screen.getByTestId('thumb');
      vi.spyOn(thumb, 'getBoundingClientRect').mockImplementation(
        () => new DOMRect(45, 0, 10, 10),
      );

      fireEvent.pointerDown(thumb, { buttons: 1, clientX: 50 });
      fireEvent.pointerUp(document.body, { buttons: 1, clientX: 50 });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(handleValueCommitted).not.toHaveBeenCalled();
    });

    it('does not commit a canceled track press', () => {
      const handleValueChange = vi.fn((_value, details) => details.cancel());
      const handleValueCommitted = vi.fn();

      render(() => (
        <TestSlider
          defaultValue={0}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        />
      ));

      const control = screen.getByTestId('control');
      mockControlRect(control);

      fireEvent.pointerDown(control, { buttons: 1, clientX: 40 });
      fireEvent.pointerUp(document.body, { buttons: 1, clientX: 40 });

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueCommitted).not.toHaveBeenCalled();
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '0');
    });

    it('commits the last applied value when a later move is canceled', () => {
      const handleValueCommitted = vi.fn();
      const handleValueChange = vi.fn(
        (value: number | readonly number[], details: SliderRoot.ChangeEventDetails) => {
        if ((value as number) > 50) {
          details.cancel();
        }
      },
      );

      render(() => (
        <TestSlider
          defaultValue={0}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        />
      ));

      const control = screen.getByTestId('control');
      mockControlRect(control);

      fireEvent.pointerDown(control, { buttons: 1, clientX: 20 });
      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 40 });
      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 60 });
      fireEvent.pointerUp(document.body, { buttons: 1, clientX: 60 });

      expect(handleValueCommitted).toHaveBeenCalledTimes(1);
      expect(handleValueCommitted.mock.calls[0][0]).toBe(40);
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '40');
    });
  });

  describe('events', () => {
    it('should call handlers', () => {
      const handleValueChange = vi.fn();
      const handleValueCommitted = vi.fn();

      render(() => (
        <TestSlider
          defaultValue={0}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        />
      ));

      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);
      const slider = screen.getByRole('slider');

      fireEvent.pointerDown(sliderControl, { buttons: 1, clientX: 10 });
      fireEvent.pointerUp(sliderControl, { buttons: 1, clientX: 10 });

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toBe(10);
      expect(handleValueCommitted.mock.calls.length).toBe(1);
      expect(handleValueCommitted.mock.calls[0][0]).toBe(10);

      focus(slider);
      fireEvent.change(slider, { target: { value: 23 } });
      expect(handleValueChange.mock.calls.length).toBe(2);
      expect(handleValueCommitted.mock.calls.length).toBe(2);
    });

    it('should support touch events', () => {
      const handleValueChange = vi.fn();
      render(() => <TestRangeSlider defaultValue={[20, 30]} onValueChange={handleValueChange} />);

      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);
      const [thumb1, thumb2] = screen.getAllByTestId('thumb');
      vi.spyOn(thumb1, 'getBoundingClientRect').mockImplementation(
        () => new DOMRect(15, 0, 10, 10),
      );
      vi.spyOn(thumb2, 'getBoundingClientRect').mockImplementation(
        () => new DOMRect(25, 0, 10, 10),
      );

      fireEvent.touchStart(sliderControl, createTouches([{ identifier: 1, clientX: 20, clientY: 0 }]));
      fireEvent.touchMove(document.body, createTouches([{ identifier: 1, clientX: 21, clientY: 0 }]));
      fireEvent.touchEnd(document.body, createTouches([{ identifier: 1, clientX: 21, clientY: 0 }]));

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual([21, 30]);
    });

    it('should hedge against a dropped mouseup event', () => {
      const handleValueChange = vi.fn();

      function ControlledSlider() {
        const [value, setValue] = createSignal(0);
        return (
          <TestSlider
            value={value()}
            onValueChange={(next) => {
              handleValueChange(next);
              setValue(next as number);
            }}
          />
        );
      }

      render(() => <ControlledSlider />);

      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);

      fireEvent.pointerDown(sliderControl, { buttons: 1, clientX: 1 });
      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toBe(1);

      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 10 });
      expect(handleValueChange.mock.calls.length).toBe(2);
      expect(handleValueChange.mock.calls[1][0]).toBe(10);

      fireEvent.pointerMove(document.body, { buttons: 0, clientX: 11 });
      // The mouse's button was released, stop the dragging session.
      expect(handleValueChange.mock.calls.length).toBe(2);
    });

    it('should focus the slider when touching', () => {
      render(() => <TestSlider defaultValue={30} />);
      const slider = screen.getByRole('slider');
      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);

      fireEvent.touchStart(sliderControl, createTouches([{ identifier: 1, clientX: 0, clientY: 0 }]));

      expect(slider).toHaveFocus();
    });

    it('should focus the slider when dragging', async () => {
      render(() => <TestSlider defaultValue={30} step={10} />);
      const slider = screen.getByRole('slider');
      const sliderThumb = screen.getByTestId('thumb');
      mockControlRect(screen.getByTestId('control'));

      fireEvent.pointerDown(sliderThumb, { buttons: 1, clientX: 1 });

      await waitFor(() => {
        expect(slider).toHaveFocus();
      });
    });

    it('should not override the event.target on mouse events', () => {
      const handleValueChange = vi.fn();
      const handleNativeEvent = vi.fn();
      const handleEvent = vi.fn();
      document.addEventListener('mousedown', handleNativeEvent);

      try {
        render(() => (
          <div onMouseDown={handleEvent}>
            <TestSlider value={0} onValueChange={handleValueChange} />
          </div>
        ));
        const sliderControl = screen.getByTestId('control');
        mockControlRect(sliderControl);

        fireEvent.mouseDown(sliderControl);

        expect(handleValueChange.mock.calls.length).toBe(0);
        expect(handleNativeEvent.mock.calls.length).toBe(1);
        expect(handleNativeEvent.mock.calls[0][0]).toHaveProperty('target', sliderControl);
        expect(handleEvent.mock.calls.length).toBe(1);
        expect(handleEvent.mock.calls[0][0]).toHaveProperty('target', sliderControl);
      } finally {
        document.removeEventListener('mousedown', handleNativeEvent);
      }
    });
  });

  describe('dragging state', () => {
    it('should not apply data-dragging for click modality', () => {
      render(() => <TestSlider defaultValue={90} />);

      const sliderControl = screen.getByTestId('control');
      const root = screen.getByTestId('root');
      mockControlRect(sliderControl);

      expect(root).not.toHaveAttribute('data-dragging');
      fireEvent.pointerDown(sliderControl, { buttons: 1, clientX: 21 });
      fireEvent.pointerUp(document.body, { buttons: 1, clientX: 21 });
      expect(root).not.toHaveAttribute('data-dragging');
    });

    it('should apply data-dragging for dragging modality', () => {
      render(() => <TestSlider defaultValue={90} />);

      const sliderControl = screen.getByTestId('control');
      const root = screen.getByTestId('root');
      mockControlRect(sliderControl);

      expect(root).not.toHaveAttribute('data-dragging');

      fireEvent.pointerDown(sliderControl, { buttons: 1, clientX: 21 });
      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 200 });
      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 200 });
      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 200 });
      expect(root).toHaveAttribute('data-dragging', '');

      fireEvent.pointerUp(document.body);
      expect(root).not.toHaveAttribute('data-dragging');
    });
  });

  describe('prop: onValueChange', () => {
    it('is called when clicking on the control', () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={50} onValueChange={handleValueChange} />);

      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);

      fireEvent.pointerDown(sliderControl, { buttons: 1, clientX: 41 });

      expect(handleValueChange.mock.calls.length).toBe(1);
    });

    it('is not called when clicking on the thumb', () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={50} onValueChange={handleValueChange} />);

      const sliderControl = screen.getByTestId('control');
      const sliderThumb = screen.getByTestId('thumb');
      mockControlRect(sliderControl);

      fireEvent.pointerDown(sliderThumb, { buttons: 1, clientX: 51 });

      expect(handleValueChange.mock.calls.length).toBe(0);
    });

    it('should not react to right clicks', () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={50} onValueChange={handleValueChange} />);

      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);

      fireEvent.pointerDown(sliderControl, { button: 2, clientX: 41 });

      expect(handleValueChange.mock.calls.length).toBe(0);
    });

    it('provides the change reason for input events', () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={30} onValueChange={handleValueChange} />);

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '35' } });

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      const [, details] = handleValueChange.mock.calls[0] as [
        number,
        SliderRoot.ChangeEventDetails,
      ];
      expect(details.reason).toBe(REASONS.inputChange);
      expect(details.activeThumbIndex).toBe(0);
    });

    it('provides the change reason for keyboard interactions', () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={40} onValueChange={handleValueChange} />);

      const slider = screen.getByRole('slider');
      focus(slider);
      fireEvent.keyDown(slider, { key: ARROW_RIGHT });

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      const [, details] = handleValueChange.mock.calls[0] as [
        number,
        SliderRoot.ChangeEventDetails,
      ];
      expect(details.reason).toBe('keyboard');
    });

    it('provides the change reason for track presses', async () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={0} onValueChange={handleValueChange} />);

      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);

      fireEvent.pointerDown(sliderControl, {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        buttons: 1,
        clientX: 80,
        clientY: 0,
      });

      await waitFor(() => {
        expect(handleValueChange.mock.calls.length).toBe(1);
      });
      const [, details] = handleValueChange.mock.calls[0] as [
        number | number[],
        SliderRoot.ChangeEventDetails,
      ];
      expect(details.reason).toBe(REASONS.trackPress);
    });

    it('should fire only when the value changes', () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={20} onValueChange={handleValueChange} />);

      const sliderControl = screen.getByTestId('control');
      mockControlRect(sliderControl);

      fireEvent.pointerDown(sliderControl, { buttons: 1, clientX: 21 });
      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 22 });
      // Sometimes another event with the same position is fired by the browser.
      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 22 });

      expect(handleValueChange.mock.calls.length).toBe(2);
      expect(handleValueChange.mock.calls[0][0]).toEqual(21);
      expect(handleValueChange.mock.calls[1][0]).toEqual(22);
    });

    it('should pass "name" and "value" as part of the event.target for onValueChange', () => {
      const handleValueChange = vi
        .fn()
        .mockImplementation((_newValue, data) => (data as any).event.target);

      render(() => (
        <TestSlider onValueChange={handleValueChange} name="change-testing" value={3} />
      ));

      const slider = screen.getByRole('slider');
      focus(slider);
      fireEvent.change(slider, { target: { value: 4 } });

      expect(handleValueChange.mock.calls.length).toBe(1);
      const target = handleValueChange.mock.results[0]?.value;
      expect(target).toEqual({
        name: 'change-testing',
        value: 4,
      });
    });

    it('should not rely on the global event when cloning change events', () => {
      const hadGlobalEvent = Object.prototype.hasOwnProperty.call(globalThis, 'event');
      const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'event');
      const globalEventConstructor = class {
        constructor() {
          throw new Error('Should not construct global event');
        }
      };
      const fakeGlobalEvent = {
        type: 'click',
        constructor: globalEventConstructor,
      };

      Object.defineProperty(globalThis, 'event', {
        configurable: true,
        get() {
          return fakeGlobalEvent;
        },
        set() {
          // Ignore assignments from the event system to ensure we never use it.
        },
      });

      try {
        const handleValueChange = vi.fn();

        render(() => (
          <TestSlider onValueChange={handleValueChange} name="change-testing" value={3} />
        ));

        const slider = screen.getByRole('slider');
        focus(slider);

        expect(() => {
          fireEvent.change(slider, { target: { value: 4 } });
        }).not.toThrow();

        expect(handleValueChange).toHaveBeenCalledTimes(1);
      } finally {
        if (hadGlobalEvent && previousDescriptor) {
          Object.defineProperty(globalThis, 'event', previousDescriptor);
        } else {
          delete (globalThis as any).event;
        }
      }
    });

    it('should handle keyboard changes inside a shadow root', () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadowRoot.appendChild(container);

      try {
        const handleValueChange = vi.fn();
        const { unmount } = render(
          () => <TestSlider onValueChange={handleValueChange} name="shadow" defaultValue={3} />,
          { container },
        );

        const slider = container.querySelector('input')!;
        focus(slider);
        fireEvent.keyDown(slider, { key: ARROW_RIGHT });

        expect(handleValueChange).toHaveBeenCalledTimes(1);
        expect(handleValueChange.mock.calls[0][0]).toBe(4);
        unmount();
      } finally {
        host.remove();
      }
    });
  });

  describe('keyboard interactions', () => {
    const keyboardCases: Array<{
      direction: TextDirection;
      orientation: Orientation;
      decrementKeys: string[];
      incrementKeys: string[];
    }> = [
      {
        direction: 'ltr',
        orientation: 'horizontal',
        decrementKeys: [ARROW_LEFT, ARROW_DOWN],
        incrementKeys: [ARROW_RIGHT, ARROW_UP],
      },
      {
        direction: 'ltr',
        orientation: 'vertical',
        decrementKeys: [ARROW_LEFT, ARROW_DOWN],
        incrementKeys: [ARROW_RIGHT, ARROW_UP],
      },
      {
        direction: 'rtl',
        orientation: 'horizontal',
        decrementKeys: [ARROW_RIGHT, ARROW_DOWN],
        incrementKeys: [ARROW_LEFT, ARROW_UP],
      },
      {
        direction: 'rtl',
        orientation: 'vertical',
        decrementKeys: [ARROW_RIGHT, ARROW_DOWN],
        incrementKeys: [ARROW_LEFT, ARROW_UP],
      },
    ];

    function renderSlider(
      direction: TextDirection,
      props: SliderRoot.Props,
      thumbs: 'single' | 'range' = 'single',
    ) {
      const handleValueChange = vi.fn();
      render(() => (
        <div dir={direction}>
          <DirectionProvider direction={direction}>
            <Slider.Root {...props} onValueChange={handleValueChange}>
              <Slider.Control>
                <Slider.Track>
                  <Slider.Indicator />
                  {thumbs === 'single' ? (
                    <Slider.Thumb data-testid="thumb" />
                  ) : (
                    <>
                      <Slider.Thumb index={0} />
                      <Slider.Thumb index={1} />
                    </>
                  )}
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
          </DirectionProvider>
        </div>
      ));
      return handleValueChange;
    }

    describe.each(keyboardCases)(
      '$direction, orientation: $orientation',
      ({ direction, orientation, decrementKeys, incrementKeys }) => {
        describe.each(decrementKeys.map((key) => ({ key })))('key: $key', ({ key }) => {
          it('decrements the value', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(direction, { orientation, defaultValue: 20 });
            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard(`[${key}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(19);
            expect(input).toHaveAttribute('aria-valuenow', '19');
          });

          it('decrements the value by largeStep when Shift is pressed', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(direction, { orientation, defaultValue: 20 });
            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            await user.keyboard(`{Shift>}[${key}]{/Shift}`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(10);
            expect(input).toHaveAttribute('aria-valuenow', '10');
          });

          it('stops at min when decrementing while Shift is pressed', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(direction, { orientation, defaultValue: 8 });
            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            await user.keyboard(`{Shift>}[${key}]{/Shift}`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(0);
            expect(input).toHaveAttribute('aria-valuenow', '0');
          });
        });

        describe.each(incrementKeys.map((key) => ({ key })))('key: $key', ({ key }) => {
          it('increments the value', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(direction, { orientation, defaultValue: 20 });
            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard(`[${key}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(21);
            expect(input).toHaveAttribute('aria-valuenow', '21');
          });

          it('rounds fractional values to the configured step', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(direction, {
              orientation,
              defaultValue: 0.35,
              min: 0.25,
              max: 1,
              step: 0.1,
            });
            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            await user.keyboard(`[${key}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(0.45);
            expect(input).toHaveAttribute('aria-valuenow', '0.45');
          });

          it('increments the value by largeStep when Shift is pressed', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(direction, { orientation, defaultValue: 20 });
            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            await user.keyboard(`{Shift>}[${key}]{/Shift}`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(30);
            expect(input).toHaveAttribute('aria-valuenow', '30');
          });

          it('stops at max when incrementing while Shift is pressed', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(direction, { orientation, defaultValue: 92 });
            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            await user.keyboard(`{Shift>}[${key}]{/Shift}`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(100);
            expect(input).toHaveAttribute('aria-valuenow', '100');
          });
        });

        describe('key: End', () => {
          it('sets value to max in a single value slider', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(direction, {
              orientation,
              defaultValue: 20,
              max: 77,
            });
            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            await user.keyboard(`[${END}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(77);
            expect(input).toHaveAttribute('aria-valuenow', '77');
          });

          it('sets value to the maximum possible value in a range slider', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(
              direction,
              { defaultValue: [20, 50], max: 77 },
              'range',
            );
            const [input1, input2] = screen.getAllByRole('slider');

            await user.keyboard('[Tab]');
            expect(input1).toHaveFocus();
            await user.keyboard(`[${END}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual([50, 50]);
            expect(input1).toHaveAttribute('aria-valuenow', '50');

            await user.keyboard('[Tab]');
            expect(input2).toHaveFocus();
            await user.keyboard(`[${END}]`);
            expect(handleValueChange.mock.calls.length).toBe(2);
            expect(handleValueChange.mock.calls[1][0]).toEqual([50, 77]);
            expect(input2).toHaveAttribute('aria-valuenow', '77');
          });
        });

        describe('key: Home', () => {
          it('sets value to min in a single value slider', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(direction, {
              orientation,
              defaultValue: 55,
              min: 17,
            });
            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            await user.keyboard(`[${HOME}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(17);
            expect(input).toHaveAttribute('aria-valuenow', '17');
          });

          it('sets value to the minimum possible value in a range slider', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(
              direction,
              { defaultValue: [20, 50], min: 7 },
              'range',
            );
            const [input1, input2] = screen.getAllByRole('slider');

            await user.keyboard('[Tab]');
            expect(input1).toHaveFocus();
            await user.keyboard(`[${HOME}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual([7, 50]);
            expect(input1).toHaveAttribute('aria-valuenow', '7');

            await user.keyboard('[Tab]');
            expect(input2).toHaveFocus();
            await user.keyboard(`[${HOME}]`);
            expect(handleValueChange.mock.calls.length).toBe(2);
            expect(handleValueChange.mock.calls[1][0]).toEqual([7, 7]);
            expect(input2).toHaveAttribute('aria-valuenow', '7');
          });
        });

        describe('key: PageUp', () => {
          it('increments the value by largeStep', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(direction, {
              orientation,
              defaultValue: 20,
              largeStep: 5,
            });
            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            await user.keyboard('[PageUp]');
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(25);
            expect(input).toHaveAttribute('aria-valuenow', '25');
          });

          it('preserves largeStep increments when step uses a different grid', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(direction, {
              orientation,
              defaultValue: 20,
              step: 2,
              largeStep: 5,
            });
            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            await user.keyboard('[PageUp]');
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(25);
            expect(input).toHaveAttribute('aria-valuenow', '25');
          });

          it('does not exceed max', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(direction, {
              orientation,
              defaultValue: 78,
              largeStep: 3,
              max: 80,
            });
            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            await user.keyboard('[PageUp]');
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(80);
            expect(input).toHaveAttribute('aria-valuenow', '80');
          });
        });

        describe('key: PageDown', () => {
          it('decrements the value by largeStep', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(direction, {
              orientation,
              defaultValue: 20,
              largeStep: 5,
            });
            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            await user.keyboard('[PageDown]');
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(15);
            expect(input).toHaveAttribute('aria-valuenow', '15');
          });

          it('does not go below min', async () => {
            const user = userEvent.setup();
            const handleValueChange = renderSlider(direction, {
              orientation,
              defaultValue: 22,
              largeStep: 3,
              min: 20,
            });
            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            await user.keyboard('[PageDown]');
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(20);
            expect(input).toHaveAttribute('aria-valuenow', '20');
          });
        });
      },
    );

    it('keypresses should correct invalid values', async () => {
      const user = userEvent.setup();
      function App() {
        const [val, setVal] = createSignal(5.4698);
        return (
          <Slider.Root value={val()} onValueChange={setVal} min={0} max={10} step={1}>
            <Slider.Control>
              <Slider.Track>
                <Slider.Indicator />
                <Slider.Thumb data-testid="thumb" />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>
        );
      }
      render(() => <App />);

      const input = screen.getByRole('slider');

      expect(input).toHaveAttribute('aria-valuenow', '5.4698');
      await user.keyboard('[Tab]');
      expect(input).toHaveFocus();
      await user.keyboard(`[${ARROW_RIGHT}]`);
      expect(input).toHaveAttribute('aria-valuenow', '6');
    });
  });

  describe('prop: format', () => {
    function formatValue(v: number) {
      return new Intl.NumberFormat(undefined, USD_NUMBER_FORMAT).format(v);
    }

    it('formats the value', () => {
      render(() => <TestSlider defaultValue={50} format={USD_NUMBER_FORMAT} />);

      expect(screen.getByTestId('value').textContent).toBe(formatValue(50));
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', formatValue(50));
    });

    it('recomputes the thumb aria text when the format option changes', () => {
      const [format, setFormat] = createSignal<Intl.NumberFormatOptions | undefined>(undefined);
      render(() => <TestSlider defaultValue={50} format={format()} />);

      const slider = screen.getByRole('slider');
      expect(slider).not.toHaveAttribute('aria-valuetext');

      setFormat(USD_NUMBER_FORMAT);
      flush();

      expect(slider).toHaveAttribute('aria-valuetext', formatValue(50));
    });

    it('formats range values', () => {
      render(() => <TestRangeSlider defaultValue={[50, 75]} format={USD_NUMBER_FORMAT} />);

      expect(screen.getByTestId('value').textContent).toBe(
        `${formatValue(50)} – ${formatValue(75)}`,
      );
      const [slider1, slider2] = screen.getAllByRole('slider');
      expect(slider1).toHaveAttribute('aria-valuetext', `${formatValue(50)} start range`);
      expect(slider2).toHaveAttribute('aria-valuetext', `${formatValue(75)} end range`);
    });
  });

  describe('prop: locale', () => {
    const format: Intl.NumberFormatOptions = {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    };

    it('sets the locale when formatting a single value', () => {
      const expectedValue = new Intl.NumberFormat('de-DE', format).format(70.51);
      render(() => <TestSlider value={70.51} format={format} step={0.01} locale="de-DE" />);
      expect(screen.getByTestId('value')).toHaveTextContent(expectedValue);
    });

    it('sets the locale when formatting a range value', () => {
      const expectedValue = `${new Intl.NumberFormat('de-DE', format).format(24.8)} – ${new Intl.NumberFormat('de-DE', format).format(70.51)}`;
      render(() => (
        <TestRangeSlider value={[24.8, 70.51]} format={format} step={0.01} locale="de-DE" />
      ));
      expect(screen.getByTestId('value')).toHaveTextContent(expectedValue);
    });
  });

  describe('Form', () => {
    it('clears external errors on change', async () => {
      const user = userEvent.setup();
      render(() => (
        <Form errors={{ test: 'test' }}>
          <Field.Root name="test" data-testid="field">
            <TestSlider data-testid="slider" defaultValue={50} />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));

      const slider = screen.getByRole('slider');

      expect(slider).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('error')).toHaveTextContent('test');

      await user.keyboard('[Tab]');
      expect(slider).toHaveFocus();

      await user.keyboard(`{Shift>}{ArrowRight}`);

      expect(slider).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
    });

    describe('form submission', () => {
      it('submits clamped range slider values to onFormSubmit', () => {
        const onFormSubmit = vi.fn();
        render(() => (
          <Form onFormSubmit={onFormSubmit}>
            <Field.Root name="range">
              <TestRangeSlider defaultValue={[-10, 120]} />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        fireEvent.click(screen.getByText('submit'));
        expect(onFormSubmit).toHaveBeenCalledTimes(1);
        expect(onFormSubmit.mock.calls[0][0]).toEqual({ range: [0, 100] });
      });

      it('submits a clamped single-thumb slider value to onFormSubmit', () => {
        const onFormSubmit = vi.fn();
        render(() => (
          <Form onFormSubmit={onFormSubmit}>
            <Field.Root name="single">
              <TestSlider defaultValue={150} />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        fireEvent.click(screen.getByText('submit'));
        expect(onFormSubmit).toHaveBeenCalledTimes(1);
        expect(onFormSubmit.mock.calls[0][0]).toEqual({ single: 100 });
      });

      it('renders the `form` attribute on the hidden inputs', () => {
        render(() => <TestRangeSlider defaultValue={[10, 20]} form="external" name="range" />);
        screen.getAllByRole('slider').forEach((input) => {
          expect(input).toHaveAttribute('form', 'external');
          expect(input).toHaveAttribute('name', 'range');
        });
      });

      // Skipped: native FormData submission of the range inputs is skipped in jsdom upstream too.
    });
  });

  describe('Field', () => {
    it('should receive disabled prop from Field.Root', () => {
      render(() => (
        <Field.Root disabled>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      ));

      expect(screen.getByTestId('root')).toHaveAttribute('data-disabled', '');
    });

    it('should receive name prop from Field.Root', () => {
      render(() => (
        <Field.Root name="field-slider">
          <Slider.Root>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      ));

      expect(screen.getByRole('slider')).toHaveAttribute('name', 'field-slider');
    });

    it('[data-touched]', () => {
      render(() => (
        <Field.Root>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      ));

      const input = screen.getByRole('slider');

      fireEvent.focus(input);
      fireEvent.blur(input);

      expect(screen.getByTestId('root')).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', () => {
      render(() => (
        <Field.Root>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      ));

      const root = screen.getByTestId('root');
      const input = screen.getByRole('slider');

      expect(root).not.toHaveAttribute('data-dirty');

      fireEvent.change(input, { target: { value: '5' } });

      expect(root).toHaveAttribute('data-dirty', '');
    });

    it('[data-dirty] with a range value', () => {
      render(() => (
        <Field.Root>
          <Slider.Root data-testid="root" defaultValue={[20, 40]}>
            <Slider.Control>
              <Slider.Thumb index={0} />
              <Slider.Thumb index={1} />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      ));

      const root = screen.getByTestId('root');
      const [, input2] = screen.getAllByRole('slider');

      expect(root).not.toHaveAttribute('data-dirty');

      fireEvent.change(input2, { target: { value: '50' } });
      expect(root).toHaveAttribute('data-dirty', '');

      fireEvent.change(input2, { target: { value: '40' } });
      expect(root).not.toHaveAttribute('data-dirty');
    });

    it('[data-focused]', () => {
      render(() => (
        <Field.Root>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      ));

      const root = screen.getByTestId('root');
      const input = screen.getByRole('slider');

      expect(root).not.toHaveAttribute('data-focused');

      fireEvent.focus(input);
      expect(root).toHaveAttribute('data-focused', '');

      fireEvent.blur(input);
      expect(root).not.toHaveAttribute('data-focused');
    });

    describe('[data-focused] without a blur event', () => {
      function renderThumbs(rangeValue = false) {
        const [firstMounted, setFirstMounted] = createSignal(true);
        const [firstDisabled, setFirstDisabled] = createSignal(false);
        render(() => (
          <Field.Root data-testid="root">
            <Slider.Root defaultValue={rangeValue ? [20, 40] : 20}>
              <Slider.Control>
                <Show when={firstMounted()}>
                  <Slider.Thumb disabled={firstDisabled()} />
                </Show>
                <Show when={rangeValue}>
                  <Slider.Thumb />
                </Show>
              </Slider.Control>
            </Slider.Root>
          </Field.Root>
        ));
        return {
          setFirstMounted: (value: boolean) => {
            setFirstMounted(value);
            flush();
          },
          setFirstDisabled: (value: boolean) => {
            setFirstDisabled(value);
            flush();
          },
        };
      }

      it('is removed when the focused thumb becomes disabled', () => {
        const { setFirstDisabled } = renderThumbs();
        focus(screen.getByRole('slider'));
        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        setFirstDisabled(true);
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused thumb unmounts', () => {
        const { setFirstMounted } = renderThumbs();
        focus(screen.getByRole('slider'));
        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        setFirstMounted(false);
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      });

      // A thumb's `blur` deliberately does nothing when focus moves to a sibling thumb, so a thumb
      // that once held focus must not assume it still owns the field's focused state.
      it('is kept when focus moved to a sibling before the first thumb is disabled', async () => {
        const { setFirstDisabled } = renderThumbs(true);
        // Thumbs without an explicit index resolve it once registered.
        await flushMicrotasks();

        const [first, second] = screen.getAllByRole('slider');
        focus(first);
        focus(second);

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        setFirstDisabled(true);
        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
      });

      it('is kept when a sibling thumb is disabled or unmounted', async () => {
        const { setFirstDisabled, setFirstMounted } = renderThumbs(true);
        await flushMicrotasks();

        focus(screen.getAllByRole('slider')[1]);
        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        setFirstDisabled(true);
        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        setFirstMounted(false);
        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
      });
    });

    describe('prop: validate', () => {
      it('validationMode=onSubmit', () => {
        render(() => (
          <Form>
            <Field.Root validate={(val) => ((val as number) > 90 ? 'error' : null)}>
              <Slider.Root defaultValue={99} data-testid="root">
                <Slider.Control>
                  <Slider.Thumb data-testid="thumb" />
                </Slider.Control>
              </Slider.Root>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        const root = screen.getByTestId('root');
        const thumb = screen.getByTestId('thumb');
        const input = screen.getByRole('slider');
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        fireEvent.change(input, { target: { value: '98' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        fireEvent.click(screen.getByText('submit'));
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('error')).not.toBe(null);
        expect(root).toHaveAttribute('data-invalid');
        expect(thumb).toHaveAttribute('data-invalid');

        fireEvent.change(input, { target: { value: '10' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);
        expect(root).not.toHaveAttribute('data-invalid');
        expect(root).toHaveAttribute('data-valid');
        expect(thumb).toHaveAttribute('data-valid');

        fireEvent.change(input, { target: { value: '94' } });
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('error')).not.toBe(null);

        fireEvent.change(input, { target: { value: '12' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);
      });

      it('moves focus to the range input on invalid submit', () => {
        render(() => (
          <Form>
            <Field.Root validate={() => 'error'}>
              <Slider.Root defaultValue={50}>
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        const input = screen.getByRole('slider');
        expect(input).not.toHaveFocus();

        fireEvent.click(screen.getByText('submit'));

        // Slider registers the range input as the field control, so invalid
        // submits focus the native input instead of the non-focusable wrapper.
        expect(input).toHaveFocus();
      });

      it('validationMode=onBlur', async () => {
        render(() => (
          <Field.Root
            validationMode="onBlur"
            validate={(value) => ((value as number) > 1 ? 'error' : null)}
          >
            <Slider.Root>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        ));

        const input = screen.getByRole('slider');
        expect(input).not.toHaveAttribute('aria-invalid');

        fireEvent.change(input, { target: { value: '2' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        fireEvent.blur(input);
        await flushMicrotasks();
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });

      it('validationMode=onBlur preserves single-element array values', async () => {
        const validate = vi.fn<(value: unknown) => null>(() => null);

        render(() => (
          <Field.Root validationMode="onBlur" validate={validate}>
            <Slider.Root defaultValue={[25]}>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>
        ));

        fireEvent.blur(screen.getByRole('slider'));
        await flushMicrotasks();

        expect(validate.mock.calls[0][0]).toEqual([25]);
      });

      it('validationMode=onChange', async () => {
        render(() => (
          <Field.Root
            validationMode="onChange"
            validate={(value) => (Number(value) === 1 ? 'error' : null)}
          >
            <Slider.Root defaultValue={0}>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>
        ));

        const input = screen.getByRole('slider');
        expect(input).not.toHaveAttribute('aria-invalid');

        fireEvent.change(input, { target: { value: '1' } });
        await flushMicrotasks();
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });

      it('validates once when changed by the user', async () => {
        const user = userEvent.setup();
        const validate = vi.fn();

        render(() => (
          <Field.Root validationMode="onChange" validate={validate}>
            <Slider.Root defaultValue={0}>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>
        ));

        await user.keyboard('[Tab]');
        expect(screen.getByRole('slider')).toHaveFocus();

        await user.keyboard(`[${ARROW_RIGHT}]`);
        await flushMicrotasks();

        expect(validate).toHaveBeenCalledTimes(1);
        expect(validate.mock.lastCall?.[0]).toBe(1);
      });

      it('validates once with an array value for range sliders when changed by the user', async () => {
        const user = userEvent.setup();
        const validate = vi.fn();

        render(() => (
          <Field.Root validationMode="onChange" validate={validate}>
            <Slider.Root defaultValue={[0, 5]}>
              <Slider.Control>
                <Slider.Thumb index={0} />
                <Slider.Thumb index={1} />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>
        ));

        await user.keyboard('[Tab]');
        expect(screen.getAllByRole('slider')[0]).toHaveFocus();

        await user.keyboard(`[${ARROW_RIGHT}]`);
        await flushMicrotasks();

        expect(validate).toHaveBeenCalledTimes(1);
        expect(validate.mock.lastCall?.[0]).toEqual([1, 5]);
      });

      it('revalidates when the controlled value changes externally', async () => {
        const validateSpy = vi.fn((value: unknown) => (Number(value) === 5 ? 'error' : null));

        function App() {
          const [value, setValue] = createSignal(0);

          return (
            <>
              <Field.Root validationMode="onChange" validate={validateSpy} name="volume">
                <Slider.Root value={value()} onValueChange={(next) => setValue(next as number)}>
                  <Slider.Control>
                    <Slider.Thumb />
                  </Slider.Control>
                </Slider.Root>
              </Field.Root>
              <button type="button" onClick={() => setValue(5)}>
                Set externally
              </button>
            </>
          );
        }

        render(() => <App />);

        const slider = screen.getByRole('slider');
        const toggle = screen.getByText('Set externally');

        expect(slider).not.toHaveAttribute('aria-invalid');
        const initialCallCount = validateSpy.mock.calls.length;

        fireEvent.click(toggle);
        await flushMicrotasks();

        expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
        expect(validateSpy.mock.lastCall?.[0]).toBe(5);
        expect(slider).toHaveAttribute('aria-invalid', 'true');
      });

      it('receives an array value for range sliders', () => {
        const validateSpy = vi.fn();
        const onSubmit = vi.fn((event: Event) => event.preventDefault());
        render(() => (
          <Form onSubmit={onSubmit}>
            <Field.Root validate={validateSpy}>
              <Slider.Root defaultValue={[5, 12]}>
                <Slider.Control>
                  <Slider.Thumb index={0} />
                  <Slider.Thumb index={1} />
                </Slider.Control>
              </Slider.Root>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        fireEvent.click(screen.getByText('submit'));
        expect(validateSpy.mock.calls.length).toBe(1);
        expect(validateSpy.mock.calls[0][0]).toEqual([5, 12]);
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      it('does not call validate on change when validationMode is omitted', () => {
        const validateSpy = vi.fn();
        render(() => (
          <Form>
            <Field.Root validate={validateSpy}>
              <Slider.Root defaultValue={50}>
                <Slider.Control data-testid="control">
                  <Slider.Track>
                    <Slider.Thumb aria-label="Value" />
                  </Slider.Track>
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        expect(validateSpy.mock.calls.length).toBe(0);

        const sliderControl = screen.getByTestId('control');
        mockControlRect(sliderControl);
        fireEvent.pointerDown(sliderControl, { buttons: 1, clientX: 10 });
        fireEvent.pointerUp(sliderControl, { buttons: 1, clientX: 30 });

        expect(validateSpy.mock.calls.length).toBe(0);
      });
    });

    it('Field.Label', () => {
      render(() => (
        <Field.Root>
          <Slider.Root>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
          <Field.Label data-testid="label" />
        </Field.Root>
      ));

      expect(screen.getByRole('slider')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('Slider.Label', () => {
      render(() => (
        <Slider.Root>
          <Slider.Label data-testid="label" />
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));

      expect(screen.getByRole('slider')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('Slider.Label focuses slider on click', async () => {
      const user = userEvent.setup();
      render(() => (
        <Slider.Root>
          <Slider.Label data-testid="label">Volume</Slider.Label>
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));

      await user.click(screen.getByTestId('label'));

      expect(screen.getByRole('slider')).toHaveFocus();
    });

    it('Slider.Label does not focus a thumb on click for range sliders', async () => {
      const user = userEvent.setup();
      render(() => (
        <Slider.Root defaultValue={[20, 80]}>
          <Slider.Label data-testid="label">Price range</Slider.Label>
          <Slider.Control>
            <Slider.Track>
              <Slider.Thumb aria-label="Minimum price" />
              <Slider.Thumb aria-label="Maximum price" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));

      await user.click(screen.getByTestId('label'));

      const [minimumSlider, maximumSlider] = screen.getAllByRole('slider');
      expect(minimumSlider).not.toHaveFocus();
      expect(maximumSlider).not.toHaveFocus();
    });

    it('does not set aria-labelledby when getAriaLabel is provided', () => {
      render(() => (
        <Slider.Root defaultValue={[20, 80]}>
          <Slider.Label>Price range</Slider.Label>
          <Slider.Control>
            <Slider.Track>
              <Slider.Thumb getAriaLabel={() => 'Minimum price'} />
              <Slider.Thumb getAriaLabel={() => 'Maximum price'} />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));

      const [minimumSlider, maximumSlider] = screen.getAllByRole('slider');
      expect(minimumSlider).toHaveAttribute('aria-label', 'Minimum price');
      expect(maximumSlider).toHaveAttribute('aria-label', 'Maximum price');
      expect(minimumSlider).not.toHaveAttribute('aria-labelledby');
      expect(maximumSlider).not.toHaveAttribute('aria-labelledby');
    });

    it('does not set fallback aria-labelledby when no label is rendered', () => {
      render(() => (
        <Slider.Root>
          <Slider.Control>
            <Slider.Thumb aria-label="Volume" />
          </Slider.Control>
        </Slider.Root>
      ));

      expect(screen.getByRole('slider')).not.toHaveAttribute('aria-labelledby');
    });

    it('updates Slider.Label linkage when root id changes', async () => {
      const [id, setId] = createSignal('first');
      render(() => (
        <Slider.Root id={id()} defaultValue={30} data-testid="root">
          <Slider.Label data-testid="label">Volume</Slider.Label>
          <Slider.Control>
            <Slider.Track>
              <Slider.Thumb />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));

      setId('second');
      flush();

      const slider = screen.getByRole('slider');
      await waitFor(() => {
        expect(slider).toHaveAttribute('aria-labelledby', 'second-label');
      });

      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute('id', 'second');
      expect(screen.getByTestId('label')).toHaveAttribute('id', 'second-label');
      expect(root).toHaveAttribute('aria-labelledby', 'second-label');
    });

    it('Field.Description', () => {
      render(() => (
        <Field.Root>
          <Slider.Root data-testid="slider" aria-describedby="external-description">
            <Slider.Control />
          </Slider.Root>
          <Field.Description data-testid="description" />
        </Field.Root>
      ));

      expect(screen.getByTestId('slider')).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });
});
