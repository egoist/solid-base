import { For } from 'solid-js';
import { expect, vi, describe, it } from 'vitest';
import { waitFor } from '@solidjs/testing-library';
import { Toast } from '..';
import { render, screen } from '../utils/test-utils';

const toast: Toast.Root.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

describe('<Toast.Arrow />', () => {
  

  it('conformance: forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Toast.Provider>
        <Toast.Positioner toast={toast}>
          <Toast.Arrow
            ref={(el) => {
              ref = el;
            }}
            data-testid="arrow"
            class={(state) => `side-${state.side}`}
            style={{ color: 'red' }}
            render={(props) => <span {...props} />}
          />
        </Toast.Positioner>
      </Toast.Provider>
    ));
    const arrow = screen.getByTestId('arrow');
    expect(ref).toBe(arrow);
    expect(arrow.tagName).toBe('SPAN');
    expect(arrow).toHaveClass('side-top');
    expect(arrow).toHaveAttribute('data-side', 'top');
    expect(arrow).toHaveAttribute('data-align', 'center');
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  // Requires a real browser (layout, pointer capture or focus-visible).
  it.skip('mirrors the resolved side of its positioner', async () => {
    function App() {
      const anchorRef: { current: HTMLButtonElement | null } = { current: null };
      const toastManager = Toast.useToastManager();
      const { add } = toastManager;
      return (
        <>
          <button
            type="button"
            ref={(el) => {
              anchorRef.current = el;
            }}
            style={{ position: 'absolute', top: '200px', left: '100px', width: '80px', height: '20px' }}
            onClick={() =>
              add({
                title: 'title',
                positionerProps: { anchor: anchorRef.current, side: 'bottom' },
              })
            }
          >
            anchor
          </button>
          <Toast.Viewport>
            <For each={toastManager.toasts}>{(toastItem) => (
              <Toast.Positioner toast={toastItem}>
                <Toast.Root toast={toastItem}>
                  <Toast.Arrow data-testid="arrow" />
                  <Toast.Title />
                </Toast.Root>
              </Toast.Positioner>
            )}</For>
          </Toast.Viewport>
        </>
      );
    }

    const { user } = render(() => (
      <Toast.Provider>
        <App />
      </Toast.Provider>
));

    await user.click(screen.getByRole('button', { name: 'anchor' }));

    const arrow = screen.getByTestId('arrow');
    await waitFor(() => expect(arrow).toHaveAttribute('data-side', 'bottom'));
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
  });

  it('throws a descriptive error when rendered outside <Toast.Positioner>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(() => <Toast.Arrow />)).toThrow(
        'Base UI: ToastPositionerContext is missing. ToastPositioner parts must be placed within <Toast.Positioner>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
