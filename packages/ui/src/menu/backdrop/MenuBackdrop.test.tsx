import { createEffect } from 'solid-js';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';
import { renderWithUser } from '../test-utils';

describe('<Menu.Backdrop />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Menu.Root open>
        <Menu.Backdrop
          data-testid="backdrop"
          ref={(el) => {
            ref = el;
          }}
          class={(state) => (state.open ? 'open' : 'closed')}
          style={{ color: 'red' }}
          render={(props) => <section {...props} />}
        />
      </Menu.Root>
    ));
    const backdrop = screen.getByTestId('backdrop');
    expect(ref).toBe(backdrop);
    expect(backdrop.tagName).toBe('SECTION');
    expect(backdrop).toHaveClass('open');
    expect(backdrop).toHaveAttribute('role', 'presentation');
    expect(backdrop).toHaveAttribute('data-open');
    expect(backdrop.style.color).toBe('red');
    expect(backdrop.style.userSelect).toBe('none');
  });

  it.each([false, true])(
    'does not start an entry phase when initially open (controlled=%s)',
    (controlled) => {
      const statuses = new Set<Menu.Backdrop.State['transitionStatus']>();
      function RecordState(props: { state: Menu.Backdrop.State }) {
        createEffect(
          () => props.state.transitionStatus,
          (status) => {
            statuses.add(status);
          },
        );
        return null;
      }

      render(() => (
        <Menu.Root open={controlled ? true : undefined} defaultOpen={!controlled}>
          <Menu.Backdrop
            render={(props, state) => (
              <div {...props}>
                <RecordState state={state} />
              </div>
            )}
          />
        </Menu.Root>
      ));

      expect(statuses).toEqual(new Set([undefined]));
    },
  );

  it('sets `pointer-events: none` style on backdrop if opened by hover', async () => {
    const { user } = renderWithUser(() => (
      <Menu.Root>
        <Menu.Trigger delay={0} openOnHover>
          Open
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Backdrop data-testid="backdrop" />
          <Menu.Positioner>
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await user.hover(screen.getByText('Open'));

    await waitFor(() => {
      expect(screen.getByTestId('backdrop').style.pointerEvents).toBe('none');
    });
  });

  it('does not set `pointer-events: none` style on backdrop if opened by click', async () => {
    const { user } = renderWithUser(() => (
      <Menu.Root>
        <Menu.Trigger delay={0}>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Backdrop data-testid="backdrop" />
          <Menu.Positioner>
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await user.click(screen.getByText('Open'));

    await waitFor(() => {
      expect(screen.getByTestId('backdrop')).toBeInTheDocument();
    });
    expect(screen.getByTestId('backdrop').style.pointerEvents).not.toBe('none');
  });
});
