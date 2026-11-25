import { createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { screen } from '@solidjs/testing-library';
import { NOOP } from '@egoist/solid-base-utils/empty';
import { renderWithUser } from '../../menu/test-utils';
import * as FilterDropdown from '../test-utils';

describe('<FilterDropdown.Clear />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    renderWithUser(() => (
      <ControlledFilterDropdownRoot initialValue="can">
        <FilterDropdown.Popup>
          <FilterDropdown.Input aria-label="Filter" />
          <FilterDropdown.Clear
            ref={(el) => {
              ref = el;
            }}
            class="clear"
            style={{ color: 'red' }}
            nativeButton={false}
            render={(props) => <span {...props} />}
            data-testid="clear"
          />
        </FilterDropdown.Popup>
      </ControlledFilterDropdownRoot>
    ));

    const clear = screen.getByTestId('clear');
    expect(ref).toBe(clear);
    expect(clear.tagName).toBe('SPAN');
    expect(clear).toHaveClass('clear');
    expect(clear.style.color).toBe('red');
  });

  it('does not render when the filter value is empty', () => {
    renderWithUser(() => (
      <ControlledFilterDropdownRoot>
        <FilterDropdown.Popup>
          <FilterDropdown.Input aria-label="Filter" />
          <FilterDropdown.Clear data-testid="clear" />
        </FilterDropdown.Popup>
      </ControlledFilterDropdownRoot>
    ));

    expect(screen.queryByTestId('clear')).toBe(null);
  });

  it('clears the filter value and focuses the input when clicked', async () => {
    const onValueChange = vi.fn();
    const { user } = renderWithUser(() => (
      <ControlledFilterDropdownRoot initialValue="can" onValueChange={onValueChange}>
        <FilterDropdown.Popup>
          <FilterDropdown.Input aria-label="Filter countries" />
          <FilterDropdown.Clear aria-label="Clear filter" />
        </FilterDropdown.Popup>
      </ControlledFilterDropdownRoot>
    ));

    const input = screen.getByRole('searchbox', { name: 'Filter countries' });
    await user.click(screen.getByLabelText('Clear filter'));

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(screen.queryByLabelText('Clear filter')).toBe(null);
    expect(onValueChange).toHaveBeenLastCalledWith(
      '',
      expect.objectContaining({ reason: 'clear-press' }),
    );
  });

  it('does nothing when disabled', async () => {
    const { user } = renderWithUser(() => (
      <ControlledFilterDropdownRoot initialValue="can">
        <FilterDropdown.Popup>
          <FilterDropdown.Input aria-label="Filter countries" />
          <FilterDropdown.Clear aria-label="Clear filter" disabled />
        </FilterDropdown.Popup>
      </ControlledFilterDropdownRoot>
    ));

    const clear = screen.getByLabelText('Clear filter');
    expect(clear).toBeDisabled();

    await user.click(clear);

    expect(screen.getByRole('searchbox', { name: 'Filter countries' })).toHaveValue('can');
  });

  it('ignores a click on a disabled non-native button', async () => {
    const onValueChange = vi.fn();

    const { user } = renderWithUser(() => (
      <ControlledFilterDropdownRoot initialValue="can" onValueChange={onValueChange}>
        <FilterDropdown.Popup>
          <FilterDropdown.Input aria-label="Filter countries" />
          <FilterDropdown.Clear
            aria-label="Clear filter"
            disabled
            nativeButton={false}
            render={(props) => <div {...props} />}
          />
        </FilterDropdown.Popup>
      </ControlledFilterDropdownRoot>
    ));

    await user.click(screen.getByLabelText('Clear filter'));

    expect(onValueChange).not.toHaveBeenCalled();
  });
});

interface ControlledFilterDropdownRootProps {
  children: JSX.Element;
  initialValue?: string;
  onValueChange?: FilterDropdown.Root.Props['onValueChange'];
}

function ControlledFilterDropdownRoot(props: ControlledFilterDropdownRootProps) {
  // An initial value, read once.
  const [value, setValue] = createSignal(untrack(() => props.initialValue) ?? '');
  const listRef = { current: [] as Array<HTMLElement | null> };

  return (
    <FilterDropdown.Root
      open
      value={value()}
      listRef={listRef}
      getActiveIndex={() => null}
      setActiveIndex={NOOP}
      onValueChange={(nextValue, eventDetails) => {
        props.onValueChange?.(nextValue, eventDetails);
        setValue(nextValue);
      }}
    >
      {props.children}
    </FilterDropdown.Root>
  );
}
