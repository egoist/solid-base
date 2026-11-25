import { Errored } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Tooltip } from '..';

function Trigger(props: Tooltip.Trigger.Props) {
  return <Tooltip.Trigger {...props} render="div" />;
}

describe('<Tooltip.Positioner />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Tooltip.Root open>
          <Tooltip.Portal>
            <Tooltip.Positioner
              data-testid="positioner"
              ref={(el) => {
                ref = el;
              }}
              class={(state) => (state.open ? 'positioner open' : 'positioner')}
              style={{ color: 'red' }}
              render={(props, state) => <section {...props} data-side-state={state.side} />}
            />
          </Tooltip.Portal>
        </Tooltip.Root>
      ));
      const positioner = screen.getByTestId('positioner');
      expect(ref).toBe(positioner);
      expect(positioner.tagName).toBe('SECTION');
      expect(positioner).toHaveClass('positioner', 'open');
      expect(positioner).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(positioner).toHaveAttribute('data-side-state', 'top');
      expect(positioner).toHaveAttribute('role', 'presentation');
    });
  });

  describe('prop: side', () => {
    it('defaults to the top side', () => {
      render(() => (
        <Tooltip.Root open>
          <Trigger>Trigger</Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner data-testid="positioner" />
          </Tooltip.Portal>
        </Tooltip.Root>
      ));

      expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'top');
    });

    it('uses the side prop over the default', () => {
      render(() => (
        <Tooltip.Root open>
          <Trigger>Trigger</Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner data-testid="positioner" side="bottom" />
          </Tooltip.Portal>
        </Tooltip.Root>
      ));

      expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'bottom');
    });
  });

  it('throws a descriptive error when rendered outside <Tooltip.Root>', () => {
    expect(() => render(() => <Tooltip.Positioner />)).toThrow(
      'Base UI: TooltipRootContext is missing. Tooltip parts must be placed within <Tooltip.Root>.',
    );
  });

  it('throws a descriptive error when rendered outside <Tooltip.Portal>', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Tooltip.Root open>
          <Tooltip.Positioner />
        </Tooltip.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent('Base UI: <Tooltip.Portal> is missing.');
  });
});
