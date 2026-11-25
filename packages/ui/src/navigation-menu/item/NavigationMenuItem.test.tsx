import { NavigationMenu } from '..';
import { describeConformance } from '../test-utils';

describe('<NavigationMenu.Item />', () => {
  describeConformance(
    (props) => (
      <NavigationMenu.Root>
        <NavigationMenu.Item {...props} />
      </NavigationMenu.Root>
    ),
    { refInstanceof: window.HTMLLIElement },
  );
});
