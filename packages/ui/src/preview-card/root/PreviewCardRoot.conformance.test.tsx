import { PreviewCard } from '..';
import {
  detachedTriggersConformanceTests,
  popupConformanceTests,
} from '../../popover/anchoredPopupTestUtils';

describe('<PreviewCard.Root /> conformance', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  popupConformanceTests({
    createComponent: (props) => (
      <PreviewCard.Root {...props.root}>
        <PreviewCard.Trigger href="#" {...props.trigger}>Open</PreviewCard.Trigger>
        <PreviewCard.Portal {...props.portal}>
          <PreviewCard.Positioner>
            <PreviewCard.Popup {...props.popup}>Content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ),
    triggerMouseAction: 'hover',
  });

  detachedTriggersConformanceTests({
    createHandle: PreviewCard.createHandle,
    Root: PreviewCard.Root,
    Trigger: PreviewCard.Trigger,
    Portal: PreviewCard.Portal,
    Positioner: PreviewCard.Positioner,
    Popup: PreviewCard.Popup,
    Viewport: PreviewCard.Viewport,
    triggerProps: { href: '#', delay: 0, closeDelay: 0 },
    openInteractions: ['hover', 'focus'],
    ariaExpanded: false,
    throwOnMissingTrigger: true,
  });
});
