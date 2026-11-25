import { render, screen } from '@solidjs/testing-library';
import { Tooltip } from '..';

describe('<Tooltip.Arrow />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: Element | undefined;
      render(() => (
        <Tooltip.Root open>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>
                <Tooltip.Arrow
                  data-testid="arrow"
                  ref={(el) => {
                    ref = el;
                  }}
                  class={(state) => (state.open ? 'arrow open' : 'arrow')}
                  style={{ color: 'red' }}
                  render={(props, state) => <span {...props} data-side-state={state.side} />}
                />
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));
      const arrow = screen.getByTestId('arrow');
      expect(ref).toBe(arrow);
      expect(arrow.tagName).toBe('SPAN');
      expect(arrow).toHaveClass('arrow', 'open');
      expect(arrow).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(arrow).toHaveAttribute('data-side-state', 'top');
    });
  });

  function ArrowTooltip() {
    return (
      <div style={{ position: 'fixed', top: '0', left: '0' }}>
        <Tooltip.Root open>
          <Tooltip.Trigger style={{ width: '20px', height: '20px' }}>T</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner side="bottom">
              <Tooltip.Popup style={{ width: '200px', height: '40px' }}>
                <Tooltip.Arrow data-testid="arrow" style={{ width: '10px', height: '10px' }} />
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    );
  }

  it('is hidden from assistive technology and mirrors the resolved side', () => {
    render(() => <ArrowTooltip />);

    const arrow = screen.getByTestId('arrow');

    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveAttribute('data-side', 'bottom');
    expect(arrow).toHaveAttribute('data-open');
  });

  // jsdom has no layout: the arrow's centering against the anchor can't be measured.
  it.skip('is marked uncentered when it cannot point at the anchor', () => {});
  // jsdom has no layout: the arrow's centering against the anchor can't be measured.
  it.skip('is not marked uncentered when it can point at the anchor', () => {});
});
