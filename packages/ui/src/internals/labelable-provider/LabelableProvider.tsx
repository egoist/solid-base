import { createMemo, createSignal, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { mergeProps } from '../../merge-props/mergeProps';
import { createBaseUiId } from '../baseUiId';
import type { HTMLProps } from '../types';
import {
  LabelableContext,
  useLabelableContext,
  type LabelableContextValue,
} from './LabelableContext';

/**
 * Creates a labelable scope: the label, the control and the descriptions rendered inside
 * share their ids through it.
 */
export function LabelableProvider(props: LabelableProvider.Props) {
  const defaultId = createBaseUiId();

  // `null` deliberately suppresses the label's `for`.
  const [controlId, setControlId] = createSignal<string | null | undefined>(defaultId());
  const [labelId, setLabelId] = createSignal<string | undefined>(undefined);
  const [staticMessageIds, setMessageIds] = createSignal<string[]>([]);
  const [messageIdSources, setMessageIdSources] = createSignal<Array<Accessor<string | undefined>>>(
    [],
  );
  const messageIds = createMemo(
    () => {
      const ids = staticMessageIds().slice();
      for (const source of messageIdSources()) {
        const id = source();
        if (id && !ids.includes(id)) {
          ids.push(id);
        }
      }
      return ids;
    },
    { name: 'LabelableProvider.messageIds', equals: areIdsEqual },
  );

  function registerMessageId(id: Accessor<string | undefined>) {
    setMessageIdSources((sources) => [...sources, id]);
    return () => {
      setMessageIdSources((sources) => sources.filter((source) => source !== id));
    };
  }

  const registrations = new Map<symbol, string | null>();

  const parent = useLabelableContext();

  function registerControlId(source: symbol, nextId: string | null | undefined) {
    if (nextId === undefined) {
      registrations.delete(source);
    } else {
      registrations.set(source, nextId);
    }

    setControlId((prev) => {
      if (registrations.size === 0) {
        // Keep the last selected control when every registration is gone.
        return prev;
      }

      let nextControlId: string | null | undefined;

      for (const id of registrations.values()) {
        // Keep the current selection while it is still registered, so rapid unmount/remount
        // cycles don't churn it.
        if (id === prev) {
          return prev;
        }

        if (nextControlId === undefined) {
          nextControlId = id;
        }
      }

      return nextControlId;
    });
  }

  function resetControlId() {
    if (registrations.size === 0) {
      setControlId(defaultId());
    }
  }

  function getDescriptionProps(externalProps: HTMLProps): HTMLProps {
    return mergeProps(externalProps, {
      get 'aria-describedby'() {
        const external = externalProps['aria-describedby'] as string | undefined;
        const ids = external ? external.split(' ') : [];
        ids.push(...parent.messageIds(), ...messageIds());
        return Array.from(new Set(ids)).join(' ') || undefined;
      },
    });
  }

  const context: LabelableContextValue = {
    controlId,
    registerControlId,
    resetControlId,
    labelId,
    setLabelId: (next) => setLabelId(next as any),
    messageIds,
    setMessageIds: (next) => setMessageIds(next as any),
    registerMessageId,
    getDescriptionProps,
  };

  return <LabelableContext value={context}>{props.children}</LabelableContext>;
}

function areIdsEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export interface LabelableProviderState {}

export interface LabelableProviderProps {
  children?: JSX.Element;
}

export namespace LabelableProvider {
  export type State = LabelableProviderState;
  export type Props = LabelableProviderProps;
}
