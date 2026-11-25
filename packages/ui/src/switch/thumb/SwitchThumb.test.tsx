import { render, screen } from '@solidjs/testing-library';
import { Switch } from '..';
import { SwitchRootContext, type SwitchRootContextValue } from '../root/SwitchRootContext';

const testContext: SwitchRootContextValue = {
  checked: false,
  disabled: false,
  readOnly: false,
  required: false,
  dirty: false,
  touched: false,
  filled: false,
  focused: false,
  valid: null,
};

describe('<Switch.Thumb />', () => {
  it('renders a span and supports ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <SwitchRootContext value={testContext}>
        <Switch.Thumb
          data-testid="thumb"
          ref={(element) => {
            ref = element;
          }}
          class={(state) => (state.checked ? 'on' : 'off')}
          style={{ color: 'red' }}
        />
        <Switch.Thumb data-testid="rendered" render="div" />
      </SwitchRootContext>
    ));

    const thumb = screen.getByTestId('thumb');
    expect(thumb.tagName).toBe('SPAN');
    expect(ref).toBe(thumb);
    expect(thumb).toHaveClass('off');
    expect(thumb).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(thumb).toHaveAttribute('data-unchecked', '');
    expect(screen.getByTestId('rendered').tagName).toBe('DIV');
  });

  it('throws a descriptive error when rendered outside <Switch.Root>', () => {
    expect(() => render(() => <Switch.Thumb />)).toThrow(
      'Base UI: SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>.',
    );
  });
});
