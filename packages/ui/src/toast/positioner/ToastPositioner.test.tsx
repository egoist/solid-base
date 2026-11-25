import { For } from 'solid-js';
import { expect, vi, describe, it } from 'vitest';
import { waitFor } from '@solidjs/testing-library';
import { Toast } from '..';
import type { ToastManagerAddOptions } from '../useToastManager';
import { act, createClock, render, screen } from '../utils/test-utils';

const toast: Toast.Root.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

describe('<Toast.Positioner />', () => {
  

  it('conformance: forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Toast.Provider>
        <Toast.Positioner
          toast={toast}
          ref={(el) => {
            ref = el;
          }}
          data-testid="positioner"
          class={(state) => `side-${state.side}`}
          style={{ color: 'red' }}
          render={(props) => <section {...props} />}
        />
      </Toast.Provider>
    ));
    const positioner = screen.getByTestId('positioner');
    expect(ref).toBe(positioner);
    expect(positioner.tagName).toBe('SECTION');
    expect(positioner).toHaveAttribute('role', 'presentation');
    expect(positioner).toHaveClass('side-top');
    expect(positioner).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  function AnchoredList() {
    const toastManager = Toast.useToastManager();
    return <For each={toastManager.toasts}>{(toastItem) => (
      <Toast.Positioner toast={toastItem} data-testid={toastItem.id}>
        <Toast.Root toast={toastItem}>
          <Toast.Title />
        </Toast.Root>
      </Toast.Positioner>
    )}</For>;
  }

  function AddButton(props: { options?: Partial<ToastManagerAddOptions<any>> }) {
    const { add } = Toast.useToastManager();
    return (
      <button type="button" onClick={() => add({ title: 'title', ...props.options })}>
        add
      </button>
    );
  }

  // Requires a real browser (layout, pointer capture or focus-visible).
  it.skip('positions an anchored toast against its anchor element', async () => {
    function App() {
      const anchorRef: { current: HTMLButtonElement | null } = { current: null };
      const { add } = Toast.useToastManager();
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
                id: 'anchored',
                title: 'title',
                positionerProps: { anchor: anchorRef.current, side: 'bottom', sideOffset: 8 },
              })
            }
          >
            anchor
          </button>
          <Toast.Viewport>
            <AnchoredList />
          </Toast.Viewport>
        </>
      );
    }

    const { user } = render(() => (
      <Toast.Provider>
        <App />
      </Toast.Provider>
));

    const anchor = screen.getByRole('button', { name: 'anchor' });
    await user.click(anchor);

    const positioner = screen.getByTestId('anchored');
    await waitFor(() => expect(positioner).toHaveAttribute('data-side', 'bottom'));

    const anchorRect = anchor.getBoundingClientRect();
    await waitFor(() => {
      expect(positioner.getBoundingClientRect().top).toBeCloseTo(anchorRect.bottom + 8, 0);
    });
  });

  it('falls back to the viewport when no anchor is provided', async () => {
    const { user } = render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <AnchoredList />
        </Toast.Viewport>
        <AddButton options={{ id: 'unanchored' }} />
      </Toast.Provider>
));

    await user.click(screen.getByRole('button', { name: 'add' }));

    const positioner = screen.getByTestId('unanchored');
    // An unanchored positioner still renders, with the defaults applied.
    expect(positioner).toHaveAttribute('data-side', 'top');
    expect(positioner).toHaveAttribute('data-align', 'center');
    expect(positioner).toHaveTextContent('title');
  });

  it('lets positioner props override the ones carried on the toast', async () => {
    function OverridingList() {
      const toastManager = Toast.useToastManager();
      return <For each={toastManager.toasts}>{(toastItem) => (
        <Toast.Positioner toast={toastItem} data-testid="positioner" side="left">
          <Toast.Root toast={toastItem}>
            <Toast.Title />
          </Toast.Root>
        </Toast.Positioner>
      )}</For>;
    }

    const { user } = render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <OverridingList />
        </Toast.Viewport>
        <AddButton options={{ positionerProps: { side: 'bottom', align: 'end' } }} />
      </Toast.Provider>
));

    await user.click(screen.getByRole('button', { name: 'add' }));

    const positioner = screen.getByTestId('positioner');
    expect(positioner).toHaveAttribute('data-side', 'left');
    // Props not set on the element still come from the toast.
    expect(positioner).toHaveAttribute('data-align', 'end');
  });

  describe('--toast-index', () => {
    const clock = createClock();

    clock.withFakeTimers();

    it('keeps the DOM index while a toast animates out', async () => {
      const manager = Toast.createToastManager();

      render(() => (
        <Toast.Provider toastManager={manager} timeout={0}>
          <Toast.Viewport>
            <AnchoredList />
          </Toast.Viewport>
        </Toast.Provider>
      ));

      await act(async () => {
        manager.add({ id: 'oldest', title: 'oldest' });
      });
      await act(async () => {
        manager.add({ id: 'newest', title: 'newest' });
      });

      const newest = screen.getByTestId('newest');
      const oldest = screen.getByTestId('oldest');

      expect(newest.style.getPropertyValue('--toast-index')).toBe('0');
      expect(oldest.style.getPropertyValue('--toast-index')).toBe('1');

      await act(async () => manager.close('newest'));

      // The closing toast is excluded from the visible stack, but it must keep a
      // real index while it animates out rather than collapsing to `-1`.
      expect(newest.style.getPropertyValue('--toast-index')).toBe('0');
      expect(oldest.style.getPropertyValue('--toast-index')).toBe('0');
    });
  });

  it('throws a descriptive error when rendered outside <Toast.Provider>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(() => <Toast.Positioner toast={toast} />)).toThrow(
        'Base UI: useToastManager must be used within <Toast.Provider>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
