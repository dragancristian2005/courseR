import type { ExamImport } from '../../src/domain/importFormat';
import { examGroupOptions, planExamImport } from '../../src/domain/examImport';
import { validateImport } from '../../src/domain/importFormat';
import { applyAnswers, planTimetableImport } from '../../src/domain/importPlan';
import type { Exam, PlannerData, Subject } from '../../src/domain/types';

const empty = (): PlannerData => ({
  semester: null,
  subjects: [],
  patterns: [],
  overrides: [],
  exams: [],
  homework: [],
  notes: [],
  links: [],
});
const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};
const subj = (id: string, abbreviation: string, name: string): Subject => ({
  id,
  abbreviation,
  name,
  attending: true,
  updatedAt: 1,
});
const file = (exams: Partial<ExamImport['exams'][number]>[]): ExamImport => ({
  format: 'study-planner-import',
  version: 1,
  kind: 'exams',
  groups: [],
  exams: exams.map((e) => ({
    subject: 'BD',
    subjectName: null,
    title: null,
    date: '2027-01-20',
    start: '09:00',
    room: null,
    groups: ['all'],
    unsure: [],
    ...e,
  })),
});

describe('planExamImport', () => {
  it('keeps only exams for the group', () => {
    const f = file([
      { groups: ['1-4'] },
      { groups: ['5-8'], date: '2027-01-21' },
      { groups: ['all'], date: '2027-01-22' },
    ]);
    const r = planExamImport(f, empty(), 'Grupa 2', 5, counter());
    expect(r.exams).toHaveLength(2);
  });

  it('links a subject by abbreviation, ignoring accents', () => {
    const data = { ...empty(), subjects: [subj('s1', 'ȘP', 'Systems')] };
    const r = planExamImport(file([{ subject: 'sp' }]), data, 'x', 5, counter());
    expect(r.exams[0]).toMatchObject({
      subjectId: 's1',
      title: 'Exam',
      room: '',
      updatedAt: 5,
      id: 'id1',
    });
  });

  it('links by name when the abbreviation differs', () => {
    const data = { ...empty(), subjects: [subj('s1', 'DB', 'Baze de dată')] };
    const f = file([{ subject: 'BD', subjectName: 'Baze de data', title: 'Final' }]);
    const r = planExamImport(f, data, 'x', 5, counter());
    expect(r.exams[0]).toMatchObject({ subjectId: 's1', title: 'Final' });
  });

  it('ignores deleted subjects and prefixes the title when unmatched', () => {
    const dead = { ...subj('s1', 'BD', 'Baze de date'), deleted: true };
    const data = { ...empty(), subjects: [dead] };
    const f = file([{ subjectName: 'Baze de date', title: 'Final', room: 'A1' }, {}]);
    const r = planExamImport(f, data, 'x', 5, counter());
    expect(r.exams[0]).toMatchObject({ subjectId: null, title: 'Baze de date: Final', room: 'A1' });
    expect(r.exams[1].title).toBe('BD: Exam');
  });

  it('skips exams already present and counts them', () => {
    const existing: Exam = {
      id: 'e0',
      updatedAt: 1,
      subjectId: 's1',
      title: 'whatever',
      date: '2027-01-20',
      start: '09:00',
      room: '',
    };
    const data = { ...empty(), subjects: [subj('s1', 'BD', 'x')], exams: [existing] };
    const f = file([{}, { date: '2027-01-21' }]);
    const r = planExamImport(f, data, 'x', 5, counter());
    expect(r.exams).toHaveLength(1);
    expect(r.exams[0].date).toBe('2027-01-21');
    expect(r.skipped).toBe(1);
  });

  it('does not skip against deleted exams; unsubjected duplicates need the same title', () => {
    const base: Exam = {
      id: 'e0',
      updatedAt: 1,
      subjectId: null,
      title: 'BD: Exam',
      date: '2027-01-20',
      start: '09:00',
      room: '',
    };
    const f = file([{}]);
    const del = { ...empty(), exams: [{ ...base, deleted: true }] };
    expect(planExamImport(f, del, 'x', 5, counter()).exams).toHaveLength(1);
    const live = { ...empty(), exams: [base] };
    expect(planExamImport(f, live, 'x', 5, counter()).skipped).toBe(1);
    const other = { ...empty(), exams: [{ ...base, title: 'Other' }] };
    expect(planExamImport(f, other, 'x', 5, counter()).exams).toHaveLength(1);
  });

  it('reports unsure fields by new exam id and does not mutate input', () => {
    const f = file([{ unsure: ['room', 'date'] }, {}]);
    const copy = JSON.stringify(f);
    const r = planExamImport(f, empty(), 'x', 5, counter());
    expect(r.unsure).toEqual({ id1: ['room', 'date'] });
    expect(JSON.stringify(f)).toBe(copy);
  });
});

describe('exams after a timetable with a full-name course', () => {
  it('link to the one subject the timetable import created', () => {
    const r = validateImport(require('../fixtures/uvt-info3.json'));
    if (!r.ok || r.file.kind !== 'timetable') throw new Error('bad fixture');
    const ids = counter();
    const plan = planTimetableImport(r.file, empty(), 'Grupa 1', null);
    const done = applyAnswers(
      plan,
      {
        chosen: { 'opt-mon-13': 3, 'opt-tue-08': 7, dct: 13 },
        types: { 10: 'lab' },
        attending: {},
        edits: {},
      },
      empty(),
      1,
      ids,
    );
    const data = { ...empty(), subjects: done.subjects };
    const tss = done.subjects.filter((s) => s.abbreviation === 'TSS');
    expect(tss).toHaveLength(1);
    const f = file([
      { subject: 'TSS', subjectName: 'Testarea sistemelor software' },
      { subject: 'Testarea sistemelor software', subjectName: null, date: '2027-01-22' },
    ]);
    const out = planExamImport(f, data, 'x', 5, ids);
    expect(out.exams.map((e) => e.subjectId)).toEqual([tss[0].id, tss[0].id]);
  });
});

describe('examGroupOptions', () => {
  it("uses the file's groups, else labels seen in the exams without all or ranges", () => {
    expect(examGroupOptions({ ...file([]), groups: ['A1', 'a1', 'B2'] })).toEqual(['A1', 'B2']);
    const f = file([{ groups: ['all'] }, { groups: ['311', '1-3'] }, { groups: ['312', '311'] }]);
    expect(examGroupOptions(f)).toEqual(['311', '312']);
  });
});
