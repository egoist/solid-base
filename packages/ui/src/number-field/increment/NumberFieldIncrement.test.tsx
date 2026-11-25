import { flush } from 'solid-js';
import { fireEvent as baseFireEvent, render, screen } from '@solidjs/testing-library';
import { NumberField } from '..';
import { CHANGE_VALUE_TICK_DELAY, START_AUTO_CHANGE_DELAY } from '../utils/constants';

// Mirrors the touch settle delay in `usePressAndHold`.
const TOUCH_TIMEOUT = 50;

// Synchronous events are flushed right away, like `fireEvent` from `@mui/internal-test-utils`.
const fireEvent = new Proxy(baseFireEvent, {
  apply(target, thisArg, args: Parameters<typeof baseFireEvent>) {
    const result = Reflect.apply(target, thisArg, args);
    flush();
    return result;
  },
  get(target, key, receiver) {
    const value = Reflect.get(target, key, receiver);
    if (typeof value !== 'function') {
      return value;
    }
    return (...args: unknown[]) => {
      const result = value(...args);
      flush();
      return result;
    };
  },
}) as typeof baseFireEvent;

const clock = {
  withFakeTimers() {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });
  },
  tick(ms: number) {
    vi.advanceTimersByTime(ms);
    flush();
  },
};

describe('<NumberField.Increment />', () => {
  it('renders a button and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <NumberField.Root>
        <NumberField.Increment
          data-testid="part"
          class={(state) => (state.disabled ? 'disabled' : 'enabled')}
          style={{ color: 'red' }}
          ref={(element) => {
            ref = element;
          }}
        />
        <NumberField.Increment data-testid="rendered" render="span" nativeButton={false} />
      </NumberField.Root>
    ));
    const element = screen.getByTestId('part');
    expect(element.tagName).toBe('BUTTON');
    expect(element).toHaveClass('enabled');
    expect(element).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(element);
    expect(screen.getByTestId('rendered').tagName).toBe('SPAN');
  });

  describe('press and hold', () => {
    clock.withFakeTimers();

    function TestNumberField() {
      return (
        <NumberField.Root defaultValue={0}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    it('stops the hold on release when an ancestor stops pointerup propagation', async () => {
      render(() => (
        <div onPointerUp={(event) => event.stopPropagation()}>
          <NumberField.Root defaultValue={0}>
            <NumberField.Increment />
            <NumberField.Input />
          </NumberField.Root>
        </div>
      ));

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button, { pointerType: 'mouse' });

      expect(input).toHaveValue('1');

      fireEvent.pointerUp(button, { pointerType: 'mouse' });
      fireEvent.mouseUp(button);

      clock.tick(START_AUTO_CHANGE_DELAY);
      clock.tick(CHANGE_VALUE_TICK_DELAY);
      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('1');
    });

    it('starts the hold once a touch press settles and ignores the compatibility click', async () => {
      render(() => <TestNumberField />);

      const input = screen.getByRole('textbox');
      const increment = screen.getByRole('button', { name: 'Increase' });

      fireEvent.touchStart(increment);
      fireEvent.pointerDown(increment, { pointerType: 'touch' });

      expect(input).toHaveValue('0');

      clock.tick(TOUCH_TIMEOUT);

      expect(input).toHaveValue('1');

      clock.tick(START_AUTO_CHANGE_DELAY);
      clock.tick(CHANGE_VALUE_TICK_DELAY);
      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('3');

      fireEvent.pointerUp(increment, { pointerType: 'touch' });
      fireEvent.touchEnd(increment);
      fireEvent.click(increment, { detail: 1 });

      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('3');
    });

    it('does not start the hold when the touch moves like a scroll', async () => {
      render(() => <TestNumberField />);

      const input = screen.getByRole('textbox');
      const increment = screen.getByRole('button', { name: 'Increase' });

      fireEvent.touchStart(increment);
      fireEvent.pointerDown(increment, { pointerType: 'touch', clientX: 0, clientY: 0 });
      fireEvent.pointerMove(increment, { pointerType: 'touch', clientX: 0, clientY: 20 });

      clock.tick(TOUCH_TIMEOUT);
      clock.tick(START_AUTO_CHANGE_DELAY);
      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('0');
    });

    it('treats a touch press with several small moves as a tap', async () => {
      render(() => <TestNumberField />);

      const input = screen.getByRole('textbox');
      const increment = screen.getByRole('button', { name: 'Increase' });

      fireEvent.touchStart(increment);
      fireEvent.pointerDown(increment, { pointerType: 'touch', clientX: 0, clientY: 0 });
      fireEvent.pointerMove(increment, { pointerType: 'touch', clientX: 1, clientY: 0 });
      fireEvent.pointerMove(increment, { pointerType: 'touch', clientX: 2, clientY: 0 });
      fireEvent.pointerMove(increment, { pointerType: 'touch', clientX: 3, clientY: 0 });

      clock.tick(TOUCH_TIMEOUT);
      clock.tick(START_AUTO_CHANGE_DELAY);

      expect(input).toHaveValue('0');

      fireEvent.pointerUp(increment, { pointerType: 'touch' });
      fireEvent.touchEnd(increment);
      fireEvent.click(increment, { detail: 1 });

      expect(input).toHaveValue('1');
    });
  });

  it('places the caret at the end of the input when a mouse press focuses it', async () => {
    render(() => (
      <NumberField.Root defaultValue={100}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>
    ));

    const button = screen.getByRole('button');
    const input = screen.getByRole<HTMLInputElement>('textbox');

    fireEvent.pointerDown(button, { pointerType: 'mouse', button: 0 });

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(input.value.length);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  describe('prop: snapOnStep', () => {
    it('should increment by exact step without rounding when snapOnStep is false', async () => {
      render(() => (
        <NumberField.Root defaultValue={2.7} step={2} snapOnStep={false}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue((4.7).toLocaleString());
    });

    it('should snap on increment when snapOnStep is true', async () => {
      render(() => (
        <NumberField.Root defaultValue={1.3} snapOnStep>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('2');

      fireEvent.input(screen.getByRole('textbox'), { target: { value: '1.9' } });
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('2');

      fireEvent.input(screen.getByRole('textbox'), { target: { value: '-0.2' } });
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('0');
    });

    it('should increment with respect to the min value', async () => {
      render(() => (
        <NumberField.Root defaultValue={1} min={1} step={2} snapOnStep>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.click(button);
      expect(input).toHaveValue('3');

      fireEvent.click(button);
      expect(input).toHaveValue('5');

      fireEvent.input(input, { target: { value: '1.112' } });
      fireEvent.click(button);
      expect(input).toHaveValue('3');

      fireEvent.input(input, { target: { value: '0.999' } });
      fireEvent.click(button);
      expect(input).toHaveValue('1');
    });
  });
});
