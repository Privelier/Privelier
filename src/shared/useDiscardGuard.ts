/**
 * Unsaved-changes guard for editor screens, presented through the shared
 * ConfirmSheet instead of a native alert.
 *
 * `beforeRemove` is intercepted while `shouldBlock()` returns true (read at
 * event time, so refs such as a just-saved flag are honored); the blocked
 * navigation action is held until the user chooses. Discard replays that
 * exact action (back button, gesture, or hardware back), so the screen leaves
 * the same way it would have without the guard. Keep editing just drops it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavigationAction } from '@react-navigation/native';

type GuardedNavigation = {
  addListener: (
    type: 'beforeRemove',
    callback: (event: { preventDefault: () => void; data: { action: NavigationAction } }) => void
  ) => () => void;
  dispatch: (action: NavigationAction) => void;
};

export interface DiscardGuard {
  /** True while the discard sheet should be shown. */
  open: boolean;
  keepEditing: () => void;
  discard: () => void;
}

export function useDiscardGuard(navigation: GuardedNavigation, shouldBlock: () => boolean): DiscardGuard {
  const [blockedAction, setBlockedAction] = useState<NavigationAction | null>(null);
  // Set synchronously before replaying the held action: the replay fires
  // beforeRemove again while the editor is still dirty.
  const discardingRef = useRef(false);
  const shouldBlockRef = useRef(shouldBlock);
  useEffect(() => {
    shouldBlockRef.current = shouldBlock;
  }, [shouldBlock]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (discardingRef.current || !shouldBlockRef.current()) return;
      event.preventDefault();
      setBlockedAction(event.data.action);
    });
    return unsubscribe;
  }, [navigation]);

  const keepEditing = useCallback(() => setBlockedAction(null), []);

  const discard = useCallback(() => {
    const action = blockedAction;
    setBlockedAction(null);
    if (!action) return;
    discardingRef.current = true;
    navigation.dispatch(action);
  }, [blockedAction, navigation]);

  return { open: blockedAction !== null, keepEditing, discard };
}
