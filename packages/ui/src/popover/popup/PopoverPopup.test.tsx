import { Errored, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Popover } from '..';
import { Toolbar } from '../../toolbar';
import {
  flushMicrotasks,
  popupFocusPropsTests,
  renderWithUser,
} from '../../dialog/test-utils';

describe('<Popover.Popup />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Popover.Root open>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup
              ref={(el) => {
                ref = el;
              }}
              class={(state) => (state.open ? 'popup open' : 'popup')}
              style={{ color: 'red' }}
              render={(props, state) => <section {...props} data-state-side={state.side} />}
            />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    const popup = screen.getByRole('dialog');
    expect(ref).toBe(popup);
    expect(popup.tagName).toBe('SECTION');
    expect(popup).toHaveClass('popup', 'open');
    expect(popup).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(popup).toHaveAttribute('data-state-side', 'bottom');
    expect(popup).toHaveAttribute('data-open');
    expect(popup).toHaveAttribute('data-side', 'bottom');
  });

  it('throws a descriptive error when rendered outside <Popover.Root>', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Popover.Popup />
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: PopoverRootContext is missing. Popover parts must be placed within <Popover.Root>.',
    );
  });

  it('throws a descriptive error when rendered outside <Popover.Positioner>', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Popover.Root open>
          <Popover.Portal>
            <Popover.Popup />
          </Popover.Portal>
        </Popover.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: PopoverPositionerContext is missing. PopoverPositioner parts must be placed within <Popover.Positioner>.',
    );
  });

  it('should render the children', () => {
    render(() => (
      <Popover.Root open>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    expect(screen.getByText('Content')).not.toBe(null);
  });

  describe('prop: id', () => {
    it('keeps the generated id when undefined', async () => {
      const { user } = renderWithUser(() => (
        <Popover.Root>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup id={undefined} />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const popup = await screen.findByRole('dialog');
      expect(popup.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
    });
  });

  popupFocusPropsTests({
    createComponent: (props) => (
      <Popover.Root>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup initialFocus={props.initialFocus} finalFocus={props.finalFocus}>
              {props.children()}
              <Popover.Close>Close</Popover.Close>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
  });

  // Requires layout: jsdom doesn't compute `display: none` for focus visibility checks.
  it.skip('focuses the popup when the active element becomes display:none', () => {});

  describe('openOnHover: delay + click', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns focus to the trigger if opened by click before the hover delay completes', async () => {
      render(() => (
        <Popover.Root>
          <Popover.Trigger openOnHover delay={300}>
            Open
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>
                <Popover.Close>Close</Popover.Close>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByText('Open');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      vi.advanceTimersByTime(100);
      flush();

      fireEvent.click(trigger);
      flush();
      await flushMicrotasks();

      expect(screen.getByText('Close')).not.toBe(null);

      vi.advanceTimersByTime(1000);
      flush();
      await flushMicrotasks();

      fireEvent.click(screen.getByText('Close'));
      flush();
      await flushMicrotasks();
      vi.advanceTimersByTime(50);
      flush();

      expect(trigger).toHaveFocus();
    });
  });

  describe('inside a toolbar', () => {
    function ToolbarPopover(props: { children?: any }) {
      return (
        <Toolbar.Root>
          <Toolbar.Button>First</Toolbar.Button>
          <Popover.Root>
            <Toolbar.Button render={(buttonProps) => <Popover.Trigger {...buttonProps} />}>
              Open
            </Toolbar.Button>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>{props.children}</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <Toolbar.Button>Last</Toolbar.Button>
        </Toolbar.Root>
      );
    }

    // The popup is portaled but its events still bubble through the component tree to
    // `Toolbar.Root`, whose composite handler would move the roving highlight.
    it('does not relay composite keys from the popup to the toolbar', async () => {
      const { user } = renderWithUser(() => (
        <ToolbarPopover>
          <button type="button">Inside</button>
        </ToolbarPopover>
      ));

      await user.keyboard('[Tab]');
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
      await user.keyboard('[ArrowRight]');
      const trigger = screen.getByRole('button', { name: 'Open' });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });

      await user.keyboard('[Enter]');
      const insideButton = await screen.findByRole('button', { name: 'Inside' });
      await waitFor(() => {
        expect(insideButton).toHaveFocus();
      });

      await user.keyboard('[ArrowRight]');
      await flushMicrotasks();

      expect(insideButton).toHaveFocus();
      expect(screen.getByRole('button', { name: 'Last' })).not.toHaveFocus();
    });

    it('keeps composite keys working inside the popup content', async () => {
      const { user } = renderWithUser(() => (
        <ToolbarPopover>
          <input value="ab" />
        </ToolbarPopover>
      ));

      await user.click(screen.getByRole('button', { name: 'Open' }));

      const input = (await screen.findByRole('textbox')) as HTMLInputElement;
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      input.setSelectionRange(0, 0);
      await user.keyboard('[ArrowRight]');

      expect(input.selectionStart).toBe(1);
      expect(screen.getByRole('button', { name: 'Last' })).not.toHaveFocus();
    });
  });
});
