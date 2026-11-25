import { expect, describe, it } from 'vitest';
import { Toast } from '..';
import { List, Button, act, render, screen } from '../utils/test-utils';

describe('<Toast.Close />', () => {
  

  const toast: Toast.Root.ToastObject = {
    id: 'test',
    title: 'title',
  };

  it('conformance: forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ ...toast, type: 'info' }}>
            <Toast.Close
              ref={(el) => {
                ref = el;
              }}
              data-testid="close"
              class={(state) => `type-${state.type}`}
              style={{ color: 'red' }}
              render={(props) => <button {...props} data-custom="" />}
            />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    const close = screen.getByTestId('close');
    expect(ref).toBe(close);
    expect(close).toHaveAttribute('data-custom');
    expect(close).toHaveAttribute('data-type', 'info');
    expect(close).toHaveClass('type-info');
    expect(close).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('is aria-hidden unless the viewport is expanded or it has focus', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast}>
            <Toast.Close data-testid="close" />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    const close = screen.getByTestId('close');
    expect(close).toHaveAttribute('aria-hidden', 'true');
    await act(() => close.focus());
    expect(close).toHaveAttribute('aria-hidden', 'false');
  });

  it('closes the toast when clicked', async () => {
    const { user } = render(() => (
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
));

    const button = screen.getByRole('button', { name: 'add' });
    const viewport = screen.getByTestId('viewport');

    await user.click(button);

    expect(screen.getByTestId('title')).not.toBe(null);

    await act(async () => {
      viewport.focus();
    });

    const closeButton = screen.getByRole('button', { name: 'close-press' });

    await user.click(closeButton);

    expect(screen.queryByTestId('title')).toBe(null);
  });
});
