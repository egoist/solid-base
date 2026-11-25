import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Combobox } from '..';
import { Field } from '../../field';
import { Form } from '../../form';
import { REASONS } from '../../internals/reasons';
import { act, flushMicrotasks, renderWithUser } from '../test-utils';

describe('<Combobox.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe('keyboard interaction', () => {
    it('focuses first item on ArrowDown and last item on ArrowUp', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                  <Combobox.Item value="cherry">cherry</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await act(async () => input.focus());

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        const first = screen.getByRole('option', { name: 'apple' });
        expect(input).toHaveAttribute('aria-activedescendant', first.id);
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.keyboard('{ArrowUp}');

      await waitFor(() => {
        const last = screen.getByRole('option', { name: 'cherry' });
        expect(input).toHaveAttribute('aria-activedescendant', last.id);
      });
    });

    it('opens, navigates with ArrowDown, and Enter selects', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = renderWithUser(() => (
        <Combobox.Root items={items}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      // Highlight first item and select it
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(input).toHaveValue('apple');
    });

    it('Enter selects with manual indices provided to items', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = renderWithUser(() => (
        <Combobox.Root items={items}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string, index: number) => (
                    <Combobox.Item value={item} index={index}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.click(input);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      await user.type(input, 'c'); // filter to "cherry"
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(input).toHaveValue('cherry');
      });
    });

    it('clicking on "listbox" keeps the focus on the input', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = renderWithUser(() => (
        <Combobox.Root items={items}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');

      await user.click(input);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      const listbox = screen.getByRole('listbox');
      await user.click(listbox);
      expect(input).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(input).toHaveValue('apple');
      });
    });

    it('Escape closes the popup without committing when nothing highlighted', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root defaultOpen items={['a', 'b']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      expect(screen.queryByRole('listbox')).not.toBe(null);

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(input).toHaveValue('');
    });

    it('bubbles Escape key when rendered inline without Positioner/Popup', async () => {
      const onOuterKeyDown = vi.fn();

      const { user } = renderWithUser(() => (
        <div
          data-testid="outer"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onOuterKeyDown();
            }
          }}
        >
          <Combobox.Root inline defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.List>
              <Combobox.Item value="a">a</Combobox.Item>
              <Combobox.Item value="b">b</Combobox.Item>
            </Combobox.List>
          </Combobox.Root>
        </div>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      await user.keyboard('{Escape}');

      expect(onOuterKeyDown.mock.calls.length).toBe(1);
    });

    it('keeps input value on Enter when inline and no item is highlighted', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root inline items={['Apple', 'Banana']}>
          <Combobox.Input data-testid="input" />
          <Combobox.List>
            {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.click(input);
      await user.type(input, 'Ba');

      expect(input).not.toHaveAttribute('aria-activedescendant');
      expect(input).toHaveValue('Ba');

      await user.keyboard('{Enter}');

      expect(input).toHaveValue('Ba');
    });

    it('bubbles Escape key when list is empty and popup hidden with CSS', async () => {
      const onOuterKeyDown = vi.fn();

      const { user } = renderWithUser(() => (
        <div
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onOuterKeyDown();
            }
          }}
        >
          <Combobox.Root defaultOpen items={[]}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner">
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </div>
      ));

      const positioner = await screen.findByTestId('positioner');
      positioner.style.display = 'none';

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(onOuterKeyDown.mock.calls.length).toBe(1);
    });

    it('does not bubble Escape key when Empty component is present', async () => {
      const onOuterKeyDown = vi.fn();

      const { user } = renderWithUser(() => (
        <div
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onOuterKeyDown();
            }
          }}
        >
          <Combobox.Root defaultOpen items={[]}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner">
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                  <Combobox.Empty>No results.</Combobox.Empty>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </div>
      ));

      const positioner = await screen.findByTestId('positioner');
      positioner.style.display = 'none';

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(onOuterKeyDown.mock.calls.length).toBe(0);
    });
  });

  describe('aria attributes', () => {
    it('sets all aria attributes on the input when closed', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
      expect(input).not.toHaveAttribute('aria-controls');
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('sets all aria attributes on the input when open', async () => {
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      const listbox = screen.getByRole('listbox');

      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
      expect(input).toHaveAttribute('aria-controls', listbox.id);
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('sets aria-expanded on the input when rendered inline and open', async () => {
      render(() => (
        <Combobox.Root inline open>
          <Combobox.Input data-testid="input" />
          <Combobox.List />
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      const listbox = screen.getByRole('listbox');

      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-controls', listbox.id);
    });

    it('sets the popup type on the input when rendered inline as a grid', async () => {
      render(() => (
        <Combobox.Root inline open grid>
          <Combobox.Input data-testid="input" />
          <Combobox.List />
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      const grid = screen.getByRole('grid');

      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-haspopup', 'grid');
      expect(input).toHaveAttribute('aria-controls', grid.id);
    });

    it('keeps the input expanded when rendered inline without the `open` prop', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root inline items={['apple', 'banana']}>
          <Combobox.Input data-testid="input" />
          <Combobox.List>
            {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      const listbox = screen.getByRole('listbox');

      // The list renders regardless of the internal open state, so the input must not claim
      // to be collapsed before it's interacted with.
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-controls', listbox.id);

      await user.click(input);

      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-controls', listbox.id);
    });

    it('sets correct attributes on the item when highlighted', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');

      await user.click(input);

      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('aria-selected', 'false');
      });
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('aria-selected', 'false');
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('option', { name: 'a' }).id,
      );

      await user.keyboard('{Enter}');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('aria-selected', 'true');
      });
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('aria-selected', 'false');
    });

    it('sets aria-controls to the dialog popup on trigger', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Trigger>trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen
        .getAllByRole('combobox')
        .find((element) => element.tagName === 'BUTTON')!;
      const popup = screen.getByRole('dialog');

      expect(popup.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await user.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('points aria-controls at a custom popup id on the trigger', async () => {
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Trigger>trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup id="custom-popup-id">
                <Combobox.Input data-testid="input" />
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen
        .getAllByRole('combobox')
        .find((element) => element.tagName === 'BUTTON')!;
      const popup = screen.getByRole('dialog');

      expect(popup.id).toBe('custom-popup-id');
      expect(trigger).toHaveAttribute('aria-controls', 'custom-popup-id');
    });

    it('points aria-controls at a popup id supplied through the render prop', async () => {
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Trigger>trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup render={(props) => <div {...props} id="custom-render-id" />}>
                <Combobox.Input data-testid="input" />
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen
        .getAllByRole('combobox')
        .find((element) => element.tagName === 'BUTTON')!;
      const popup = screen.getByRole('dialog');

      expect(popup.id).toBe('custom-render-id');
      expect(trigger).toHaveAttribute('aria-controls', 'custom-render-id');
    });
  });

  it('should handle browser autofill', async () => {
    const onInputValueChange = vi.fn();
    const { user } = renderWithUser(() => (
      <Combobox.Root name="test" onInputValueChange={onInputValueChange}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');

    fireEvent.change(
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'test')!,
      { target: { value: 'b' } },
    );
    await flushMicrotasks();
    expect(onInputValueChange.mock.lastCall?.[0]).toBe('b');
    expect(onInputValueChange.mock.lastCall?.[1].reason).toBe(REASONS.none);

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it.each([
    { lockState: 'readOnly', label: 'inside Field', withField: true, expectedError: 'test' },
    { lockState: 'disabled', label: 'inside Field', withField: true, expectedError: 'test' },
    { lockState: 'readOnly', label: 'outside Field', withField: false, expectedError: null },
    { lockState: 'disabled', label: 'outside Field', withField: false, expectedError: null },
  ] as const)(
    'ignores hidden-input autofill when $lockState $label',
    async ({ lockState, withField, expectedError }) => {
      const onValueChange = vi.fn();
      const onInputValueChange = vi.fn();
      const combobox = () => (
        <Combobox.Root
          name={withField ? undefined : 'test'}
          readOnly={lockState === 'readOnly'}
          disabled={lockState === 'disabled'}
          onValueChange={onValueChange}
          onInputValueChange={onInputValueChange}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      );

      render(() =>
        withField ? (
          <Form errors={{ test: 'test' }}>
            <Field.Root name="test">
              {combobox()}
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>
        ) : (
          combobox()
        ),
      );

      const visibleInput = screen.getByTestId<HTMLInputElement>('input');
      const hiddenInput = screen
        .getAllByDisplayValue('')
        .find((el) => el.getAttribute('name') === 'test') as HTMLInputElement;
      expect(hiddenInput).not.toBeUndefined();
      expect(screen.queryByTestId('error')?.textContent ?? null).toBe(expectedError);

      fireEvent.change(hiddenInput, { target: { value: 'b' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onInputValueChange).not.toHaveBeenCalled();
      expect(visibleInput.value).toBe('');
      expect(hiddenInput.value).toBe('');
      expect(screen.queryByTestId('error')?.textContent ?? null).toBe(expectedError);
    },
  );

  it('shows all items when opening after browser autofill', async () => {
    const items = ['a', 'b', 'c'];
    const { user } = renderWithUser(() => (
      <Combobox.Root name="test" items={items}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');

    fireEvent.change(
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'test')!,
      { target: { value: 'b' } },
    );
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.toBe(null);
    });
    expect(screen.getByRole('option', { name: 'a' })).not.toBe(null);
    expect(screen.getByRole('option', { name: 'b' })).not.toBe(null);
    expect(screen.getByRole('option', { name: 'c' })).not.toBe(null);
  });

  it('does not open or filter the popup on browser autofill with insertReplacementText', async () => {
    const items = ['a', 'b', 'c'];
    const { user } = renderWithUser(() => (
      <Combobox.Root name="test" items={items} defaultValue="b">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');

    // Firefox reports autofill on the visible input as `insertReplacementText`. The
    // autofilled text matches the selected label, so it must not count as a typed query
    // that filters the list once the popup opens.
    fireEvent.input(input, { target: { value: 'B' }, inputType: 'insertReplacementText' });
    await flushMicrotasks();

    expect(input).toHaveValue('B');
    expect(screen.queryByRole('listbox')).toBe(null);

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.toBe(null);
    });
    expect(screen.getByRole('option', { name: 'a' })).not.toBe(null);
    expect(screen.getByRole('option', { name: 'b' })).not.toBe(null);
    expect(screen.getByRole('option', { name: 'c' })).not.toBe(null);
  });

  it('should handle browser autofill with object values', async () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
    ];

    render(() => (
      <Combobox.Root
        name="country"
        items={items}
        itemToStringLabel={(item: (typeof items)[number]) => item.country}
        itemToStringValue={(item: (typeof items)[number]) => item.code}
        defaultOpen
      >
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: (typeof items)[1]) => (
                  <Combobox.Item value={item}>{item.country}</Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');

    fireEvent.change(
      // getByRole('textbox', { hidden: true, name: 'country' }) does not work
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'country')!,
      { target: { value: 'CA' } },
    );
    await flushMicrotasks();

    fireEvent.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('should handle browser autofill with object values when autofill uses the label', async () => {
    // Browsers autofill with the displayed text (label), not the underlying value.
    // For example, Chrome will autofill "United States" (the label), not "US" (the value).
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
    ];

    const onValueChange = vi.fn();

    render(() => (
      <Combobox.Root
        name="country"
        items={items}
        itemToStringLabel={(item: (typeof items)[number]) => item.country}
        itemToStringValue={(item: (typeof items)[number]) => item.code}
        onValueChange={onValueChange}
        defaultOpen
      >
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: (typeof items)[1]) => (
                  <Combobox.Item value={item}>{item.country}</Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');

    // Simulate browser autofill with the LABEL (displayed text), not the value
    fireEvent.change(
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'country')!,
      { target: { value: 'Canada' } }, // Browser sends "Canada" (label), not "CA" (value)
    );
    await flushMicrotasks();

    // onValueChange should be called with the matching object
    expect(onValueChange).toHaveBeenCalledWith(
      { country: 'Canada', code: 'CA' },
      expect.objectContaining({ reason: REASONS.none }),
    );

    fireEvent.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('matches browser autofill against an item rendered label for primitive values regardless of case', async () => {
    const { user } = renderWithUser(() => (
      <Combobox.Root name="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="US">United States</Combobox.Item>
                <Combobox.Item value="CA">Canada</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    // The browser autofills the rendered text ("Canada"), not the value ("CA").
    fireEvent.change(hiddenInput, { target: { value: 'canada' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('matches browser autofill by serialized value before an earlier rendered label', async () => {
    const { user } = renderWithUser(() => (
      <Combobox.Root name="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="CA">US</Combobox.Item>
                <Combobox.Item value="US">United States</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    fireEvent.change(hiddenInput, { target: { value: 'US' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'United States' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
    expect(screen.getByRole('option', { name: 'US' })).toHaveAttribute('aria-selected', 'false');
  });

  it('matches browser autofill when an earlier item has no rendered label', async () => {
    const { user } = renderWithUser(() => (
      <Combobox.Root name="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="US">{null}</Combobox.Item>
                <Combobox.Item value="CA">Canada</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    fireEvent.change(hiddenInput, { target: { value: 'Canada' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('matches browser autofill against an item rendered label when using the items prop', async () => {
    const countryNames: Record<string, string> = {
      US: 'United States',
      CA: 'Canada',
    };

    const { user } = renderWithUser(() => (
      <Combobox.Root name="country" items={['US', 'CA']}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(code: string) => <Combobox.Item value={code}>{countryNames[code]}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    fireEvent.change(hiddenInput, { target: { value: 'Canada' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('does not force-mount the list when autofill matches a serialized value with the items prop', async () => {
    const { user } = renderWithUser(() => (
      <Combobox.Root name="country" items={['US', 'CA']}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(code: string) => <Combobox.Item value={code}>{code}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    fireEvent.change(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    // The serialized value matched directly, so the popup must not be force-mounted.
    expect(document.querySelector('[role="listbox"]')).toBe(null);

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'CA' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('marks the field dirty and validates after successful autofill', async () => {
    const validateSpy = vi.fn((value: unknown) => {
      return value === 'CA' ? null : 'error';
    });

    render(() => (
      <Field.Root validationMode="onChange" validate={validateSpy}>
        <Combobox.Root name="country">
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="US">United States</Combobox.Item>
                  <Combobox.Item value="CA">Canada</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </Field.Root>
    ));

    const input = screen.getByTestId('input');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    expect(input).not.toHaveAttribute('data-dirty');

    fireEvent.change(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalled();
    });

    expect(validateSpy.mock.calls[validateSpy.mock.calls.length - 1][0]).toBe('CA');
    expect(input).toHaveAttribute('data-dirty', '');
  });

  it('does not update field state when autofill is canceled', async () => {
    render(() => (
      <Form errors={{ country: 'server error' }}>
        <Field.Root name="country">
          <Combobox.Root
            onValueChange={(_value, eventDetails) => {
              eventDetails.cancel();
            }}
          >
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input />
                  <Combobox.List>
                    <Combobox.Item value="US">United States</Combobox.Item>
                    <Combobox.Item value="CA">Canada</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
      </Form>
    ));

    const trigger = screen.getByTestId('trigger');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    expect(trigger).not.toHaveAttribute('data-dirty');
    expect(screen.getByTestId('error')).toHaveTextContent('server error');

    fireEvent.change(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    // The change was canceled, so the value never changed and the field keeps its state.
    expect(trigger).not.toHaveAttribute('data-dirty');
    expect(screen.getByTestId('error')).toHaveTextContent('server error');
  });

  it('does not mark the field dirty when input autofill is canceled', async () => {
    render(() => (
      <Field.Root>
        <Combobox.Root
          name="country"
          onValueChange={(_value, eventDetails) => {
            eventDetails.cancel();
          }}
        >
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="US">United States</Combobox.Item>
                  <Combobox.Item value="CA">Canada</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </Field.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    expect(trigger).not.toHaveAttribute('data-dirty');

    fireEvent.change(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    // The change was canceled, so the value never changed and the field stays pristine.
    expect(trigger).not.toHaveAttribute('data-dirty');
  });

  it('should pass autoComplete to the hidden input', async () => {
    render(() => (
      <Combobox.Root name="country" autoComplete="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="US">United States</Combobox.Item>
                <Combobox.Item value="CA">Canada</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const hiddenInput = screen.getByRole('textbox', { hidden: true });

    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).not.toHaveAttribute('name');
    expect(hiddenInput).toHaveAttribute('name', 'country');
    expect(hiddenInput).not.toHaveAttribute('id');
    expect(hiddenInput).toHaveAttribute('autocomplete', 'country');
  });

  // Needs real layout (popup width vs. viewport width).
  describe.skip('scroll locking', () => {
    describe('touch scroll lock', () => {
      it('applies scroll lock when a touch-opened popup covers the viewport width', async () => {
        render(() => (
          <Combobox.Root modal items={['Apple']}>
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner" style={{ width: 'calc(100vw - 10px)' }}>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="Apple">Apple</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const trigger = screen.getByTestId('trigger');

        fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        fireEvent.mouseDown(trigger);

        await screen.findByRole('listbox');

        await waitFor(() => {
          expect(trigger.ownerDocument.documentElement.style.overflow === 'hidden').toBe(true);
        });
      });

      it('does not apply scroll lock when a touch-opened popup is narrower than the viewport', async () => {
        render(() => (
          <Combobox.Root modal items={['Apple']}>
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner" style={{ width: '240px' }}>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="Apple">Apple</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const trigger = screen.getByTestId('trigger');

        fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        fireEvent.mouseDown(trigger);

        await screen.findByRole('listbox');

        await act(async () => {
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          });
        });

        expect(trigger.ownerDocument.documentElement.style.overflow === 'hidden').toBe(false);
      });
    });
  });

  it('does not open on programmatic input events', async () => {
    render(() => (
      <Combobox.Root>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="Darlinghurst">Darlinghurst</Combobox.Item>
                <Combobox.Item value="Sydney">Sydney</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Darlinghurst' } });
    await flushMicrotasks();

    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('opens on paste input events', async () => {
    render(() => (
      <Combobox.Root>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="Darlinghurst">Darlinghurst</Combobox.Item>
                <Combobox.Item value="Sydney">Sydney</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    fireEvent.input(input, {
      target: { value: 'Darlinghurst' },
      inputType: 'insertFromPaste',
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.toBe(null);
    });
  });

  describe('prop: id', () => {
    it('sets the id on the input when it is outside the popup', async () => {
      render(() => (
        <Combobox.Root id="test-id">
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');
      await waitFor(() => {
        expect(input).toHaveAttribute('id', 'test-id');
      });
    });

    it('sets the id on the trigger when the input is inside the popup', async () => {
      render(() => (
        <Combobox.Root id="test-id" defaultOpen>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const input = screen.getByTestId('input');

      expect(trigger).toHaveAttribute('id', 'test-id');
      expect(input).not.toHaveAttribute('id', 'test-id');
    });
  });

  describe('prop: disabled', () => {
    it('should render disabled state on all interactive components', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root disabled>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a" data-testid="item-a">
                    a
                  </Combobox.Item>
                  <Combobox.Item value="b" data-testid="item-b">
                    b
                  </Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('disabled');

      // Verify interactions are disabled
      await user.click(trigger);
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('should not open popup when disabled', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root disabled>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      await user.click(input);
      expect(screen.queryByRole('listbox')).toBe(null);

      await user.click(trigger);
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('should prevent keyboard interactions when disabled', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root disabled>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.type(input, 'a');
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('should set disabled attribute on hidden input', async () => {
      render(() => (
        <Combobox.Root disabled name="test">
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('disabled');
    });
  });

  describe('prop: required', () => {
    it('does not mark the hidden input as required when selection exists in multiple mode', async () => {
      render(() => (
        <Combobox.Root multiple required name="languages" value={['a']}>
          <Combobox.Input />
        </Combobox.Root>
      ));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).not.toHaveAttribute('required');
    });

    it('keeps the hidden input required when no selection exists in multiple mode', async () => {
      render(() => (
        <Combobox.Root multiple required name="languages" value={[]}>
          <Combobox.Input />
        </Combobox.Root>
      ));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).toHaveAttribute('required');
    });
  });

  describe('prop: readOnly', () => {
    it('should render readOnly state on the input', async () => {
      render(() => (
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      expect(input).toHaveAttribute('aria-readonly', 'true');
      expect(input).toHaveAttribute('readonly');
    });

    it('should expose aria-autocomplete="none" when readOnly', async () => {
      render(() => (
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
        </Combobox.Root>
      ));

      expect(screen.getByTestId('input')).toHaveAttribute('aria-autocomplete', 'none');
    });

    it('should open the popup from the input and the trigger when readOnly', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByTestId('input'));
      expect(await screen.findByRole('listbox')).toHaveAttribute('aria-readonly', 'true');

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.click(screen.getByTestId('trigger'));
      expect(await screen.findByRole('listbox')).not.toBe(null);
    });

    it('should browse the items with the arrow keys when readOnly', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await screen.findByRole('listbox');

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-highlighted');
      });

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-highlighted');
      });
    });

    it('should not change the input value when typing while readOnly', async () => {
      const onInputValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Combobox.Root readOnly onInputValueChange={onInputValueChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.type(input, 'a');

      expect(input).toHaveValue('');
      expect(onInputValueChange).not.toHaveBeenCalled();
    });

    it('should set readOnly attribute on hidden input', async () => {
      render(() => (
        <Combobox.Root readOnly name="test">
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('readonly');
    });

    it('should prevent value changes when readOnly with items', async () => {
      const handleValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Combobox.Root readOnly onValueChange={handleValueChange} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a" data-testid="item-a">
                    a
                  </Combobox.Item>
                  <Combobox.Item value="b" data-testid="item-b">
                    b
                  </Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const itemA = screen.getByTestId('item-a');
      await user.click(itemA);

      expect(handleValueChange.mock.calls.length).toBe(0);
    });

    it('should not submit the form with Enter on a highlighted item when readOnly', async () => {
      const onSubmit = vi.fn();
      const { user } = renderWithUser(() => (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Combobox.Root readOnly>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <button type="submit">Submit</button>
        </form>
      ));

      await user.click(screen.getByTestId('input'));
      await screen.findByRole('listbox');

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-highlighted');
      });

      await user.keyboard('{Enter}');

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should report arrow-key highlights as keyboard-driven when readOnly', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = renderWithUser(() => (
        <Combobox.Root readOnly onItemHighlighted={onItemHighlighted}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      // Opening by pointer marks pointer activity, which the arrow key must clear.
      await user.click(screen.getByTestId('input'));
      await screen.findByRole('listbox');
      onItemHighlighted.mockClear();

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenCalledWith(
          'a',
          expect.objectContaining({ reason: 'keyboard' }),
        );
      });
    });

    it('should not commit a value with Enter on a highlighted item when readOnly', async () => {
      const handleValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Combobox.Root readOnly onValueChange={handleValueChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await screen.findByRole('listbox');

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-highlighted');
      });

      await user.keyboard('{Enter}');

      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(input).toHaveValue('');
    });
  });

  describe('prop: itemToStringLabel', () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
      { country: 'Australia', code: 'AU' },
    ];

    it('uses itemToStringLabel for input value synchronization', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root
          items={items}
          itemToStringLabel={(item: (typeof items)[number]) => item.country}
          itemToStringValue={(item: (typeof items)[number]) => item.code}
          defaultOpen
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: { country: string; code: string }) => (
                    <Combobox.Item value={item}>{item.country}</Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');
      await user.click(screen.getByText('Canada'));
      expect(input).toHaveValue('Canada');
    });

    it('shows the label for a controlled object value not in items', async () => {
      const value = { country: 'Japan', code: 'JP' };

      render(() => (
        <Combobox.Root
          items={items}
          value={value}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
        >
          <Combobox.Input />
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');
      expect(input).toHaveValue('Japan');
    });
  });

  describe('prop: itemToStringValue', () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
      { country: 'Australia', code: 'AU' },
    ];

    it('uses itemToStringValue for form submission', async () => {
      render(() => (
        <Combobox.Root
          name="country"
          items={items}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
          defaultValue={items[0]}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const hiddenInput = screen.getByDisplayValue('US'); // input[name="country"]
      expect(hiddenInput.tagName).toBe('INPUT');
      expect(hiddenInput).toHaveAttribute('name', 'country');
    });

    it('uses itemToStringValue for multiple selection form submission', async () => {
      const values = [items[0], items[1]];
      render(() => (
        <Combobox.Root
          name="countries"
          items={items}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
          multiple
          defaultValue={values}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      values.forEach((value) => {
        const input = screen.getByDisplayValue(value.code);
        expect(input.tagName).toBe('INPUT');
        expect(input).toHaveAttribute('name', 'countries');
      });
    });
  });
});
