import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Drawer } from '..';
import { flushMicrotasks, renderWithProps } from '../../dialog/test-utils';

// Upstream's DrawerVirtualKeyboardProvider suite is browser-only (every test is
// `skipIf(isJSDOM)`: it relies on real layout, visual viewport and software keyboard behavior), so
// none of it is ported verbatim. These tests cover the jsdom-observable behavior instead: the
// keyboard inset variable driven by a mocked visual viewport, and tap-to-focus on touch.

function createTouch(target: EventTarget, point: { clientX: number; clientY: number }) {
  if (typeof Touch === 'function') {
    return new Touch({ identifier: 1, target, ...point });
  }
  return point;
}

function mockVisualViewport(height: number) {
  const visualViewport = Object.assign(new EventTarget(), {
    height,
    width: window.innerWidth,
    offsetTop: 0,
    offsetLeft: 0,
    pageTop: 0,
    pageLeft: 0,
    scale: 1,
  });
  const descriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
  return {
    visualViewport,
    restore() {
      if (descriptor) {
        Object.defineProperty(window, 'visualViewport', descriptor);
      } else {
        delete (window as any).visualViewport;
      }
    },
  };
}

/**
 * jsdom has no layout: report the full layout viewport height for the `100svh` probe the provider
 * uses to detect browsers that shrink the layout viewport for the keyboard.
 */
function mockSmallViewportProbe(height: number) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!;
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      if (this.style.height === '100svh') {
        return height;
      }
      return descriptor.get!.call(this);
    },
  });
  return () => Object.defineProperty(HTMLElement.prototype, 'offsetHeight', descriptor);
}

async function flushAnimationFrames(count = 3) {
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  await flushMicrotasks();
}

function TestDrawer(props: { open?: boolean; withProvider?: boolean; onClick?: () => void }) {
  const content = () => (
    <Drawer.Portal>
      <Drawer.Viewport data-testid="viewport">
        <Drawer.Popup data-testid="popup">
          <label data-testid="label">
            Name
            <input data-testid="labelled-input" />
          </label>
          <input data-testid="input" onClick={() => props.onClick?.()} />
          <input data-testid="disabled-input" disabled />
          <input data-testid="checkbox" type="checkbox" />
          <button data-testid="button">Button</button>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  );
  return (
    <Drawer.Root open={props.open ?? true} modal={false}>
      {props.withProvider === false ? (
        content()
      ) : (
        <Drawer.VirtualKeyboardProvider>{content()}</Drawer.VirtualKeyboardProvider>
      )}
    </Drawer.Root>
  );
}

describe('<Drawer.VirtualKeyboardProvider />', () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  function withElementFromPoint(element: () => Element | null) {
    const original = document.elementFromPoint;
    document.elementFromPoint = () => element();
    cleanups.push(() => {
      document.elementFromPoint = original;
    });
  }

  function tap(target: Element, point = { clientX: 10, clientY: 10 }) {
    fireEvent.touchStart(target, { touches: [createTouch(target, point)] });
    return fireEvent.touchEnd(target, { touches: [], changedTouches: [createTouch(target, point)] });
  }

  it('renders its children without an element of its own', () => {
    render(() => <TestDrawer />);
    const viewport = screen.getByTestId('viewport');
    expect(viewport.parentElement).toHaveAttribute('data-base-ui-portal');
    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });

  describe('keyboard inset', () => {
    it('sets --drawer-keyboard-inset to the part of the layout viewport covered by the keyboard', async () => {
      const viewportMock = mockVisualViewport(window.innerHeight - 300);
      cleanups.push(viewportMock.restore, mockSmallViewportProbe(window.innerHeight));

      render(() => <TestDrawer />);
      await flushMicrotasks();
      const viewport = screen.getByTestId('viewport');

      screen.getByTestId('input').focus();
      await flushAnimationFrames();

      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('300px');

      // The keyboard closes.
      viewportMock.visualViewport.height = window.innerHeight;
      viewportMock.visualViewport.dispatchEvent(new Event('resize'));
      await flushAnimationFrames();

      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
    });

    it('does not report an inset when the layout viewport already follows the keyboard', async () => {
      const visualHeight = window.innerHeight - 300;
      cleanups.push(mockVisualViewport(visualHeight).restore, mockSmallViewportProbe(visualHeight));

      render(() => <TestDrawer />);
      await flushMicrotasks();

      screen.getByTestId('input').focus();
      await flushAnimationFrames();

      expect(
        screen.getByTestId('viewport').style.getPropertyValue('--drawer-keyboard-inset'),
      ).toBe('0px');
    });

    it('clears the inset when focus leaves the keyboard input', async () => {
      cleanups.push(
        mockVisualViewport(window.innerHeight - 300).restore,
        mockSmallViewportProbe(window.innerHeight),
      );

      render(() => <TestDrawer />);
      await flushMicrotasks();
      const viewport = screen.getByTestId('viewport');

      screen.getByTestId('input').focus();
      await flushAnimationFrames();
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('300px');

      screen.getByTestId('button').focus();
      await flushAnimationFrames();
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
    });

    it('removes the inset variable when the drawer closes', async () => {
      cleanups.push(
        mockVisualViewport(window.innerHeight - 300).restore,
        mockSmallViewportProbe(window.innerHeight),
      );

      const { setProps } = renderWithProps(
        (props: { open: boolean }) => <TestDrawer open={props.open} />,
        { open: true },
      );
      await flushMicrotasks();
      const viewport = screen.getByTestId('viewport');

      screen.getByTestId('input').focus();
      await flushAnimationFrames();
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('300px');

      await setProps({ open: false });
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('');
    });

    it('does not set the inset without the provider', async () => {
      cleanups.push(
        mockVisualViewport(window.innerHeight - 300).restore,
        mockSmallViewportProbe(window.innerHeight),
      );

      render(() => <TestDrawer withProvider={false} />);
      await flushMicrotasks();

      screen.getByTestId('input').focus();
      await flushAnimationFrames();

      expect(
        screen.getByTestId('viewport').style.getPropertyValue('--drawer-keyboard-inset'),
      ).toBe('');
    });
  });

  describe('tap to focus', () => {
    it('focuses a tapped input synchronously and redispatches its click', async () => {
      const handleClick = vi.fn();
      render(() => <TestDrawer onClick={handleClick} />);
      await flushMicrotasks();

      const input = screen.getByTestId('input');
      withElementFromPoint(() => input);

      const notPrevented = tap(input);

      expect(notPrevented).toBe(false);
      expect(input).toHaveFocus();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('focuses the control of a tapped label', async () => {
      render(() => <TestDrawer />);
      await flushMicrotasks();

      const label = screen.getByTestId('label');
      withElementFromPoint(() => label);

      tap(label);

      expect(screen.getByTestId('labelled-input')).toHaveFocus();
    });

    it('does not focus the input when the touch moved like a drag', async () => {
      render(() => <TestDrawer />);
      await flushMicrotasks();

      const input = screen.getByTestId('input');
      withElementFromPoint(() => input);

      fireEvent.touchStart(input, { touches: [createTouch(input, { clientX: 10, clientY: 10 })] });
      fireEvent.touchMove(input, { touches: [createTouch(input, { clientX: 10, clientY: 60 })] });
      const notPrevented = fireEvent.touchEnd(input, {
        touches: [],
        changedTouches: [createTouch(input, { clientX: 10, clientY: 60 })],
      });

      expect(notPrevented).toBe(true);
      expect(input).not.toHaveFocus();
    });

    it('preserves native taps on disabled inputs and non-keyboard controls', async () => {
      render(() => <TestDrawer />);
      await flushMicrotasks();

      const disabledInput = screen.getByTestId('disabled-input');
      withElementFromPoint(() => disabledInput);
      expect(tap(disabledInput)).toBe(true);

      const checkbox = screen.getByTestId('checkbox');
      withElementFromPoint(() => checkbox);
      expect(tap(checkbox)).toBe(true);
      expect(checkbox).not.toHaveFocus();
    });

    it('does not steal a tap that lands on another interactive element', async () => {
      render(() => <TestDrawer />);
      await flushMicrotasks();

      const input = screen.getByTestId('input');
      const button = screen.getByTestId('button');
      // The touch started on the input but lifted over the button.
      withElementFromPoint(() => button);

      expect(tap(input)).toBe(true);
      expect(input).not.toHaveFocus();
    });

    it('does nothing without the provider', async () => {
      render(() => <TestDrawer withProvider={false} />);
      await flushMicrotasks();

      const input = screen.getByTestId('input');
      withElementFromPoint(() => input);

      expect(tap(input)).toBe(true);
      expect(input).not.toHaveFocus();
    });

    it('lets the native tap through for an input that is already focused', async () => {
      render(() => <TestDrawer />);
      await flushMicrotasks();

      const input = screen.getByTestId('input');
      input.focus();
      await waitFor(() => expect(input).toHaveFocus());
      withElementFromPoint(() => input);

      // Without a visual viewport, the keyboard is assumed to be up for the focused input.
      expect(tap(input)).toBe(true);
      expect(input).toHaveFocus();
    });
  });
});
