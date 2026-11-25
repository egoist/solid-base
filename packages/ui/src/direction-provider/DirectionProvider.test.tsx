import { createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { DirectionProvider, useDirection, type TextDirection } from '.';

function DirectionProbe() {
  const direction = useDirection();
  return <span data-testid="direction">{direction()}</span>;
}

describe('<DirectionProvider />', () => {
  it('defaults useDirection to ltr outside a provider', () => {
    render(() => <DirectionProbe />);
    expect(screen.getByTestId('direction')).toHaveTextContent('ltr');
  });

  it('provides the configured direction to descendants', () => {
    const [direction, setDirection] = createSignal<TextDirection>('rtl');
    render(() => (
      <DirectionProvider direction={direction()}>
        <DirectionProbe />
      </DirectionProvider>
    ));
    expect(screen.getByTestId('direction')).toHaveTextContent('rtl');

    setDirection('ltr');
    flush();
    expect(screen.getByTestId('direction')).toHaveTextContent('ltr');
  });
});
