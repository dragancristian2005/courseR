import { createContext, useContext } from 'react';
import type { PlannerData } from '../domain/types';
import type { Repository } from './repository';

export interface StoreValue {
  data: PlannerData;
  repo: Repository;
  /** False until the repository has delivered data at least once. */
  ready: boolean;
  /** Set when the repository could not load or sync data. */
  error: Error | null;
  /** Set when the server rejected a write; not fatal. Cleared by dismissWriteError. */
  writeError: Error | null;
  dismissWriteError: () => void;
}

export const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}
