import { createRoot, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { NumberField } from '..';
import { platform } from '@egoist/solid-base-utils/platform';
import {
  NumberFieldScrubAreaContext,
  useNumberFieldScrubAreaContext,
} from '../scrub-area/NumberFieldScrubAreaContext';

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

const isWebKit = platform.engine.webkit;

const defaultScrubAreaContext: NumberFieldScrubAreaContext = {
  isScrubbing: () => true,
  isTouchInput: () => false,
  isPointerLockDenied: () => false,
  scrubAreaCursorRef: { current: null },
};

// This component doesn't render on WebKit.
describe.skipIf(isWebKit)('<NumberField.ScrubAreaCursor />', () => {
  it('renders a span and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <NumberField.Root>
        <NumberField.ScrubArea>
          <NumberFieldScrubAreaContext value={defaultScrubAreaContext}>
            <NumberField.ScrubAreaCursor
              data-testid="part"
              class={(state) => (state.disabled ? 'disabled' : 'enabled')}
              style={{ color: 'red' }}
              ref={(element) => {
                ref = element;
              }}
            />
            <NumberField.ScrubAreaCursor data-testid="rendered" render="div" />
          </NumberFieldScrubAreaContext>
        </NumberField.ScrubArea>
      </NumberField.Root>
    ));
    const element = screen.getByTestId('part');
    expect(element.tagName).toBe('SPAN');
    expect(element).toHaveClass('enabled');
    expect(element).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(element);
    // Portaled to the body.
    expect(element.parentElement).toBe(document.body);
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

  it('throws a descriptive error when rendered outside <NumberField.ScrubArea>', () => {
    // The context hook throws synchronously. Rendering the cursor inside `<NumberField.Root>` would
    // throw from a lazily evaluated child, outside of `render`.
    expect(() => createRoot(() => useNumberFieldScrubAreaContext())).toThrow(
      'Base UI: NumberFieldScrubAreaContext is missing. NumberFieldScrubArea parts must be placed within <NumberField.ScrubArea>.',
    );
  });

  it('renders when using mouse input', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      Element.prototype.requestPointerLock = vi.fn().mockResolvedValue(undefined);

      const user = userEvent.setup();
      render(() => (
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByTestId('scrub-area');

      await act(async () => {
        await user.pointer({ target: scrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
        await new Promise((resolve) => {
          setTimeout(resolve, 25);
        });
      });

      expect(screen.queryByTestId('scrub-area-cursor')).not.toBe(null);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('only renders a cursor for the active scrub area', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      Element.prototype.requestPointerLock = vi.fn().mockResolvedValue(undefined);

      const user = userEvent.setup();
      render(() => (
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area-1">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
          <NumberField.ScrubArea data-testid="scrub-area-2">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const firstScrubArea = screen.getByTestId('scrub-area-1');

      await act(async () => {
        await user.pointer({ target: firstScrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
        await new Promise((resolve) => {
          setTimeout(resolve, 25);
        });
      });

      expect(screen.queryAllByTestId('scrub-area-cursor')).toHaveLength(1);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('does not render when using touch input', async () => {
    const user = userEvent.setup();
    render(() => (
      <NumberField.Root>
        <NumberField.ScrubArea>
          <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
        </NumberField.ScrubArea>
      </NumberField.Root>
    ));

    const scrubArea = screen.getByRole('presentation');

    await act(async () => {
      await user.pointer({ target: scrubArea, keys: '[TouchA>]', pointerName: 'touch' });
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });
    });

    expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
  });

  it('handles pointer lock denial through requestPointerLock API', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      const requestLockStub = vi.fn(() => {
        throw new Error('User denied pointer lock');
      });
      Element.prototype.requestPointerLock =
        requestLockStub as typeof Element.prototype.requestPointerLock;

      const user = userEvent.setup();
      render(() => (
        <NumberField.Root>
          <NumberField.ScrubArea>
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByRole('presentation');

      await act(async () => {
        await user.pointer({ target: scrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
        await new Promise((resolve) => {
          setTimeout(resolve, 25);
        });
      });

      expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
      expect(requestLockStub).toHaveBeenCalled();
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('does not render after a quick tap when pointer lock resolves later', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      // Simulate pointer lock resolving after the user already released the pointer (tap)
      Element.prototype.requestPointerLock = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          setTimeout(resolve, 30);
        }),
      );

      const user = userEvent.setup();
      render(() => (
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByTestId('scrub-area');

      await act(async () => {
        // Quick press and release (tap)
        await user.pointer({ target: scrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
        await user.pointer({ target: scrubArea, keys: '[/MouseLeft]', pointerName: 'mouse' });
        window.dispatchEvent(new Event('pointerup'));
        // Wait longer than the delayed pointer lock resolution
        await new Promise((resolve) => {
          setTimeout(resolve, 50);
        });
      });

      // After a tap, the scrub cursor should not remain rendered
      expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });
});
