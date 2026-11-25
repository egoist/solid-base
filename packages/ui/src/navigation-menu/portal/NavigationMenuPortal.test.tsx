import { NavigationMenu } from '..';
import { describeConformance } from '../test-utils';

describe('<NavigationMenu.Portal />', () => {
  describeConformance(
    (props) => (
      <NavigationMenu.Root value="item">
        <NavigationMenu.Portal {...props} />
      </NavigationMenu.Root>
    ),
    { refInstanceof: window.HTMLDivElement },
  );
});
