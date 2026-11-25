import { Show, createSignal, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
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

async function pressKey(target: HTMLElement, key: string) {
  fireEvent.keyDown(target, { key });
  await settle();
}

describe('<Tabs.List />', () => {
  it('renders a tablist and forwards class, style, ref and render', async () => {
    let ref: HTMLElement | undefined;
    await renderAndSettle(() => (
      <Tabs.Root>
        <Tabs.List
          class={(state) => `list-${state.orientation}`}
          style={{ color: 'red' }}
          ref={(element) => {
            ref = element;
          }}
          render={(props) => <section {...props} />}
        />
      </Tabs.Root>
    ));

    const list = screen.getByRole('tablist');
    expect(list.tagName).toBe('SECTION');
    expect(list).toHaveClass('list-horizontal');
    expect(list).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(list);
    expect(list).toHaveAttribute('data-orientation', 'horizontal');
    expect(list).toHaveAttribute('data-activation-direction', 'none');
  });

  describe('accessibility attributes', () => {
    it('sets the aria-selected attribute on the active tab', async () => {
      await renderAndSettle(() => (
        <Tabs.Root defaultValue={1}>
          <Tabs.List>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
            <Tabs.Tab value={3}>Tab 3</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      const tabs = [1, 2, 3].map((index) => screen.getByText(`Tab ${index}`));
      const selected = () => tabs.map((tab) => tab.getAttribute('aria-selected'));

      expect(selected()).toEqual(['true', 'false', 'false']);

      tabs[1].click();
      await settle();
      expect(selected()).toEqual(['false', 'true', 'false']);

      tabs[2].click();
      await settle();
      expect(selected()).toEqual(['false', 'false', 'true']);

      tabs[0].click();
      await settle();
      expect(selected()).toEqual(['true', 'false', 'false']);
    });
  });

  describe('prop: loopFocus', () => {
    it('does not wrap focus past the first tab when `loopFocus` is false', async () => {
      await renderAndSettle(() => (
        <Tabs.Root value={0}>
          <Tabs.List loopFocus={false}>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>
      ));

      const [firstTab, , lastTab] = screen.getAllByRole('tab');
      firstTab.focus();
      await pressKey(firstTab, 'ArrowLeft');

      expect(firstTab).toHaveFocus();
      expect(lastTab).not.toHaveFocus();
    });

    it('does not wrap focus past the last tab when `loopFocus` is false', async () => {
      await renderAndSettle(() => (
        <Tabs.Root value={2}>
          <Tabs.List loopFocus={false}>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>
      ));

      const [firstTab, , lastTab] = screen.getAllByRole('tab');
      lastTab.focus();
      await pressKey(lastTab, 'ArrowRight');

      expect(lastTab).toHaveFocus();
      expect(firstTab).not.toHaveFocus();
    });
  });

  describe('keyboard navigation', () => {
    it('moves focus to a tab disabled with the `disabled` prop', async () => {
      await renderAndSettle(() => (
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} disabled />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>
      ));

      const [firstTab, disabledTab] = screen.getAllByRole('tab');
      firstTab.focus();
      await pressKey(firstTab, 'ArrowRight');

      expect(disabledTab).toHaveFocus();
    });

    it('skips a natively disabled tab in a single keypress', async () => {
      await renderAndSettle(() => (
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} render={(props) => <button {...props} disabled />} />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>
      ));

      const [firstTab, , lastTab] = screen.getAllByRole('tab');
      firstTab.focus();
      await pressKey(firstTab, 'ArrowRight');

      expect(lastTab).toHaveFocus();

      await pressKey(lastTab, 'ArrowLeft');

      expect(firstTab).toHaveFocus();
    });
  });

  describe('roving focus after tab removal', () => {
    it('moves the tab stop off a hidden successor when the highlighted tab is removed', async () => {
      const [showMiddleTab, setShowMiddleTab] = createSignal(true);
      await renderAndSettle(() => (
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Show when={showMiddleTab()}>
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            </Show>
            <Tabs.Tab value={2} hidden>
              Tab 2
            </Tabs.Tab>
            <Tabs.Tab value={3}>Tab 3</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      const selectedTab = screen.getByText('Tab 0');
      selectedTab.focus();
      await pressKey(selectedTab, 'ArrowRight');

      setShowMiddleTab(false);
      await settle();

      const tabs = screen.getAllByRole('tab', { hidden: true });
      expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    });

    it('can fall back to a tab that is focusable when disabled', async () => {
      const [showSelectedTab, setShowSelectedTab] = createSignal(true);
      await renderAndSettle(() => (
        <Tabs.Root value={2}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Show when={showSelectedTab()}>
              <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
            </Show>
          </Tabs.List>
        </Tabs.Root>
      ));

      setShowSelectedTab(false);
      await settle();

      expect(screen.getByText('Tab 0')).toHaveAttribute('tabindex', '0');
      expect(screen.getByText('Tab 1')).toHaveAttribute('tabindex', '-1');
    });

    it('keeps the tab stop on the selected tab when focus is inside the list', async () => {
      const [showFirstTab, setShowFirstTab] = createSignal(true);
      await renderAndSettle(() => (
        <Tabs.Root value={2}>
          <Tabs.List>
            <Show when={showFirstTab()}>
              <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            </Show>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      const selectedTab = screen.getByText('Tab 2');
      selectedTab.focus();
      await settle();

      setShowFirstTab(false);
      await settle();

      const [unselectedTab] = screen.getAllByRole('tab');
      expect([unselectedTab.tabIndex, selectedTab.tabIndex]).toEqual([-1, 0]);
    });

    it('keeps tracking a successor through subsequent removals', async () => {
      const [showFirstTab, setShowFirstTab] = createSignal(true);
      const [showSelectedTab, setShowSelectedTab] = createSignal(true);
      await renderAndSettle(() => (
        <Tabs.Root value={1}>
          <Tabs.List>
            <Show when={showFirstTab()}>
              <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            </Show>
            <Show when={showSelectedTab()}>
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            </Show>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
            <Tabs.Tab value={3}>Tab 3</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      setShowSelectedTab(false);
      await settle();

      expect(screen.getByText('Tab 2')).toHaveAttribute('tabindex', '0');

      setShowFirstTab(false);
      await settle();

      expect(screen.getByText('Tab 2')).toHaveAttribute('tabindex', '0');
      expect(screen.getByText('Tab 3')).toHaveAttribute('tabindex', '-1');
    });
  });

  it('can be named via `aria-label`', async () => {
    await renderAndSettle(() => (
      <Tabs.Root defaultValue={0}>
        <Tabs.List aria-label="string label">
          <Tabs.Tab value={0} />
        </Tabs.List>
      </Tabs.Root>
    ));

    expect(screen.getByRole('tablist')).toHaveAccessibleName('string label');
  });

  it('can be named via `aria-labelledby`', async () => {
    await renderAndSettle(() => (
      <>
        <h3 id="label-id">complex name</h3>
        <Tabs.Root defaultValue={0}>
          <Tabs.List aria-labelledby="label-id">
            <Tabs.Tab value={0} />
          </Tabs.List>
        </Tabs.Root>
      </>
    ));

    expect(screen.getByRole('tablist')).toHaveAccessibleName('complex name');
  });
});
