import { createSignal, flush, Show } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { reset as resetErrorLog } from '@egoist/solid-base-utils/error';
import { Field } from '..';

describe('<Field.Label />', () => {
  it('renders a label and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Field.Root>
        <Field.Label
          data-testid="label"
          class="label"
          style={{ color: 'red' }}
          ref={(el) => {
            ref = el;
          }}
        >
          Label
        </Field.Label>
      </Field.Root>
    ));
    const label = screen.getByTestId('label');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveClass('label');
    expect(label).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(label);
  });

  it('should set `for` referencing the control automatically', () => {
    render(() => (
      <Field.Root data-testid="field">
        <Field.Control />
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>
    ));

    expect(screen.getByTestId('label')).toHaveAttribute('for', screen.getByRole('textbox').id);
  });

  it('sets aria-labelledby on the control', () => {
    render(() => (
      <Field.Root>
        <Field.Control />
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>
    ));

    const label = screen.getByTestId('label');
    expect(label.id).not.toBe('');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-labelledby', label.id);
    expect(screen.getByRole('textbox', { name: 'Label' })).toBeInTheDocument();
  });

  it('uses the id prop', () => {
    render(() => (
      <Field.Root>
        <Field.Control />
        <Field.Label id="custom-label">Label</Field.Label>
      </Field.Root>
    ));

    expect(screen.getByText('Label')).toHaveAttribute('id', 'custom-label');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-labelledby', 'custom-label');
  });

  it('when nativeLabel={false}, clicking focuses the associated control', async () => {
    const user = userEvent.setup();
    render(() => (
      <Field.Root>
        <Field.Control data-testid="control" />
        <Field.Label nativeLabel={false} render="div" data-testid="label">
          Label
        </Field.Label>
      </Field.Root>
    ));

    const label = screen.getByTestId('label');
    const control = screen.getByTestId('control');

    expect(label).not.toHaveAttribute('for');

    await user.click(label);
    expect(control).toHaveFocus();
  });

  describe('control selection', () => {
    function setup() {
      const [first, setFirst] = createSignal(true);
      const [second, setSecond] = createSignal(true);
      render(() => (
        <Field.Root>
          <Show when={first()}>
            <Field.Control id="a" />
          </Show>
          <Show when={second()}>
            <Field.Control id="b" />
          </Show>
          <Field.Label data-testid="label">Label</Field.Label>
        </Field.Root>
      ));
      return { setFirst, setSecond };
    }

    it('keeps the selected control id when another control unmounts', () => {
      const { setSecond } = setup();

      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

      setSecond(false);
      flush();

      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');
    });

    it('falls over to the remaining control when the selected one unmounts', () => {
      const { setFirst } = setup();

      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

      setFirst(false);
      flush();

      expect(screen.getByTestId('label')).toHaveAttribute('for', 'b');
    });
  });

  it('reflects the disabled state from Field.Item', () => {
    render(() => (
      <Field.Root>
        <Field.Item disabled>
          <Field.Label data-testid="label">Label</Field.Label>
        </Field.Item>
      </Field.Root>
    ));

    expect(screen.getByTestId('label')).toHaveAttribute('data-disabled');
  });

  describe('dev warnings', () => {
    beforeEach(() => {
      resetErrorLog();
    });

    it('does not warn by default', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(() => (
        <Field.Root>
          <Field.Control />
          <Field.Label>Label</Field.Label>
        </Field.Root>
      ));

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('errors if nativeLabel=true but the element is not a label', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        render(() => (
          <Field.Root>
            <Field.Control />
            <Field.Label nativeLabel render="div">
              Label
            </Field.Label>
          </Field.Root>
        ));

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Base UI: <Field.Label> expected a <label> element because the `nativeLabel` prop is true.',
          ),
        );
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('errors if nativeLabel=false but the element is a label', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        render(() => (
          <Field.Root>
            <Field.Control />
            <Field.Label nativeLabel={false}>Label</Field.Label>
          </Field.Root>
        ));

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Base UI: <Field.Label> expected a non-<label> element because the `nativeLabel` prop is false.',
          ),
        );
      } finally {
        errorSpy.mockRestore();
      }
    });
  });
});
