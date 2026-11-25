import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Radio } from '..';
import { RadioGroup } from '../../radio-group';

describe('<Radio.Indicator />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe('conformance', () => {
    it('renders a span and supports class, style, render and ref', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Radio.Root value="">
          <Radio.Indicator
            data-testid="indicator"
            class={(state) => (state.checked ? 'is-checked' : '')}
            style={{ color: 'red' }}
            ref={(element) => {
              ref = element;
            }}
          />
        </Radio.Root>
      ));

      const indicator = screen.getByTestId('indicator');
      expect(indicator.tagName).toBe('SPAN');
      expect(ref).toBe(indicator);
      expect(indicator).toHaveClass('is-checked');
      expect(indicator).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });

    it('supports the render prop', () => {
      render(() => (
        <Radio.Root value="">
          <Radio.Indicator data-testid="indicator" render="em" />
        </Radio.Root>
      ));

      expect(screen.getByTestId('indicator').tagName).toBe('EM');
    });
  });

  it('only renders while the radio is checked', () => {
    render(() => (
      <RadioGroup defaultValue="a">
        <Radio.Root value="a" data-testid="a">
          <Radio.Indicator data-testid="indicator-a" />
        </Radio.Root>
        <Radio.Root value="b" data-testid="b">
          <Radio.Indicator data-testid="indicator-b" />
        </Radio.Root>
      </RadioGroup>
    ));

    expect(screen.getByTestId('indicator-a')).toHaveAttribute('data-checked');
    expect(screen.queryByTestId('indicator-b')).toBe(null);

    fireEvent.click(screen.getByTestId('b'));
    flush();

    expect(screen.queryByTestId('indicator-a')).toBe(null);
    expect(screen.getByTestId('indicator-b')).toHaveAttribute('data-checked');
  });

  it('keeps the indicator mounted with `keepMounted`', () => {
    render(() => (
      <RadioGroup defaultValue="a">
        <Radio.Root value="a">
          <Radio.Indicator keepMounted data-testid="indicator-a" />
        </Radio.Root>
        <Radio.Root value="b" data-testid="b">
          <Radio.Indicator keepMounted data-testid="indicator-b" />
        </Radio.Root>
      </RadioGroup>
    ));

    expect(screen.getByTestId('indicator-b')).toHaveAttribute('data-unchecked');

    fireEvent.click(screen.getByTestId('b'));
    flush();

    expect(screen.getByTestId('indicator-a')).toHaveAttribute('data-unchecked');
    expect(screen.getByTestId('indicator-b')).toHaveAttribute('data-checked');
  });

  it('reflects the root state', () => {
    render(() => (
      <RadioGroup defaultValue="a" disabled readOnly required>
        <Radio.Root value="a">
          <Radio.Indicator data-testid="indicator" />
        </Radio.Root>
      </RadioGroup>
    ));

    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('data-disabled');
    expect(indicator).toHaveAttribute('data-readonly');
    expect(indicator).toHaveAttribute('data-required');
  });

  it('applies data-starting-style when mounting', async () => {
    const [value, setValue] = createSignal('b');
    render(() => (
      <RadioGroup value={value()}>
        <Radio.Root value="a">
          <Radio.Indicator data-testid="indicator-a" />
        </Radio.Root>
        <Radio.Root value="b" />
      </RadioGroup>
    ));

    expect(screen.queryByTestId('indicator-a')).toBe(null);

    setValue('a');
    flush();

    expect(screen.getByTestId('indicator-a')).toHaveAttribute('data-starting-style');
    await waitFor(() => {
      expect(screen.getByTestId('indicator-a')).not.toHaveAttribute('data-starting-style');
    });
  });

  it('removes the indicator when there is no exit animation', async () => {
    const [value, setValue] = createSignal('a');
    render(() => (
      <RadioGroup value={value()}>
        <Radio.Root value="a">
          <Radio.Indicator data-testid="indicator-a" />
        </Radio.Root>
        <Radio.Root value="b" />
      </RadioGroup>
    ));

    expect(screen.getByTestId('indicator-a')).not.toBe(null);

    setValue('b');
    flush();

    await waitFor(() => {
      expect(screen.queryByTestId('indicator-a')).toBe(null);
    });
  });

  // Skipped: the CSS animation/transition tests ('should remove the indicator when the animation
  // finishes', 'triggers enter animation via data-starting-style', 'applies data-ending-style
  // before unmount'): they need real animations, upstream skips them in JSDOM.
});
