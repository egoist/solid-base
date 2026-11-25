import { createSignal, flush } from 'solid-js';
import { mergeProps, mergePropsN } from '.';
import type { BaseUIEvent } from '../types';

type AnyProps = Record<string, any>;

describe('mergeProps', () => {
  it('merges event handlers', () => {
    const theirProps = {
      onClick: vi.fn(),
      onKeyDown: vi.fn(),
    };
    const ourProps = {
      onClick: vi.fn(),
      onPaste: vi.fn(),
    };
    const mergedProps = mergeProps<AnyProps>(ourProps, theirProps);

    mergedProps.onClick?.(new MouseEvent('click'));
    mergedProps.onKeyDown?.(new KeyboardEvent('keydown'));
    mergedProps.onPaste?.(new Event('paste'));

    expect(theirProps.onClick.mock.invocationCallOrder[0]).toBeLessThan(
      ourProps.onClick.mock.invocationCallOrder[0],
    );
    expect(theirProps.onClick.mock.calls.length).toBe(1);
    expect(ourProps.onClick.mock.calls.length).toBe(1);
    expect(theirProps.onKeyDown.mock.calls.length).toBe(1);
    expect(ourProps.onPaste.mock.calls.length).toBe(1);
  });

  it('merges multiple event handlers', () => {
    const log: string[] = [];

    const mergedProps = mergeProps<AnyProps>(
      {
        onClick() {
          log.push('3');
        },
      },
      {
        onClick() {
          log.push('2');
        },
      },
      {
        onClick() {
          log.push('1');
        },
      },
    );

    mergedProps.onClick?.(new MouseEvent('click'));
    expect(log).toEqual(['1', '2', '3']);
  });

  it('merges undefined event handlers', () => {
    const log: string[] = [];

    const mergedProps = mergeProps<AnyProps>(
      {
        onClick() {
          log.push('3');
        },
      },
      {
        onClick: undefined,
      },
      {
        onClick() {
          log.push('1');
        },
      },
    );

    mergedProps.onClick?.(new MouseEvent('click'));
    expect(log).toEqual(['1', '3']);
  });

  it('returns undefined for a handler no source defines', () => {
    const mergedProps = mergeProps<AnyProps>({ onClick: undefined }, { id: 'x' });
    expect(mergedProps.onClick).toBe(undefined);
  });

  it('keeps a stable handler identity and reads handlers at call time', () => {
    const log: string[] = [];
    const source: AnyProps = {
      onClick() {
        log.push('a');
      },
    };
    const mergedProps = mergeProps<AnyProps>(source);
    const handler = mergedProps.onClick;
    expect(mergedProps.onClick).toBe(handler);

    source.onClick = () => log.push('b');
    handler(new MouseEvent('click'));
    expect(log).toEqual(['b']);
  });

  it('supports Solid bound handlers', () => {
    const handler = vi.fn();
    const mergedProps = mergeProps<AnyProps>({ onClick: [handler, 'data'] });
    const event = new MouseEvent('click');
    mergedProps.onClick(event);
    expect(handler).toHaveBeenCalledWith('data', event);
  });

  it('makes a lone event handler preventable', () => {
    let prevented = false;

    const mergedProps = mergeProps<AnyProps>(
      {},
      {
        onMouseDown(event: BaseUIEvent<MouseEvent>) {
          event.preventBaseUIHandler();
          prevented = event.baseUIHandlerPrevented === true;
        },
      },
    );

    mergedProps.onMouseDown?.(new MouseEvent('mousedown'));

    expect(prevented).toBe(true);
  });

  it('makes a first-position event handler preventable', () => {
    let prevented = false;

    const mergedProps = mergeProps<AnyProps>(
      {
        onMouseDown(event: BaseUIEvent<MouseEvent>) {
          event.preventBaseUIHandler();
          prevented = event.baseUIHandlerPrevented === true;
        },
      },
      {
        id: 'test-button',
      },
    );

    mergedProps.onMouseDown?.(new MouseEvent('mousedown'));

    expect(prevented).toBe(true);
  });

  it('makes a first-position event handler preventable in mergePropsN', () => {
    let prevented = false;

    const mergedProps = mergePropsN<AnyProps>([
      {
        onMouseDown(event: BaseUIEvent<MouseEvent>) {
          event.preventBaseUIHandler();
          prevented = event.baseUIHandlerPrevented === true;
        },
      },
      {
        id: 'test-button',
      },
    ]);

    mergedProps.onMouseDown?.(new MouseEvent('mousedown'));

    expect(prevented).toBe(true);
  });

  it('makes a lone obscure event handler preventable', () => {
    let prevented = false;

    const mergedProps = mergeProps<AnyProps>(
      {},
      {
        onContextMenu(event: BaseUIEvent<MouseEvent>) {
          event.preventBaseUIHandler();
          prevented = event.baseUIHandlerPrevented === true;
        },
      },
    );

    mergedProps.onContextMenu?.(new MouseEvent('contextmenu'));

    expect(prevented).toBe(true);
  });

  it('merges styles', () => {
    const theirProps = {
      style: { color: 'red' },
    };
    const ourProps = {
      style: { color: 'blue', 'background-color': 'blue' },
    };
    const mergedProps = mergeProps<AnyProps>(ourProps, theirProps);

    expect(mergedProps.style).toEqual({
      color: 'red',
      'background-color': 'blue',
    });
  });

  it('merges string styles with style objects', () => {
    const mergedProps = mergeProps<AnyProps>(
      { style: 'color: blue; background-color: blue' },
      { style: { color: 'red' } },
    );

    expect(mergedProps.style).toEqual({
      color: 'red',
      'background-color': 'blue',
    });
  });

  it('merges styles with undefined', () => {
    const theirProps = {
      style: { color: 'red' },
    };
    const ourProps = {};

    const mergedProps = mergeProps<AnyProps>(ourProps, theirProps);

    expect(mergedProps.style).toEqual({
      color: 'red',
    });
  });

  it('does not merge styles if both are undefined', () => {
    const mergedProps = mergeProps<AnyProps>({}, {});

    expect(mergedProps.style).toBe(undefined);
  });

  // Solid accepts class arrays, so classes are joined into an array (rightmost first) instead of
  // a space-separated string.
  it('merges classes with rightmost first', () => {
    const theirProps = {
      class: 'external-class',
    };
    const ourProps = {
      class: 'internal-class',
    };
    const mergedProps = mergeProps<AnyProps>(ourProps, theirProps);

    expect(mergedProps.class).toEqual(['external-class', 'internal-class']);
  });

  it('merges multiple classes', () => {
    const mergedProps = mergeProps<AnyProps>(
      {
        class: 'class-1',
      },
      {
        class: 'class-2',
      },
      {
        class: { 'class-3': true },
      },
    );

    expect(mergedProps.class).toEqual([{ 'class-3': true }, 'class-2', 'class-1']);
  });

  it('merges classes with undefined', () => {
    const theirProps = {
      class: 'external-class',
    };
    const ourProps = {};

    const mergedProps = mergeProps<AnyProps>(ourProps, theirProps);

    expect(mergedProps.class).toBe('external-class');
  });

  it('does not merge classes if both are undefined', () => {
    const mergedProps = mergeProps<AnyProps>({}, {});

    expect(mergedProps.class).toBe(undefined);
  });

  it('merges refs', () => {
    const calls: string[] = [];
    const mergedProps = mergeProps<AnyProps>(
      { ref: () => calls.push('ours') },
      { ref: [() => calls.push('theirs-1'), () => calls.push('theirs-2')] },
      { ref: undefined },
    );

    const element = document.createElement('div');
    mergedProps.ref(element);

    expect(calls).toEqual(['ours', 'theirs-1', 'theirs-2']);
  });

  it('serializes boolean aria attributes', () => {
    const mergedProps = mergeProps<AnyProps>(
      { 'aria-hidden': true, 'aria-expanded': false },
      { 'data-flag': true },
    );

    expect(mergedProps['aria-hidden']).toBe('true');
    expect(mergedProps['aria-expanded']).toBe('false');
    expect(mergedProps['data-flag']).toBe(true);
  });

  it('does not prevent internal handler if event.preventBaseUIHandler() is not called', () => {
    let ran = false;

    const mergedProps = mergeProps<AnyProps>(
      {
        onClick() {},
      },
      {
        onClick() {
          ran = true;
        },
      },
    );

    mergedProps.onClick?.(new MouseEvent('click'));

    expect(ran).toBe(true);
  });

  it('prevents internal handler if event.preventBaseUIHandler() is called', () => {
    let ran = false;

    const mergedProps = mergeProps<AnyProps>(
      {
        onClick: function onClick3() {
          ran = true;
        },
      },
      {
        onClick: function onClick2() {
          ran = true;
        },
      },
      {
        onClick: function onClick1(event: BaseUIEvent<MouseEvent>) {
          event.preventBaseUIHandler();
        },
      },
    );

    mergedProps.onClick?.(new MouseEvent('click'));

    expect(ran).toBe(false);
  });

  it('prevents handlers merged after event.preventBaseUIHandler() is called', () => {
    const log: string[] = [];

    const mergedProps = mergeProps<AnyProps>(
      {
        onClick() {
          log.push('2');
        },
      },
      {
        onClick(event: BaseUIEvent<MouseEvent>) {
          event.preventBaseUIHandler();
          log.push('1');
        },
      },
      {
        onClick() {
          log.push('0');
        },
      },
    );

    mergedProps.onClick?.(new MouseEvent('click'));

    expect(log).toEqual(['0', '1']);
  });

  it.each([
    { name: 'a boolean', eventArgument: true },
    { name: 'a number', eventArgument: 13 },
    { name: 'a string', eventArgument: 'newValue' },
    { name: 'an object', eventArgument: { key: 'value' } },
    { name: 'an array', eventArgument: ['value'] },
    { name: 'a function', eventArgument: () => 'value' },
    { name: 'null', eventArgument: null },
  ])('handles non-standard event handlers called with $name', ({ eventArgument }) => {
    const log: string[] = [];

    const mergedProps = mergeProps<AnyProps>(
      {
        onValueChange() {
          log.push('1');
        },
      },
      {
        onValueChange() {
          log.push('0');
        },
      },
    );

    mergedProps.onValueChange(eventArgument);

    expect(log).toEqual(['0', '1']);
    if (eventArgument != null && typeof eventArgument === 'object') {
      // Plain objects are not treated as events.
      expect('preventBaseUIHandler' in eventArgument).toBe(false);
    }
  });

  it('forwards all arguments for a lone non-standard event handler', () => {
    const handler = vi.fn();

    const mergedProps = mergeProps<AnyProps>(
      {},
      {
        onOpenChange: handler,
      },
    );

    const eventDetails = { reason: 'test' };
    mergedProps.onOpenChange?.(true, eventDetails);

    expect(handler).toHaveBeenCalledWith(true, eventDetails);
  });

  it('forwards all arguments for merged non-standard event handlers', () => {
    const log: Array<[string, boolean, { reason: string }]> = [];
    const eventDetails = { reason: 'test' };

    const mergedProps = mergeProps<AnyProps>(
      {
        onOpenChange(open: boolean, details: { reason: string }) {
          log.push(['ours', open, details]);
        },
      },
      {
        onOpenChange(open: boolean, details: { reason: string }) {
          log.push(['theirs', open, details]);
        },
      },
    );

    mergedProps.onOpenChange?.(true, eventDetails);

    expect(log).toEqual([
      ['theirs', true, eventDetails],
      ['ours', true, eventDetails],
    ]);
  });

  it('forwards additional arguments for event handlers', () => {
    const log: Array<[string, string]> = [];

    const mergedProps = mergeProps<AnyProps>(
      {
        onMouseDown(_event: BaseUIEvent<MouseEvent>, details: { reason: string }) {
          log.push(['ours', details.reason]);
        },
      },
      {
        onMouseDown(_event: BaseUIEvent<MouseEvent>, details: { reason: string }) {
          log.push(['theirs', details.reason]);
        },
      },
    );

    mergedProps.onMouseDown?.(new MouseEvent('mousedown'), {
      reason: 'pointer',
    });

    expect(log).toEqual([
      ['theirs', 'pointer'],
      ['ours', 'pointer'],
    ]);
  });

  it('returns the value of the rightmost handler', () => {
    const mergedProps = mergeProps<AnyProps>(
      { onValidate: () => 'ours' },
      { onValidate: () => 'theirs' },
    );

    expect(mergedProps.onValidate('value')).toBe('theirs');
  });

  it('merges props so that the rightmost source wins', () => {
    const mergedProps = mergeProps<AnyProps>(
      {
        title: 'internal title 2',
      },
      {
        title: 'internal title 1',
      },
      {},
    );

    expect(mergedProps.title).toBe('internal title 1');
  });

  it('lets an explicit undefined override earlier values', () => {
    const mergedProps = mergeProps<AnyProps>({ title: 'title' }, { title: undefined });

    expect(mergedProps.title).toBe(undefined);
    expect('title' in mergedProps).toBe(true);
  });

  it('sets baseUIHandlerPrevented to true after calling preventBaseUIHandler()', () => {
    let observedFlag: boolean | undefined;

    const mergedProps = mergeProps<AnyProps>(
      {
        onClick() {},
      },
      {
        onClick(event: BaseUIEvent<MouseEvent>) {
          event.preventBaseUIHandler();
          observedFlag = event.baseUIHandlerPrevented;
        },
      },
    );

    mergedProps.onClick?.(new MouseEvent('click'));

    expect(observedFlag).toBe(true);
  });

  describe('live view', () => {
    it('forwards reads to the sources at access time', () => {
      const source: AnyProps = { title: 'a' };
      const mergedProps = mergeProps<AnyProps>({ id: 'x' }, source);

      expect(mergedProps.title).toBe('a');
      source.title = 'b';
      source.role = 'button';
      expect(mergedProps.title).toBe('b');
      expect(Object.keys(mergedProps)).toEqual(['id', 'title', 'role']);
    });

    it('reads getters lazily', () => {
      const [title, setTitle] = createSignal('a');
      const mergedProps = mergeProps<AnyProps>({
        get title() {
          return title();
        },
      });

      expect(mergedProps.title).toBe('a');
      setTitle('b');
      flush();
      expect(mergedProps.title).toBe('b');
    });
  });

  describe('props getters', () => {
    it('calls the props getter with the props defined before it', () => {
      let observedProps;
      const propsGetter = vi.fn((props) => {
        observedProps = { ...props };
        return props;
      });

      mergeProps(
        {
          id: '2',
          class: 'test-class',
        },
        propsGetter,
        {
          id: '1',
          role: 'button',
        },
      );

      expect(propsGetter.mock.calls.length === 1).toBe(true);
      expect(observedProps).toEqual({ id: '2', class: 'test-class' });
    });

    it('calls the props getter with the merged props defined before it', () => {
      let observedProps;
      const propsGetter = vi.fn((props) => {
        observedProps = { ...props };
        return props;
      });

      mergeProps(
        {
          role: 'button',
          class: 'test-class',
        },
        {
          role: 'tab',
        },
        propsGetter,
        {
          id: 'one',
        },
      );

      expect(propsGetter.mock.calls.length === 1).toBe(true);
      expect(observedProps).toEqual({
        role: 'tab',
        class: 'test-class',
      });
    });

    it('calls the props getter with an empty object if no props are defined before it', () => {
      let observedProps;
      const propsGetter = vi.fn((props) => {
        observedProps = { ...props };
        return props;
      });

      mergeProps(propsGetter, { id: '1' });

      expect(propsGetter.mock.calls.length === 1).toBe(true);
      expect(observedProps).toEqual({});
    });

    it('does not mutate a reused object returned by the first props getter', () => {
      const shared = { class: 'base' };

      const result = mergeProps(() => shared, {
        class: 'next',
      });

      expect({ ...result }).toEqual({
        class: ['next', 'base'],
      });
      expect(shared).toEqual({
        class: 'base',
      });
    });

    it('accepts the result of the props getter', () => {
      const propsGetter = () => ({ class: 'test-class' });
      const result = mergeProps(
        {
          id: 'two',
          role: 'tab',
        },
        {
          id: 'one',
        },
        propsGetter,
      );

      expect({ ...result }).toEqual({
        class: 'test-class',
      });
    });

    it('does not automatically prevent handlers that are manually called by getter handlers', () => {
      const log: string[] = [];

      const mergedProps = mergeProps<AnyProps>(
        {
          onClick() {
            log.push('first-handler');
          },
        },
        (props: AnyProps) => ({
          onClick(event: BaseUIEvent<MouseEvent>) {
            // Call preventBaseUIHandler to signal prevention
            event.preventBaseUIHandler();
            log.push('getter-handler');
            // Manually calling the previous handler - this bypasses automatic prevention!
            props.onClick?.(new MouseEvent('click'));
          },
        }),
        {
          onClick() {
            // This handler does NOT call preventBaseUIHandler, so getter-handler runs
            log.push('last-handler');
          },
        },
      );

      mergedProps.onClick?.(new MouseEvent('click'));

      // last-handler runs first, then getter-handler (not prevented), then getter-handler
      // manually calls first-handler which runs despite preventBaseUIHandler being called
      expect(log).toEqual(['last-handler', 'getter-handler', 'first-handler']);
    });

    it('allows props getter handlers to check baseUIHandlerPrevented manually', () => {
      const log: string[] = [];

      const mergedProps = mergeProps<AnyProps>(
        {
          onClick() {
            log.push('first-handler');
          },
        },
        (props: AnyProps) => ({
          onClick(event: BaseUIEvent<MouseEvent>) {
            // Call preventBaseUIHandler to signal prevention
            event.preventBaseUIHandler();
            log.push('getter-handler');
            // Check the flag before manually calling previous handlers - this respects prevention
            if (!event.baseUIHandlerPrevented) {
              props.onClick?.(new MouseEvent('click'));
            }
          },
        }),
        {
          onClick() {
            // This handler does NOT call preventBaseUIHandler, so getter-handler runs
            log.push('last-handler');
          },
        },
      );

      mergedProps.onClick?.(new MouseEvent('click'));

      // first-handler does NOT run because getter-handler checks the flag before calling it
      expect(log).toEqual(['last-handler', 'getter-handler']);
    });
  });
});
