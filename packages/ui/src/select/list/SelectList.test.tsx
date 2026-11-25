import { render, screen } from '@solidjs/testing-library';
import { Select } from '..';

describe('<Select.List />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Select.Root open>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.List
                  data-testid="list"
                  ref={(el) => {
                    ref = el;
                  }}
                  class="list"
                  style={{ color: 'red' }}
                  render={(props) => <section {...props} />}
                />
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      const list = screen.getByTestId('list');
      expect(ref).toBe(list);
      expect(list.tagName).toBe('SECTION');
      expect(list).toHaveClass('list');
      expect(list).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });

    it('renders a div with the listbox role', () => {
      render(() => (
        <Select.Root open>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.List data-testid="list" />
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      const list = screen.getByTestId('list');
      expect(list).toBeInstanceOf(window.HTMLDivElement);
      expect(list).toHaveAttribute('role', 'listbox');
      expect(list.id).not.toBe('');
    });
  });
});
