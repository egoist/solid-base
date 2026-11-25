import type { JSX } from '@solidjs/web';
import {
  DirectionContext,
  type DirectionContextValue,
  type TextDirection,
} from '../internals/direction-context/DirectionContext';

/**
 * Enables RTL behavior for Base UI components.
 *
 * Documentation: [Base UI Direction Provider](https://base-ui.com/react/utils/direction-provider)
 */
export function DirectionProvider(props: DirectionProvider.Props) {
  const value: DirectionContextValue = {
    get direction() {
      return props.direction ?? 'ltr';
    },
  };
  return <DirectionContext value={value}>{props.children}</DirectionContext>;
}

export interface DirectionProviderState {}

export interface DirectionProviderProps {
  children?: JSX.Element;
  /**
   * The reading direction of the text
   * @default 'ltr'
   */
  direction?: TextDirection | undefined;
}

export namespace DirectionProvider {
  export type State = DirectionProviderState;
  export type Props = DirectionProviderProps;
}
