import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { resolveStyle } from '../../utils/resolveStyle';
import { renderElement } from '../../internals/renderElement';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { useCollapsibleRootContext } from '../root/CollapsibleRootContext';
import type { CollapsibleRootState } from '../root/CollapsibleRoot';
import { collapsibleStateAttributesMapping } from '../root/stateAttributesMapping';
import { createCollapsiblePanel, createKeepMountedWarning } from './createCollapsiblePanel';
import { registerCollapsiblePartId } from './registerCollapsiblePartId';
import * as CollapsiblePanelCssVars from './CollapsiblePanelCssVars';

/**
 * A panel with the collapsible contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Collapsible](https://base.egoist.dev/components/collapsible)
 */
export function CollapsiblePanel(componentProps: CollapsiblePanel.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'hiddenUntilFound',
    'keepMounted',
    'id',
  );

  createKeepMountedWarning(
    () => Boolean(componentProps.hiddenUntilFound) && componentProps.keepMounted === false,
    'The `keepMounted={false}` prop on `Collapsible.Panel` is ignored when `hiddenUntilFound` is enabled, since the panel must remain mounted while closed.',
  );

  const context = useCollapsibleRootContext();

  const registeredId = () => componentProps.id || undefined;
  const id = () => registeredId() ?? context.defaultPanelId();

  registerCollapsiblePartId(registeredId, context.setPanelIdState);

  const panel = createCollapsiblePanel({
    hiddenUntilFound: () => componentProps.hiddenUntilFound ?? false,
    id,
    keepMounted: () => componentProps.keepMounted ?? false,
    mounted: context.mounted,
    onOpenChange: context.onOpenChange,
    open: context.open,
    setMounted: context.setMounted,
    setOpen: context.setOpen,
    transitionStatus: context.transitionStatus,
  });

  const state: CollapsiblePanelState = {
    get open() {
      return context.state.open;
    },
    get disabled() {
      return context.state.disabled;
    },
    get transitionStatus() {
      return panel.transitionStatus();
    },
  };

  return renderElement(
    'div',
    {
      get class() {
        return componentProps.class;
      },
      get render() {
        return componentProps.render;
      },
    },
    {
      state,
      ref: panel.ref,
      enabled: panel.shouldRender,
      props: [
        panel.props,
        {
          get style() {
            const height = panel.height();
            const width = panel.width();
            return {
              [CollapsiblePanelCssVars.collapsiblePanelHeight]:
                height === undefined ? 'auto' : `${height}px`,
              [CollapsiblePanelCssVars.collapsiblePanelWidth]:
                width === undefined ? 'auto' : `${width}px`,
            };
          },
        },
        elementProps,
        {
          get style() {
            return resolveStyle(componentProps.style, state);
          },
        },
        // The public `style` prop is resolved here (instead of by `renderElement`) so the
        // temporary `animation-name: none` still wins over the user's inline styles.
        {
          get style() {
            return panel.shouldPreventOpenAnimation() ? { 'animation-name': 'none' } : undefined;
          },
        },
      ],
      stateAttributesMapping: collapsibleStateAttributesMapping,
    },
  );
}

export interface CollapsiblePanelState extends CollapsibleRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CollapsiblePanelProps extends BaseUIComponentProps<'div', CollapsiblePanelState> {
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   *
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is hidden.
   * This prop is ignored when `hiddenUntilFound` is used.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace CollapsiblePanel {
  export type State = CollapsiblePanelState;
  export type Props = CollapsiblePanelProps;
}
