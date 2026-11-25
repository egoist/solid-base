import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { resolveStyle } from '../../utils/resolveStyle';
import { renderElement } from '../../internals/renderElement';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import {
  createCollapsiblePanel,
  createKeepMountedWarning,
} from '../../collapsible/panel/createCollapsiblePanel';
import { registerCollapsiblePartId } from '../../collapsible/panel/registerCollapsiblePartId';
import { useAccordionRootContext } from '../root/AccordionRootContext';
import type { AccordionRoot } from '../root/AccordionRoot';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';
import * as AccordionPanelCssVars from './AccordionPanelCssVars';

/**
 * A collapsible panel with the accordion item contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/react/components/accordion)
 */
export function AccordionPanel(componentProps: AccordionPanel.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'hiddenUntilFound',
    'keepMounted',
    'id',
  );

  const rootContext = useAccordionRootContext();
  const collapsible = useCollapsibleRootContext();

  const hiddenUntilFound = () => componentProps.hiddenUntilFound ?? rootContext.hiddenUntilFound();
  const keepMounted = () => componentProps.keepMounted ?? rootContext.keepMounted();
  const registeredId = () => componentProps.id || undefined;
  const id = () => {
    const idProp = componentProps.id;
    return typeof idProp === 'string' ? idProp : collapsible.defaultPanelId();
  };

  createKeepMountedWarning(
    () => componentProps.keepMounted === false && hiddenUntilFound(),
    'The `keepMounted={false}` prop on an `Accordion.Panel` is ignored when `hiddenUntilFound` is enabled on the panel or root, since the panel must remain mounted while closed.',
  );

  registerCollapsiblePartId(registeredId, collapsible.setPanelIdState);

  const panel = createCollapsiblePanel({
    hiddenUntilFound,
    id,
    keepMounted,
    mounted: collapsible.mounted,
    onOpenChange: collapsible.onOpenChange,
    open: collapsible.open,
    setMounted: collapsible.setMounted,
    setOpen: collapsible.setOpen,
    transitionStatus: collapsible.transitionStatus,
  });

  const itemContext = useAccordionItemContext();
  const itemState = itemContext.state;

  const state: AccordionPanelState = {
    get value() {
      return itemState.value;
    },
    get orientation() {
      return itemState.orientation;
    },
    get hidden() {
      return itemState.hidden;
    },
    get index() {
      return itemState.index;
    },
    get open() {
      return itemState.open;
    },
    get disabled() {
      return itemState.disabled;
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
          get 'aria-labelledby'() {
            return itemContext.triggerId();
          },
          role: 'region',
          get style() {
            const height = panel.height();
            const width = panel.width();
            return {
              [AccordionPanelCssVars.accordionPanelHeight]:
                height === undefined ? 'auto' : `${height}px`,
              [AccordionPanelCssVars.accordionPanelWidth]:
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
      stateAttributesMapping: accordionStateAttributesMapping,
    },
  );
}

export interface AccordionPanelState extends AccordionItemState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface AccordionPanelProps
  extends
    BaseUIComponentProps<'div', AccordionPanelState>,
    Pick<AccordionRoot.Props, 'hiddenUntilFound' | 'keepMounted'> {}

export namespace AccordionPanel {
  export type State = AccordionPanelState;
  export type Props = AccordionPanelProps;
}
