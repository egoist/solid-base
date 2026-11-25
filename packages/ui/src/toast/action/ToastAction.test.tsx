import { expect, vi, describe, it } from 'vitest';
import { Toast } from '..';
import { List, Button, render, screen } from '../utils/test-utils';

describe('<Toast.Action />', () => {
  

  const toast: Toast.Root.ToastObject = {
    id: 'test',
    title: 'title',
  };

  it('conformance: forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast}>
            <Toast.Action
              ref={(el) => {
                ref = el;
              }}
              class={(state) => `type-${state.type ?? 'none'}`}
              style={{ color: 'red' }}
              render={(props) => <span {...props} />}
              nativeButton={false}
            >
              action
            </Toast.Action>
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    const action = screen.getByText('action');
    expect(ref).toBe(action);
    expect(action.tagName).toBe('SPAN');
    expect(action).toHaveAttribute('role', 'button');
    expect(action).toHaveClass('type-none');
    expect(action).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('performs an action when clicked', async () => {
    const onClick = vi.fn();

    function AddButton() {
      const { add } = Toast.useToastManager();
      return (
        <button
          type="button"
          onClick={() =>
            add({
              title: 'title',
              actionProps: {
                children: 'action',
                onClick,
              },
            })
          }
        >
          add
        </button>
      );
    }

    const { user } = render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <AddButton />
      </Toast.Provider>
));

    await user.click(screen.getByRole('button', { name: 'add' }));
    expect(onClick).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('action'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forwards actionProps to the button', async () => {
    const { user } = render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
));

    const button = screen.getByRole('button', { name: 'add' });

    await user.click(button);

    expect(screen.getByTestId('action').id).toBe('action');
  });

  it('does not render if it has no children', async () => {
    function AddButton() {
      const { add } = Toast.useToastManager();
      return (
        <button
          type="button"
          onClick={() =>
            add({
              actionProps: {
                children: undefined,
              },
            })
          }
        >
          add
        </button>
      );
    }

    const { user } = render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <AddButton />
      </Toast.Provider>
));

    const button = screen.getByRole('button', { name: 'add' });
    await user.click(button);

    const actionElement = screen.queryByTestId('action');
    expect(actionElement).toBe(null);
  });

  // Deviation: a Solid render function can't be inspected for its own children without calling
  // it, so content is passed as children of the part instead.
  it('renders content passed through the render prop', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast}>
            <Toast.Action render={(props) => <button {...props} type="button" />}>
              render prop action
            </Toast.Action>
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
));

    expect(screen.getByText('render prop action')).not.toBe(null);
  });

  it('does not render a childless render prop when there is no action content', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast}>
            <Toast.Action
              render={(props) => <button {...props} type="button" data-testid="action-render" />}
            />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
));

    expect(screen.queryByTestId('action-render')).toBe(null);
  });

  it('renders the toast action content through a childless render prop', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test', actionProps: { children: 'Undo' } }}>
            <Toast.Action render={(props) => <button {...props} type="button" />} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
));

    expect(screen.getByText('Undo')).not.toBe(null);
  });
});
