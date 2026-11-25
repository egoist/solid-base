import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { NumberField } from '..';
import { platform } from '@egoist/solid-base-utils/platform';

vi.mock('@egoist/solid-base-utils/platform', async () => {
  const actual =
    await vi.importActual<typeof import('@egoist/solid-base-utils/platform')>(
      '@egoist/solid-base-utils/platform',
    );

  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: { ...actual.platform.engine, gecko: true },
    },
  };
});

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

// Upstream runs this only in Chromium/Firefox; jsdom dispatches the synthetic pointer events too.
describe.skipIf(platform.engine.webkit)('<NumberField.ScrubArea /> on Gecko', () => {
  clock.withFakeTimers();

  it('delays releasing the pointer lock so soft clicks are not swallowed', async () => {
    const onValueCommitted = vi.fn();

    render(() => (
      <NumberField.Root defaultValue={0} data-testid="root" onValueCommitted={onValueCommitted}>
        <NumberField.Input />
        <NumberField.ScrubArea data-testid="scrub-area">
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>
    ));

    const scrubArea = screen.getByTestId('scrub-area');
    const root = screen.getByTestId('root');
    const box = scrubArea.getBoundingClientRect();

    await act(async () => {
      scrubArea.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          clientX: box.left + box.width / 2,
          clientY: box.top + box.height / 2,
        }),
      );
      scrubArea.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, movementX: 10, movementY: 0 }),
      );
    });

    expect(screen.getByRole('textbox')).toHaveValue('10');

    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });

    // Firefox needs the pointer lock to outlive the release, so the scrub is still open here.
    expect(onValueCommitted).not.toHaveBeenCalled();
    expect(root).toHaveAttribute('data-scrubbing');

    await act(async () => {
      clock.tick(20);
    });

    expect(onValueCommitted.mock.calls.length).toBe(1);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(10);
    expect(root).not.toHaveAttribute('data-scrubbing');
  });
});
