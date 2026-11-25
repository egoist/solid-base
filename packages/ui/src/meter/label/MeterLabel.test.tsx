import { createSignal, flush, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Meter } from '..';

describe('<Meter.Label />', () => {
  it('renders a span with class, style, ref and render support', () => {
    let refElement: HTMLElement | undefined;
    render(() => (
      <Meter.Root value={50}>
        <Meter.Label
          data-testid="label"
          class="label"
          style={{ color: 'red' }}
          ref={(element) => {
            refElement = element;
          }}
        />
        <Meter.Label render="div" data-testid="div" />
      </Meter.Root>
    ));
    const label = screen.getByTestId('label');
    expect(label.tagName).toBe('SPAN');
    expect(label).toHaveAttribute('role', 'presentation');
    expect(label).toHaveClass('label');
    expect(label.style.color).toBe('red');
    expect(refElement).toBe(label);
    expect(screen.getByTestId('div').tagName).toBe('DIV');
  });

  it('updates and clears the meter label association', () => {
    const [labelId, setLabelId] = createSignal('label-a');
    const [showLabel, setShowLabel] = createSignal(true);

    render(() => (
      <>
        <Meter.Root value={50}>
          <Show when={showLabel()}>
            <Meter.Label id={labelId()}>Battery level</Meter.Label>
          </Show>
        </Meter.Root>
        <button type="button" onClick={() => setLabelId('label-b')}>
          Change id
        </button>
        <button type="button" onClick={() => setShowLabel(false)}>
          Remove label
        </button>
      </>
    ));

    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-labelledby', 'label-a');

    fireEvent.click(screen.getByRole('button', { name: 'Change id' }));
    flush();
    expect(meter).toHaveAttribute('aria-labelledby', 'label-b');

    fireEvent.click(screen.getByRole('button', { name: 'Remove label' }));
    flush();
    expect(meter).not.toHaveAttribute('aria-labelledby');
  });

  it('throws a descriptive error when rendered outside <Meter.Root>', () => {
    expect(() => render(() => <Meter.Label />)).toThrow(
      'Base UI: MeterRootContext is missing. Meter parts must be placed within <Meter.Root>.',
    );
  });
});
