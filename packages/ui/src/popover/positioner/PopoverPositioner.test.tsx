import { Errored } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Popover } from '..';

describe('<Popover.Positioner />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Popover.Root open>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            data-testid="positioner"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => `positioner side-${state.side}`}
            style={{ color: 'red' }}
            render={(props, state) => <section {...props} data-state-align={state.align} />}
          >
            <Popover.Popup />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    const positioner = screen.getByTestId('positioner');
    expect(ref).toBe(positioner);
    expect(positioner.tagName).toBe('SECTION');
    expect(positioner).toHaveClass('positioner', 'side-bottom');
    expect(positioner).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(positioner).toHaveAttribute('data-state-align', 'center');
    expect(positioner).toHaveAttribute('role', 'presentation');
    expect(positioner).toHaveAttribute('data-open');
    expect(positioner).toHaveAttribute('data-side', 'bottom');
    expect(positioner).toHaveAttribute('data-align', 'center');
  });

  it('renders a div by default', () => {
    render(() => (
      <Popover.Root open>
        <Popover.Portal>
          <Popover.Positioner data-testid="positioner">
            <Popover.Popup />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    expect(screen.getByTestId('positioner')).toBeInstanceOf(window.HTMLDivElement);
  });

  it('applies the side and align props as data attributes', () => {
    render(() => (
      <Popover.Root open>
        <Popover.Portal>
          <Popover.Positioner data-testid="positioner" side="left" align="start">
            <Popover.Popup data-testid="popup" />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'left');
    expect(screen.getByTestId('positioner')).toHaveAttribute('data-align', 'start');
    expect(screen.getByTestId('popup')).toHaveAttribute('data-side', 'left');
    expect(screen.getByTestId('popup')).toHaveAttribute('data-align', 'start');
  });

  it('throws a descriptive error when rendered outside <Popover.Portal>', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Popover.Root open>
          <Popover.Positioner />
        </Popover.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent('Base UI: <Popover.Portal> is missing.');
  });

  // The remaining upstream tests measure the positioner with `getBoundingClientRect()` (anchoring
  // after the trigger moves, anchor tracking on scroll, custom anchor observation and the
  // `--transform-origin` computations). jsdom has no layout, so they only run in a real browser.
  it.skip('remains anchored if keepMounted=false', () => {});
  it.skip('remains anchored if keepMounted=true', () => {});
  it.skip('does not follow the anchor when its ancestor scrolls', () => {});
  it.skip('observes a custom anchor for keepMounted auto-updates', () => {});
  it.skip('remains anchored to the trigger when closing from a tooltip trigger close', () => {});
  describe.skip('transform origin', () => {
    it('points to the anchor center / popup edges for every side, alignment and offset', () => {});
  });
});
