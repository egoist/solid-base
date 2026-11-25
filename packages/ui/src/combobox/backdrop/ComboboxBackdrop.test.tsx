import { render, screen } from '@solidjs/testing-library';
import { Combobox } from '..';

describe('<Combobox.Backdrop />', () => {
  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Portal>
          <Combobox.Backdrop
            data-testid="backdrop"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'open' : 'closed')}
            style={{ color: 'red' }}
            render={(props) => <section {...props} />}
          />
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const backdrop = screen.getByTestId('backdrop');
    expect(ref).toBe(backdrop);
    expect(backdrop.tagName).toBe('SECTION');
    expect(backdrop).toHaveClass('open');
    expect(backdrop).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(backdrop).toHaveAttribute('role', 'presentation');
    expect(backdrop).toHaveAttribute('data-open');
  });
});
