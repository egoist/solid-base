import { PreviewCard } from '..';
import { positionerConformanceTests } from '../../popover/anchoredPopupTestUtils';

describe('<PreviewCard.Positioner /> conformance', () => {
  positionerConformanceTests({
    viewport: true,
    defaultCollisionAvoidance: 'popup',
    createComponent: (props) => (
      <PreviewCard.Root {...props.root}>
        <PreviewCard.Trigger href="#" {...props.trigger}>Trigger</PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner {...props.positioner}>
            <PreviewCard.Popup {...props.popup}>
              {props.viewport ? <PreviewCard.Viewport>Popup</PreviewCard.Viewport> : 'Popup'}
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ),
  });
});
