import React, { useEffect, useMemo, useState } from 'react';
import type { PlannerData } from '../domain/types';
import { Repository, emptyPlannerData } from './repository';
import { StoreContext } from './useStore';

interface State {
  repo: Repository;
  data: PlannerData;
  ready: boolean;
  error: Error | null;
}

export function StoreProvider({
  repository,
  children,
}: {
  repository: Repository;
  children: React.ReactNode;
}) {
  // State is keyed to the repository it came from, so a switch of repository can never
  // pair the new repo with the previous account's data.
  const [state, setState] = useState<State>(() => ({
    repo: repository,
    data: emptyPlannerData(),
    ready: false,
    error: null,
  }));

  useEffect(() => {
    setState({ repo: repository, data: emptyPlannerData(), ready: false, error: null });
    return repository.subscribe(
      (data) => setState((s) => (s.repo === repository ? { ...s, data, ready: true } : s)),
      (error) => setState((s) => (s.repo === repository ? { ...s, error } : s)),
    );
  }, [repository]);

  const value = useMemo(() => {
    if (state.repo !== repository) {
      return { data: emptyPlannerData(), repo: repository, ready: false, error: null };
    }
    return { data: state.data, repo: repository, ready: state.ready, error: state.error };
  }, [state, repository]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
