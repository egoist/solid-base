import { For, Show, createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { HTMLProps } from '../../../internals/types';
import { createTestFloating, getInteractionProps, getItemInteractionProps } from '../testUtils';
import { createClick } from './click';
import { createTypeahead } from './typeahead';
import type { CreateTypeaheadOptions } from './typeahead';
import { cleanupRef } from './__fixtures__/helpers';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

function act(fn: () => void) {
  fn();
  flush();
}

interface MatchSpyProps {
  onMatch?: ((index: number) => void) | undefined;
}

type ImplProps = MatchSpyProps &
  Pick<CreateTypeaheadOptions, 'onTyping'> & {
    list?: Array<string>;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    addUseClick?: boolean;
  };

function createImpl(props: ImplProps) {
  const [open, setOpen] = createSignal(true);
  const [activeIndex, setActiveIndex] = createSignal<null | number>(null);
  const isOpen = () => props.open ?? open();
  const { store, refs } = createTestFloating({
    open: isOpen,
    onOpenChange: (value) => (props.onOpenChange ?? setOpen)(value),
  });
  const listRef: RefObject<Array<string | null>> = {
    current: props.list ?? ['one', 'two', 'three'],
  };
  const typeahead = createTypeahead(store, {
    listRef,
    get activeIndex() {
      return activeIndex();
    },
    onMatch(index) {
      setActiveIndex(index);
      props.onMatch?.(index);
    },
    onTyping: (isTyping) => props.onTyping?.(isTyping),
  });
  const click = createClick(store, {
    get enabled() {
      return props.addUseClick ?? false;
    },
  });

  const interactions = [typeahead, click];

  return {
    activeIndex,
    open: isOpen,
    getReferenceProps: (userProps?: HTMLProps) =>
      getInteractionProps(interactions, 'reference', {
        role: 'combobox',
        ...userProps,
        ref: refs.setReference,
      }),
    getFloatingProps: () =>
      getInteractionProps(interactions, 'floating', {
        role: 'listbox',
        ref: cleanupRef(refs.setFloating),
      }),
  };
}

function Combobox(
  props: MatchSpyProps &
    Pick<CreateTypeaheadOptions, 'onTyping'> & {
      list?: Array<string>;
      open?: boolean;
    },
) {
  const { getReferenceProps, getFloatingProps } = createImpl(props);
  return (
    <>
      <input {...getReferenceProps()} />
      <div {...getFloatingProps()} />
    </>
  );
}

function ComboboxWithElementsRef(
  props: MatchSpyProps & {
    list?: Array<string>;
    hiddenIndices?: Array<number>;
  },
) {
  const [activeIndex, setActiveIndex] = createSignal<null | number>(null);
  const [open, setOpen] = createSignal(true);
  const { store, refs } = createTestFloating({
    open,
    onOpenChange: (value) => setOpen(value),
  });
  const list = props.list ?? ['apple', 'apricot', 'banana'];
  const listRef: RefObject<Array<string | null>> = { current: list };
  const elementsRef: RefObject<Array<HTMLElement | null>> = { current: [] };
  const typeahead = createTypeahead(store, {
    listRef,
    elementsRef,
    get activeIndex() {
      return activeIndex();
    },
    onMatch(index) {
      setActiveIndex(index);
      props.onMatch?.(index);
    },
  });

  const interactions = [typeahead];

  return (
    <>
      <input
        {...getInteractionProps(interactions, 'reference', {
          role: 'combobox',
          ref: refs.setReference,
        })}
      />
      <Show when={open()}>
        <div
          {...getInteractionProps(interactions, 'floating', {
            role: 'listbox',
            ref: cleanupRef(refs.setFloating),
          })}
        >
          <For each={list} keyed={false}>
            {(value, index) => (
              <div
                role="option"
                aria-selected={activeIndex() === index ? 'true' : 'false'}
                style={props.hiddenIndices?.includes(index) ? { display: 'none' } : undefined}
                {...getItemInteractionProps(interactions, {
                  ref: cleanupRef<HTMLElement>((node) => {
                    elementsRef.current[index] = node;
                  }),
                })}
              >
                {value()}
              </div>
            )}
          </For>
        </div>
      </Show>
    </>
  );
}

describe('createTypeahead', () => {
  it('passes the matching keydown event to onMatch', async () => {
    const onMatch = vi.fn();

    function App() {
      const { store, refs } = createTestFloating({ open: () => true });
      const listRef = { current: ['one', 'two', 'three'] };
      const typeahead = createTypeahead(store, { listRef, activeIndex: null, onMatch });
      return (
        <input
          {...getInteractionProps([typeahead], 'reference', {
            role: 'combobox',
            ref: refs.setReference,
          })}
        />
      );
    }

    render(() => <App />);

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('t');

    expect(onMatch).toHaveBeenCalledTimes(1);
    expect(onMatch.mock.lastCall?.[0]).toBe(1);
    expect(onMatch.mock.lastCall?.[1].type).toBe('keydown');
    expect(onMatch.mock.lastCall?.[1].key).toBe('t');
  });

  it('rapidly focuses list items when they start with the same letter', async () => {
    const spy = vi.fn();
    render(() => <Combobox onMatch={spy} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(1);

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(2);

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('bails out of rapid focus of first letter if the list contains a string that starts with two of the same letter', async () => {
    const spy = vi.fn();
    render(() => <Combobox onMatch={spy} list={['apple', 'aaron', 'apricot']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(0);

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(0);
  });

  // Upstream also runs this under React's StrictMode, which has no Solid counterpart.
  it('starts from the current activeIndex and correctly loops', async () => {
    const spy = vi.fn();
    render(() => <Combobox onMatch={spy} list={['Toy Story 2', 'Toy Story 3', 'Toy Story 4']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).toHaveBeenCalledWith(0);

    spy.mockReset();

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(750);

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).toHaveBeenCalledWith(1);

    vi.advanceTimersByTime(750);

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).toHaveBeenCalledWith(2);

    vi.advanceTimersByTime(750);

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).toHaveBeenCalledWith(0);
  });

  it('capslock characters continue to match', async () => {
    const spy = vi.fn();
    render(() => <Combobox onMatch={spy} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('{CapsLock}t');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('does not depend on locale-sensitive lowercasing', async () => {
    const toLocaleLowerCase = String.prototype.toLocaleLowerCase;
    const toLocaleLowerCaseSpy = vi
      .spyOn(String.prototype, 'toLocaleLowerCase')
      .mockImplementation(function lowerWithTurkishLocale(this: string) {
        return toLocaleLowerCase.call(this, 'tr');
      });

    try {
      const spy = vi.fn();
      render(() => <Combobox onMatch={spy} list={['Istanbul']} />);

      await userEvent.click(screen.getByRole('combobox'));

      await userEvent.keyboard('i');
      expect(spy).toHaveBeenCalledWith(0);
    } finally {
      toLocaleLowerCaseSpy.mockRestore();
    }
  });

  function App1(props: MatchSpyProps & { list: Array<string> }) {
    const { getReferenceProps, getFloatingProps, activeIndex, open } = createImpl(props);
    let input: HTMLInputElement | undefined;

    return (
      <>
        <div
          {...getReferenceProps({
            onClick: () => input?.focus(),
          })}
        >
          <input ref={input} readonly />
        </div>
        <Show when={open()}>
          <div {...getFloatingProps()}>
            <For each={props.list}>
              {(value, i) => (
                <div
                  role="option"
                  tabindex={i() === activeIndex() ? 0 : -1}
                  aria-selected={i() === activeIndex() ? 'true' : 'false'}
                >
                  {value}
                </div>
              )}
            </For>
          </div>
        </Show>
      </>
    );
  }

  it('matches when focus is within reference', async () => {
    const spy = vi.fn();
    render(() => <App1 onMatch={spy} list={['one', 'two', 'three']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('matches when focus is within floating', async () => {
    const spy = vi.fn();
    render(() => <App1 onMatch={spy} list={['one', 'two', 'three']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    const option = await screen.findByRole('option', { selected: true });
    expect(option.textContent).toBe('two');
    option.focus();
    expect(option).toHaveFocus();

    await userEvent.keyboard('h');
    expect((await screen.findByRole('option', { selected: true })).textContent).toBe('three');
  });

  it('onTyping is called with typing activity', async () => {
    const spy = vi.fn();
    render(() => <Combobox onTyping={spy} list={['one', 'two', 'three']} />);

    act(() => screen.getByRole('combobox').focus());

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(true);

    vi.advanceTimersByTime(750);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(false);
  });

  it('onTyping is called when the popup closes without moving focus', async () => {
    const spy = vi.fn();
    const [open, setOpen] = createSignal(true);
    render(() => <Combobox open={open()} onTyping={spy} />);

    expect(spy).not.toHaveBeenCalled();

    act(() => screen.getByRole('combobox').focus());
    await userEvent.keyboard('t');
    expect(spy.mock.calls).toEqual([[true]]);

    act(() => setOpen(false));
    expect(spy.mock.calls).toEqual([[true], [false]]);

    vi.advanceTimersByTime(750);
    expect(spy.mock.calls).toEqual([[true], [false]]);

    act(() => setOpen(true));
    expect(spy.mock.calls).toEqual([[true], [false]]);
  });

  it('skips hidden items when matching with elementsRef', async () => {
    const spy = vi.fn();
    render(() => <ComboboxWithElementsRef onMatch={spy} hiddenIndices={[0]} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('does not let hidden double-letter items block rapid cycling with elementsRef', async () => {
    const spy = vi.fn();
    render(() => (
      <ComboboxWithElementsRef
        onMatch={spy}
        list={['aaron', 'apple', 'avocado']}
        hiddenIndices={[0]}
      />
    ));

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenLastCalledWith(1);

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenLastCalledWith(2);
  });

  it('skips visibility:hidden items when matching with elementsRef', async () => {
    const spy = vi.fn();
    render(() => <ComboboxWithElementsRef onMatch={spy} />);

    const apple = screen.getByRole('option', { name: 'apple' });

    apple.style.visibility = 'hidden';

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('is a no-op when disabled', async () => {
    const spy = vi.fn();

    function App() {
      const { store, refs } = createTestFloating({ open: () => true });
      const typeahead = createTypeahead(store, {
        listRef: { current: ['one', 'two', 'three'] },
        activeIndex: null,
        onMatch: spy,
        enabled: false,
      });
      return (
        <input
          {...getInteractionProps([typeahead], 'reference', {
            role: 'combobox',
            ref: refs.setReference,
          })}
        />
      );
    }

    render(() => <App />);

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('t');
    expect(spy).not.toHaveBeenCalled();
  });
});
