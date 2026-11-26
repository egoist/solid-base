import { omit } from 'solid-js';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
import type { ToolbarRootState } from '../root/ToolbarRoot';
import { ToolbarGroupContext, type ToolbarGroupContextValue } from './ToolbarGroupContext';

/**
 * Groups several toolbar items or toggles.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Toolbar](https://base.egoist.dev/components/toolbar)
 */
export function ToolbarGroup(componentProps: ToolbarGroup.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'disabled');

  const toolbarContext = useToolbarRootContext();

  const disabled = () => toolbarContext.disabled || (componentProps.disabled ?? false);

  const contextValue: ToolbarGroupContextValue = {
    get disabled() {
      return disabled();
    },
  };

  const state: ToolbarGroupState = {
    get disabled() {
      return disabled();
    },
    get orientation() {
      return toolbarContext.orientation;
    },
  };

  return (
    <ToolbarGroupContext value={contextValue}>
      {renderElement('div', componentProps, {
        state,
        props: [{ role: 'group' }, elementProps],
      })}
    </ToolbarGroupContext>
  );
}

export interface ToolbarGroupState extends ToolbarRootState {}

export interface ToolbarGroupProps extends BaseUIComponentProps<'div', ToolbarGroupState> {
  /**
   * When `true` all toolbar items in the group are disabled.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ToolbarGroup {
  export type State = ToolbarGroupState;
  export type Props = ToolbarGroupProps;
}
