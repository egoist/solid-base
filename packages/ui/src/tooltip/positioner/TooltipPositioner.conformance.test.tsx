import { Tooltip } from '..';
import { positionerConformanceTests } from '../../popover/anchoredPopupTestUtils';

describe('<Tooltip.Positioner /> conformance', () => {
  positionerConformanceTests({
    viewport: true,
    defaultSide: 'top',
    defaultCollisionAvoidance: 'popup',
    createComponent: (props) => (
      <Tooltip.Root {...props.root}>
        <Tooltip.Trigger {...props.trigger}>Trigger</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner {...props.positioner}>
            <Tooltip.Popup {...props.popup}>
              {props.viewport ? <Tooltip.Viewport>Popup</Tooltip.Viewport> : 'Popup'}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ),
  });
});
