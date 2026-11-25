import { render, screen } from '@solidjs/testing-library';
import { PreviewCard } from '..';

describe('<PreviewCard.Arrow />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <PreviewCard.Root open>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup>
              <PreviewCard.Arrow
                data-testid="arrow"
                ref={(el) => {
                  ref = el;
                }}
                class={(state) => (state.open ? 'arrow open' : 'arrow')}
                style={{ color: 'red' }}
                render={(props, state) => <span {...props} data-state-side={state.side} />}
              />
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));
    const arrow = screen.getByTestId('arrow');
    expect(ref).toBe(arrow);
    expect(arrow.tagName).toBe('SPAN');
    expect(arrow).toHaveClass('arrow', 'open');
    expect(arrow).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveAttribute('data-side', 'bottom');
    expect(arrow).toHaveAttribute('data-align', 'center');
    expect(arrow).toHaveAttribute('data-state-side', 'bottom');
    expect(arrow).toHaveAttribute('data-open');
  });
});
