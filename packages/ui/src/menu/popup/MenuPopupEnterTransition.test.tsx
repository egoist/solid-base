import type { JSX } from '@solidjs/web';
import { render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Menu } from '..';
import { renderWithProps } from '../../dialog/test-utils';
import { act, wait } from '../test-utils';

// Upstream runs this suite only in real browsers. The behavior it pins (`[data-starting-style]`
// and `[data-instant]` during the enter frames) is driven by animation frames, which jsdom
// provides, so it runs here too.

const activeTrackers: Array<{ stop(): void }> = [];

/**
 * Records whether `selector` ever matches an element. Polls per frame because the tracked
 * attributes may be present for only a single frame.
 */
function trackSelector(selector: string) {
  let seen = false;
  let frame: number;

  function sample() {
    if (document.querySelector(selector)) {
      seen = true;
    }
    frame = requestAnimationFrame(sample);
  }
  frame = requestAnimationFrame(sample);

  const tracker = {
    seen: () => seen,
    stop() {
      cancelAnimationFrame(frame);
    },
  };
  activeTrackers.push(tracker);
  return tracker;
}

/**
 * Records whether an element ever carries `[data-starting-style]`, which is what drives the enter
 * transition.
 */
function trackStartingStyle(testId: string) {
  return trackSelector(`[data-testid="${testId}"][data-starting-style]`);
}

async function waitMs(ms: number) {
  await act(() => wait(ms));
}

function SubmenuMenu(props: {
  rootProps?: Menu.Root.Props;
  portalProps?: Menu.Portal.Props;
  submenuProps?: Menu.SubmenuRoot.Props;
  withItem?: boolean;
  showSubmenuPopup?: boolean;
  children?: JSX.Element;
}) {
  return (
    <Menu.Root {...props.rootProps}>
      <Menu.Trigger>Trigger</Menu.Trigger>
      <Menu.Portal {...props.portalProps}>
        <Menu.Positioner>
          <Menu.Popup data-testid="menu-popup">
            {props.withItem !== false && <Menu.Item>Item</Menu.Item>}
            <Menu.SubmenuRoot {...props.submenuProps}>
              <Menu.SubmenuTrigger>Submenu</Menu.SubmenuTrigger>
              {props.showSubmenuPopup !== false && (
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu-popup">
                      <Menu.Item>Sub item</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              )}
            </Menu.SubmenuRoot>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

async function openWithKeyboard() {
  const trigger = screen.getByRole('button', { name: 'Trigger' });
  await act(() => {
    trigger.focus();
  });
  await userEvent.keyboard('[Enter]');
}

describe('Menu enter transition', () => {
  afterEach(() => {
    activeTrackers.splice(0).forEach((tracker) => tracker.stop());
  });

  it('plays the enter transition for a submenu that is open when its parent opens', async () => {
    const submenuTracker = trackStartingStyle('submenu-popup');

    render(() => <SubmenuMenu submenuProps={{ defaultOpen: true }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Trigger' }));

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(submenuTracker.seen()).toBe(true);
    });
  });

  it('plays the enter transition for a controlled-open submenu when its parent opens', async () => {
    const submenuTracker = trackStartingStyle('submenu-popup');

    render(() => <SubmenuMenu submenuProps={{ open: true }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Trigger' }));

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(submenuTracker.seen()).toBe(true);
    });
  });

  it('does not play the enter transition for a menu that is open on the first render', async () => {
    const menuTracker = trackStartingStyle('menu-popup');

    render(() => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Trigger</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="menu-popup">
              <Menu.Item>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await waitFor(() => {
      expect(screen.queryByTestId('menu-popup')).not.toBe(null);
    });

    await waitMs(100);

    expect(menuTracker.seen()).toBe(false);
  });

  it('does not play the enter transition for a submenu inside a menu that is open on the first render', async () => {
    const menuTracker = trackStartingStyle('menu-popup');
    const submenuTracker = trackStartingStyle('submenu-popup');

    render(() => (
      <SubmenuMenu rootProps={{ defaultOpen: true }} submenuProps={{ defaultOpen: true }} />
    ));

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });

    await waitMs(100);

    expect(menuTracker.seen()).toBe(false);
    expect(submenuTracker.seen()).toBe(false);
  });

  it('does not play the enter transition for a submenu when the parent popup is kept mounted', async () => {
    // Known limitation (upstream): with a `keepMounted` parent the submenu subtree exists from
    // page load, so its mount cannot be tied to the parent's reveal. This pins the behavior.
    const submenuTracker = trackStartingStyle('submenu-popup');

    render(() => (
      <SubmenuMenu portalProps={{ keepMounted: true }} submenuProps={{ defaultOpen: true }} />
    ));

    await userEvent.click(screen.getByRole('button', { name: 'Trigger' }));

    await waitFor(() => {
      expect(screen.getByTestId('menu-popup')).toBeVisible();
    });

    await waitMs(100);

    expect(submenuTracker.seen()).toBe(false);
  });

  it('plays the enter transition for a submenu opened by the user', async () => {
    const submenuTracker = trackStartingStyle('submenu-popup');

    render(() => <SubmenuMenu rootProps={{ defaultOpen: true }} withItem={false} />);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Submenu' }));

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(submenuTracker.seen()).toBe(true);
    });
  });

  it('plays the enter transition for a submenu whose parent opened instantly', async () => {
    // `data-instant` is a styling hint: the submenu must still go through `'starting'` alongside
    // the parent on a keyboard open.
    const submenuTracker = trackStartingStyle('submenu-popup');

    render(() => <SubmenuMenu submenuProps={{ defaultOpen: true }} />);

    await openWithKeyboard();

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(submenuTracker.seen()).toBe(true);
    });
  });

  it('marks an initially open submenu as instant when its parent opened instantly', async () => {
    const submenuInstantTracker = trackSelector(
      '[data-testid="submenu-popup"][data-instant="click"]',
    );

    render(() => <SubmenuMenu submenuProps={{ defaultOpen: true }} />);

    await openWithKeyboard();

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('menu-popup')).toHaveAttribute('data-instant', 'click');
    // The submenu carries the inherited value during its enter frames only: it is cleared once
    // the initial reveal settles, so it cannot suppress later transitions.
    await waitFor(() => {
      expect(submenuInstantTracker.seen()).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
    });
  });

  it('clears the inherited instant type after the initial open', async () => {
    // The inherited `instantType` must not outlive the initial reveal: controlled `open` flips
    // bypass `setOpen`, so a value that stuck around would suppress later transitions.
    const { setProps } = renderWithProps(
      (props: { submenuOpen: boolean }) => (
        <SubmenuMenu
          submenuProps={{
            get open() {
              return props.submenuOpen;
            },
          }}
        />
      ),
      { submenuOpen: true },
    );

    await openWithKeyboard();

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
    });

    await setProps({ submenuOpen: false });
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).toBe(null);
    });

    await setProps({ submenuOpen: true });
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
  });

  // Upstream holds the entry open with a 300ms CSS transition; jsdom has no animations, so here
  // the controlled close lands right after the entry starts instead.
  it('clears the inherited instant type when a controlled close interrupts the entry', async () => {
    const { setProps } = renderWithProps(
      (props: { submenuOpen: boolean }) => (
        <SubmenuMenu
          submenuProps={{
            get open() {
              return props.submenuOpen;
            },
          }}
        />
      ),
      { submenuOpen: true },
    );

    await openWithKeyboard();

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });

    await setProps({ submenuOpen: false });
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).toBe(null);
    });

    await setProps({ submenuOpen: true });
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
  });

  it('clears the inherited instant type when the popup is not initially rendered', async () => {
    // With the popup subtree omitted at mount, there is no element for the animations-finished
    // callback to watch. The seed must still be cleared.
    const { setProps } = renderWithProps(
      (props: { showPopup: boolean }) => (
        <SubmenuMenu
          submenuProps={{ defaultOpen: true }}
          showSubmenuPopup={props.showPopup}
        />
      ),
      { showPopup: false },
    );

    await openWithKeyboard();

    await waitFor(() => {
      expect(screen.getByTestId('menu-popup')).toHaveAttribute('data-instant', 'click');
    });
    // Give the reveal time to settle while the submenu popup is absent.
    await waitMs(100);

    await setProps({ showPopup: true });
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
  });

  it('does not mark a closed submenu as instant when it is later opened programmatically', async () => {
    // A submenu that mounts closed during the parent's enter transition must not inherit the
    // parent's `instantType`; the controlled `open={false}` must win over `defaultOpen`.
    const { setProps } = renderWithProps(
      (props: { submenuOpen: boolean }) => (
        <SubmenuMenu
          submenuProps={{
            get open() {
              return props.submenuOpen;
            },
            defaultOpen: true,
          }}
        />
      ),
      { submenuOpen: false },
    );

    await openWithKeyboard();

    await waitFor(() => {
      expect(screen.queryByTestId('menu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('menu-popup')).toHaveAttribute('data-instant', 'click');

    await setProps({ submenuOpen: true });

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
  });
});
