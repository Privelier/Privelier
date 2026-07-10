/**
 * Barber-app unread context — a thin wrapper over the shared
 * useUnreadThreads hook (one instance per app, mounted in BarberNavigator).
 * Tabs read it for the Chats badge, ChatsScreen for the bold rows,
 * ConversationScreen for setActiveRoom.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useUnreadThreads, type UnreadState } from '../shared/useUnreadThreads';

const UnreadContext = createContext<UnreadState | null>(null);

export function UnreadProvider({ children }: { children: ReactNode }) {
  const value = useUnreadThreads();
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread(): UnreadState {
  const value = useContext(UnreadContext);
  if (!value) {
    throw new Error('useUnread must be used inside the barber UnreadProvider');
  }
  return value;
}
