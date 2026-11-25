import { flush } from 'solid-js';
import { fireEvent as baseFireEvent, render, screen } from '@solidjs/testing-library';
import { Slider } from '..';
import { getHorizontalSliderRect } from '../utils/test-utils';

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

describe('<Slider.Control />', () => {
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

  it('renders a div and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Slider.Root defaultValue={50}>
        <Slider.Control
          data-testid="control"
          class={(state) => `orientation-${state.orientation}`}
          style={{ color: 'red' }}
          ref={(element) => {
            ref = element;
          }}
        />
        <Slider.Control render="section" data-testid="section" />
      </Slider.Root>
    ));
    const control = screen.getByTestId('control');
    expect(control.tagName).toBe('DIV');
    expect(control).toHaveClass('orientation-horizontal');
    expect(control.style.color).toBe('red');
    expect(ref).toBe(control);
    expect(screen.getByTestId('section').tagName).toBe('SECTION');
  });

  it('does not apply a tabindex by default', () => {
    render(() => (
      <Slider.Root defaultValue={50}>
        <Slider.Control data-testid="control">
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    ));

    expect(screen.getByTestId('control')).not.toHaveAttribute('tabindex');
  });

  it('throws a descriptive error when rendered outside <Slider.Root>', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(() => <Slider.Control />)).toThrow(
        'Base UI: SliderRootContext is missing. Slider parts must be placed within <Slider.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('moves the first of several thumbs stacked at the maximum', () => {
    const onValueChange = vi.fn();

    render(() => (
      <Slider.Root defaultValue={[100, 100, 100]} onValueChange={onValueChange}>
        <Slider.Control data-testid="control">
          <Slider.Thumb index={0} data-testid="thumb-0" />
          <Slider.Thumb index={1} data-testid="thumb-1" />
          <Slider.Thumb index={2} data-testid="thumb-2" />
        </Slider.Control>
      </Slider.Root>
    ));

    const control = screen.getByTestId('control');
    const lastThumb = screen.getByTestId('thumb-2');
    vi.spyOn(control, 'getBoundingClientRect').mockImplementation(() => getHorizontalSliderRect());
    vi.spyOn(lastThumb, 'getBoundingClientRect').mockReturnValue(new DOMRect(90, 0, 20, 10));

    fireEvent.pointerDown(lastThumb, { buttons: 1, clientX: 100 });
    fireEvent.pointerMove(document.body, { buttons: 1, clientX: 50 });

    expect(onValueChange).toHaveBeenLastCalledWith(
      [50, 100, 100],
      expect.objectContaining({ activeThumbIndex: 0, reason: 'drag' }),
    );
  });

  it('clears the grabbed offset when swapping to a thumb that is not rendered', () => {
    const onValueChange = vi.fn();

    render(() => (
      <Slider.Root
        defaultValue={[20, 40]}
        thumbCollisionBehavior="swap"
        onValueChange={onValueChange}
      >
        <Slider.Control data-testid="control">
          <Slider.Thumb index={0} data-testid="thumb" />
        </Slider.Control>
      </Slider.Root>
    ));

    const control = screen.getByTestId('control');
    const thumb = screen.getByTestId('thumb');
    vi.spyOn(control, 'getBoundingClientRect').mockImplementation(() => getHorizontalSliderRect());
    vi.spyOn(thumb, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 0, 20, 10));

    fireEvent.pointerDown(thumb, { buttons: 1, clientX: 30 });
    fireEvent.pointerMove(document.body, { buttons: 1, clientX: 70 });
    fireEvent.pointerMove(document.body, { buttons: 1, clientX: 80 });

    expect(onValueChange).toHaveBeenLastCalledWith(
      [40, 80],
      expect.objectContaining({ activeThumbIndex: 1, reason: 'drag' }),
    );
  });

  it('ignores a drag when collision behavior cannot satisfy the minimum distance', () => {
    const onValueChange = vi.fn();

    render(() => (
      <Slider.Root
        value={[20, 40]}
        thumbCollisionBehavior="none"
        minStepsBetweenValues={50}
        onValueChange={onValueChange}
      >
        <Slider.Control data-testid="control">
          <Slider.Thumb index={0} data-testid="thumb" />
          <Slider.Thumb index={1} />
        </Slider.Control>
      </Slider.Root>
    ));

    const control = screen.getByTestId('control');
    const thumb = screen.getByTestId('thumb');
    vi.spyOn(control, 'getBoundingClientRect').mockImplementation(() => getHorizontalSliderRect());
    vi.spyOn(thumb, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 0, 20, 10));

    fireEvent.pointerDown(thumb, { button: 0, buttons: 1, clientX: 20 });
    fireEvent.pointerMove(document.body, { buttons: 1, clientX: 80 });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'horizontal',
      orientation: 'horizontal' as const,
      controlRect: new DOMRect(0, 0, 100, 10),
      thumbRect: new DOMRect(40, 0, 20, 10),
      pointer: { clientX: 10, clientY: 5 },
    },
    {
      name: 'vertical',
      orientation: 'vertical' as const,
      controlRect: new DOMRect(0, 0, 10, 100),
      thumbRect: new DOMRect(0, 40, 10, 20),
      pointer: { clientX: 5, clientY: 90 },
    },
  ])(
    'accounts for the thumb size when pressing an inset $name control',
    ({ orientation, controlRect, thumbRect, pointer }) => {
      const onValueChange = vi.fn();

      render(() => (
        <Slider.Root
          defaultValue={50}
          orientation={orientation}
          thumbAlignment="edge-client-only"
          onValueChange={onValueChange}
        >
          <Slider.Control data-testid="control">
            <Slider.Thumb data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>
      ));

      const control = screen.getByTestId('control');
      vi.spyOn(control, 'getBoundingClientRect').mockReturnValue(controlRect);
      vi.spyOn(screen.getByTestId('thumb'), 'getBoundingClientRect').mockReturnValue(thumbRect);

      fireEvent.pointerDown(control, { button: 0, buttons: 1, ...pointer });

      expect(onValueChange).toHaveBeenCalledWith(
        0,
        expect.objectContaining({ activeThumbIndex: 0, reason: 'track-press' }),
      );
    },
  );

  it('preserves single-element array values on track press', () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    render(() => (
      <Slider.Root
        defaultValue={[25]}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <Slider.Control data-testid="control">
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    ));

    const control = screen.getByTestId('control');
    vi.spyOn(control, 'getBoundingClientRect').mockImplementation(() => getHorizontalSliderRect());

    fireEvent.pointerDown(control, { button: 0, buttons: 1, clientX: 50 });
    fireEvent.pointerUp(document.body, { buttons: 0, clientX: 50 });

    expect(onValueChange.mock.calls[0][0]).toEqual([50]);
    expect(onValueCommitted.mock.calls[0][0]).toEqual([50]);
  });

  it('releases pointer capture when the interaction ends', () => {
    render(() => (
      <Slider.Root defaultValue={20}>
        <Slider.Control data-testid="control">
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    ));

    const control = screen.getByTestId('control');
    vi.spyOn(control, 'getBoundingClientRect').mockImplementation(() => getHorizontalSliderRect());
    const releasePointerCapture = vi.fn();
    Object.defineProperties(control, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: () => true },
      releasePointerCapture: { configurable: true, value: releasePointerCapture },
    });

    fireEvent.pointerDown(control, {
      pointerId: 7,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: 40,
    });
    fireEvent.pointerUp(document.body, {
      pointerId: 7,
      pointerType: 'mouse',
      buttons: 0,
      clientX: 40,
    });

    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('degrades safely when a custom render function drops the control ref', () => {
    const onValueChange = vi.fn();
    const { unmount } = render(() => (
      <Slider.Root defaultValue={20} onValueChange={onValueChange}>
        <Slider.Control
          data-testid="control"
          render={(props) => {
            const { ref: _ref, ...rest } = props as typeof props & { ref?: unknown };
            return <div {...rest} />;
          }}
        >
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    ));

    fireEvent.pointerDown(screen.getByTestId('control'), {
      button: 0,
      buttons: 1,
      clientX: 80,
    });
    expect(onValueChange).not.toHaveBeenCalled();

    unmount();
  });

  // Skipped: the remaining upstream tests need real touch input and layout.
});
