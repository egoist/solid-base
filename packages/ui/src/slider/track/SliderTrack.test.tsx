import { render, screen } from '@solidjs/testing-library';
import { Slider } from '..';

describe('<Slider.Track />', () => {
  it('renders a div and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Slider.Root defaultValue={50} disabled>
        <Slider.Track
          data-testid="track"
          class={(state) => (state.disabled ? 'disabled' : '')}
          style={{ color: 'red' }}
          ref={(element) => {
            ref = element;
          }}
        />
        <Slider.Track render="span" data-testid="span" />
      </Slider.Root>
    ));
    const track = screen.getByTestId('track');
    expect(track.tagName).toBe('DIV');
    expect(track).toHaveClass('disabled');
    expect(track.style.color).toBe('red');
    expect(track.style.position).toBe('relative');
    expect(track).toHaveAttribute('data-disabled', '');
    expect(ref).toBe(track);
    expect(screen.getByTestId('span').tagName).toBe('SPAN');
  });
});
