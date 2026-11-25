import { For } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { waitFor } from '@solidjs/testing-library';
import { Toast } from '..';
import { fireEvent, render, screen } from '../utils/test-utils';

/**
 * jsdom has no Web Animations: fake a running exit animation on elements with
 * `[data-ending-style]`, finished on demand. Covers the browser-only upstream tests about toasts
 * that are re-added while they animate out.
 */
function mockExitAnimations() {
  let finish = () => {};
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getAnimations');

  beforeEach(() => {
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
      configurable: true,
      value(this: HTMLElement) {
        if (!this.hasAttribute('data-ending-style')) {
          return [];
        }
        return [{ finished, effect: { getTiming: () => ({ duration: 100, iterations: 1 }) } }];
      },
    });
  });

  afterEach(() => {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, 'getAnimations', original);
    } else {
      delete (HTMLElement.prototype as any).getAnimations;
    }
  });

  return {
    finish: () => finish(),
  };
}

function simulateSwipeRight(element: HTMLElement) {
  fireEvent.pointerDown(element, { clientX: 100, clientY: 100, button: 0, pointerId: 1 });
  fireEvent.pointerMove(element, { clientX: 101, clientY: 100, pointerId: 1 });
  fireEvent.pointerMove(element, { clientX: 160, clientY: 100, pointerId: 1 });
  fireEvent.pointerUp(element, { clientX: 160, clientY: 100, pointerId: 1 });
}

describe('<Toast.Root /> lifecycle', () => {
  const animations = mockExitAnimations();

  function App() {
    const toastManager = Toast.useToastManager();
    return (
      <>
        <button
          type="button"
          onClick={() => toastManager.add({ id: 'save', title: 'Saved', timeout: 0 })}
        >
          add
        </button>
        <button type="button" onClick={() => toastManager.close('save')}>
          close
        </button>
        <Toast.Viewport>
          <For each={toastManager.toasts}>
            {(toastItem) => (
              <Toast.Root toast={toastItem} data-testid="toast-root" swipeDirection="right">
                <Toast.Title />
              </Toast.Root>
            )}
          </For>
        </Toast.Viewport>
      </>
    );
  }

  it('keeps an ending toast mounted until its exit animation finishes', async () => {
    const { user } = render(() => (
      <Toast.Provider>
        <App />
      </Toast.Provider>
    ));

    await user.click(screen.getByRole('button', { name: 'add' }));
    const toastRoot = screen.getByTestId('toast-root');
    expect(toastRoot).not.toHaveAttribute('data-starting-style');

    await user.click(screen.getByRole('button', { name: 'close' }));
    expect(toastRoot).toHaveAttribute('data-ending-style');
    expect(screen.getByTestId('toast-root')).toBe(toastRoot);

    animations.finish();
    await waitFor(() => expect(screen.queryByTestId('toast-root')).toBe(null));
  });

  it('keeps the root and clears the ending state when re-adding an ending toast', async () => {
    const { user } = render(() => (
      <Toast.Provider>
        <App />
      </Toast.Provider>
    ));

    await user.click(screen.getByRole('button', { name: 'add' }));
    const toastRoot = screen.getByTestId('toast-root');

    await user.click(screen.getByRole('button', { name: 'close' }));
    expect(toastRoot).toHaveAttribute('data-ending-style');

    await user.click(screen.getByRole('button', { name: 'add' }));
    expect(screen.getByTestId('toast-root')).toBe(toastRoot);
    await waitFor(() => {
      expect(toastRoot).not.toHaveAttribute('data-starting-style');
    });
    expect(toastRoot).not.toHaveAttribute('data-ending-style');

    // The finished exit animation of the previous lifecycle doesn't remove the revived toast.
    animations.finish();
    await Promise.resolve();
    expect(screen.getByTestId('toast-root')).toBe(toastRoot);
  });

  it('clears swipe state when re-adding a swipe-dismissed toast', async () => {
    const { user } = render(() => (
      <Toast.Provider>
        <App />
      </Toast.Provider>
    ));

    await user.click(screen.getByRole('button', { name: 'add' }));
    const toastRoot = screen.getByTestId('toast-root');

    simulateSwipeRight(toastRoot);

    expect(toastRoot).toHaveAttribute('data-ending-style');
    expect(toastRoot).toHaveAttribute('data-swipe-direction', 'right');

    await user.click(screen.getByRole('button', { name: 'add' }));
    expect(screen.getByTestId('toast-root')).toBe(toastRoot);

    await waitFor(() => {
      expect(toastRoot).not.toHaveAttribute('data-starting-style');
    });
    await waitFor(() => {
      expect(toastRoot).not.toHaveAttribute('data-swipe-direction');
    });
    expect(toastRoot.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
    expect(toastRoot.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
  });
});
