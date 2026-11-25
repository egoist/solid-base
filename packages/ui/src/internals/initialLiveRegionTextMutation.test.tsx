import { Show, createSignal } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import {
  INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY,
  createInitialLiveRegionTextMutation,
} from './initialLiveRegionTextMutation';
import { flushMicrotasks } from '../dialog/test-utils';

describe('createInitialLiveRegionTextMutation', () => {
  it('does nothing when its ref is not attached', async () => {
    function Unattached() {
      createInitialLiveRegionTextMutation();
      return <div data-testid="status">Status</div>;
    }

    render(() => <Unattached />);
    await flushMicrotasks();

    expect(screen.getByTestId('status')).toHaveTextContent('Status');
  });

  it('marks the text when the element appears after mount', async () => {
    const [present, setPresent] = createSignal(false);

    function Status() {
      const ref = createInitialLiveRegionTextMutation<HTMLDivElement>(present);
      return (
        <Show when={present()}>
          <div ref={ref} data-testid="status">
            Ready
          </div>
        </Show>
      );
    }

    render(() => <Status />);
    await flushMicrotasks();

    expect(screen.queryByTestId('status')).toBe(null);

    setPresent(true);
    await flushMicrotasks();

    expect(screen.getByTestId('status').firstChild).toHaveProperty('nodeValue', 'Ready⁠');
  });

  it('skips empty text nodes when finding the announcement text', async () => {
    const text = document.createTextNode('Status');
    const empty = document.createTextNode('');

    function Status() {
      const ref = createInitialLiveRegionTextMutation<HTMLDivElement>();
      return (
        <div
          ref={(element) => {
            ref(element);
            element.append(text, empty);
          }}
          data-testid="status"
        />
      );
    }

    render(() => <Status />);
    await flushMicrotasks();

    expect(text.data).toBe('Status⁠');
    expect(empty.data).toBe('');
  });

  describe('with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not overwrite text that changes before the reset', async () => {
      function Status() {
        const ref = createInitialLiveRegionTextMutation<HTMLDivElement>();
        return (
          <div ref={ref} data-testid="status">
            Status
          </div>
        );
      }

      render(() => <Status />);
      await flushMicrotasks();
      const status = screen.getByTestId('status');
      status.firstChild!.nodeValue = 'Updated';

      vi.advanceTimersByTime(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

      expect(status).toHaveTextContent('Updated');
    });
  });
});
