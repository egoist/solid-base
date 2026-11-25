import { createSignal, flush, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Fieldset } from '..';

describe('<Fieldset.Legend />', () => {
  it('renders a div and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Fieldset.Root>
        <Fieldset.Legend
          data-testid="legend"
          class="legend"
          style={{ color: 'red' }}
          render={(props) => <div {...props} data-custom="" />}
          ref={(el) => {
            ref = el;
          }}
        />
      </Fieldset.Root>
    ));
    const legend = screen.getByTestId('legend');
    expect(legend.tagName).toBe('DIV');
    expect(legend).toHaveClass('legend');
    expect(legend).toHaveAttribute('data-custom');
    expect(legend).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(legend);
  });

  it('should set aria-labelledby on the fieldset automatically', () => {
    render(() => (
      <Fieldset.Root>
        <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
      </Fieldset.Root>
    ));

    expect(screen.getByRole('group')).toHaveAttribute(
      'aria-labelledby',
      screen.getByTestId('legend').id,
    );
  });

  it('should set aria-labelledby on the fieldset with custom id', () => {
    render(() => (
      <Fieldset.Root>
        <Fieldset.Legend id="legend-id" />
      </Fieldset.Root>
    ));

    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'legend-id');
  });

  it('reflects the disabled state', () => {
    render(() => (
      <Fieldset.Root disabled>
        <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
      </Fieldset.Root>
    ));

    expect(screen.getByTestId('legend')).toHaveAttribute('data-disabled');
  });

  it('updates and clears the legend association', () => {
    const [legendId, setLegendId] = createSignal('legend-a');
    const [showLegend, setShowLegend] = createSignal(true);

    render(() => (
      <>
        <Fieldset.Root>
          <Show when={showLegend()}>
            <Fieldset.Legend id={legendId()}>Legend</Fieldset.Legend>
          </Show>
        </Fieldset.Root>
        <button type="button" onClick={() => setLegendId('legend-b')}>
          Change id
        </button>
        <button type="button" onClick={() => setShowLegend(false)}>
          Remove legend
        </button>
      </>
    ));

    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'legend-a');
    fireEvent.click(screen.getByRole('button', { name: 'Change id' }));
    flush();
    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'legend-b');
    fireEvent.click(screen.getByRole('button', { name: 'Remove legend' }));
    flush();
    expect(screen.getByRole('group')).not.toHaveAttribute('aria-labelledby');
  });

  it('throws a descriptive error when rendered outside <Fieldset.Root>', () => {
    expect(() => render(() => <Fieldset.Legend />)).toThrow(
      'Base UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>.',
    );
  });

  // Skipped: SSR/hydration tests (no server renderer in this test setup).
});
