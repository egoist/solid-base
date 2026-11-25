import { render, screen } from '@solidjs/testing-library';
import { Combobox } from '..';

describe('<Combobox.Arrow />', () => {
  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Arrow
              data-testid="arrow"
              ref={(el) => {
                ref = el;
              }}
              class={(state) => (state.open ? 'open' : 'closed')}
              style={{ color: 'red' }}
              render={(props) => <section {...props} />}
            />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const arrow = screen.getByTestId('arrow');
    expect(ref).toBe(arrow);
    expect(arrow.tagName).toBe('SECTION');
    expect(arrow).toHaveClass('open');
    expect(arrow).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveAttribute('data-open');
    expect(arrow).toHaveAttribute('data-side', 'bottom');
  });
});
