import { createSignal, flush, For, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { CheckboxGroup } from '.';
import { Checkbox } from '../checkbox';

function click(element: Element) {
  fireEvent.click(element);
  flush();
}

function getChildCheckboxes() {
  return screen
    .getAllByRole('checkbox')
    .filter((element) => element.getAttribute('data-parent') == null);
}

describe('createCheckboxGroupParent', () => {
  const allValues = ['a', 'b', 'c'];

  function ControlledGroup(props: {
    initialValue: string[];
    children: (helpers: { value: () => string[] }) => any;
  }) {
    const [value, setValue] = createSignal<string[]>(props.initialValue);
    return (
      <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
        {props.children({ value })}
      </CheckboxGroup>
    );
  }

  it('should control child checkboxes', () => {
    const parentCheckedChange = vi.fn();
    const childCheckedChange = vi.fn();

    render(() => (
      <ControlledGroup initialValue={[]}>
        {() => (
          <>
            <Checkbox.Root parent data-testid="parent" onCheckedChange={parentCheckedChange} />
            <Checkbox.Root value="a" />
            <Checkbox.Root value="b" onCheckedChange={childCheckedChange} />
            <Checkbox.Root value="c" />
          </>
        )}
      </ControlledGroup>
    ));

    const checkboxes = getChildCheckboxes();
    const parent = screen.getByTestId('parent');

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    click(parent);
    expect(parent).toHaveAttribute('aria-checked', 'true');

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    expect(parentCheckedChange.mock.calls.length).toBe(1);
    expect(childCheckedChange.mock.calls.length).toBe(0);

    click(parent);
    expect(parent).toHaveAttribute('aria-checked', 'false');

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    expect(parentCheckedChange.mock.calls.length).toBe(2);
    expect(childCheckedChange.mock.calls.length).toBe(0);
  });

  it('parent should be marked as mixed if some children are checked', () => {
    const childCheckedChange = vi.fn();

    render(() => (
      <ControlledGroup initialValue={[]}>
        {() => (
          <>
            <Checkbox.Root parent data-testid="parent" />
            <Checkbox.Root value="a" onCheckedChange={childCheckedChange} />
            <Checkbox.Root value="b" />
            <Checkbox.Root value="c" />
          </>
        )}
      </ControlledGroup>
    ));

    const checkboxes = getChildCheckboxes();

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
    click(checkboxes[0]);
    expect(childCheckedChange.mock.calls.length).toBe(1);

    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'mixed');
  });

  it('updates uncontrolled parent-enabled groups from child clicks without duplicate callbacks', () => {
    const handleValueChange = vi.fn();

    render(() => (
      <CheckboxGroup allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" data-testid="checkboxB" />
        <Checkbox.Root value="c" data-testid="checkboxC" />
      </CheckboxGroup>
    ));

    const parent = screen.getByTestId('parent');
    const checkboxA = screen.getByTestId('checkboxA');
    const checkboxB = screen.getByTestId('checkboxB');
    const checkboxC = screen.getByTestId('checkboxC');

    click(checkboxA);

    expect(handleValueChange.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls[0][0]).toEqual(['a']);
    expect(parent).toHaveAttribute('aria-checked', 'mixed');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(checkboxB).toHaveAttribute('aria-checked', 'false');

    click(parent);

    expect(handleValueChange.mock.calls.length).toBe(2);
    expect(handleValueChange.mock.calls[1][0]).toEqual(['a', 'b', 'c']);
    expect(parent).toHaveAttribute('aria-checked', 'true');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(checkboxB).toHaveAttribute('aria-checked', 'true');
    expect(checkboxC).toHaveAttribute('aria-checked', 'true');

    click(parent);

    expect(handleValueChange.mock.calls.length).toBe(3);
    expect(handleValueChange.mock.calls[2][0]).toEqual([]);
    expect(parent).toHaveAttribute('aria-checked', 'false');
    expect(checkboxA).toHaveAttribute('aria-checked', 'false');
    expect(checkboxB).toHaveAttribute('aria-checked', 'false');
    expect(checkboxC).toHaveAttribute('aria-checked', 'false');
  });

  it('should correctly initialize the values array', () => {
    render(() => (
      <ControlledGroup initialValue={['a']}>
        {() => (
          <>
            <Checkbox.Root parent data-testid="parent" />
            <Checkbox.Root value="a" data-testid="checkboxA" />
            <Checkbox.Root value="b" />
            <Checkbox.Root value="c" />
          </>
        )}
      </ControlledGroup>
    ));

    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'mixed');
    expect(screen.getByTestId('checkboxA')).toHaveAttribute('aria-checked', 'true');
  });

  it('should update the values array when a child checkbox is clicked', () => {
    render(() => (
      <ControlledGroup initialValue={['a']}>
        {() => (
          <>
            <Checkbox.Root parent data-testid="parent" />
            <Checkbox.Root value="a" data-testid="checkboxA" />
            <Checkbox.Root value="b" />
            <Checkbox.Root value="c" />
          </>
        )}
      </ControlledGroup>
    ));

    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'mixed');

    const checkboxes = getChildCheckboxes();
    const checkboxA = screen.getByTestId('checkboxA');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');

    checkboxes.forEach((checkbox) => {
      if (checkbox !== checkboxA) {
        click(checkbox);
      }
    });

    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'true');
  });

  it('should apply space-separated aria-controls attribute with child names', () => {
    render(() => (
      <ControlledGroup initialValue={[]}>
        {() => (
          <>
            <Checkbox.Root parent data-testid="parent" />
            <For each={allValues}>{(v) => <Checkbox.Root value={v} data-testid={v} />}</For>
          </>
        )}
      </ControlledGroup>
    ));

    expect(screen.getByTestId('parent')).toHaveAttribute(
      'aria-controls',
      allValues.map((v) => screen.getByTestId(v).id).join(' '),
    );
  });

  it('keeps a custom child id in aria-controls', () => {
    render(() => (
      <CheckboxGroup allValues={['a']}>
        <Checkbox.Root parent data-testid="parent" nativeButton render="button" />
        <Checkbox.Root id="custom" value="a" data-testid="a" nativeButton render="button" />
      </CheckboxGroup>
    ));

    expect(screen.getByTestId('a')).toHaveAttribute('id', 'custom');
    expect(screen.getByTestId('parent')).toHaveAttribute('aria-controls', 'custom');
  });

  it.each([false, true])(
    'keeps a rendered child id in aria-controls (nativeButton=%s)',
    (nativeButton) => {
      render(() => (
        <CheckboxGroup allValues={['a']}>
          <Checkbox.Root
            parent
            data-testid="parent"
            nativeButton={nativeButton}
            render={nativeButton ? 'button' : undefined}
          />
          <Checkbox.Root
            value="a"
            nativeButton={nativeButton}
            render={(props) =>
              nativeButton ? <button {...props} id="rendered" /> : <span {...props} id="rendered" />
            }
          />
        </CheckboxGroup>
      ));

      expect(screen.getByTestId('parent')).toHaveAttribute('aria-controls', 'rendered');
    },
  );

  it('references the exposed child rather than its custom-id input without nativeButton', () => {
    render(() => (
      <CheckboxGroup allValues={['a']}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root id="custom" value="a" data-testid="a" />
      </CheckboxGroup>
    ));

    // The custom `id` lands on the hidden input, so `aria-controls` has to name the exposed
    // element instead.
    expect(document.querySelector('input[type="checkbox"][id="custom"]')).not.toBe(null);
    expect(screen.getByTestId('a').id).not.toBe('custom');
    expect(screen.getByTestId('parent')).toHaveAttribute(
      'aria-controls',
      screen.getByTestId('a').id,
    );
  });

  it('does not read aria-controls ids off Object.prototype', () => {
    render(() => (
      <CheckboxGroup allValues={['a', 'constructor']}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="a" />
      </CheckboxGroup>
    ));

    expect(screen.getByTestId('parent')).toHaveAttribute(
      'aria-controls',
      screen.getByTestId('a').id,
    );
  });

  it('drops an unmounted child from aria-controls', () => {
    const [showB, setShowB] = createSignal(true);
    render(() => (
      <CheckboxGroup allValues={allValues}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="a" />
        <Show when={showB()}>
          <Checkbox.Root value="b" data-testid="b" />
        </Show>
      </CheckboxGroup>
    ));

    setShowB(false);
    flush();

    expect(screen.getByTestId('parent')).toHaveAttribute(
      'aria-controls',
      screen.getByTestId('a').id,
    );
  });

  it('keeps both ids for checkboxes sharing a value and retains the survivor', () => {
    const [showSecondB, setShowSecondB] = createSignal(true);
    render(() => (
      <CheckboxGroup allValues={allValues}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="a" />
        <Checkbox.Root value="b" data-testid="b" />
        <Show when={showSecondB()}>
          <Checkbox.Root value="b" data-testid="second-b" />
        </Show>
      </CheckboxGroup>
    ));

    expect(screen.getByTestId('parent')).toHaveAttribute(
      'aria-controls',
      `${screen.getByTestId('a').id} ${screen.getByTestId('b').id} ${screen.getByTestId('second-b').id}`,
    );

    setShowSecondB(false);
    flush();

    expect(screen.getByTestId('parent')).toHaveAttribute(
      'aria-controls',
      `${screen.getByTestId('a').id} ${screen.getByTestId('b').id}`,
    );
  });

  it('does not select a child without an identifying value', () => {
    render(() => (
      <CheckboxGroup allValues={['a']}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root id="standalone" data-testid="no-value" />
        <Checkbox.Root value="a" data-testid="checkbox-a" />
      </CheckboxGroup>
    ));

    const parent = screen.getByTestId('parent');
    const noValue = screen.getByTestId('no-value');
    const checkboxA = screen.getByTestId('checkbox-a');

    click(parent);

    expect(parent).toHaveAttribute('aria-checked', 'true');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(noValue).toHaveAttribute('aria-checked', 'false');
    expect(noValue.nextElementSibling).toHaveAttribute('id', 'standalone');
  });

  it('preserves initial state if mixed when parent is clicked', () => {
    render(() => (
      <ControlledGroup initialValue={[]}>
        {() => (
          <>
            <Checkbox.Root parent data-testid="parent" />
            <Checkbox.Root value="a" data-testid="checkboxA" />
            <Checkbox.Root value="b" />
            <Checkbox.Root value="c" />
          </>
        )}
      </ControlledGroup>
    ));

    const checkboxes = getChildCheckboxes();
    const checkboxA = screen.getByTestId('checkboxA');
    const parent = screen.getByTestId('parent');

    click(checkboxA);

    expect(parent).toHaveAttribute('aria-checked', 'mixed');

    click(parent);

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    click(parent);

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    click(parent);

    expect(parent).toHaveAttribute('aria-checked', 'mixed');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', checkbox === checkboxA ? 'true' : 'false');
    });
  });

  it('lets a parent checkbox cancel a parent-enabled group change', () => {
    const handleValueChange = vi.fn();
    const handleParentChange = vi.fn((_, eventDetails: Checkbox.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });

    render(() => (
      <CheckboxGroup allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" onCheckedChange={handleParentChange} />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" data-testid="checkboxB" />
        <Checkbox.Root value="c" data-testid="checkboxC" />
      </CheckboxGroup>
    ));

    click(screen.getByTestId('parent'));

    expect(handleParentChange.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls.length).toBe(0);
    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxA')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxB')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxC')).toHaveAttribute('aria-checked', 'false');
  });

  it('lets a child checkbox cancel a parent-enabled group change', () => {
    const handleValueChange = vi.fn();
    const handleChildChange = vi.fn((_, eventDetails: Checkbox.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });

    render(() => (
      <CheckboxGroup allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" onCheckedChange={handleChildChange} />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));

    click(screen.getByTestId('checkboxA'));

    expect(handleChildChange.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls.length).toBe(0);
    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxA')).toHaveAttribute('aria-checked', 'false');
  });

  it('does not advance the parent toggle cycle when the group cancels a parent change', () => {
    const handleValueChange = vi.fn((_, eventDetails: CheckboxGroup.ChangeEventDetails) => {
      eventDetails.cancel();
    });

    render(() => (
      <CheckboxGroup value={['a']} allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));

    const parent = screen.getByTestId('parent');

    // From a mixed state the parent attempts to check all. The group cancels, so
    // the internal status must not advance to 'on'.
    click(parent);
    // A second click must retry the same 'mixed -> on' transition instead of
    // skipping ahead to 'on -> off' and proposing an empty value.
    click(parent);

    expect(handleValueChange).toHaveBeenCalledTimes(2);
    expect(handleValueChange.mock.calls[0][0]).toEqual(allValues);
    expect(handleValueChange.mock.calls[1][0]).toEqual(allValues);
  });

  it('does not pollute the parent snapshot when the group cancels a child change', () => {
    const handleValueChange = vi.fn((_, eventDetails: CheckboxGroup.ChangeEventDetails) => {
      eventDetails.cancel();
    });

    render(() => (
      <CheckboxGroup value={allValues} allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));

    // Unchecking a child is canceled, so the parent's snapshot of checked
    // children must stay intact.
    click(screen.getByTestId('checkboxA'));
    // The parent still sees an all-checked group and toggles to none. A polluted
    // snapshot would make it propose checking everything again.
    click(screen.getByTestId('parent'));

    expect(handleValueChange).toHaveBeenCalledTimes(2);
    expect(handleValueChange.mock.calls[0][0]).toEqual(['b', 'c']);
    expect(handleValueChange.mock.calls[1][0]).toEqual([]);
  });

  it('handles unchecked disabled checkboxes', () => {
    render(() => (
      <ControlledGroup initialValue={[]}>
        {() => (
          <>
            <Checkbox.Root parent data-testid="parent" />
            <Checkbox.Root value="a" disabled data-testid="checkboxA" />
            <Checkbox.Root value="b" />
            <Checkbox.Root value="c" />
          </>
        )}
      </ControlledGroup>
    ));

    const parent = screen.getByTestId('parent');
    click(parent);

    expect(parent).toHaveAttribute('aria-checked', 'mixed');
    expect(screen.getByTestId('checkboxA')).toHaveAttribute('aria-checked', 'false');
  });

  it('handles checked disabled checkboxes', () => {
    render(() => (
      <ControlledGroup initialValue={['a']}>
        {() => (
          <>
            <Checkbox.Root parent data-testid="parent" />
            <Checkbox.Root value="a" data-testid="checkboxA" disabled />
            <Checkbox.Root value="b" data-testid="checkboxB" />
            <Checkbox.Root value="c" />
          </>
        )}
      </ControlledGroup>
    ));

    const checkboxA = screen.getByTestId('checkboxA');
    const checkboxB = screen.getByTestId('checkboxB');
    const parent = screen.getByTestId('parent');

    click(parent);
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(checkboxB).toHaveAttribute('aria-checked', 'true');

    click(parent);
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(checkboxB).toHaveAttribute('aria-checked', 'false');
  });
});
