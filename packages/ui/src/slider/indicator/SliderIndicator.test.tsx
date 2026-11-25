import { createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Slider } from '..';

describe('<Slider.Indicator />', () => {
  it('renders a div and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Slider.Root defaultValue={50}>
        <Slider.Indicator
          data-testid="indicator"
          class={(state) => `values-${state.values.join('-')}`}
          style={{ color: 'red' }}
          ref={(element) => {
            ref = element;
          }}
        />
        <Slider.Indicator render="span" data-testid="span" />
      </Slider.Root>
    ));
    const indicator = screen.getByTestId('indicator');
    expect(indicator.tagName).toBe('DIV');
    expect(indicator).toHaveClass('values-50');
    expect(indicator.style.color).toBe('red');
    expect(ref).toBe(indicator);
    expect(screen.getByTestId('span').tagName).toBe('SPAN');
  });

  it('sizes a single value indicator from the start edge', () => {
    const [value, setValue] = createSignal(30);
    render(() => (
      <Slider.Root value={value()}>
        <Slider.Indicator data-testid="indicator" />
      </Slider.Root>
    ));

    const indicator = screen.getByTestId('indicator');
    expect(indicator.style.position).toBe('relative');
    expect(indicator.style.getPropertyValue('inset-inline-start')).toBe('0px');
    expect(indicator.style.width).toBe('30%');
    expect(indicator.style.height).toBe('inherit');

    setValue(75);
    flush();
    expect(indicator.style.width).toBe('75%');
  });

  it('spans the range between the first and last values', () => {
    render(() => (
      <Slider.Root defaultValue={[20, 70]}>
        <Slider.Indicator data-testid="indicator" />
      </Slider.Root>
    ));

    const indicator = screen.getByTestId('indicator');
    expect(indicator.style.getPropertyValue('inset-inline-start')).toBe('20%');
    expect(indicator.style.width).toBe('50%');
  });

  it('uses bottom and height for vertical sliders', () => {
    render(() => (
      <Slider.Root defaultValue={[20, 70]} orientation="vertical">
        <Slider.Indicator data-testid="indicator" />
      </Slider.Root>
    ));

    const indicator = screen.getByTestId('indicator');
    expect(indicator.style.position).toBe('absolute');
    expect(indicator.style.bottom).toBe('20%');
    expect(indicator.style.height).toBe('50%');
    expect(indicator.style.width).toBe('inherit');
  });

  it('is hidden until the inset thumb positions are measured', () => {
    render(() => (
      <Slider.Root defaultValue={30} thumbAlignment="edge-client-only">
        <Slider.Indicator data-testid="indicator" />
      </Slider.Root>
    ));

    expect(screen.getByTestId('indicator').style.visibility).toBe('hidden');
  });

  // Skipped: the layout parity cases (indicator edges vs. thumb centers) need real layout.
});
