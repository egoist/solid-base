import { createSignal } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Combobox } from '..';
import { INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY } from '../../internals/initialLiveRegionTextMutation';
import { flushMicrotasks } from '../test-utils';

describe('<Combobox.Empty />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Empty
                data-testid="empty"
                ref={(el) => {
                  ref = el;
                }}
                class="empty"
                style={{ color: 'red' }}
                render={(props) => <section {...props} />}
              />
              <Combobox.List />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const empty = screen.getByTestId('empty');
    expect(ref).toBe(empty);
    expect(empty.tagName).toBe('SECTION');
    expect(empty).toHaveClass('empty');
    expect(empty).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('renders when there are no filtered items', () => {
    render(() => (
      <Combobox.Root items={[]} defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Empty data-testid="empty">No results</Combobox.Empty>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.getByTestId('empty')).toHaveTextContent('No results');
    expect(screen.getByTestId('empty')).toHaveAttribute('role', 'status');
  });

  it('does not render when there are items', () => {
    render(() => (
      <Combobox.Root items={['a']} defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Empty>No results</Combobox.Empty>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.queryByText(/No results/)).toBe(null);
  });

  it('renders when the search query matches no items', () => {
    render(() => (
      <Combobox.Root items={['a', 'b', 'c']} defaultInputValue="d" defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Empty data-testid="empty">No results</Combobox.Empty>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.getByTestId('empty')).toHaveTextContent('No results');
  });

  it('does not render when the search query matches an item', () => {
    render(() => (
      <Combobox.Root items={['a', 'b', 'c']} defaultInputValue="c" defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Empty data-testid="empty">No results</Combobox.Empty>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.queryByText(/No results/)).toBe(null);
  });

  describe('a11y', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('removes the initial text mutation after the reset delay', async () => {
      render(() => (
        <Combobox.Root items={[]} defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Empty data-testid="empty">No results</Combobox.Empty>
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByRole('status')).toBe(screen.getByTestId('empty'));
      expect(screen.getByTestId('empty').textContent).toBe('No results⁠');

      vi.advanceTimersByTime(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

      expect(screen.getByTestId('empty').textContent).toBe('No results');
    });

    it('updates the live region immediately when the empty content appears after mount', async () => {
      const [items, setItems] = createSignal<string[]>(['a']);
      render(() => (
        <Combobox.Root items={items()} defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Empty data-testid="empty">No results</Combobox.Empty>
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('empty')).toHaveTextContent('');
      expect(screen.getByRole('status')).toBe(screen.getByTestId('empty'));

      setItems([]);
      await flushMicrotasks();

      expect(screen.getByTestId('empty')).toHaveTextContent('No results');
    });

    it('preserves a custom render prop on the visible element', async () => {
      render(() => (
        <Combobox.Root items={[]} defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Empty render={(props) => <p data-testid="custom-empty" {...props} />}>
                  No results
                </Combobox.Empty>
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('custom-empty').tagName).toBe('P');
      expect(screen.getByRole('status')).toBe(screen.getByTestId('custom-empty'));
      expect(screen.getByTestId('custom-empty').textContent).toBe('No results⁠');

      vi.advanceTimersByTime(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

      expect(screen.getByTestId('custom-empty').textContent).toBe('No results');
    });
  });
});
