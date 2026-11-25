import { createContext, useContext, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';

interface GroupCollectionContext {
  items: Accessor<readonly any[]>;
}

const GroupCollectionContext = createContext<GroupCollectionContext | null>(null);

export function useGroupCollectionContext() {
  return useContext(GroupCollectionContext);
}

export function GroupCollectionProvider(props: GroupCollectionProvider.Props) {
  const contextValue: GroupCollectionContext = { items: () => props.items };

  return <GroupCollectionContext value={contextValue}>{props.children}</GroupCollectionContext>;
}

export namespace GroupCollectionProvider {
  export interface Props {
    children: JSX.Element;
    items: readonly any[];
  }
}
