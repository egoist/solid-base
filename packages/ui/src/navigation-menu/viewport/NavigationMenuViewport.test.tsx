import { NavigationMenu } from '..';
import { describeConformance } from '../test-utils';

describe('<NavigationMenu.Viewport />', () => {
  describeConformance(
    (props) => (
      <NavigationMenu.Root>
        <NavigationMenu.Viewport {...props} />
      </NavigationMenu.Root>
    ),
    { refInstanceof: window.HTMLDivElement },
  );
});
