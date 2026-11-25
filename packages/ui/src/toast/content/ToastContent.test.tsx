import { For, createSignal } from 'solid-js';
import { expect, describe, it } from 'vitest';
import { Toast } from '..';
import { fireEvent, render, screen } from '../utils/test-utils';

const toast = {
  id: 'test',
  title: 'Toast title',
};

describe('<Toast.Content />', () => {
  

  it('conformance: forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast}>
            <Toast.Content
              ref={(el) => {
                ref = el;
              }}
              data-testid="content"
              class={(state) => (state.behind ? 'behind' : 'front')}
              style={{ color: 'red' }}
              render={(props) => <section {...props} />}
            />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    const content = screen.getByTestId('content');
    expect(ref).toBe(content);
    expect(content.tagName).toBe('SECTION');
    expect(content).toHaveClass('front');
    expect(content).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  function App() {
    const toastManager = Toast.useToastManager();
    const { add } = toastManager;
    const [count, setCount] = createSignal(0);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            const next = count() + 1;
            setCount(next);
            add({ title: `toast-${next}` });
          }}
        >
          add
        </button>
        <Toast.Viewport data-testid="viewport">
          <For each={toastManager.toasts}>{(toastItem) => (
            <Toast.Root toast={toastItem}>
              <Toast.Content data-testid={`content-${toastItem.title}`}>
                <Toast.Title />
              </Toast.Content>
            </Toast.Root>
          )}</For>
        </Toast.Viewport>
      </>
    );
  }

  it('marks content behind the frontmost toast with data-behind', async () => {
    render(() => (
      <Toast.Provider>
        <App />
      </Toast.Provider>
));

    const addButton = screen.getByRole('button', { name: 'add' });
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    // The newest toast is at the front; the older one sits behind it.
    expect(screen.getByTestId('content-toast-2')).not.toHaveAttribute('data-behind');
    expect(screen.getByTestId('content-toast-1')).toHaveAttribute('data-behind');
  });

  it('reflects the expanded state when the viewport is hovered', async () => {
    render(() => (
      <Toast.Provider>
        <App />
      </Toast.Provider>
));

    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    const content = screen.getByTestId('content-toast-1');
    expect(content).not.toHaveAttribute('data-expanded');

    fireEvent.mouseEnter(screen.getByTestId('viewport'));
    expect(content).toHaveAttribute('data-expanded');
  });
});
