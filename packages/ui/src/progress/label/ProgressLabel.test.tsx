import { createSignal, flush, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Progress } from '..';

describe('<Progress.Label />', () => {
  it('renders a span with class, style, ref and render support', () => {
    let refElement: HTMLElement | undefined;
    render(() => (
      <Progress.Root value={40}>
        <Progress.Label
          data-testid="label"
          class="label"
          style={{ color: 'red' }}
          ref={(element) => {
            refElement = element;
          }}
        />
        <Progress.Label render="div" data-testid="div" />
      </Progress.Root>
    ));
    const label = screen.getByTestId('label');
    expect(label.tagName).toBe('SPAN');
    expect(label).toHaveAttribute('role', 'presentation');
    expect(label.id).toMatch(/^base-ui-/);
    expect(label).toHaveClass('label');
    expect(label.style.color).toBe('red');
    expect(refElement).toBe(label);
    expect(screen.getByTestId('div').tagName).toBe('DIV');
  });

  it('updates and clears the progress bar label association', () => {
    const [labelId, setLabelId] = createSignal('label-a');
    const [showLabel, setShowLabel] = createSignal(true);

    render(() => (
      <>
        <Progress.Root value={40}>
          <Show when={showLabel()}>
            <Progress.Label id={labelId()}>Upload progress</Progress.Label>
          </Show>
        </Progress.Root>
        <button type="button" onClick={() => setLabelId('label-b')}>
          Change id
        </button>
        <button type="button" onClick={() => setShowLabel(false)}>
          Remove label
        </button>
      </>
    ));

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-labelledby', 'label-a');

    fireEvent.click(screen.getByRole('button', { name: 'Change id' }));
    flush();
    expect(progressbar).toHaveAttribute('aria-labelledby', 'label-b');

    fireEvent.click(screen.getByRole('button', { name: 'Remove label' }));
    flush();
    expect(progressbar).not.toHaveAttribute('aria-labelledby');
  });

  it('throws a descriptive error when rendered outside <Progress.Root>', () => {
    expect(() => render(() => <Progress.Label />)).toThrow(
      'Base UI: ProgressRootContext is missing. Progress parts must be placed within <Progress.Root>.',
    );
  });
});
