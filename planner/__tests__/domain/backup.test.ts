import { exportBackup, parseBackup } from '../../src/domain/backup';
import { emptyPlannerData } from '../../src/data/repository';
import type { PlannerData } from '../../src/domain/types';

const NOT_BACKUP = 'This file is not a Study Planner backup.';

function sample(): PlannerData {
  return {
    ...emptyPlannerData(),
    subjects: [{ id: 's1', name: 'Algebra', abbreviation: 'ALG', attending: true, updatedAt: 5 }],
    homework: [
      { id: 'h1', title: 'Sheet 3', subjectId: 's1', due: '2026-11-10', dueTime: null, done: false, updatedAt: 6 },
    ],
  };
}

const wrap = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ app: 'study-planner', version: 1, exportedAt: 'x', data: emptyPlannerData(), ...over });

describe('backup', () => {
  it('round trips data', () => {
    const data = sample();
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
    expect(parseBackup(wrap({ app: 'other' }))).toEqual({ ok: false, error: NOT_BACKUP });
  });

  it('rejects newer versions', () => {
    expect(parseBackup(wrap({ version: 2 }))).toEqual({
      ok: false,
      error: 'This backup was made by a newer version of the app.',
    });
  });

  it('rejects missing or non-1 versions', () => {
    const noVersion = JSON.stringify({ app: 'study-planner', data: emptyPlannerData() });
    expect(parseBackup(noVersion)).toEqual({ ok: false, error: NOT_BACKUP });
    expect(parseBackup(wrap({ version: 0 }))).toEqual({ ok: false, error: NOT_BACKUP });
    expect(parseBackup(wrap({ version: '1' }))).toEqual({ ok: false, error: NOT_BACKUP });
  });

  it('rejects invalid JSON', () => {
    expect(parseBackup('{nope')).toEqual({ ok: false, error: 'This file could not be read.' });
  });

  it('rejects wrong shapes', () => {
    expect(parseBackup('null')).toEqual({ ok: false, error: NOT_BACKUP });
    expect(parseBackup('[]')).toEqual({ ok: false, error: NOT_BACKUP });
    expect(parseBackup(wrap({ data: null }))).toEqual({ ok: false, error: NOT_BACKUP });
    expect(parseBackup(wrap({ data: { ...emptyPlannerData(), subjects: {} } }))).toEqual({
      ok: false,
      error: NOT_BACKUP,
    });
    const { links: _l, ...missing } = emptyPlannerData();
    expect(parseBackup(wrap({ data: missing }))).toEqual({ ok: false, error: NOT_BACKUP });
    expect(parseBackup(wrap({ data: { ...emptyPlannerData(), semester: 3 } }))).toEqual({
      ok: false,
      error: NOT_BACKUP,
    });
  });
});
