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

  useEffect(() => repository.subscribe(setData), [repository]);

  const value = useMemo(() => ({ data, repo: repository }), [data, repository]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
