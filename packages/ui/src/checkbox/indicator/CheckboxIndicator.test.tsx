import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Checkbox } from '..';
import { CheckboxRootContext, type CheckboxRootContextValue } from '../root/CheckboxRootContext';

const testContext: CheckboxRootContextValue = {
  checked: true,
  disabled: false,
  readOnly: false,
  required: false,
  indeterminate: false,
  dirty: false,
  touched: false,
  valid: null,
  filled: false,
  focused: false,
};

describe('<Checkbox.Indicator />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe('conformance', () => {
    it('renders a span and supports class, style, ref and render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <CheckboxRootContext value={testContext}>
          <Checkbox.Indicator
            data-testid="indicator"
            class={(state) => (state.checked ? 'is-checked' : 'is-unchecked')}
            style={{ color: 'red' }}
            ref={(element) => {
              ref = element;
            }}
          />
        </CheckboxRootContext>
      ));
      const indicator = screen.getByTestId('indicator');
      expect(indicator.tagName).toBe('SPAN');
      expect(ref).toBe(indicator);
      expect(indicator).toHaveClass('is-checked');
      expect(indicator).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(indicator).toHaveAttribute('data-checked', '');
    });

    it('supports the render prop', () => {
      render(() => (
        <CheckboxRootContext value={testContext}>
          <Checkbox.Indicator data-testid="indicator" render="em" />
        </CheckboxRootContext>
      ));
      expect(screen.getByTestId('indicator').tagName).toBe('EM');
    });
  });

  it('throws a descriptive error when rendered outside <Checkbox.Root>', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(() => <Checkbox.Indicator />)).toThrow(
        'Base UI: CheckboxRootContext is missing. Checkbox parts must be placed within <Checkbox.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('should not render indicator by default', () => {
    render(() => (
      <Checkbox.Root>
        <Checkbox.Indicator data-testid="indicator" />
      </Checkbox.Root>
    ));
    expect(screen.queryByTestId('indicator')).toBe(null);
  });

  it('should render indicator when checked', () => {
    render(() => (
      <Checkbox.Root checked>
        <Checkbox.Indicator data-testid="indicator" />
      </Checkbox.Root>
    ));
    expect(screen.getByTestId('indicator')).not.toBe(null);
  });

  it('should render indicator when indeterminate', () => {
    render(() => (
      <Checkbox.Root indeterminate>
        <Checkbox.Indicator data-testid="indicator" />
      </Checkbox.Root>
    ));
    expect(screen.getByTestId('indicator')).toHaveAttribute('data-indeterminate', '');
  });

  describe('prop: keepMounted', () => {
    it('should keep indicator mounted when unchecked', () => {
      render(() => (
        <Checkbox.Root>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>
      ));
      expect(screen.getByTestId('indicator')).toHaveAttribute('data-unchecked', '');
    });

    it('should keep indicator mounted when checked', () => {
      render(() => (
        <Checkbox.Root checked>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>
      ));
      expect(screen.getByTestId('indicator')).not.toBe(null);
    });

    it('should keep indicator mounted when indeterminate', () => {
      render(() => (
        <Checkbox.Root indeterminate>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>
      ));
      expect(screen.getByTestId('indicator')).not.toBe(null);
    });
  });

  // Runs in jsdom here (upstream skips it): without `getAnimations`, the exit completes at once.
  it('should remove the indicator when there is no exit animation defined', async () => {
    const [checked, setChecked] = createSignal(true);
    render(() => (
      <div>
        <button onClick={() => setChecked(false)}>Close</button>
        <Checkbox.Root checked={checked()}>
          <Checkbox.Indicator data-testid="indicator" />
        </Checkbox.Root>
      </div>
    ));

    expect(screen.getByTestId('indicator')).not.toBe(null);

    fireEvent.click(screen.getByText('Close'));
    flush();

    await waitFor(() => {
      expect(screen.queryByTestId('indicator')).toBe(null);
    });
  });

  it('mounts with [data-starting-style] when it gets checked', () => {
    const [checked, setChecked] = createSignal(false);
    render(() => (
      <Checkbox.Root checked={checked()}>
        <Checkbox.Indicator data-testid="indicator" />
      </Checkbox.Root>
    ));

    expect(screen.queryByTestId('indicator')).toBe(null);

    setChecked(true);
    flush();

    expect(screen.getByTestId('indicator')).toHaveAttribute('data-starting-style', '');
  });

  // Skipped: 'should remove the indicator when the animation finishes' and the `animations`
  // block (enter/exit animations, single-commit removal with React.Profiler). They need real CSS
  // animations, which jsdom doesn't run (upstream skips them in jsdom too).
});
