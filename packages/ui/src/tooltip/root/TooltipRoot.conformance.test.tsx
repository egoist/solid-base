import { Tooltip } from '..';
import {
  detachedTriggersConformanceTests,
  popupConformanceTests,
} from '../../popover/anchoredPopupTestUtils';

describe('<Tooltip.Root /> conformance', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  popupConformanceTests({
    createComponent: (props) => (
      <Tooltip.Root {...props.root}>
        <Tooltip.Trigger {...props.trigger}>Open</Tooltip.Trigger>
        <Tooltip.Portal {...props.portal}>
          <Tooltip.Positioner>
            <Tooltip.Popup {...props.popup}>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ),
    triggerMouseAction: 'hover',
  });

  detachedTriggersConformanceTests({
    createHandle: Tooltip.createHandle,
    Root: Tooltip.Root,
    Trigger: Tooltip.Trigger,
    Portal: Tooltip.Portal,
    Positioner: Tooltip.Positioner,
    Popup: Tooltip.Popup,
    Viewport: Tooltip.Viewport,
    triggerProps: { delay: 0 },
    openInteractions: ['hover', 'focus'],
    ariaExpanded: false,
    throwOnMissingTrigger: true,
  });
});
