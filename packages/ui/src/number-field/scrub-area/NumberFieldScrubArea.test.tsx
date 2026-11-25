import { createSignal, flush, Show } from 'solid-js';
import { fireEvent as baseFireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { NumberField } from '..';
import { platform } from '@egoist/solid-base-utils/platform';

const isWebKit = platform.engine.webkit;

// TODO (@Janpot): Contribute https://github.com/testing-library/user-event/issues/903 and
// rely on `user.pointer()` instead.
let currentPos = { clientX: 0, clientY: 0 };

function createPointerDownEvent(elm: HTMLElement) {
  const box = elm.getBoundingClientRect();
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;
  currentPos = { clientX: centerX, clientY: centerY };
  return new PointerEvent('pointerdown', {
    bubbles: true,
    ...currentPos,
  });
}

function createPointerMoveEvent({ movementX = 0, movementY = 0 }) {
  currentPos = {
    clientX: currentPos.clientX + movementX,
    clientY: currentPos.clientY + movementY,
  };
  return new PointerEvent('pointermove', {
    bubbles: true,
    ...currentPos,
    movementX,
    movementY,
  });
}

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

// Flushes synchronously after a synchronous callback, like React's `act`.
function act(fn: () => unknown): Promise<void> {
  const result = fn();
  if (result instanceof Promise) {
    return result.then(() => {
      flush();
    });
  }
  flush();
  return Promise.resolve();
}

const isJSDOM = /jsdom/.test(window.navigator.userAgent);

/**
 * Dispatches a `paste` event carrying `value` as `text/plain`.
 */
function pasteText(target: HTMLElement, value: string) {
  const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(pasteEvent, 'clipboardData', {
    value: {
      getData: (type: string) => (type === 'text/plain' ? value : ''),
    },
  });
  fireEvent(target, pasteEvent);
}

describe('<NumberField.ScrubArea />', () => {
  it('renders a span and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <NumberField.Root>
        <NumberField.ScrubArea
          data-testid="part"
          class={(state) => (state.disabled ? 'disabled' : 'enabled')}
          style={{ color: 'red' }}
          ref={(element) => {
            ref = element;
          }}
        />
        <NumberField.ScrubArea data-testid="rendered" render="div" />
      </NumberField.Root>
    ));
    const element = screen.getByTestId('part');
    expect(element.tagName).toBe('SPAN');
    expect(element).toHaveClass('enabled');
    expect(element).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(element);
    expect(screen.getByTestId('rendered').tagName).toBe('DIV');
  });

  it('has presentation role', async () => {
    render(() => (
      <NumberField.Root>
        <NumberField.ScrubArea />
      </NumberField.Root>
    ));
    expect(screen.queryByRole('presentation')).not.toBe(null);
  });

  describe('touch input', () => {
    function createTouch(target: EventTarget) {
      if (typeof Touch === 'function') {
        return new Touch({ identifier: 1, target, clientX: 0, clientY: 0 });
      }
      return { clientX: 0, clientY: 0 };
    }

    async function renderScrubArea() {
      render(() => (
        <NumberField.Root defaultValue={0}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area" />
        </NumberField.Root>
      ));
      return { scrubArea: screen.getByTestId('scrub-area') };
    }

    it('blocks scrolling for a single-touch scrub', async () => {
      const { scrubArea } = await renderScrubArea();
      const notCanceled = fireEvent.touchStart(scrubArea, {
        touches: [createTouch(scrubArea)],
      });
      expect(notCanceled).toBe(false);
    });

    it('leaves multi-touch gestures such as pinch-zoom to the browser', async () => {
      const { scrubArea } = await renderScrubArea();
      const notCanceled = fireEvent.touchStart(scrubArea, {
        touches: [createTouch(scrubArea), createTouch(scrubArea)],
      });
      expect(notCanceled).toBe(true);
    });
  });

  describe('pointerdown guards', () => {
    async function renderScrubArea(props?: NumberField.Root.Props) {
      render(() => (
        <NumberField.Root defaultValue={0} data-testid="root" {...props}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));
      return {
        scrubArea: screen.getByTestId('scrub-area'),
        root: screen.getByTestId('root'),
      };
    }

    it('ignores non-primary pointer buttons', async () => {
      const { scrubArea, root } = await renderScrubArea();

      await act(async () => {
        scrubArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 1 }));
      });

      expect(root).not.toHaveAttribute('data-scrubbing');
    });

    it('does not start scrubbing when the field is read-only', async () => {
      const { scrubArea, root } = await renderScrubArea({ readOnly: true });

      await act(async () => {
        scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      });

      expect(root).not.toHaveAttribute('data-scrubbing');
    });

    it('keeps a selection the consumer sets in onFocus when a mouse press focuses the input', async () => {
      render(() => (
        <NumberField.Root defaultValue={100}>
          <NumberField.Input onFocus={(event) => event.currentTarget.select()} />
          <NumberField.ScrubArea data-testid="scrub-area" />
        </NumberField.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('textbox');

      await act(async () => {
        screen
          .getByTestId('scrub-area')
          .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
      });

      expect(input).toHaveFocus();
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
    });
  });

  // Only run the following tests in Chromium/Firefox (upstream also skips them in jsdom; they run
  // here, except the ones that need a visual viewport or layout).
  if (isWebKit) {
    return;
  }

  it('should increment or decrement the value when scrubbing with the pointer', async () => {
    render(() => (
      <NumberField.Root defaultValue={0}>
        <NumberField.Input />
        <NumberField.ScrubArea data-testid="scrub-area">
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>
    ));

    const scrubArea = screen.getByTestId('scrub-area');
    const input = screen.getByRole('textbox');

    await act(async () => {
      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -10 }));
    });

    expect(input).toHaveValue('-10');
    await act(async () => {
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 5 }));
    });

    expect(input).toHaveValue('-5');

    await act(async () => {
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -2 }));
    });

    expect(input).toHaveValue('-7');
  });

  // Needs `window.visualViewport` (missing in jsdom).
  it.skipIf(isJSDOM)('tracks visual viewport scale and removes scrub listeners after pointer lock exits', async () => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) {
      throw new Error('Expected visualViewport in a browser test.');
    }

    let scale = 2;
    const scaleGetter = vi.spyOn(visualViewport, 'scale', 'get').mockImplementation(() => scale);
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const pointerLock = vi
      .spyOn(document.body, 'requestPointerLock')
      .mockImplementation(() => Promise.resolve());

    try {
      render(() => (
        <NumberField.Root defaultValue={0} data-testid="root">
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByTestId('scrub-area');
      const root = screen.getByTestId('root');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      });

      const cursor = screen.getByTestId('cursor');
      expect(cursor.style.transform).toContain('scale(0.5)');

      scale = 4;
      await act(async () => {
        window.dispatchEvent(createPointerMoveEvent({ movementX: 4 }));
      });
      expect(cursor.style.transform).toContain('scale(0.25)');

      const pointerUpListener = addEventListener.mock.calls.find(([type]) => type === 'pointerup');
      const pointerMoveListener = addEventListener.mock.calls.find(
        ([type]) => type === 'pointermove',
      );
      expect(pointerUpListener).toBeDefined();
      expect(pointerMoveListener).toBeDefined();

      await act(async () => {
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      });

      expect(root).not.toHaveAttribute('data-scrubbing');
      expect(screen.queryByTestId('cursor')).toBe(null);
      expect(removeEventListener).toHaveBeenCalledWith('pointerup', pointerUpListener?.[1], true);
      expect(removeEventListener).toHaveBeenCalledWith(
        'pointermove',
        pointerMoveListener?.[1],
        true,
      );
    } finally {
      scaleGetter.mockRestore();
      addEventListener.mockRestore();
      removeEventListener.mockRestore();
      pointerLock.mockRestore();
    }
  });

  it('clears the root scrubbing state when the scrub area unmounts mid-scrub', async () => {
    const [scrubAreaMounted, setScrubAreaMounted] = createSignal(true);

    render(() => (
      <NumberField.Root defaultValue={0} data-testid="root">
        <NumberField.Input />
        <Show when={scrubAreaMounted()}>
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </Show>
      </NumberField.Root>
    ));

    const scrubArea = screen.getByTestId('scrub-area');
    const root = screen.getByTestId('root');

    await act(async () => {
      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -10 }));
    });

    expect(root).toHaveAttribute('data-scrubbing');

    // Unmount the scrub area before pointerup; the root must not stay stuck in the scrubbing state.
    await act(async () => {
      setScrubAreaMounted(false);
    });

    expect(root).not.toHaveAttribute('data-scrubbing');
  });

  it('syncs the visible input value when scrubbing after pasting', async () => {
    const onValueChange = vi.fn();

    render(() => (
      <NumberField.Root defaultValue={10} onValueChange={onValueChange}>
        <NumberField.Input />
        <NumberField.ScrubArea data-testid="scrub-area">
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>
    ));

    const scrubArea = screen.getByTestId('scrub-area');
    const input = screen.getByRole('textbox') as HTMLInputElement;

    // Select the existing value so the paste replaces it rather than inserting at the caret.
    await act(async () => input.focus());
    input.select();
    pasteText(input, '20');

    expect(input).toHaveValue('20');
    expect(onValueChange.mock.lastCall?.[0]).toBe(20);

    await act(async () => {
      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 2 }));
    });

    expect(onValueChange.mock.lastCall?.[0]).toBe(22);
    expect(input).toHaveValue('22');
  });

  it('calls onValueChange while scrubbing and onValueCommitted on pointerup', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    render(() => (
      <NumberField.Root
        defaultValue={0}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
        <NumberField.ScrubArea data-testid="scrub-area">
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>
    ));

    const scrubArea = screen.getByTestId('scrub-area');

    await act(async () => {
      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 3 }));
    });

    // One or more changes depending on pixel sensitivity and environment
    expect(onValueChange.mock.calls.length).toBeGreaterThan(0);

    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });

    expect(onValueCommitted.mock.calls.length).toBe(1);

    const lastChange = onValueChange.mock.lastCall?.[0];
    const committed = onValueCommitted.mock.calls[0][0];
    expect(committed).toBe(lastChange);
  });

  // Gecko defers the pointer lock release by 20ms, so the scrub is still live right after
  // `pointerup` there; that path is covered by `NumberFieldScrubArea.gecko.test.tsx`.
  it.skipIf(platform.engine.gecko)(
    'ignores pointer movement once the scrub has ended',
    async () => {
      render(() => (
        <NumberField.Root defaultValue={0}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByTestId('scrub-area');
      const input = screen.getByRole('textbox');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 10 }));
      });

      expect(input).toHaveValue('10');

      await act(async () => {
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        window.dispatchEvent(createPointerMoveEvent({ movementX: 10 }));
      });

      expect(input).toHaveValue('10');
    },
  );

  // Skipped: the `React.Activity` test (React-only).

  describe('prop: pixelSensitivity', () => {
    it('does not change the value for a zero-distance move when sensitivity is 0', async () => {
      const onValueChange = vi.fn();

      // `snapOnStep` makes a zero-amount step observable: it would snap 3.5 down to 3.
      render(() => (
        <NumberField.Root defaultValue={3.5} step={1} snapOnStep onValueChange={onValueChange}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area" pixelSensitivity={0}>
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByTestId('scrub-area');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 0 }));
      });

      expect(screen.getByRole('textbox')).toHaveValue(new Intl.NumberFormat().format(3.5));
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('should only increment if the pointer movement was greater than or equal to the value', async () => {
      render(() => (
        <NumberField.Root defaultValue={0}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area" pixelSensitivity={5}>
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByTestId('scrub-area');
      const input = screen.getByRole('textbox');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -2 }));
      });

      expect(input).toHaveValue('0');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 2 }));
      });

      expect(input).toHaveValue('0');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
      });

      expect(input).toHaveValue('0');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
      });

      expect(input).toHaveValue('1');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 5 }));
      });

      expect(input).toHaveValue('6');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -4 }));
      });

      expect(input).toHaveValue('6');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -1 }));
      });

      expect(input).toHaveValue('5');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 5 }));
      });

      expect(input).toHaveValue('10');
    });
  });

  describe('prop: teleportDistance', () => {
    // Needs layout and `requestPointerLock` (missing in jsdom).
    it.skipIf(isJSDOM)('wraps the virtual cursor around the allowed bounds', async () => {
      // Headless Chromium denies pointer lock, which unmounts the virtual cursor mid-test.
      const pointerLock = vi
        .spyOn(document.body, 'requestPointerLock')
        .mockImplementation(() => Promise.resolve());

      try {
        render(() => (
          <NumberField.Root defaultValue={0}>
            <NumberField.Input />
            {/* Pin the scrub area so the bounds don't shift as the value (and input width) grows. */}
            <NumberField.ScrubArea
              data-testid="scrub-area"
              teleportDistance={100}
              style={{ position: 'fixed', left: '100px', top: '100px', width: '20px', height: '20px' }}
            >
              <NumberField.ScrubAreaCursor data-testid="cursor" />
            </NumberField.ScrubArea>
          </NumberField.Root>
        ));

        const scrubArea = screen.getByTestId('scrub-area');

        await act(async () => {
          scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
        });

        const cursor = screen.getByTestId('cursor');
        // The bare cursor has no size, so its wrap coordinates are the bounds themselves.
        expect(cursor.offsetWidth).toBe(0);

        // Past the right bound (120 + 100 / 2): the cursor reappears at the left one.
        await act(async () => {
          scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 5000 }));
        });
        expect(cursor.style.transform).toContain('translate3d(50px,');

        // And symmetrically past the left bound (100 - 100 / 2).
        await act(async () => {
          scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -5000 }));
        });
        expect(cursor.style.transform).toContain('translate3d(170px,');
      } finally {
        pointerLock.mockRestore();
      }
    });
  });

  describe('prop: direction', () => {
    it('scrubs on vertical movement when direction is vertical', async () => {
      render(() => (
        <NumberField.Root defaultValue={0}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area" direction="vertical">
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByTestId('scrub-area');
      const input = screen.getByRole('textbox');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 10 }));
      });

      expect(input).toHaveValue('0');

      // Upward movement (negative Y) increases the value.
      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementY: -10 }));
      });

      expect(input).toHaveValue('10');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementY: 4 }));
      });

      expect(input).toHaveValue('6');
    });

    it('should only scrub if the pointer moved in the given direction', async () => {
      render(() => (
        <NumberField.Root defaultValue={0}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area" direction="horizontal">
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByTestId('scrub-area');
      const input = screen.getByRole('textbox');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 10 }));
      });

      expect(input).toHaveValue('10');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementY: 10 }));
      });

      expect(input).toHaveValue('10');
    });
  });

  it('should fire onClick once when clicked without scrubbing', async () => {
    const handleClick = vi.fn();

    render(() => (
      <NumberField.Root defaultValue={0}>
        <NumberField.ScrubArea
          data-testid="scrub-area"
          onClick={handleClick}
          style={{ display: 'inline-block', width: '100px', height: '40px' }}
        >
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
        <NumberField.Input />
      </NumberField.Root>
    ));

    // Real browser input upstream (`vitest/browser`), so the native click and the synthesized one
    // can both happen. `user-event` dispatches the same pointerdown/pointerup/click sequence.
    const user = userEvent.setup();
    await user.click(screen.getByTestId('scrub-area'));
    // The synthesized click is deferred by one task (20ms in Firefox).
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should fire onClick on child elements', async () => {
    const handleScrubAreaClick = vi.fn();
    const handleLabelClick = vi.fn();

    const user = userEvent.setup();
      render(() => (
        <NumberField.Root defaultValue={0}>
        <NumberField.ScrubArea onClick={handleScrubAreaClick}>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <label onClick={handleLabelClick}>Amount</label>
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>
      ));

    await user.click(screen.getByText('Amount'));

    expect(handleLabelClick.mock.calls.length).toBe(1);
    expect(handleScrubAreaClick.mock.calls.length).toBe(1);
  });
});
