import { Errored } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { PreviewCard } from '..';

describe('<PreviewCard.Positioner />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <PreviewCard.Root open>
          <PreviewCard.Portal>
            <PreviewCard.Positioner
              data-testid="positioner"
              ref={(el) => {
                ref = el;
              }}
              class={(state) => (state.open ? 'positioner open' : 'positioner')}
              style={{ color: 'red' }}
              render={(props, state) => <section {...props} data-state-align={state.align} />}
            >
              <PreviewCard.Popup />
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));
      const positioner = screen.getByTestId('positioner');
      expect(ref).toBe(positioner);
      expect(positioner.tagName).toBe('SECTION');
      expect(positioner).toHaveClass('positioner', 'open');
      expect(positioner).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(positioner).toHaveAttribute('role', 'presentation');
      expect(positioner).toHaveAttribute('data-side', 'bottom');
      expect(positioner).toHaveAttribute('data-align', 'center');
      expect(positioner).toHaveAttribute('data-state-align', 'center');
      expect(positioner).toHaveAttribute('data-open');
    });

    it('renders a div by default', () => {
      render(() => (
        <PreviewCard.Root open>
          <PreviewCard.Portal>
            <PreviewCard.Positioner data-testid="positioner" />
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));
      expect(screen.getByTestId('positioner')).toBeInstanceOf(window.HTMLDivElement);
    });

    it('reflects the `side` and `align` props', () => {
      render(() => (
        <PreviewCard.Root open>
          <PreviewCard.Portal>
            <PreviewCard.Positioner data-testid="positioner" side="left" align="start">
              <PreviewCard.Popup data-testid="popup" />
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));
      expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'left');
      expect(screen.getByTestId('positioner')).toHaveAttribute('data-align', 'start');
      expect(screen.getByTestId('popup')).toHaveAttribute('data-side', 'left');
      expect(screen.getByTestId('popup')).toHaveAttribute('data-align', 'start');
    });
  });

  it('throws a descriptive error when rendered outside <PreviewCard.Portal>', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <PreviewCard.Root open>
          <PreviewCard.Positioner />
        </PreviewCard.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent('Base UI: <PreviewCard.Portal> is missing.');
  });

  // The multiline inline trigger tests measure real line boxes and scroll offsets (browser-only
  // upstream: `describe.skipIf(isJSDOM)`); jsdom has no layout.
  describe.skip('multiline inline trigger', () => {
    it('positions the popup relative to the hovered line of a multiline trigger', () => {});
    it('with delayed opening: uses the latest hovered line', () => {});
    it('keeps the popup aligned after page scroll', () => {});
    it('stays anchored to the opened line while already open', () => {});
    it('re-anchors to a newly entered line while reopening during close transition', () => {});
    it('positions the popup relative to the side-aligned rect when open is controlled', () => {});
    it('clears hovered-line coords after close before controlled reopen of the same trigger', () => {});
    it('ignores stale hovered coords when a controlled trigger switch reuses the popup', () => {});
    it('uses the hovered line with a custom anchor in a clipped keepMounted portal', () => {});
    it('positions the popup relative to the side-aligned rect when opened via focus', () => {});
    it('clears hovered-line coords when opened via focus', () => {});
  });
});
