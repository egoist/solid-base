import { Errored, createSignal, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
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

describe('<Tabs.Tab />', () => {
  it('renders a button with tab semantics and forwards class, style, ref and render', async () => {
    let ref: HTMLElement | undefined;
    await renderAndSettle(() => (
      <Tabs.Root defaultValue="1">
        <Tabs.List>
          <Tabs.Tab
            value="1"
            class={(state) => (state.active ? 'is-active' : undefined)}
            style={{ color: 'red' }}
            ref={(element) => {
              ref = element;
            }}
          >
            One
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const tab = screen.getByRole('tab');
    expect(tab.tagName).toBe('BUTTON');
    expect(tab).toHaveAttribute('type', 'button');
    expect(tab).toHaveClass('is-active');
    expect(tab).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(tab);
    expect(tab).toHaveAttribute('data-active');
    expect(tab).toHaveAttribute('data-orientation', 'horizontal');
    expect(tab).toHaveAttribute('data-activation-direction', 'none');
  });

  it('marks a disabled tab as focusable and aria-disabled', async () => {
    await renderAndSettle(() => (
      <Tabs.Root defaultValue="1">
        <Tabs.List>
          <Tabs.Tab value="1">One</Tabs.Tab>
          <Tabs.Tab value="2" disabled>
            Two
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const disabledTab = screen.getByRole('tab', { name: 'Two' });
    expect(disabledTab).not.toHaveAttribute('disabled');
    expect(disabledTab).toHaveAttribute('aria-disabled', 'true');
    expect(disabledTab).toHaveAttribute('data-disabled');
  });

  describe('prop: nativeButton', () => {
    it('renders as an anchor and toggles selection when `nativeButton` is false', async () => {
      const user = userEvent.setup();
      await renderAndSettle(() => (
        <Tabs.Root defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab nativeButton={false} render={(props) => <a {...props} href="#overview" />} value="overview">
              Overview
            </Tabs.Tab>
            <Tabs.Tab nativeButton={false} render={(props) => <a {...props} href="#details" />} value="details">
              Details
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0].tagName).toBe('A');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');

      await user.click(tabs[1]);
      await settle();

      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('throws a descriptive error when rendered outside <Tabs.List>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(() => (
        <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
          <Tabs.Root>
            <Tabs.Tab value="1" />
          </Tabs.Root>
        </Errored>
      ));
      await settle();

      expect(screen.getByTestId('error')).toHaveTextContent(
        'Base UI: TabsListContext is missing. TabsList parts must be placed within <Tabs.List>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  describe('pointer interaction', () => {
    function renderTwoTabs(props: {
      onValueChange?: Tabs.Root.Props['onValueChange'];
      disabledSecond?: boolean;
    }) {
      return renderAndSettle(() => (
        <Tabs.Root defaultValue={0} onValueChange={props.onValueChange}>
          <Tabs.List activateOnFocus>
            <Tabs.Tab value={0}>One</Tabs.Tab>
            <Tabs.Tab value={1} disabled={props.disabledSecond}>
              Two
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
    }

    it('does not re-commit the value when the active tab is pressed', async () => {
      const user = userEvent.setup();
      const handleValueChange = vi.fn();
      await renderTwoTabs({ onValueChange: handleValueChange });

      const [firstTab] = screen.getAllByRole('tab');
      await user.pointer({ keys: '[MouseLeft]', target: firstTab });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(firstTab).toHaveAttribute('aria-selected', 'true');
    });

    it('does not activate a disabled tab that is pressed and focused', async () => {
      const user = userEvent.setup();
      const handleValueChange = vi.fn();
      await renderTwoTabs({ onValueChange: handleValueChange, disabledSecond: true });

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      await user.pointer({ keys: '[MouseLeft]', target: secondTab });
      secondTab.focus();
      await settle();

      expect(secondTab).toHaveFocus();
      expect(handleValueChange).not.toHaveBeenCalled();
      expect(firstTab).toHaveAttribute('aria-selected', 'true');
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
    });

    it('does not activate a tab focused by a held secondary-button press', async () => {
      const user = userEvent.setup();
      const handleValueChange = vi.fn();
      await renderTwoTabs({ onValueChange: handleValueChange });

      const [, secondTab] = screen.getAllByRole('tab');
      await user.pointer({ keys: '[MouseRight>]', target: secondTab });
      secondTab.focus();
      await settle();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
    });

    it('activates on focus again once a secondary-button press has ended', async () => {
      const user = userEvent.setup();
      const handleValueChange = vi.fn();
      await renderTwoTabs({ onValueChange: handleValueChange });

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      await user.pointer({ keys: '[MouseRight]', target: secondTab });

      expect(handleValueChange).not.toHaveBeenCalled();

      firstTab.focus();
      await user.keyboard('{ArrowRight}');
      await settle();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });

    it('activates on focus again once a secondary-button press is cancelled', async () => {
      const user = userEvent.setup();
      const handleValueChange = vi.fn();
      await renderTwoTabs({ onValueChange: handleValueChange });

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      fireEvent.pointerDown(secondTab, { button: 2 });
      fireEvent.pointerCancel(secondTab);

      firstTab.focus();
      await user.keyboard('{ArrowRight}');
      await settle();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('keyboard activation', () => {
    it.each([
      ['Enter', '{Enter}'],
      ['Space', ' '],
    ])('activates the focused tab with %s when `activateOnFocus` is false', async (_label, key) => {
      const user = userEvent.setup();
      await renderAndSettle(() => (
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0}>One</Tabs.Tab>
            <Tabs.Tab value={1}>Two</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      firstTab.focus();
      await user.keyboard('{ArrowRight}');
      await settle();

      expect(secondTab).toHaveFocus();
      expect(secondTab).toHaveAttribute('aria-selected', 'false');

      await user.keyboard(key);
      await settle();

      expect(secondTab).toHaveAttribute('aria-selected', 'true');
      expect(firstTab).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('state', () => {
    // jsdom has no layout: tab positions are mocked through `getBoundingClientRect`.
    it('exposes tab activation direction through the render prop state', async () => {
      const [value, setValue] = createSignal(0);
      const states: Tabs.Tab.State[] = [];

      await renderAndSettle(() => (
        <Tabs.Root value={value()}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab
              value={1}
              render={(props, state) => {
                states.push(state);
                return <button {...props} />;
              }}
            >
              Tab 1
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      screen.getAllByRole('tab').forEach((tab, index) => {
        tab.getBoundingClientRect = () => ({ left: index * 100, top: 0 }) as DOMRect;
      });

      setValue(1);
      await settle();

      // `render` is called once with a live state object.
      expect(states).toHaveLength(1);
      expect(states[0].active).toBe(true);
      expect(states[0].tabActivationDirection).toBe('right');
    });
  });
});
