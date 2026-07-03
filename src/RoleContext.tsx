import { createContext, useContext } from 'react';

const RoleExitContext = createContext<() => void>(() => {});

export const RoleExitProvider = RoleExitContext.Provider;

export function useExitRole() {
  return useContext(RoleExitContext);
}
