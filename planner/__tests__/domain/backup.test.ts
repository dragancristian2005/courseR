import { exportBackup, parseBackup } from '../../src/domain/backup';
import { emptyPlannerData } from '../../src/data/repository';
import type { PlannerData } from '../../src/domain/types';

const NOT_BACKUP = 'This file is not a Study Planner backup.';

function sample(): PlannerData {
  return {
    ...emptyPlannerData(),
    subjects: [
      {
        id: 's1',
        name: 'Algebra',
        abbreviation: 'ALG',
        attending: true,
        updatedAt: 5,
      },
    ],
    homework: [
      {
        id: 'h1',
        title: 'Sheet 3',
        subjectId: 's1',
        due: '2026-11-10',
        dueTime: null,
        done: false,
        updatedAt: 6,
      },
    ],
  };
}

const wrap = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    app: 'study-planner',
    version: 1,
    exportedAt: 'x',
    data: emptyPlannerData(),
    ...over,
  });

describe('backup', () => {
  it('round trips data', () => {
    const data = sample();
    const result = parseBackup(exportBackup(data, new Date('2026-11-04T10:00:00Z')));
    expect(result).toEqual({ ok: true, data });
  });

  it('round trips classroomCourses and Classroom homework fields', () => {
    const data = sample();
    data.classroomCourses = [{ id: '123', name: 'Algebra', subjectId: null, updatedAt: 3 }];
    data.homework[0] = {
      ...data.homework[0],
      source: 'classroom',
      externalId: 'c1:w9',
      imported: { title: 'Sheet 3', due: null, dueTime: null },
    };
    const result = parseBackup(exportBackup(data, new Date('2026-11-04T10:00:00Z')));
    expect(result).toEqual({ ok: true, data });
  });

  it('treats a backup without classroomCourses as having none', () => {
    const { classroomCourses: _c, ...old } = emptyPlannerData();
    const result = parseBackup(wrap({ data: old }));
    expect(result).toEqual({ ok: true, data: emptyPlannerData() });
  });

  it('rejects a non-array classroomCourses', () => {
    expect(parseBackup(wrap({ data: { ...emptyPlannerData(), classroomCourses: {} } }))).toEqual({
      ok: false,
      error: NOT_BACKUP,
    });
  });

  it('round trips homework without a due date', () => {
    const data = sample();
    data.homework[0] = { ...data.homework[0], due: null };
    const result = parseBackup(exportBackup(data, new Date('2026-11-04T10:00:00Z')));
    expect(result).toEqual({ ok: true, data });
  });

  it('writes envelope with exportedAt and 2-space indent', () => {
    const text = exportBackup(emptyPlannerData(), new Date('2026-11-04T10:00:00Z'));
    const obj = JSON.parse(text);
    expect(obj.app).toBe('study-planner');
    expect(obj.version).toBe(1);
    expect(obj.exportedAt).toBe('2026-11-04T10:00:00.000Z');
    expect(text).toContain('\n  "app"');
  });

  it('rejects wrong app', () => {
    expect(parseBackup(wrap({ app: 'other' }))).toEqual({
      ok: false,
      error: NOT_BACKUP,
    });
  });

  it('rejects newer versions', () => {
    expect(parseBackup(wrap({ version: 2 }))).toEqual({
      ok: false,
      error: 'This backup was made by a newer version of the app.',
    });
  });

  it('rejects missing or non-1 versions', () => {
    const noVersion = JSON.stringify({
      app: 'study-planner',
      data: emptyPlannerData(),
    });
    expect(parseBackup(noVersion)).toEqual({ ok: false, error: NOT_BACKUP });
    expect(parseBackup(wrap({ version: 0 }))).toEqual({
      ok: false,
      error: NOT_BACKUP,
    });
    expect(parseBackup(wrap({ version: '1' }))).toEqual({
      ok: false,
      error: NOT_BACKUP,
    });
  });

  it('rejects invalid JSON', () => {
    expect(parseBackup('{nope')).toEqual({
      ok: false,
      error: 'This file could not be read.',
    });
  });

  it('rejects wrong shapes', () => {
    expect(parseBackup('null')).toEqual({ ok: false, error: NOT_BACKUP });
    expect(parseBackup('[]')).toEqual({ ok: false, error: NOT_BACKUP });
    expect(parseBackup(wrap({ data: null }))).toEqual({
      ok: false,
      error: NOT_BACKUP,
    });
    expect(parseBackup(wrap({ data: { ...emptyPlannerData(), subjects: {} } }))).toEqual({
      ok: false,
      error: NOT_BACKUP,
    });
    const { links: _l, ...missing } = emptyPlannerData();
    expect(parseBackup(wrap({ data: missing }))).toEqual({
      ok: false,
      error: NOT_BACKUP,
    });
    expect(parseBackup(wrap({ data: { ...emptyPlannerData(), semester: 3 } }))).toEqual({
      ok: false,
      error: NOT_BACKUP,
    });
  });

  it('rejects links with an unsafe or non-string url', () => {
    for (const url of ['javascript:alert(1)', 42]) {
      const data = {
        semester: null,
        subjects: [],
        patterns: [],
        overrides: [],
        exams: [],
        homework: [],
        notes: [],
        links: [{ id: 'l', title: 't', url, subjectId: null, updatedAt: 1 }],
      };
      expect(parseBackup(JSON.stringify({ app: 'study-planner', version: 1, data }))).toEqual({
        ok: false,
        error: NOT_BACKUP,
      });
    }
  });

  describe('record shapes', () => {
    const semester = () => ({
      id: 'sem',
      updatedAt: 1,
      name: 'Autumn',
      firstDay: '2026-10-05',
      lastDay: '2027-01-29',
      breaks: [{ from: '2026-12-21', to: '2027-01-03' }],
      parityOverrides: { 3: 'even' },
    });
    const withData = (over: Record<string, unknown>) =>
      parseBackup(wrap({ data: { ...emptyPlannerData(), ...over } }));
    const rejected = { ok: false, error: NOT_BACKUP };

    it('accepts a well-formed semester', () => {
      expect(withData({ semester: semester() }).ok).toBe(true);
    });

    it.each([
      ['a non-object record', [5]],
      ['a missing id', [{ updatedAt: 1 }]],
      ['a non-string id', [{ id: 4, updatedAt: 1 }]],
      ['an id with a slash', [{ id: 'a/b', updatedAt: 1 }]],
      ['an empty id', [{ id: '', updatedAt: 1 }]],
      ['a missing updatedAt', [{ id: 'a' }]],
      ['a string updatedAt', [{ id: 'a', updatedAt: '1' }]],
      ['a non-finite updatedAt', [{ id: 'a', updatedAt: null }]],
    ])('rejects %s in any collection', (_n, list) => {
      for (const key of [
        'subjects',
        'patterns',
        'overrides',
        'exams',
        'homework',
        'notes',
        'links',
        'classroomCourses',
      ]) {
        expect(withData({ [key]: list })).toEqual(rejected);
      }
    });

    it.each([
      ['a missing id', { id: undefined }],
      ['a bad id', { id: 'x y' }],
      ['a non-numeric updatedAt', { updatedAt: 'now' }],
      ['an invalid firstDay', { firstDay: '2026-02-30' }],
      ['a non-string lastDay', { lastDay: 20270129 }],
      ['non-array breaks', { breaks: {} }],
      ['a break with a bad date', { breaks: [{ from: '2026-12-21', to: 'soon' }] }],
      ['a break that is not an object', { breaks: ['x'] }],
      ['non-object parityOverrides', { parityOverrides: [] }],
      ['a bad parity value', { parityOverrides: { 3: 'both' } }],
    ])('rejects a semester with %s', (_n, over) => {
      expect(withData({ semester: { ...semester(), ...over } })).toEqual(rejected);
    });
  });
});
