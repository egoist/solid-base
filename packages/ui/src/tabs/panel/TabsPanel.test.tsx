import { Show, createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Tabs } from '..';

async function settle() {
  for (let i = 0; i < 3; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    flush();
  }
}

async function renderAndSettle(ui: () => any) {
  const result = render(ui);
  await settle();
  return result;
}

describe('<Tabs.Panel />', () => {
  it('renders a tabpanel and forwards class, style, ref and render', async () => {
    let ref: HTMLElement | undefined;
    await renderAndSettle(() => (
      <Tabs.Root defaultValue="1">
        <Tabs.List>
          <Tabs.Tab value="1" />
        </Tabs.List>
        <Tabs.Panel
          value="1"
          class={(state) => (state.hidden ? 'hidden' : 'visible')}
          style={{ color: 'red' }}
          ref={(element) => {
            ref = element;
          }}
          render={(props) => <section {...props} />}
        >
          Content
        </Tabs.Panel>
      </Tabs.Root>
    ));

    const panel = screen.getByRole('tabpanel');
    expect(panel.tagName).toBe('SECTION');
    expect(panel).toHaveClass('visible');
    expect(panel).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(panel);
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(panel).not.toHaveAttribute('inert');
    expect(panel).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('throws a descriptive error when rendered outside <Tabs.Root>', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(() => <Tabs.Panel value="1" keepMounted />)).toThrow(
        'Base UI: TabsRootContext is missing. Tabs parts must be placed within <Tabs.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('marks hidden kept-mounted panels as hidden, inert and not tabbable', async () => {
    await renderAndSettle(() => (
      <Tabs.Root defaultValue="1">
        <Tabs.List>
          <Tabs.Tab value="1" />
          <Tabs.Tab value="2" />
        </Tabs.List>
        <Tabs.Panel value="1" keepMounted />
        <Tabs.Panel value="2" keepMounted data-testid="hidden-panel" />
      </Tabs.Root>
    ));

    const panel = screen.getByTestId('hidden-panel');
    expect(panel).toHaveAttribute('hidden');
    expect(panel).toHaveAttribute('data-hidden');
    expect(panel).toHaveAttribute('inert');
    expect(panel).toHaveAttribute('tabindex', '-1');
  });

  it('unmounts hidden panels unless keepMounted', async () => {
    const user = userEvent.setup();
    await renderAndSettle(() => (
      <Tabs.Root defaultValue="1">
        <Tabs.List>
          <Tabs.Tab value="1">One</Tabs.Tab>
          <Tabs.Tab value="2">Two</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="1">Panel one</Tabs.Panel>
        <Tabs.Panel value="2">Panel two</Tabs.Panel>
      </Tabs.Root>
    ));

    expect(screen.getByText('Panel one')).toBeInTheDocument();
    expect(screen.queryByText('Panel two')).toBe(null);

    await user.click(screen.getByRole('tab', { name: 'Two' }));
    await settle();

    expect(screen.queryByText('Panel one')).toBe(null);
    expect(screen.getByText('Panel two')).toBeInTheDocument();
  });

  describe('panels sharing a value', () => {
    it('keeps the surviving registration when a shadowed panel unmounts', async () => {
      const [shadowedMounted, setShadowedMounted] = createSignal(true);

      await renderAndSettle(() => (
        <Tabs.Root value="a">
          <Tabs.List>
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Tab value="b">B</Tabs.Tab>
          </Tabs.List>
          <Show when={shadowedMounted()}>
            <Tabs.Panel value="b" keepMounted data-testid="shadowed" />
          </Show>
          <Tabs.Panel value="b" keepMounted data-testid="owner" />
        </Tabs.Root>
      ));

      const tabB = screen.getAllByRole('tab')[1];
      const owner = screen.getByTestId('owner');

      // The last panel to register owns the value.
      expect(tabB).toHaveAttribute('aria-controls', owner.id);

      setShadowedMounted(false);
      await settle();

      expect(screen.queryByTestId('shadowed')).toBe(null);
      expect(tabB).toHaveAttribute('aria-controls', owner.id);
    });
  });

  it('sets the panel index data attribute', async () => {
    await renderAndSettle(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one" />
          <Tabs.Tab value="two" />
        </Tabs.List>
        <Tabs.Panel value="one" data-testid="panel" />
        <Tabs.Panel value="two" keepMounted data-testid="panel-2" />
      </Tabs.Root>
    ));

    expect(screen.getByTestId('panel')).toHaveAttribute('data-index', '0');
    expect(screen.getByTestId('panel-2')).toHaveAttribute('data-index', '1');
  });

  it('applies data-starting-style while mounting', async () => {
    const user = userEvent.setup();
    await renderAndSettle(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="one">Panel one</Tabs.Panel>
        <Tabs.Panel value="two" data-testid="panel-two">
          Panel two
        </Tabs.Panel>
      </Tabs.Root>
    ));

    await user.click(screen.getByRole('tab', { name: 'Two' }));
    flush();
    expect(screen.getByTestId('panel-two')).toHaveAttribute('data-starting-style');

    // The starting style is removed on the next animation frame.
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
    await settle();
    expect(screen.getByTestId('panel-two')).not.toHaveAttribute('data-starting-style');
  });

  // Upstream's exit animation tests (`data-ending-style` held until the animation finishes)
  // rely on real CSS animations, which jsdom doesn't run. React's Suspense integration test
  // has no Solid equivalent.
});
