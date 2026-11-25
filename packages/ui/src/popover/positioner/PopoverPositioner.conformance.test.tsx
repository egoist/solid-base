import { Popover } from '..';
import { positionerConformanceTests } from '../anchoredPopupTestUtils';

describe('<Popover.Positioner /> conformance', () => {
  positionerConformanceTests({
    viewport: true,
    defaultCollisionAvoidance: 'popup',
    createComponent: (props) => (
      <Popover.Root {...props.root}>
        <Popover.Trigger {...props.trigger}>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner {...props.positioner}>
            <Popover.Popup {...props.popup}>
              {props.viewport ? <Popover.Viewport>Popup</Popover.Viewport> : 'Popup'}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
  });
});
