import { createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Combobox } from '..';
import { INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY } from '../../internals/initialLiveRegionTextMutation';
import { flushMicrotasks } from '../test-utils';

describe('<Combobox.Status />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root>
        <Combobox.Status
          data-testid="status"
          ref={(el) => {
            ref = el;
          }}
          class="status"
          style={{ color: 'red' }}
          render={(props) => <section {...props} />}
        />
      </Combobox.Root>
    ));

    const status = screen.getByTestId('status');
    expect(ref).toBe(status);
    expect(status.tagName).toBe('SECTION');
    expect(status).toHaveClass('status');
    expect(status).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
  });

  it('renders only when open', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Status data-testid="status">Searching…</Combobox.Status>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.queryByTestId('status')).toBe(null);
    await user.click(screen.getByTestId('input'));
    await waitFor(() => expect(screen.getByTestId('status')).not.toBe(null));
  });

  describe('a11y', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function StatusTest(props: { children?: JSX.Element }) {
      return (
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Status data-testid="status">{props.children}</Combobox.Status>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      );
    }

    it('removes the initial text mutation after the reset delay', async () => {
      render(() => <StatusTest>Searching…</StatusTest>);
      await flushMicrotasks();

      expect(screen.getByRole('status')).toBe(screen.getByTestId('status'));
      expect(screen.getByTestId('status').textContent).toBe('Searching…⁠');

      vi.advanceTimersByTime(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

      expect(screen.getByTestId('status').textContent).toBe('Searching…');
    });

    it('updates content immediately after the live region has mounted', async () => {
      const [text, setText] = createSignal<string | undefined>(undefined);
      render(() => <StatusTest>{text()}</StatusTest>);
      await flushMicrotasks();

      expect(screen.getByRole('status')).toBe(screen.getByTestId('status'));
      expect(screen.getByTestId('status')).toHaveTextContent('');

      setText('Searching…');
      await flushMicrotasks();

      expect(screen.getByTestId('status')).toHaveTextContent('Searching…');
    });

    it('preserves a custom render prop on the visible element', async () => {
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Status render={(props) => <p data-testid="custom-status" {...props} />}>
                  Searching…
                </Combobox.Status>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('custom-status').tagName).toBe('P');
      expect(screen.getByRole('status')).toBe(screen.getByTestId('custom-status'));
      expect(screen.getByTestId('custom-status').textContent).toBe('Searching…⁠');

      vi.advanceTimersByTime(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

      expect(screen.getByTestId('custom-status').textContent).toBe('Searching…');
    });

    it('restores the marker before unmounting during the reset delay', async () => {
      const { unmount } = render(() => <StatusTest>Searching…</StatusTest>);
      await flushMicrotasks();

      const status = screen.getByTestId('status');
      expect(status.textContent).toBe('Searching…⁠');

      unmount();

      expect(status.textContent).toBe('Searching…');
    });
  });
});
