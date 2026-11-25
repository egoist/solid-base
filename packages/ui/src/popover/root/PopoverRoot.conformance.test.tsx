import { Popover } from '..';
import { detachedTriggersConformanceTests, popupConformanceTests } from '../anchoredPopupTestUtils';

describe('<Popover.Root /> conformance', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  popupConformanceTests({
    createComponent: (props) => (
      <Popover.Root {...props.root}>
        <Popover.Trigger {...props.trigger}>Open menu</Popover.Trigger>
        <Popover.Portal {...props.portal}>
          <Popover.Positioner>
            <Popover.Popup {...props.popup}>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
    triggerMouseAction: 'click',
    expectedPopupRole: 'dialog',
  });

  detachedTriggersConformanceTests({
    createHandle: Popover.createHandle,
    Root: Popover.Root,
    Trigger: Popover.Trigger,
    Portal: Popover.Portal,
    Positioner: Popover.Positioner,
    Popup: Popover.Popup,
    Viewport: Popover.Viewport,
    Close: Popover.Close,
    openInteractions: ['click'],
    ariaExpanded: true,
    throwOnMissingTrigger: true,
  });
});
