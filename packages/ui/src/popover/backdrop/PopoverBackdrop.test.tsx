import { createEffect } from 'solid-js';
import { render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Popover } from '..';

describe('<Popover.Backdrop />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Popover.Root open>
        <Popover.Backdrop
          data-testid="backdrop"
          ref={(el) => {
            ref = el;
          }}
          class={(state) => (state.open ? 'backdrop open' : 'backdrop')}
          style={{ color: 'red' }}
          render={(props, state) => <section {...props} data-state-open={String(state.open)} />}
        />
      </Popover.Root>
    ));
    const backdrop = screen.getByTestId('backdrop');
    expect(ref).toBe(backdrop);
    expect(backdrop.tagName).toBe('SECTION');
    expect(backdrop).toHaveClass('backdrop', 'open');
    expect(backdrop).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(backdrop).toHaveAttribute('data-state-open', 'true');
    expect(backdrop).toHaveAttribute('data-open');
    expect(backdrop).toHaveAttribute('role', 'presentation');
  });

  it.each([false, true])(
    'does not start an entry phase when initially open (controlled=%s)',
    (controlled) => {
      const statuses = new Set<Popover.Backdrop.State['transitionStatus']>();

      function RecordState(props: { state: Popover.Backdrop.State }) {
        createEffect(
          () => props.state.transitionStatus,
          (status) => {
            statuses.add(status);
          },
        );
        return null;
      }

      render(() => (
        <Popover.Root open={controlled ? true : undefined} defaultOpen={!controlled}>
          <Popover.Backdrop
            render={(props, state) => (
              <div {...props}>
                <RecordState state={state} />
              </div>
            )}
          />
        </Popover.Root>
      ));

      expect(statuses).toEqual(new Set([undefined]));
    },
  );

  it('sets `pointer-events: none` style on backdrop if opened by hover', async () => {
    const user = userEvent.setup();
    render(() => (
      <Popover.Root>
        <Popover.Trigger delay={0} openOnHover>
          Open
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Backdrop data-testid="backdrop" />
          <Popover.Positioner>
            <Popover.Popup />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    await user.hover(screen.getByText('Open'));

    await waitFor(() => {
      expect(screen.getByTestId('backdrop').style.pointerEvents).toBe('none');
    });
  });

  it('does not set `pointer-events: none` style on backdrop if opened by click', async () => {
    const user = userEvent.setup();
    render(() => (
      <Popover.Root>
        <Popover.Trigger openOnHover>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Backdrop data-testid="backdrop" />
          <Popover.Positioner>
            <Popover.Popup />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    await user.click(screen.getByText('Open'));

    await waitFor(() => {
      expect(screen.getByTestId('backdrop').style.pointerEvents).not.toBe('none');
    });
  });
});
