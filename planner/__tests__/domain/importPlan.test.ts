import { validateImport } from '../../src/domain/importFormat';
import type { TimetableImport } from '../../src/domain/importFormat';
import {
  applyAnswers,
  blocksFor,
  fold,
  groupOptions,
  isComplete,
  offBlocks,
  planSubjectFor,
  matchesGroup,
  planTimetableImport,
  subjectKey,
} from '../../src/domain/importPlan';
import type { ImportAnswers } from '../../src/domain/importPlan';
import { TIMETABLE_EXAMPLE } from '../../src/domain/importPrompt';
import { OPEN_START } from '../../src/domain/edits';
import type { ClassPattern, PlannerData, Subject } from '../../src/domain/types';

function load(raw: unknown): TimetableImport {
  const r = validateImport(raw);
  if (!r.ok || r.file.kind !== 'timetable') throw new Error('bad fixture');
  return r.file;
}
const uvt = load(require('../fixtures/uvt-info3.json'));
const poli = load(require('../fixtures/poli-1b.json'));

const empty = (): PlannerData => ({
  semester: null,
  subjects: [],
  patterns: [],
  overrides: [],
  exams: [],
  homework: [],
  notes: [],
  links: [],
  classroomCourses: [],
});
const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};
const noAnswers = (): ImportAnswers => ({ chosen: {}, types: {}, attending: {}, edits: {} });

describe('fold and subjectKey', () => {
  it('strips diacritics, case and spaces', () => {
    expect(fold('  ȘaBlOane Țară ')).toBe('sabloane tara');
    expect(subjectKey('Ș.P.')).toBe('sp');
    expect(subjectKey('SP')).toBe('sp');
  });
});

describe('matchesGroup', () => {
  it('matches all, exact (case/diacritic-insensitive) and ranges', () => {
    expect(matchesGroup(['all'], 'Grupa 3')).toBe(true);
    expect(matchesGroup(['ALL'], 'Grupa 3')).toBe(true);
    expect(matchesGroup([' grupa 2 '], 'Grupa 2')).toBe(true);
    expect(matchesGroup(['Grupa 1'], 'Grupa 2')).toBe(false);
    expect(matchesGroup(['1-4'], 'Grupa 2')).toBe(true);
    expect(matchesGroup(['1–4'], 'Grupa 4')).toBe(true);
    expect(matchesGroup(['Grupa 1-4'], 'Grupa 5')).toBe(false);
    expect(matchesGroup(['Grupa 1 – 4'], 'Grupa 3')).toBe(true);
    expect(matchesGroup(['Grupa 7', '1-2'], 'Grupa 2')).toBe(true);
    expect(matchesGroup([], 'Grupa 2')).toBe(false);
  });
});

describe('matchesGroup near misses', () => {
  it('Grupa 10 does not match Grupa 1', () => {
    expect(matchesGroup(['Grupa 10'], 'Grupa 1')).toBe(false);
    expect(matchesGroup(['Grupa 1'], 'Grupa 10')).toBe(false);
  });
  it('the range 1-4 does not match group 10', () => {
    expect(matchesGroup(['1-4'], 'Grupa 10')).toBe(false);
    expect(matchesGroup(['Grupa 1-4'], '10')).toBe(false);
  });
  it('a label without a number matches only all or the exact label', () => {
    expect(matchesGroup(['1-4'], 'Seria A')).toBe(false);
    expect(matchesGroup(['Seria B'], 'Seria A')).toBe(false);
    expect(matchesGroup(['Seria A'], 'seria a')).toBe(true);
    expect(matchesGroup(['all'], 'Seria A')).toBe(true);
  });
});

describe('blocksFor semigroups', () => {
  it('matches "semigrupa 1" with "1" by their number, not "11"', () => {
    const f = {
      ...uvt,
      blocks: [
        { ...uvt.blocks[0], groups: ['all'], semigroup: 'semigrupa 1' },
        { ...uvt.blocks[0], groups: ['all'], semigroup: '11' },
      ],
    };
    expect(blocksFor(f, 'Grupa 1', '1')).toHaveLength(1);
    expect(blocksFor(f, 'Grupa 1', 'Semigrupa 11')).toHaveLength(1);
    expect(blocksFor(f, 'Grupa 1', 'Seria A')).toHaveLength(0);
  });
});

describe('groupOptions', () => {
  it('uses the file lists', () => {
    expect(groupOptions(uvt).groups).toHaveLength(8);
    expect(groupOptions(poli)).toEqual({ groups: ['Grupa 6', 'Grupa 7'], semigroups: ['1', '2'] });
  });
  it('falls back to labels in blocks, without all', () => {
    const f = { ...uvt, groups: [], semigroups: [], blocks: poli.blocks };
    expect(groupOptions(f)).toEqual({
      groups: ['Grupa 7', 'Grupa 6'],
      semigroups: ['1', '2'],
    });
  });
});

describe('blocksFor', () => {
  it('Grupa 1 gets all, listed and range blocks but not Grupa 5', () => {
    const b = blocksFor(uvt, 'Grupa 1', null);
    expect(b).toHaveLength(16);
    expect(b.some((x) => x.subject === 'SIIA')).toBe(false);
    expect(b.some((x) => x.subject === 'ITB')).toBe(true);
  });
  it('Grupa 5 sees its own block and not the Grupa 1-4 ones', () => {
    const b = blocksFor(uvt, 'Grupa 5', null);
    expect(b.some((x) => x.subject === 'SIIA')).toBe(true);
    expect(b.some((x) => x.subject === 'ITB')).toBe(false);
    expect(b.some((x) => x.subject === 'ALED' && x.type === null)).toBe(false);
  });
  it('a range label applies to group 2 (Review Focus 2)', () => {
    const f = { ...uvt, blocks: [{ ...uvt.blocks[0], groups: ['1-4'] }] };
    expect(blocksFor(f, 'Grupa 2', null)).toHaveLength(1);
    expect(blocksFor(f, 'Grupa 6', null)).toHaveLength(0);
  });
  it('semigroups: null block applies to all; other semigroup does not', () => {
    const s1 = blocksFor(poli, 'Grupa 7', '1').map((b) => b.subject);
    expect(s1).toEqual(['MAT', 'CHIM', 'FIZ', 'ENG', 'INF']);
    const s2 = blocksFor(poli, 'Grupa 7', '2').map((b) => b.subject);
    expect(s2).toEqual(['MAT', 'INF', 'ENG', 'INF']);
    expect(blocksFor(poli, 'Grupa 6', '1').map((b) => b.subject)).toEqual([
      'MAT',
      'ENG',
      'FIZ',
      'INF',
    ]);
  });
  it('with no semigroup chosen only whole-group blocks apply', () => {
    expect(blocksFor(poli, 'Grupa 7', null).map((b) => b.subject)).toEqual(['MAT', 'ENG', 'INF']);
  });
  it('does not mutate the file and returns copies of the list', () => {
    const before = JSON.stringify(uvt);
    blocksFor(uvt, 'Grupa 1', null);
    planTimetableImport(uvt, empty(), 'Grupa 1', null);
    expect(JSON.stringify(uvt)).toBe(before);
  });
});

describe('planTimetableImport', () => {
  const plan = planTimetableImport(uvt, empty(), 'Grupa 1', null);

  it('asks one choose-one per choiceGroup, with block indexes', () => {
    const c = plan.questions.filter((q) => q.kind === 'choose-one');
    expect(c).toEqual([
      { kind: 'choose-one', id: 'opt-mon-13', options: [3, 4] },
      { kind: 'choose-one', id: 'opt-tue-08', options: [7, 8, 9] },
      { kind: 'choose-one', id: 'dct', options: [13, 14] },
    ]);
  });
  it('asks a type question and an unsure note for the untyped block', () => {
    expect(plan.questions).toContainEqual({ kind: 'type', block: 10 });
    expect(plan.questions).toContainEqual({ kind: 'unsure', block: 10, fields: ['type'] });
    expect(plan.questions.filter((q) => q.kind === 'type')).toHaveLength(1);
  });
  it('does not ask when only one option remains for the group', () => {
    const f = { ...uvt, blocks: uvt.blocks.filter((b) => b.subject !== 'IBC') };
    const p = planTimetableImport(f, empty(), 'Grupa 1', null);
    expect(p.questions.find((q) => q.kind === 'choose-one' && q.id === 'opt-mon-13')).toBe(
      undefined,
    );
    expect(
      isComplete(
        p,
        { ...noAnswers(), types: { 9: 'lab' }, chosen: { 'opt-tue-08': 6, dct: 12 } },
        empty(),
      ),
    ).toBe(true);
  });
  it('maps ȘP and SP to one subject with the full name', () => {
    const sp = plan.subjects.filter((s) => subjectKey(s.abbreviation) === 'sp');
    expect(sp).toEqual([{ abbreviation: 'ȘP', name: 'Șabloane de proiectare', existingId: null }]);
    expect(plan.subjects.map((s) => s.abbreviation)).not.toContain('SP');
  });
  it('an abbreviation without any subjects entry is its own name', () => {
    const f = { ...uvt, subjects: [] };
    const p = planTimetableImport(f, empty(), 'Grupa 2', null);
    expect(p.subjects.find((s) => s.abbreviation === 'ITB')?.name).toBe('ITB');
  });
  it('links existing planner subjects by abbreviation, then by name', () => {
    const data = empty();
    data.subjects = [
      { id: 's1', name: 'Whatever', abbreviation: 'sp', attending: false, updatedAt: 1 },
      {
        id: 's2',
        name: 'Administrarea Rețelelor',
        abbreviation: 'NET',
        attending: true,
        updatedAt: 1,
      },
      { id: 's3', name: 'Gone', abbreviation: 'ITB', attending: true, updatedAt: 1, deleted: true },
    ];
    const p = planTimetableImport(uvt, data, 'Grupa 1', null);
    expect(p.subjects.find((s) => s.abbreviation === 'ȘP')?.existingId).toBe('s1');
    expect(p.subjects.find((s) => s.abbreviation === 'AR')?.existingId).toBe('s2');
    expect(p.subjects.find((s) => s.abbreviation === 'ITB')?.existingId).toBe(null);
  });
  it('works on the prompt example', () => {
    const g = groupOptions(TIMETABLE_EXAMPLE);
    const p = planTimetableImport(TIMETABLE_EXAMPLE, empty(), g.groups[0] ?? 'x', null);
    expect(p.blocks.length).toBeGreaterThan(0);
  });
});

describe('isComplete', () => {
  const plan = planTimetableImport(uvt, empty(), 'Grupa 1', null);
  const full: ImportAnswers = {
    ...noAnswers(),
    chosen: { 'opt-mon-13': 3, 'opt-tue-08': 7, dct: 13 },
    types: { 10: 'lab' },
  };
  it('is false until every choose-one and type is answered', () => {
    expect(isComplete(plan, noAnswers(), empty())).toBe(false);
    expect(isComplete(plan, { ...full, types: {} }, empty())).toBe(false);
    expect(isComplete(plan, { ...full, chosen: { ...full.chosen, dct: 99 } }, empty())).toBe(false);
    expect(isComplete(plan, full, empty())).toBe(true);
  });
  it('accepts a type given through edits', () => {
    expect(isComplete(plan, { ...full, types: {}, edits: { 10: { type: 'lab' } } }, empty())).toBe(
      true,
    );
  });
  const abbrOf = (i: number) => planSubjectFor(plan, plan.blocks[i].subject)!.abbreviation;

  it('does not ask the type of a class whose subject is switched off', () => {
    const off = { ...full, types: {}, attending: { [abbrOf(10)]: false } };
    expect(offBlocks(plan, off, empty()).has(10)).toBe(true);
    expect(isComplete(plan, off, empty())).toBe(true);
  });
  it('does not ask to choose between options that are all switched off', () => {
    const attending = Object.fromEntries(plan.subjects.map((s) => [s.abbreviation, false]));
    expect(isComplete(plan, { ...noAnswers(), attending }, empty())).toBe(true);
  });
  it('a subject switched back on asks again', () => {
    const on = { ...full, types: {}, attending: { [abbrOf(10)]: true } };
    expect(isComplete(plan, on, empty())).toBe(false);
  });
  it('a subject already switched off in the planner counts as off', () => {
    const name = planSubjectFor(plan, plan.blocks[10].subject)!.name;
    const data = {
      ...empty(),
      subjects: [{ id: 's', updatedAt: 1, name, abbreviation: abbrOf(10), attending: false }],
    };
    const p2 = planTimetableImport(uvt, data, 'Grupa 1', null);
    expect(isComplete(p2, { ...full, types: {} }, data)).toBe(true);
  });
  it('unsure notes do not block completion', () => {
    expect(plan.questions.some((q) => q.kind === 'unsure')).toBe(true);
    expect(isComplete(plan, full, empty())).toBe(true);
  });
});

describe('applyAnswers', () => {
  const answers: ImportAnswers = {
    chosen: { 'opt-mon-13': 4, 'opt-tue-08': 7, dct: 13 },
    types: { 10: 'lab' },
    attending: {},
    edits: {},
  };

  it('keeps only the chosen alternative of each choice group', () => {
    const plan = planTimetableImport(uvt, empty(), 'Grupa 1', null);
    const r = applyAnswers(plan, answers, empty(), 1000, counter());
    const abbr = (id: string) => r.subjects.find((s) => s.id === id)?.abbreviation;
    const used = r.patterns.map((p) => abbr(p.subjectId));
    expect(used).toContain('IBC');
    expect(r.patterns.filter((p) => p.weekday === 1 && p.start === '13:00')).toHaveLength(1);
    expect(r.patterns.filter((p) => p.weekday === 2 && p.start === '08:00')).toHaveLength(1);
    expect(r.patterns.filter((p) => p.start === '16:20')).toHaveLength(1);
    expect(r.patterns).toHaveLength(12);
    expect(used).not.toContain('PSTR');
    expect(used).not.toContain('GJS');
  });

  it('builds patterns with defaults and the answered type', () => {
    const plan = planTimetableImport(uvt, empty(), 'Grupa 1', null);
    const ids = counter();
    const r = applyAnswers(plan, answers, empty(), 1000, ids);
    const itb = r.patterns.find((p) => p.start === '08:00' && p.weekday === 1) as ClassPattern;
    expect(itb).toMatchObject({
      type: 'lab',
      room: '032',
      teacher: 'Bimbirica A.',
      repeat: 'every',
      validFrom: OPEN_START,
      validTo: null,
      source: 'import',
      online: false,
      updatedAt: 1000,
    });
    const dct = r.patterns.find((p) => p.start === '16:20') as ClassPattern;
    expect(dct.room).toBe('');
    expect(dct.teacher).toBe('');
    const aled = r.patterns.find((p) => p.weekday === 2 && p.start === '09:40') as ClassPattern;
    expect(aled.type).toBe('lab');
    expect(new Set(r.patterns.map((p) => p.id)).size).toBe(r.patterns.length);
  });

  it('ȘP course and SP lab share one subject', () => {
    const plan = planTimetableImport(uvt, empty(), 'Grupa 1', null);
    const r = applyAnswers(plan, answers, empty(), 1000, counter());
    expect(r.subjects.filter((s) => subjectKey(s.abbreviation) === 'sp')).toHaveLength(1);
    const sp = r.subjects.find((s) => subjectKey(s.abbreviation) === 'sp') as Subject;
    expect(sp.name).toBe('Șabloane de proiectare');
    const mine = r.patterns.filter((p) => p.subjectId === sp.id);
    expect(mine.map((p) => p.type).sort()).toEqual(['course', 'lab']);
  });

  it('diagonal pair becomes odd and even patterns (Review Focus 3)', () => {
    const plan = planTimetableImport(poli, empty(), 'Grupa 7', '1');
    const r = applyAnswers(plan, { ...noAnswers(), types: { 4: 'course' } }, empty(), 5, counter());
    const wed = r.patterns.filter((p) => p.weekday === 3);
    expect(wed.map((p) => p.repeat).sort()).toEqual(['even', 'odd']);
    const name = (id: string) => r.subjects.find((s) => s.id === id)?.abbreviation;
    expect(
      wed.find((p) => p.repeat === 'odd') && name(wed.find((p) => p.repeat === 'odd')!.subjectId),
    ).toBe('CHIM');
    expect(name(wed.find((p) => p.repeat === 'even')!.subjectId)).toBe('FIZ');
  });

  it('reuses an existing subject, keeps its attending, does not duplicate', () => {
    const data = empty();
    data.subjects = [
      { id: 'ex', name: 'My SP', abbreviation: 'SP', attending: false, updatedAt: 7 },
    ];
    const plan = planTimetableImport(uvt, data, 'Grupa 1', null);
    const r = applyAnswers(plan, answers, data, 1000, counter());
    expect(r.subjects.find((s) => s.id === 'ex')).toBeUndefined();
    expect(r.subjects.filter((s) => subjectKey(s.abbreviation) === 'sp')).toHaveLength(0);
    expect(r.patterns.filter((p) => p.subjectId === 'ex')).toHaveLength(2);
    expect(data.subjects[0].attending).toBe(false);
  });

  it('updates attending of a reused subject only when the answer differs', () => {
    const data = empty();
    data.subjects = [{ id: 'ex', name: 'x', abbreviation: 'SP', attending: false, updatedAt: 7 }];
    const plan = planTimetableImport(uvt, data, 'Grupa 1', null);
    const same = applyAnswers(
      plan,
      { ...answers, attending: { ȘP: false } },
      data,
      1000,
      counter(),
    );
    expect(same.subjects.find((s) => s.id === 'ex')).toBeUndefined();
    const diff = applyAnswers(plan, { ...answers, attending: { ȘP: true } }, data, 1000, counter());
    const s = diff.subjects.find((x) => x.id === 'ex');
    expect(s?.attending).toBe(true);
    expect(s?.updatedAt).toBeGreaterThan(7);
    expect(data.subjects[0].attending).toBe(false);
  });

  describe('two sheet entries on one existing subject', () => {
    const block = (subject: string, day: 1 | 2): TimetableImport['blocks'][number] => ({
      ...uvt.blocks[0],
      day,
      start: '08:00',
      end: '09:30',
      subject,
      type: 'course',
      groups: ['all'],
      semigroup: null,
      choiceGroup: null,
      unsure: [],
    });
    const file: TimetableImport = {
      ...uvt,
      subjects: [
        { abbreviation: 'AL1', name: 'Algebra' },
        { abbreviation: 'AL2', name: 'Algebra' },
      ],
      blocks: [block('AL1', 1), block('AL2', 2)],
    };
    const dataWith = (attending: boolean) => {
      const d = empty();
      d.subjects = [{ id: 'ex', name: 'Algebra', abbreviation: 'ALG', attending, updatedAt: 7 }];
      return d;
    };
    const run = (attending: boolean, answered: Record<string, boolean>) => {
      const data = dataWith(attending);
      const p = planTimetableImport(file, data, 'all', null);
      expect(p.subjects).toHaveLength(2);
      expect(p.subjects.every((s) => s.existingId === 'ex')).toBe(true);
      return applyAnswers(p, { ...noAnswers(), attending: answered }, data, 1000, counter());
    };
    it('turns the subject on when any entry is on', () => {
      expect(run(false, { AL1: false, AL2: true }).subjects[0]?.attending).toBe(true);
      expect(run(false, { AL1: true, AL2: false }).subjects[0]?.attending).toBe(true);
    });
    it('turns it off only when every entry is off', () => {
      expect(run(true, { AL1: false, AL2: false }).subjects[0]?.attending).toBe(false);
      expect(run(true, { AL1: false }).subjects).toHaveLength(0);
    });
    it('keeps it on when one entry is on and the other off', () => {
      expect(run(true, { AL1: true, AL2: false }).subjects).toHaveLength(0);
      expect(run(true, { AL1: false, AL2: true }).subjects).toHaveLength(0);
    });
    it('leaves it alone when no entry differs', () => {
      expect(run(false, { AL1: false, AL2: false }).subjects).toHaveLength(0);
    });
  });

  it('a switched-off new subject is created with attending false; default is true', () => {
    const plan = planTimetableImport(uvt, empty(), 'Grupa 1', null);
    const r = applyAnswers(plan, { ...answers, attending: { ITB: false } }, empty(), 1, counter());
    expect(r.subjects.find((s) => s.abbreviation === 'ITB')?.attending).toBe(false);
    expect(r.subjects.find((s) => s.abbreviation === 'TSS')?.attending).toBe(true);
    expect(
      r.patterns.some((p) => p.subjectId === r.subjects.find((s) => s.abbreviation === 'ITB')?.id),
    ).toBe(true);
  });

  it('applies edits to a block', () => {
    const plan = planTimetableImport(uvt, empty(), 'Grupa 1', null);
    const r = applyAnswers(
      plan,
      { ...answers, edits: { 0: { room: 'Z9', start: '08:10', weeks: 'odd' } } },
      empty(),
      1,
      counter(),
    );
    const p = r.patterns.find((x) => x.room === 'Z9');
    expect(p).toMatchObject({ start: '08:10', repeat: 'odd', weekday: 1 });
  });

  it('re-importing the same sheet adds nothing (Review Focus 4)', () => {
    const data = empty();
    const ids = counter();
    const plan = planTimetableImport(uvt, data, 'Grupa 1', null);
    const first = applyAnswers(plan, answers, data, 1, ids);
    const saved: PlannerData = { ...data, subjects: first.subjects, patterns: first.patterns };
    const plan2 = planTimetableImport(uvt, saved, 'Grupa 1', null);
    const second = applyAnswers(plan2, answers, saved, 2, ids);
    expect(second.patterns).toEqual([]);
    expect(second.subjects).toEqual([]);
    expect(first.patterns.length).toBeGreaterThan(0);
  });

  it('a deleted identical pattern does not block a new one', () => {
    const data = empty();
    const ids = counter();
    const plan = planTimetableImport(uvt, data, 'Grupa 1', null);
    const first = applyAnswers(plan, answers, data, 1, ids);
    const saved: PlannerData = {
      ...data,
      subjects: first.subjects,
      patterns: first.patterns.map((p) => ({ ...p, deleted: true })),
    };
    const second = applyAnswers(
      planTimetableImport(uvt, saved, 'Grupa 1', null),
      answers,
      saved,
      2,
      ids,
    );
    expect(second.patterns).toHaveLength(first.patterns.length);
  });

  it('does not mutate its inputs', () => {
    const data = empty();
    data.subjects = [{ id: 'ex', name: 'x', abbreviation: 'SP', attending: true, updatedAt: 7 }];
    const plan = planTimetableImport(uvt, data, 'Grupa 1', null);
    const a = JSON.stringify({ plan, answers, data, uvt });
    applyAnswers(plan, { ...answers, attending: { ȘP: false } }, data, 1, counter());
    expect(JSON.stringify({ plan, answers, data, uvt })).toBe(a);
  });
});

describe('a course written with the full subject name', () => {
  const answers: ImportAnswers = {
    ...noAnswers(),
    chosen: { 'opt-mon-13': 3, 'opt-tue-08': 7, dct: 13 },
    types: { 10: 'lab' },
  };
  const tssBlocks = (plan: ReturnType<typeof planTimetableImport>) =>
    plan.blocks.filter((b) => subjectKey(b.subject).startsWith('t'));

  it('plans one TSS subject for the abbreviation and the full name', () => {
    const plan = planTimetableImport(uvt, empty(), 'Grupa 1', null);
    expect(tssBlocks(plan)).toHaveLength(3);
    expect(plan.subjects.filter((s) => s.abbreviation === 'TSS')).toHaveLength(1);
    expect(plan.subjects.some((s) => s.abbreviation === 'Testarea sistemelor software')).toBe(
      false,
    );
  });

  it('creates one subject and links every TSS class to it', () => {
    const plan = planTimetableImport(uvt, empty(), 'Grupa 1', null);
    const r = applyAnswers(plan, answers, empty(), 1, counter());
    const tss = r.subjects.filter((s) => subjectKey(s.abbreviation) === 'tss');
    expect(tss).toHaveLength(1);
    expect(r.subjects.filter((s) => subjectKey(s.name) === 'testareasistemelorsoftware')).toEqual(
      tss,
    );
    const linked = r.patterns.filter((p) => p.subjectId === tss[0].id);
    expect(linked).toHaveLength(3);
  });

  it('reuses an existing subject once, even with attending changed', () => {
    const data = empty();
    data.subjects = [
      {
        id: 'tss',
        name: 'Testarea sistemelor software',
        abbreviation: 'TSS',
        attending: true,
        updatedAt: 3,
      },
    ];
    const plan = planTimetableImport(uvt, data, 'Grupa 1', null);
    const r = applyAnswers(plan, { ...answers, attending: { TSS: false } }, data, 9, counter());
    expect(r.subjects.filter((s) => s.id === 'tss')).toHaveLength(1);
    expect(r.subjects.filter((s) => subjectKey(s.abbreviation) === 'tss')).toHaveLength(1);
    expect(r.patterns.filter((p) => p.subjectId === 'tss')).toHaveLength(3);
  });

  it('merges a typed full name into the subject created for its abbreviation', () => {
    const plan = planTimetableImport(uvt, empty(), 'Grupa 1', null);
    const i = plan.blocks.findIndex((b) => b.subject === 'Testarea sistemelor software');
    // The plan lists TSS; an edit that types the name differently-spaced still lands on it.
    const r = applyAnswers(
      plan,
      { ...answers, edits: { [i]: { subject: 'testarea  sistemelor software' } } },
      empty(),
      1,
      counter(),
    );
    expect(r.subjects.filter((s) => subjectKey(s.abbreviation) === 'tss')).toHaveLength(1);
    expect(r.subjects.filter((s) => /testarea/i.test(s.name))).toHaveLength(1);
  });

  it('two spellings of an existing subject update it only once', () => {
    const data = empty();
    data.subjects = [
      {
        id: 'tss',
        name: 'Testarea sistemelor software',
        abbreviation: 'TSS',
        attending: true,
        updatedAt: 3,
      },
    ];
    const plan = planTimetableImport(uvt, data, 'Grupa 1', null);
    // Hand-built plan with two entries pointing at the same subject.
    const twin = {
      ...plan,
      subjects: [...plan.subjects, { abbreviation: 'Testarea', name: 'x', existingId: 'tss' }],
    };
    const i = plan.blocks.findIndex((b) => b.subject === 'Testarea sistemelor software');
    const r = applyAnswers(
      twin,
      {
        ...answers,
        attending: { TSS: false, Testarea: false },
        edits: { [i]: { subject: 'Testarea' } },
      },
      data,
      9,
      counter(),
    );
    expect(r.subjects.filter((s) => s.id === 'tss')).toHaveLength(1);
  });

  it('skips a block whose subject is empty', () => {
    const plan = planTimetableImport(uvt, empty(), 'Grupa 1', null);
    const r = applyAnswers(
      plan,
      { ...answers, edits: { 0: { subject: '  ' } } },
      empty(),
      1,
      counter(),
    );
    expect(r.patterns.some((p) => p.start === '08:00' && p.weekday === 1)).toBe(false);
    expect(r.subjects.some((s) => subjectKey(s.name) === '')).toBe(false);
  });
});
