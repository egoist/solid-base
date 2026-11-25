import { createSignal } from 'solid-js';
import { Drawer } from '@egoist/solid-base/drawer';
import { SidebarLinks } from './Sidebar';
import { CloseIcon, MenuIcon } from './icons';

/** The sidebar on small screens, in the library's swipeable Drawer. */
export function MobileNav() {
  const [open, setOpen] = createSignal(false);
  return (
    <Drawer.Root open={open()} onOpenChange={(next) => setOpen(next)} swipeDirection="left">
      <Drawer.Trigger class="icon-button mobile-nav-trigger" aria-label="Open navigation">
        <MenuIcon />
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop class="mobile-nav-backdrop" />
        <Drawer.Viewport class="mobile-nav-viewport">
          <Drawer.Popup class="mobile-nav-popup">
            <div class="mobile-nav-header">
              <Drawer.Title class="eyebrow">Navigation</Drawer.Title>
              <Drawer.Close class="icon-button" aria-label="Close navigation">
                <CloseIcon />
              </Drawer.Close>
            </div>
            <Drawer.Content class="mobile-nav-content">
              <SidebarLinks onNavigate={() => setOpen(false)} />
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
