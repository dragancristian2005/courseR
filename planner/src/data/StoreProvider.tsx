import React, { useEffect, useMemo, useState } from 'react';
import type { PlannerData } from '../domain/types';
import { Repository, emptyPlannerData } from './repository';
import { StoreContext } from './useStore';

export function StoreProvider({
  repository,
  children,
}: {
  repository: Repository;
  children: React.ReactNode;
}) {
  const [data, setData] = useState<PlannerData>(emptyPlannerData);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    return repository.subscribe((next) => {
      setData(next);
      setReady(true);
    });
  }, [repository]);

  const value = useMemo(() => ({ data, repo: repository, ready }), [data, repository, ready]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
