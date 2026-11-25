import { fireEvent, render, screen } from '@solidjs/testing-library';
import { For, createSignal, flush } from 'solid-js';
import { Select } from '..';
import { flushMicrotasks, renderWithUser } from '../test-utils';

describe('<Select.Value />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Select.Root open defaultValue="a">
        <Select.Value
          data-testid="value"
          ref={(el) => {
            ref = el;
          }}
          class={(state) => (state.placeholder ? 'value placeholder' : 'value')}
          style={{ color: 'red' }}
          render={(props) => <b {...props} />}
        />
      </Select.Root>
    ));
    const value = screen.getByTestId('value');
    expect(ref).toBe(value);
    expect(value.tagName).toBe('B');
    expect(value).toHaveClass('value');
    expect(value).not.toHaveClass('placeholder');
    expect(value).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(value).toHaveTextContent('a');
  });

  it('renders a span by default', () => {
    render(() => (
      <Select.Root>
        <Select.Value data-testid="value" />
      </Select.Root>
    ));
    expect(screen.getByTestId('value')).toBeInstanceOf(window.HTMLSpanElement);
  });

  describe('prop: children', () => {
    it('accepts a function with a value parameter', async () => {
      const children = vi.fn();
      render(() => (
        <Select.Root value="1">
          <Select.Trigger>
            <Select.Value>
              {(value: string) => {
                children(value);
                return value;
              }}
            </Select.Value>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="1">one</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      fireEvent.click(screen.getByText('1'));
      await flushMicrotasks();

      expect(children.mock.calls[0]?.[0]).toBe('1');
      expect(children.mock.calls[0]?.at(-1)).toBe('1');
    });

    it('overrides the text when children is a string', () => {
      render(() => (
        <Select.Root value="1">
          <Select.Value>one</Select.Value>
        </Select.Root>
      ));

      expect(screen.getByText('one')).not.toBe(null);
    });
  });

  describe('prop: items (object format)', () => {
    it('displays the label from items object when no children are provided', () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
        mono: 'Monospace',
      };

      render(() => (
        <Select.Root value="sans" items={items}>
          <Select.Trigger>
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="sans">Sans-serif</Select.Item>
                <Select.Item value="serif">Serif</Select.Item>
                <Select.Item value="mono">Monospace</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Sans-serif');
    });

    it('updates the label when value changes with items object', async () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
        mono: 'Monospace',
      };

      function App() {
        const [value, setValue] = createSignal<string | null>('sans');
        return (
          <div>
            <button onClick={() => setValue('serif')}>serif</button>
            <button onClick={() => setValue('mono')}>mono</button>
            <Select.Root value={value()} onValueChange={setValue} items={items}>
              <Select.Trigger>
                <Select.Value data-testid="value" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="sans">Sans-serif</Select.Item>
                    <Select.Item value="serif">Serif</Select.Item>
                    <Select.Item value="mono">Monospace</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        );
      }

      const { user } = renderWithUser(() => <App />);

      expect(screen.getByTestId('value')).toHaveTextContent('Sans-serif');

      await user.click(screen.getByRole('button', { name: 'serif' }));
      flush();
      expect(screen.getByTestId('value')).toHaveTextContent('Serif');

      await user.click(screen.getByRole('button', { name: 'mono' }));
      flush();
      expect(screen.getByTestId('value')).toHaveTextContent('Monospace');
    });

    it('falls back to raw value when value is not in items object', () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
      };

      render(() => (
        <Select.Root value="unknown" items={items}>
          <Select.Value data-testid="value" />
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('unknown');
    });

    it('supports element labels in items object', () => {
      const items = {
        sans: <span>Sans-serif</span>,
        serif: <span>Serif</span>,
      };

      render(() => (
        <Select.Root value="sans" items={items}>
          <Select.Value data-testid="value" />
        </Select.Root>
      ));

      expect(screen.getByTestId('value').querySelector('span')).toHaveTextContent('Sans-serif');
    });

    it('can lookup null value', () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
        null: 'Null',
      };

      render(() => (
        <Select.Root value={null} items={items}>
          <Select.Value data-testid="value" />
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Null');
    });
  });

  describe('prop: items (array format)', () => {
    it('displays the label from items array when no children are provided', () => {
      const items = [
        { value: 'sans', label: 'Sans-serif' },
        { value: 'serif', label: 'Serif' },
        { value: 'mono', label: 'Monospace' },
      ];

      render(() => (
        <Select.Root value="serif" items={items}>
          <Select.Trigger>
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="sans">Sans-serif</Select.Item>
                <Select.Item value="serif">Serif</Select.Item>
                <Select.Item value="mono">Monospace</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Serif');
    });

    it('updates the label when value changes with items array', async () => {
      const items = [
        { value: 'sans', label: 'Sans-serif' },
        { value: 'serif', label: 'Serif' },
        { value: 'mono', label: 'Monospace' },
      ];

      function App() {
        const [value, setValue] = createSignal<string | null>('sans');
        return (
          <div>
            <button onClick={() => setValue('serif')}>serif</button>
            <button onClick={() => setValue('mono')}>mono</button>
            <Select.Root value={value()} onValueChange={setValue} items={items}>
              <Select.Trigger>
                <Select.Value data-testid="value" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="sans">Sans-serif</Select.Item>
                    <Select.Item value="serif">Serif</Select.Item>
                    <Select.Item value="mono">Monospace</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        );
      }

      const { user } = renderWithUser(() => <App />);

      expect(screen.getByTestId('value')).toHaveTextContent('Sans-serif');

      await user.click(screen.getByRole('button', { name: 'serif' }));
      flush();
      expect(screen.getByTestId('value')).toHaveTextContent('Serif');

      await user.click(screen.getByRole('button', { name: 'mono' }));
      flush();
      expect(screen.getByTestId('value')).toHaveTextContent('Monospace');
    });

    it('falls back to raw value when value is not in items array', () => {
      const items = [
        { value: 'sans', label: 'Sans-serif' },
        { value: 'serif', label: 'Serif' },
      ];

      render(() => (
        <Select.Root value="unknown" items={items}>
          <Select.Value data-testid="value" />
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('unknown');
    });

    it('supports element labels in items array', () => {
      const items = [
        { value: 'bold', label: <strong>Bold Text</strong> },
        { value: 'italic', label: <em>Italic Text</em> },
      ];

      render(() => (
        <Select.Root value="bold" items={items}>
          <Select.Value data-testid="value" />
        </Select.Root>
      ));

      expect(screen.getByTestId('value').querySelector('strong')).toHaveTextContent('Bold Text');
    });

    it('is not stale after being updated', async () => {
      function App() {
        const [value, setValue] = createSignal<string | null>('a');
        const [items, setItems] = createSignal([
          { value: 'a', label: 'a' },
          { value: 'b', label: 'b' },
        ]);

        function updateItems() {
          setItems([
            { value: 'a', label: 'a new' },
            { value: 'b', label: 'b new' },
            { value: 'c', label: 'c' },
          ]);
        }

        return (
          <div>
            <button onClick={updateItems}>update</button>
            <button onClick={() => setValue('c')}>select c</button>
            <Select.Root value={value()} onValueChange={setValue} items={items()}>
              <Select.Trigger>
                <Select.Value data-testid="value" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <For each={items()}>
                      {(item) => <Select.Item value={item.value}>{item.label}</Select.Item>}
                    </For>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        );
      }

      const { user } = renderWithUser(() => <App />);

      expect(screen.getByTestId('value')).toHaveTextContent('a');

      await user.click(screen.getByRole('button', { name: 'update' }));
      flush();

      expect(screen.getByTestId('value')).toHaveTextContent('a new');

      await user.click(screen.getByRole('button', { name: 'select c' }));
      flush();

      expect(screen.getByTestId('value')).toHaveTextContent('c');
    });
  });

  describe('prop: itemToStringLabel', () => {
    it('uses custom itemToStringLabel function', () => {
      const items = [
        { country: 'United States', code: 'US' },
        { country: 'Canada', code: 'CA' },
      ];

      render(() => (
        <Select.Root
          value={items[1]}
          itemToStringLabel={(i: any) => i.country}
          itemToStringValue={(i: any) => i.code}
        >
          <Select.Trigger>
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <For each={items}>
                  {(it) => <Select.Item value={it}>{it.country}</Select.Item>}
                </For>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Canada');
    });

    it('falls back to label/value properties when functions are not provided', () => {
      const items = [
        { label: 'United States', value: 'US' },
        { label: 'Canada', value: 'CA' },
      ];

      render(() => (
        <Select.Root name="country" value={items[1]}>
          <Select.Trigger>
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <For each={items}>{(it) => <Select.Item value={it}>{it.label}</Select.Item>}</For>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Canada');

      const hiddenInput = screen.getByRole('textbox', {
        hidden: true,
      });
      expect(hiddenInput).toHaveValue('CA');
    });
  });

  describe('prop: children (takes precedence over items)', () => {
    it('uses children string over items object', () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
      };

      render(() => (
        <Select.Root value="sans" items={items}>
          <Select.Value data-testid="value">Custom Text</Select.Value>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Custom Text');
    });

    it('uses children function over items array', () => {
      const items = [
        { value: 'sans', label: 'Sans-serif' },
        { value: 'serif', label: 'Serif' },
      ];

      render(() => (
        <Select.Root value="sans" items={items}>
          <Select.Value data-testid="value">{(value: string) => `Custom: ${value}`}</Select.Value>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Custom: sans');
    });
  });

  it('changes text when the value changes', async () => {
    function App() {
      const [value, setValue] = createSignal<string | null>(null);
      return (
        <div>
          <button onClick={() => setValue('1')}>1</button>
          <button onClick={() => setValue('2')}>2</button>
          <button onClick={() => setValue(null)}>null</button>
          <Select.Root value={value()} onValueChange={setValue}>
            <Select.Trigger>
              <Select.Value data-testid="value">
                {(val: string | null) => val ?? 'initial'}
              </Select.Value>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="1">1</Select.Item>
                  <Select.Item value="2">2</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      );
    }

    const { user } = renderWithUser(() => <App />);

    await user.click(screen.getByText('initial'));
    await flushMicrotasks();

    await user.click(screen.getByRole('button', { name: '1' }));
    flush();
    expect(screen.getByTestId('value')).toHaveTextContent('1');

    await user.click(screen.getByRole('button', { name: '2' }));
    flush();
    expect(screen.getByTestId('value')).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: 'null' }));
    flush();
    expect(screen.getByTestId('value')).toHaveTextContent('initial');
  });

  describe('prop: multiple', () => {
    it('displays comma-separated labels for multiple values with items object', () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
        mono: 'Monospace',
      };

      render(() => (
        <Select.Root value={['sans', 'serif']} items={items} multiple>
          <Select.Trigger>
            <span data-testid="value">
              <Select.Value />
            </span>
          </Select.Trigger>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Sans-serif, Serif');
    });

    it('displays comma-separated labels for multiple values with items array', () => {
      const items = [
        { value: 'serif', label: 'Serif' },
        { value: 'mono', label: 'Monospace' },
      ];

      render(() => (
        <Select.Root value={['serif', 'mono']} items={items} multiple>
          <Select.Trigger>
            <span data-testid="value">
              <Select.Value />
            </span>
          </Select.Trigger>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Serif, Monospace');
    });

    it('supports element labels for multiple selections', () => {
      const items = [
        { value: 'bold', label: <strong>Bold Text</strong> },
        { value: 'italic', label: <em>Italic Text</em> },
      ];

      render(() => (
        <Select.Root value={['bold', 'italic']} items={items} multiple>
          <Select.Trigger>
            <span data-testid="value">
              <Select.Value />
            </span>
          </Select.Trigger>
        </Select.Root>
      ));

      const value = screen.getByTestId('value');
      expect(value.querySelector('strong')).toHaveTextContent('Bold Text');
      expect(value.querySelector('em')).toHaveTextContent('Italic Text');
      expect(value).toHaveTextContent('Bold Text, Italic Text');
    });

    it('falls back to raw values when no items are provided', () => {
      render(() => (
        <Select.Root value={['serif', 'mono']} multiple>
          <Select.Trigger>
            <span data-testid="value">
              <Select.Value />
            </span>
          </Select.Trigger>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('serif, mono');
    });

    it('displays single value when only one value is selected in multiple mode', () => {
      render(() => (
        <Select.Root value={['sans']} multiple>
          <Select.Value data-testid="value" />
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('sans');
    });

    it('displays empty when no values are selected in multiple mode', () => {
      render(() => (
        <Select.Root value={[]} multiple>
          <Select.Value data-testid="value" />
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('');
    });

    it('children function receives array of values in multiple mode', () => {
      const children = vi.fn();
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
      };

      render(() => (
        <Select.Root value={['sans', 'serif']} items={items} multiple>
          <Select.Value>
            {(values: string[]) => {
              children(values);
              return `Selected: ${Array.isArray(values) ? values.join(' + ') : values}`;
            }}
          </Select.Value>
        </Select.Root>
      ));

      expect(children.mock.calls[0]?.[0]).toEqual(['sans', 'serif']);
      expect(screen.getByText('Selected: sans + serif')).not.toBe(null);
    });

    it('children prop takes precedence over items in multiple mode', () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
      };

      render(() => (
        <Select.Root value={['sans', 'serif']} items={items} multiple>
          <Select.Value data-testid="value">Custom Multiple Text</Select.Value>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Custom Multiple Text');
    });

    it('defaults to empty array when no value is provided', () => {
      const renderValue = vi.fn();

      render(() => (
        <Select.Root multiple>
          <Select.Value>{renderValue}</Select.Value>
        </Select.Root>
      ));

      expect(renderValue.mock.calls[0]?.[0]).toEqual([]);
    });
  });

  describe('prop: placeholder', () => {
    it('displays placeholder when no value is selected', () => {
      render(() => (
        <Select.Root>
          <Select.Value data-testid="value" placeholder="Select an option" />
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Select an option');
    });

    it('displays placeholder when value is null', () => {
      render(() => (
        <Select.Root value={null}>
          <Select.Value data-testid="value" placeholder="Select an option" />
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Select an option');
    });

    it('does not display placeholder when value is selected', () => {
      render(() => (
        <Select.Root value="option1">
          <Select.Value data-testid="value" placeholder="Select an option" />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="option1">Option 1</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('option1');
    });

    it('children prop takes precedence over placeholder', () => {
      render(() => (
        <Select.Root>
          <Select.Value data-testid="value" placeholder="Select an option">
            Custom Text
          </Select.Value>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Custom Text');
    });

    it('children function takes precedence over placeholder', () => {
      render(() => (
        <Select.Root>
          <Select.Value data-testid="value" placeholder="Select an option">
            {(value: string | null) => value || 'Function fallback'}
          </Select.Value>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Function fallback');
    });

    it('null item label in items takes precedence over placeholder', () => {
      const items = [
        { value: null, label: 'None' },
        { value: 'option1', label: 'Option 1' },
      ];

      render(() => (
        <Select.Root items={items}>
          <Select.Value data-testid="value" placeholder="Select an option" />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value={null}>None</Select.Item>
                <Select.Item value="option1">Option 1</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('None');
    });

    it('uses placeholder when items have null value without label', () => {
      const items = [
        { value: null, label: null },
        { value: 'option1', label: 'Option 1' },
      ];

      render(() => (
        <Select.Root items={items}>
          <Select.Value data-testid="value" placeholder="Select an option" />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value={null}>None</Select.Item>
                <Select.Item value="option1">Option 1</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Select an option');
    });

    it('displays placeholder when object items do not have a null key', () => {
      const items = {
        option1: 'Option 1',
        option2: 'Option 2',
      };

      render(() => (
        <Select.Root items={items}>
          <Select.Value data-testid="value" placeholder="Select an option" />
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Select an option');
    });

    it('null key label in object items takes precedence over placeholder', () => {
      const items = {
        null: 'None',
        option1: 'Option 1',
      };

      render(() => (
        <Select.Root items={items}>
          <Select.Value data-testid="value" placeholder="Select an option" />
        </Select.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('None');
    });

    it('supports elements as placeholder', () => {
      render(() => (
        <Select.Root>
          <Select.Value
            data-testid="value"
            placeholder={<span data-testid="placeholder">Select an option</span>}
          />
        </Select.Root>
      ));

      expect(screen.getByTestId('placeholder')).toHaveTextContent('Select an option');
    });
  });
});
