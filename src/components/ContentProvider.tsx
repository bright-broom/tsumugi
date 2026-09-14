import { createContext, useContext, type ReactNode } from 'react';
import type { SharedMessages } from '@/content/page-props';

const ContentContext = createContext<SharedMessages | null>(null);

/** The provider runs during static rendering only; the exported site has no JS runtime. */
export function ContentProvider({
  messages,
  children,
}: {
  messages: SharedMessages;
  children: ReactNode;
}) {
  return <ContentContext.Provider value={messages}>{children}</ContentContext.Provider>;
}

export function useMessages<K extends keyof SharedMessages>(namespace: K): SharedMessages[K] {
  const messages = useContext(ContentContext);
  if (!messages) throw new Error('ContentProvider is required');
  return messages[namespace];
}
