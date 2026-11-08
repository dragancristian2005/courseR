import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SemesterScreen from '../../app/settings/semester';
import { createMemoryRepository } from '../../src/data/memoryRepository';
import { StoreProvider } from '../../src/data/StoreProvider';
import type { PlannerData, Semester } from '../../src/domain/types';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

const existing: Semester = {
  id: 'sem',
  updatedAt: 1,
  name: 'Semester I, 2026–2027',
  firstDay: '2026-09-28',
  lastDay: '2027-01-15',
  breaks: [{ from: '2026-12-21', to: '2027-01-03' }],
  parityOverrides: {},
};

async function setup(initial: Partial<PlannerData> = {}) {
  const repo = createMemoryRepository(initial);
  const save = jest.spyOn(repo, 'saveSemester');
  await render(
    <StoreProvider repository={repo}>
      <SemesterScreen />
    </StoreProvider>,
  );
  return { repo, save };
}
const press = async (name: string) => await fireEvent.press(screen.getByRole('button', { name }));
const type = async (label: string, value: string) =>
  await fireEvent.changeText(screen.getByLabelText(label), value);
const weekButtons = () => screen.getAllByRole('button', { name: /^Week \d+ odd$/ });

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 2, 10, 25));
});
afterEach(() => jest.useRealTimers());

describe('Semester setup', () => {
  it('explains that a break counts whole weeks', async () => {
    await setup();
    expect(
      screen.getByText('A break week counts as a whole week, even if it starts mid-week.'),
    ).toBeTruthy();
  });

  it('lists 14 weeks and one break row for 28 Sep to 15 Jan with a 21 Dec break', async () => {
    await setup();
    await type('First day of classes', '2026-09-28');
    await type('Last day of classes', '2027-01-15');
    await press('Add a break');
    await type('From', '2026-12-21');
    await type('To', '2027-01-03');
    await press('Add break');
    expect(weekButtons()).toHaveLength(14);
    expect(screen.getAllByText('Break')).toHaveLength(1);
    expect(screen.getByText('21 Dec – 3 Jan')).toBeTruthy();
    expect(screen.getByText('28 Sep – 2 Oct')).toBeTruthy();
    expect(screen.getByText('30 Nov – 4 Dec')).toBeTruthy();
    expect(screen.getByText('Week 1')).toBeTruthy();
  });

  it('saves a parity override when week 6 is set to odd, then shows Semester saved.', async () => {
    const { save } = await setup();
    await type('First day of classes', '2026-09-28');
    await type('Last day of classes', '2027-01-15');
    expect(screen.queryByText('Semester saved.')).toBeNull();
    await press('Week 6 odd');
    expect(
      screen.getByRole('button', { name: 'Week 6 odd' }).props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Week 6 even' }).props.accessibilityState.selected,
    ).toBe(false);
    await press('Save semester');
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'semester',
        name: 'This semester',
        firstDay: '2026-09-28',
        lastDay: '2027-01-15',
        breaks: [],
        parityOverrides: { 6: 'odd' },
        updatedAt: Date.now(),
      }),
    );
    expect(screen.getByText('Semester saved.')).toBeTruthy();
  });

  it('removes the override when set back to the natural parity', async () => {
    const { save } = await setup({
      semester: { ...existing, breaks: [], parityOverrides: { 6: 'odd' } },
    });
    await press('Week 6 even');
    await press('Save semester');
    expect(save.mock.calls[0][0].parityOverrides).toEqual({});
  });

  it('drops overrides beyond the week count', async () => {
    const { save } = await setup({
      semester: { ...existing, parityOverrides: { 3: 'even', 30: 'odd' } },
    });
    await press('Save semester');
    expect(save.mock.calls[0][0].parityOverrides).toEqual({ 3: 'even' });
  });

  it('prefills from the existing semester and keeps its id', async () => {
    const { save } = await setup({ semester: existing });
    expect(screen.getByText('Semester I, 2026–2027')).toBeTruthy();
    expect(screen.getByLabelText('Name').props.value).toBe('Semester I, 2026–2027');
    expect(screen.getByLabelText('First day of classes').props.value).toBe('2026-09-28');
    expect(screen.getByLabelText('Last day of classes').props.value).toBe('2027-01-15');
    expect(weekButtons()).toHaveLength(14);
    await press('Save semester');
    expect(save.mock.calls[0][0].id).toBe('sem');
  });

  it('groups a two-week break into one row and removes it', async () => {
    await setup({ semester: existing });
    expect(screen.getAllByText('Break')).toHaveLength(1);
    expect(screen.getByText('21 Dec – 3 Jan')).toBeTruthy();
    await press('Remove');
    expect(screen.queryByText('Break')).toBeNull();
    expect(weekButtons()).toHaveLength(16);
  });

  it('disables save when the last day is before the first day', async () => {
    await setup();
    await type('First day of classes', '2026-09-28');
    await type('Last day of classes', '2026-09-01');
    expect(screen.getByText('The last day must be after the first day.')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Save semester' }).props.accessibilityState.disabled,
    ).toBe(true);
    expect(screen.queryAllByRole('button', { name: /^Week \d+ odd$/ })).toHaveLength(0);
  });

  it('flags a malformed date', async () => {
    await setup();
    await type('First day of classes', 'soon');
    expect(screen.getByText('Enter a date like 2026-09-28.')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Save semester' }).props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('validates the add-break form and can cancel', async () => {
    await setup({ semester: { ...existing, breaks: [] } });
    await press('Add a break');
    await type('From', 'nope');
    expect(screen.getByText('Enter a date like 2026-09-28.')).toBeTruthy();
    await type('From', '2026-12-21');
    await type('To', '2026-12-01');
    expect(screen.getByText('The break must end after it starts.')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Add break' }).props.accessibilityState.disabled,
    ).toBe(true);
    await type('From', '2028-01-01');
    await type('To', '2028-01-10');
    expect(screen.getByText('The break must be inside the semester.')).toBeTruthy();
    await press('Cancel');
    expect(screen.queryByLabelText('From')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add a break' })).toBeTruthy();
  });
});
