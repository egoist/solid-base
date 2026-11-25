import { createMemo, omit } from 'solid-js';
import type {
  BaseUIComponentProps,
  HTMLProps,
  Orientation as BaseOrientation,
} from '../../internals/types';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { createCompositeList } from '../../internals/composite/list/CompositeList';
import { ToolbarRootContext, type ToolbarRootContextValue } from './ToolbarRootContext';

/**
 * A container for grouping a set of controls, such as buttons, toggle groups, or menus.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarRoot(componentProps: ToolbarRoot.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'loopFocus',
    'orientation',
  );

  const disabled = () => componentProps.disabled ?? false;
  const orientation = () => componentProps.orientation ?? 'horizontal';

  // The items register in this list (provided by the composite root).
  const itemList = createCompositeList<Partial<ToolbarRoot.ItemMetadata>>();

  const disabledIndices = createMemo(
    () => {
      const output: number[] = [];
      for (const itemMetadata of itemList.map().values()) {
        // Only items that are disabled and not focusable when disabled
        // are removed from roving focus.
        if (itemMetadata.disabled && !itemMetadata.focusableWhenDisabled) {
          output.push(itemMetadata.index);
        }
      }
      return output;
    },
    { equals: areIndicesEqual },
  );

  const contextValue: ToolbarRootContextValue = {
    get disabled() {
      return disabled();
    },
    get orientation() {
      return orientation();
    },
  };

  const state: ToolbarRootState = {
    get disabled() {
      return disabled();
    },
    get orientation() {
      return orientation();
    },
  };

  const defaultProps: HTMLProps = {
    get 'aria-orientation'() {
      return orientation();
    },
    role: 'toolbar',
  };

  return (
    <ToolbarRootContext value={contextValue}>
      <CompositeRoot
        render={componentProps.render}
        class={componentProps.class}
        style={componentProps.style}
        state={state}
        props={[defaultProps, elementProps]}
        disabledIndices={disabledIndices()}
        loopFocus={componentProps.loopFocus}
        list={itemList}
        orientation={orientation()}
      />
    </ToolbarRootContext>
  );
}

function areIndicesEqual(a: number[], b: number[]) {
  return a.length === b.length && a.every((index, i) => index === b[i]);
}

export interface ToolbarRootItemMetadata {
  disabled: boolean;
  focusableWhenDisabled: boolean;
}

export type ToolbarRootOrientation = BaseOrientation;

export interface ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * The component orientation.
   */
  orientation: ToolbarRoot.Orientation;
}

export interface ToolbarRootProps extends BaseUIComponentProps<'div', ToolbarRootState> {
  disabled?: boolean | undefined;
  /**
   * The orientation of the toolbar.
   * @default 'horizontal'
   */
  orientation?: ToolbarRoot.Orientation | undefined;
  /**
   * If `true`, using keyboard navigation will wrap focus to the other end of the toolbar once the end is reached.
   *
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export namespace ToolbarRoot {
  export type ItemMetadata = ToolbarRootItemMetadata;
  export type Orientation = ToolbarRootOrientation;
  export type State = ToolbarRootState;
  export type Props = ToolbarRootProps;
}
