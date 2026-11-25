import { render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Accordion } from '..';

describe('<Accordion.Trigger />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Trigger
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'open' : 'closed')}
            style={{ color: 'red' }}
            render={(props, state) => (
              <button {...props} data-state-open={String(state.open)} />
            )}
          >
            Trigger
          </Accordion.Trigger>
        </Accordion.Item>
      </Accordion.Root>
    ));
    const trigger = screen.getByRole('button');
    expect(ref).toBe(trigger);
    expect(trigger).toHaveClass('closed');
    expect(trigger).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(trigger).toHaveAttribute('data-state-open', 'false');
  });

  it('renders the disabled attribute when disabled', () => {
    render(() => (
      <Accordion.Root>
        <Accordion.Item disabled>
          <Accordion.Header>
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toBeDisabled();
    expect(trigger).not.toHaveAttribute('aria-disabled');
  });

  it('adds data-disabled when only the trigger is disabled', () => {
    render(() => (
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger disabled>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));

    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute('data-disabled');
  });

  it('removes a disabled non-native trigger from the tab order', async () => {
    const user = userEvent.setup();
    render(() => (
      <Accordion.Root>
        <Accordion.Item disabled>
          <Accordion.Header>
            <Accordion.Trigger nativeButton={false} render="span">
              Trigger
            </Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    expect(trigger).toHaveAttribute('tabindex', '-1');
    expect(trigger).not.toHaveAttribute('disabled');

    await user.keyboard('[Tab]');
    expect(trigger).not.toHaveFocus();
  });

  it('keeps a non-native trigger tabbable', () => {
    render(() => (
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger nativeButton={false} render="span">
              Trigger
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));

    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute('tabindex', '0');
  });

  it('does not render the root value as data-value', () => {
    render(() => (
      <Accordion.Root value={['a', 'b']} multiple>
        <Accordion.Item value="a">
          <Accordion.Header>
            <Accordion.Trigger>header a</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>panel a</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Header>
            <Accordion.Trigger>header b</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>panel b</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));

    const triggers = screen.getAllByRole('button');
    expect(triggers[0]).not.toHaveAttribute('data-value');
    expect(triggers[1]).not.toHaveAttribute('data-value');
  });

  it('renders data-index on every trigger including the first', async () => {
    render(() => (
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger>first</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger>second</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>
    ));

    const triggers = screen.getAllByRole('button');
    // Item indexes resolve once the items are attached (document order).
    await waitFor(() => {
      expect(triggers[0]).toHaveAttribute('data-index', '0');
      expect(triggers[1]).toHaveAttribute('data-index', '1');
    });
  });

  it('keeps data-panel-open instead of data-open', () => {
    render(() => (
      <Accordion.Root value={['a']}>
        <Accordion.Item value="a">
          <Accordion.Header>
            <Accordion.Trigger>header a</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>panel a</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'header a' });
    expect(trigger).toHaveAttribute('data-panel-open');
    expect(trigger).not.toHaveAttribute('data-open');
  });
});
