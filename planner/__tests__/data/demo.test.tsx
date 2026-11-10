import React from 'react';
import { render, screen } from '@testing-library/react-native';
import Today from '../../app/(tabs)/index';
import Week from '../../app/(tabs)/week';
import { demoData, isDemo } from '../../src/data/demo';
import { createMemoryRepository } from '../../src/data/memoryRepository';
import { StoreProvider } from '../../src/data/StoreProvider';
import { isDate, isTime, weekdayOf } from '../../src/domain/dates';
import { sessionsBetween } from '../../src/domain/sessions';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../src/ui/useLayout', () => ({ useLayout: () => 'phone' }));

const TODAY = '2026-10-28'; // a Wednesday

describe('demoData', () => {
  const data = demoData(TODAY);

  it('is off unless EXPO_PUBLIC_DEMO is 1', () => {
    expect(isDemo()).toBe(false);
  });

  it('has a coherent semester around today', () => {
    const s = data.semester!;
    expect(s.firstDay < TODAY && TODAY < s.lastDay).toBe(true);
    expect(s.breaks).toHaveLength(1);
    expect(s.breaks[0].from > TODAY).toBe(true);
  });

  it('has valid, cross-referenced records with unique ids', () => {
    const ids = new Set(data.subjects.map((s) => s.id));
    expect(data.subjects.length).toBeGreaterThanOrEqual(6);
    expect(data.subjects.filter((s) => !s.attending)).toHaveLength(1);
    for (const p of data.patterns) {
      expect(ids.has(p.subjectId)).toBe(true);
      expect(isTime(p.start) && isTime(p.end) && p.start < p.end).toBe(true);
      expect(p.weekday).toBeGreaterThanOrEqual(1);
      expect(p.weekday).toBeLessThanOrEqual(5);
    }
    expect(new Set(data.patterns.map((p) => p.repeat))).toEqual(new Set(['every', 'odd', 'even']));
    for (const h of data.homework) {
      if (h.due) expect(isDate(h.due)).toBe(true);
      if (h.subjectId) expect(ids.has(h.subjectId)).toBe(true);
    }
    const open = data.homework.filter((h) => !h.done);
    expect(open.some((h) => h.due && h.due < TODAY)).toBe(true);
    expect(open.some((h) => h.due === TODAY)).toBe(true);
    expect(open.some((h) => h.due === null)).toBe(true);
    expect(data.homework.some((h) => h.done)).toBe(true);
    expect(data.exams).toHaveLength(2);
    expect(data.exams.every((e) => e.date > TODAY && isDate(e.date))).toBe(true);
    expect(data.notes.some((n) => n.sessionId)).toBe(true);
    expect(data.notes.some((n) => n.subjectId)).toBe(true);
    expect(data.links.length).toBeGreaterThanOrEqual(3);
    for (const list of [
      data.subjects,
      data.patterns,
      data.homework,
      data.exams,
      data.notes,
      data.links,
    ]) {
      expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
    }
  });

  it('applies the moved override this week', () => {
    const sessions = sessionsBetween(data, '2026-10-26', '2026-11-01');
    expect(sessions.filter((s) => s.moved)).toHaveLength(1);
  });

  it('has classes on a weekday', () => {
    expect(weekdayOf(TODAY)).toBe(3);
    expect(sessionsBetween(data, TODAY, TODAY).length).toBeGreaterThan(0);
  });

  describe('screens', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 9, 28, 10, 30));
    });
    afterEach(() => jest.useRealTimers());

    const wrap = (ui: React.ReactElement) => (
      <StoreProvider repository={createMemoryRepository(data)}>{ui}</StoreProvider>
    );

    it('renders Today with classes', async () => {
      await render(wrap(<Today />));
      expect(screen.getByText('Wednesday 28 October')).toBeTruthy();
      expect(screen.getAllByText(/Prelucrarea imaginilor/).length).toBeGreaterThan(0);
    });

    it('renders Week', async () => {
      await render(wrap(<Week />));
      expect(screen.getAllByText(/PSTR/).length).toBeGreaterThan(0);
    });
  });
});
