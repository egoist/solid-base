import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Accordion } from '..';

describe('<Accordion.Item />', () => {
  it('throws when rendered outside an Accordion.Root', () => {
    expect(() => render(() => <Accordion.Item />)).toThrow(
      'Base UI: AccordionRootContext is missing. Accordion parts must be placed within <Accordion.Root>.',
    );
  });

  it('forwards ref, class, style and supports render', async () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Accordion.Root defaultValue={['a']}>
        <Accordion.Item
          data-testid="item"
          value="a"
          ref={(el) => {
            ref = el;
          }}
          class={(state) => (state.open ? 'open' : 'closed')}
          style={{ color: 'red' }}
          render={(props, state) => <section {...props} data-state-open={String(state.open)} />}
        />
      </Accordion.Root>
    ));
    const item = screen.getByTestId('item');
    expect(ref).toBe(item);
    expect(item.tagName).toBe('SECTION');
    expect(item).toHaveClass('open');
    expect(item).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(item).toHaveAttribute('data-state-open', 'true');
    expect(item).toHaveAttribute('data-open');
    expect(item).not.toHaveAttribute('data-value');
    await vi.waitFor(() => expect(item).toHaveAttribute('data-index', '0'));
  });

  describe('state', () => {
    // Solid calls render functions once, so the state is observed through an effect-like read
    // inside the rendered JSX instead of a render spy.
    it('does not report hidden=true after the item has started opening', async () => {
      const states: Array<{ open: boolean; hidden: boolean }> = [];
      const user = userEvent.setup();
      render(() => (
        <Accordion.Root>
          <Accordion.Item
            render={(props, state) => (
              <div
                {...props}
                data-observed={
                  (states.push({ open: state.open, hidden: state.hidden }), String(state.open))
                }
              />
            )}
          >
            <Accordion.Header>
              <Accordion.Trigger>Trigger</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>Panel</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));

      await user.click(screen.getByRole('button', { name: 'Trigger' }));

      expect(states.some((state) => state.open === true)).toBe(true);
      expect(states.some((state) => state.open === true && state.hidden === true)).toBe(false);
    });
  });
});
