import { fromDoc, toDoc } from '../../src/data/firestoreMapping';
import type { Base } from '../../src/domain/types';

const records: Record<string, Base> = {
  subjects: {
    id: 's1',
    updatedAt: 5,
    name: 'Algebra',
    abbreviation: 'ALG',
    attending: true,
  } as Base,
  patterns: {
    id: 'p1',
    updatedAt: 5,
    subjectId: 's1',
    type: 'course',
    weekday: 1,
    start: '08:00',
    end: '10:00',
    room: 'A1',
    teacher: 'Dr X',
    repeat: 'every',
    validFrom: '2026-10-01',
    validTo: null,
    online: false,
  } as Base,
  overrides: {
    id: 'o1',
    updatedAt: 5,
    sessionId: 'p1:2026-10-05',
    kind: 'moved',
    date: '2026-10-06',
    start: '09:00',
  } as Base,
  exams: {
    id: 'e1',
    updatedAt: 5,
    subjectId: null,
    title: 'Final',
    date: '2026-12-01',
    start: null,
    room: '',
  } as Base,
  homework: {
    id: 'h1',
    updatedAt: 5,
    title: 'Sheet 1',
    subjectId: 's1',
    due: '2026-10-20',
    dueTime: null,
    done: false,
  } as Base,
  notes: {
    id: 'n1',
    updatedAt: 5,
    text: 'hi',
    subjectId: null,
    sessionId: null,
    createdAt: 4,
  } as Base,
  semester: {
    id: 'semester',
    updatedAt: 5,
    name: 'Autumn',
    firstDay: '2026-10-01',
    lastDay: '2027-01-31',
    breaks: [{ from: '2026-12-22', to: '2027-01-04' }],
    parityOverrides: { 3: 'even' },
  } as unknown as Base,
};

describe('firestoreMapping', () => {
  it.each(Object.keys(records))('round-trips a %s record', (key) => {
    const r = records[key];
    const { id: _id, ...doc } = toDoc(r) as Record<string, unknown>;
    expect(fromDoc(r.id, toDoc(r))).toEqual(r);
    expect(_id).toBeUndefined();
    void doc;
  });

  it('drops undefined fields', () => {
    const doc = toDoc({ id: 'x', updatedAt: 1, date: undefined, room: 'r' } as Base);
    expect('date' in doc).toBe(false);
    expect(doc).toEqual({ updatedAt: 1, room: 'r' });
  });

  it('keeps the deleted flag', () => {
    const r = { id: 's1', updatedAt: 9, deleted: true, name: 'A' } as Base;
    expect(fromDoc('s1', toDoc(r)).deleted).toBe(true);
  });
});
