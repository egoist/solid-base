import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Fieldset } from '..';
import { Field } from '../../field';

describe('<Fieldset.Root />', () => {
  it('renders a fieldset and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Fieldset.Root
        data-testid="fieldset"
        class={(state) => (state.disabled ? 'disabled' : 'enabled')}
        style={{ color: 'red' }}
        ref={(el) => {
          ref = el;
        }}
      />
    ));
    const fieldset = screen.getByTestId('fieldset');
    expect(fieldset.tagName).toBe('FIELDSET');
    expect(fieldset).toHaveClass('enabled');
    expect(fieldset).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(fieldset);
  });

  it('supports the render prop', () => {
    render(() => <Fieldset.Root render="div" data-testid="fieldset" />);
    expect(screen.getByTestId('fieldset').tagName).toBe('DIV');
  });

  it('sets the native disabled attribute', () => {
    render(() => (
      <Fieldset.Root disabled data-testid="fieldset">
        <input />
      </Fieldset.Root>
    ));

    expect(screen.getByTestId('fieldset')).toHaveAttribute('disabled');
    expect(screen.getByTestId('fieldset')).toHaveAttribute('data-disabled');
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('keeps nested fieldsets disabled when an ancestor fieldset is disabled', () => {
    render(() => (
      <Fieldset.Root disabled>
        <Fieldset.Root>
          <Field.Root>
            <Field.Control data-testid="control" />
          </Field.Root>
        </Fieldset.Root>
      </Fieldset.Root>
    ));

    expect(screen.getByTestId('control')).toHaveAttribute('disabled');
  });

  it('updates nested disabled precedence in both directions', () => {
    const [outerDisabled, setOuterDisabled] = createSignal(false);
    const [innerDisabled, setInnerDisabled] = createSignal(true);

    render(() => (
      <>
        <Fieldset.Root disabled={outerDisabled()}>
          <Fieldset.Root disabled={innerDisabled()}>
            <Field.Root data-testid="root">
              <Field.Control data-testid="control" />
            </Field.Root>
          </Fieldset.Root>
        </Fieldset.Root>
        <button type="button" onClick={() => setOuterDisabled(true)}>
          Disable outer
        </button>
        <button type="button" onClick={() => setInnerDisabled(false)}>
          Enable inner
        </button>
        <button type="button" onClick={() => setOuterDisabled(false)}>
          Enable outer
        </button>
      </>
    ));

    expect(screen.getByTestId('control')).toBeDisabled();
    expect(screen.getByTestId('root')).toHaveAttribute('data-disabled');
    fireEvent.click(screen.getByRole('button', { name: 'Disable outer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enable inner' }));
    flush();
    expect(screen.getByTestId('control')).toBeDisabled();
    expect(screen.getByTestId('root')).toHaveAttribute('data-disabled');
    fireEvent.click(screen.getByRole('button', { name: 'Enable outer' }));
    flush();
    expect(screen.getByTestId('control')).not.toBeDisabled();
    expect(screen.getByTestId('root')).not.toHaveAttribute('data-disabled');
  });

  // Skipped: "passes disabled to rendered Base UI roots" uses RadioGroup, CheckboxGroup and
  // Slider, which are ported separately.
});
