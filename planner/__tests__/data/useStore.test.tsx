import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { createMemoryRepository } from '../../src/data/memoryRepository';
import { StoreProvider } from '../../src/data/StoreProvider';
import { emptyPlannerData, type Repository } from '../../src/data/repository';
import type { PlannerData } from '../../src/domain/types';
import { useStore } from '../../src/data/useStore';

function Probe() {
  const { data } = useStore();
  return <Text testID="names">{data.subjects.map((s) => s.name).join(',')}</Text>;
}

const subj = (id: string, name: string, updatedAt = 1) => ({
  id,
  name,
  updatedAt,
  abbreviation: name,
  attending: true,
});

describe('useStore', () => {
  it('re-renders when a record is upserted', async () => {
    const repo = createMemoryRepository();
    await render(
      <StoreProvider repository={repo}>
        <Probe />
      </StoreProvider>,
    );
    expect(screen.getByTestId('names').props.children).toBe('');
    await act(async () => {
      await repo.upsert('subjects', subj('a', 'Algebra'));
    });
    expect(screen.getByTestId('names').props.children).toBe('Algebra');
  });

  it('is ready once the repository has delivered', async () => {
    const repo = createMemoryRepository();
    let ready: boolean | undefined;
    function P() {
      ready = useStore().ready;
      return null;
    }
    await render(
      <StoreProvider repository={repo}>
        <P />
      </StoreProvider>,
    );
    expect(ready).toBe(true);
  });

  it('is not ready until the first delivery', async () => {
    let deliver: (d: PlannerData) => void = () => {};
    const repo: Repository = {
      ...createMemoryRepository(),
      subscribe(cb) {
        deliver = cb;
        return () => {};
      },
    };
    let ready: boolean | undefined;
    function P() {
      ready = useStore().ready;
      return null;
    }
    await render(
      <StoreProvider repository={repo}>
        <P />
      </StoreProvider>,
    );
    expect(ready).toBe(false);
    await act(async () => {
      deliver(emptyPlannerData());
    });
    expect(ready).toBe(true);
  });

  it('exposes the repo', async () => {
    const repo = createMemoryRepository();
    let seen: unknown;
    function P() {
      seen = useStore().repo;
      return null;
    }
    await render(
      <StoreProvider repository={repo}>
        <P />
      </StoreProvider>,
    );
    expect(seen).toBe(repo);
  });

  it('throws outside a provider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(render(<Probe />)).rejects.toThrow('useStore must be used inside StoreProvider');
    } finally {
      spy.mockRestore();
    }
  });
});
