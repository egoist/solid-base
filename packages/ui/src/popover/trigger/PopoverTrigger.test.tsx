import { Errored, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Popover } from '..';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { flushMicrotasks, renderWithUser } from '../../dialog/test-utils';

function enterWithMouse(element: HTMLElement) {
  fireEvent.pointerEnter(element, { pointerType: 'mouse' });
  fireEvent.mouseEnter(element);
  fireEvent.mouseMove(element);
}

describe('<Popover.Trigger />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Popover.Root open>
        <Popover.Trigger
          ref={(el) => {
            ref = el;
          }}
          class={(state) => (state.open ? 'trigger open' : 'trigger')}
          style={{ color: 'red' }}
          render={(props) => <button {...props} data-custom="" />}
        >
          Toggle
        </Popover.Trigger>
      </Popover.Root>
    ));
    const trigger = screen.getByRole('button', { name: 'Toggle' });
    expect(ref).toBe(trigger);
    expect(trigger).toHaveAttribute('data-custom');
    expect(trigger).toHaveClass('trigger');
    expect(trigger).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('renders a button with type="button" by default', () => {
    render(() => (
      <Popover.Root>
        <Popover.Trigger>Toggle</Popover.Trigger>
      </Popover.Root>
    ));
    const trigger = screen.getByRole('button');
    expect(trigger).toBeInstanceOf(window.HTMLButtonElement);
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('throws a descriptive error when rendered without a root or a handle', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Popover.Trigger>Toggle</Popover.Trigger>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: <Popover.Trigger> must be either used within a <Popover.Root> component or provided with a handle.',
    );
  });

  describe('prop: disabled', () => {
    it('disables the popover', async () => {
      const { user } = renderWithUser(() => (
        <Popover.Root>
          <Popover.Trigger disabled />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.click(trigger);
      expect(screen.queryByText('Content')).toBe(null);

      await user.keyboard('[Tab]');
      expect(document.activeElement).not.toBe(trigger);
    });

    it('custom element', async () => {
      const { user } = renderWithUser(() => (
        <Popover.Root>
          <Popover.Trigger disabled render="span" nativeButton={false} />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');
      expect(trigger).not.toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');
      expect(trigger).toHaveAttribute('aria-disabled', 'true');

      await user.click(trigger);
      expect(screen.queryByText('Content')).toBe(null);

      await user.keyboard('[Tab]');
      expect(document.activeElement).not.toBe(trigger);
    });

    it('does not open on hover when disabled', async () => {
      const { user } = renderWithUser(() => (
        <Popover.Root>
          <Popover.Trigger disabled openOnHover delay={0} render="span" nativeButton={false} />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.hover(trigger);
      await flushMicrotasks();

      expect(screen.queryByText('Content')).toBe(null);
      expect(trigger).not.toHaveAttribute('data-popup-open');
    });
  });

  describe('openOnHover opened by touch', () => {
    function MultiTriggerPopover() {
      return (
        <Popover.Root>
          {(arg: { readonly payload: unknown }) => (
            <>
              <Popover.Trigger
                payload="One"
                openOnHover
                delay={0}
                closeDelay={0}
                style={{ 'pointer-events': 'none' }}
              >
                One
              </Popover.Trigger>
              <Popover.Trigger
                payload="Two"
                openOnHover
                delay={0}
                closeDelay={0}
                style={{ 'pointer-events': 'none' }}
              >
                Two
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>
                    <span data-testid="content">{arg.payload as string}</span>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </>
          )}
        </Popover.Root>
      );
    }

    async function pressTrigger(trigger: HTMLElement, pointerType: 'mouse' | 'touch') {
      fireEvent.pointerDown(trigger, { pointerType });
      fireEvent.mouseDown(trigger);
      fireEvent.click(trigger, { detail: 1 });
      flush();
      await flushMicrotasks();
    }

    // A touch tap leaves the pointer parked wherever the cursor happens to be, so hover must stay
    // disarmed until the popover is reopened by some other means.
    it('keeps ownership on the tapped trigger when a sibling trigger is hovered', async () => {
      render(() => <MultiTriggerPopover />);

      const one = screen.getByRole('button', { name: 'One' });
      const two = screen.getByRole('button', { name: 'Two' });

      await pressTrigger(one, 'touch');

      expect(screen.getByTestId('content')).toHaveTextContent('One');

      enterWithMouse(two);
      flush();
      await flushMicrotasks();

      expect(screen.getByTestId('content')).toHaveTextContent('One');
      expect(two).toHaveAttribute('aria-expanded', 'false');
    });

    // The same hover must still take over when the popover was opened with a mouse.
    it('hands ownership to a hovered sibling trigger when opened by mouse', async () => {
      render(() => <MultiTriggerPopover />);

      const one = screen.getByRole('button', { name: 'One' });
      const two = screen.getByRole('button', { name: 'Two' });

      await pressTrigger(one, 'mouse');

      expect(screen.getByTestId('content')).toHaveTextContent('One');

      enterWithMouse(two);
      flush();
      await flushMicrotasks();

      expect(screen.getByTestId('content')).toHaveTextContent('Two');
      expect(two).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('style hooks', () => {
    it('should have the data-popup-open and data-pressed attributes when open by clicking', () => {
      render(() => (
        <Popover.Root>
          <Popover.Trigger />
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');
      trigger.click();
      flush();

      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('data-pressed');
    });

    it('should have the data-popup-open but not the data-pressed attribute when open by hover', async () => {
      const { user } = renderWithUser(() => (
        <Popover.Root>
          <Popover.Trigger openOnHover delay={0} />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      await user.hover(trigger);
      flush();

      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).not.toHaveAttribute('data-pressed');
    });

    it('should not have the data-popup-open and data-pressed attributes when open by click when `openOnHover=true` and `delay=0`', async () => {
      const { user } = renderWithUser(() => (
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      await user.hover(trigger);
      trigger.click();
      flush();

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('should have the data-popup-open and data-pressed attributes when open by click when `openOnHover=true`', async () => {
      const { user } = renderWithUser(() => (
        <Popover.Root>
          <Popover.Trigger openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      await user.hover(trigger);
      trigger.click();
      flush();

      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('data-pressed');
    });
  });

  describe('impatient clicks with `openOnHover=true`', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    function tick(ms: number) {
      vi.advanceTimersByTime(ms);
      flush();
    }

    it('closes the popover if the user clicks patiently', () => {
      render(() => (
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      flush();

      tick(PATIENT_CLICK_THRESHOLD);

      fireEvent.click(trigger);
      flush();

      expect(trigger).not.toHaveAttribute('data-popup-open');

      // Leaving the trigger afterwards doesn't reopen it.
      fireEvent.mouseLeave(trigger);
      flush();

      expect(trigger).not.toHaveAttribute('data-popup-open');
    });

    it('sticks if the user clicks impatiently', () => {
      render(() => (
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      flush();

      // The hover opened the popover, so the click below lands on an open popover.
      expect(trigger).toHaveAttribute('data-popup-open');

      tick(PATIENT_CLICK_THRESHOLD - 1);

      fireEvent.click(trigger);
      flush();

      expect(trigger).toHaveAttribute('data-popup-open');

      fireEvent.mouseLeave(trigger);
      flush();

      expect(trigger).toHaveAttribute('data-popup-open');

      tick(1);

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('sticks when clicked before the hover delay completes', () => {
      render(() => (
        <Popover.Root>
          <Popover.Trigger openOnHover delay={300}>
            Open
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      tick(100);

      // User clicks impatiently to open
      fireEvent.click(trigger);
      flush();

      expect(trigger).toHaveAttribute('data-popup-open');

      fireEvent.mouseLeave(trigger);
      flush();

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('should keep the popover open when re-hovered and clicked within the patient threshold', async () => {
      render(() => (
        <Popover.Root>
          <Popover.Trigger openOnHover delay={100}>
            Open
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      tick(100);
      await flushMicrotasks();

      expect(screen.getByText('Content')).not.toBe(null);

      tick(PATIENT_CLICK_THRESHOLD);

      fireEvent.mouseLeave(trigger);
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      flush();

      fireEvent.click(trigger);
      flush();
      expect(screen.getByText('Content')).not.toBe(null);
    });
  });

  // Upstream runs these in a real browser only: native tab order with `user.tab()` and focus
  // guards requires real focus navigation.
  describe.skip('opened by hover', () => {
    it('tabs forward/backward from the trigger in native order', () => {});
    it('tabs onto the trigger / past an untabbable trigger', () => {});
  });

  // Upstream runs this in a real browser only (vitest-browser-react + real keyboard).
  it.skip('should toggle closed with Enter or Space when rendering a <div>', () => {});
});
