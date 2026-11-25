import { createSignal, omit } from 'solid-js';
import { useRender } from '@egoist/solid-base/use-render';
import { mergeProps } from '@egoist/solid-base/merge-props';
import styles from './render-callback.module.css';

type CounterState = {
  odd: boolean;
};

interface CounterProps extends useRender.ComponentProps<'button', CounterState> {}

function Counter(props: CounterProps) {
  const [count, setCount] = createSignal(0);

  // A live state object: its getters keep the `render` callback and the
  // `data-odd` attribute up to date.
  const state: CounterState = {
    get odd() {
      return count() % 2 === 1;
    },
  };

  const defaultProps: useRender.ElementProps<'button'> = {
    class: styles.Button,
    type: 'button',
    children: (
      <>
        Counter: <span class={styles.Count}>{count()}</span>
      </>
    ),
    onClick() {
      setCount((previous) => previous + 1);
    },
    get 'aria-label'() {
      return `Count is ${count()}, click to increase.`;
    },
  };

  return useRender({
    defaultTagName: 'button',
    get render() {
      return props.render;
    },
    state,
    props: mergeProps(defaultProps, omit(props, 'render')),
  });
}

export default function ExampleCounter() {
  return (
    <Counter
      render={(props, state) => (
        <button {...props}>
          {props.children}
          <span class={styles.Suffix}>{state.odd ? '👎' : '👍'}</span>
        </button>
      )}
    />
  );
}
