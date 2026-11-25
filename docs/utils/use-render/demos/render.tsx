import { omit } from 'solid-js';
import { useRender } from '@egoist/solid-base/use-render';
import { mergeProps } from '@egoist/solid-base/merge-props';
import styles from './render.module.css';

interface TextProps extends useRender.ComponentProps<'p'> {}

function Text(props: TextProps) {
  return useRender({
    defaultTagName: 'p',
    get render() {
      return props.render;
    },
    props: mergeProps({ class: styles.Text }, omit(props, 'render')),
  });
}

export default function ExampleText() {
  return (
    <div>
      <Text>Text component rendered as a paragraph tag</Text>
      <Text render="strong">Text component rendered as a strong tag</Text>
    </div>
  );
}
