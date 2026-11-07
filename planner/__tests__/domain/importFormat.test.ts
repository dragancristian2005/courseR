import { validateImport } from '../../src/domain/importFormat';
import type { ImportFile, TimetableImport, ExamImport } from '../../src/domain/importFormat';

const block = (over: Record<string, unknown> = {}) => ({
  day: 1,
  start: '11:20',
  end: '12:50',
  subject: 'TSS',
  type: 'seminar',
  room: '048',
  teacher: 'Mutescul A.',
  online: false,
  groups: ['Grupa 1', 'Grupa 2'],
  semigroup: null,
  weeks: 'every',
  choiceGroup: null,
  unsure: ['type'],
  ...over,
});

const timetable = (blocks: unknown[] = [block()], over: Record<string, unknown> = {}) => ({
  format: 'study-planner-import',
  version: 1,
  kind: 'timetable',
  title: 'Informatică anul 3, semestrul I 2026–2027',
  validFrom: '2026-10-08',
  groups: ['Grupa 1', 'Grupa 2'],
  semigroups: ['1', '2'],
  subjects: [{ abbreviation: 'TSS', name: 'Testarea sistemelor software' }],
  blocks,
  ...over,
});

const exam = (over: Record<string, unknown> = {}) => ({
  subject: 'ALED',
  subjectName: 'Algebră liniară și ecuații diferențiale',
  title: 'Exam',
  date: '2027-01-20',
  start: '09:00',
  room: 'A02',
  groups: ['all'],
  ...over,
});

const exams = (list: unknown[] = [exam()], over: Record<string, unknown> = {}) => ({
  format: 'study-planner-import',
  version: 1,
  kind: 'exams',
  groups: ['Grupa 1'],
  exams: list,
  ...over,
});

const err = (v: unknown) => {
  const r = validateImport(v);
  if (r.ok) throw new Error('expected failure');
  return r.error;
};
const okFile = (v: unknown): ImportFile => {
  const r = validateImport(v);
  if (!r.ok) throw new Error(r.error);
  return r.file;
};

describe('validateImport', () => {
  it('accepts the format example', () => {
    const f = okFile(timetable()) as TimetableImport;
    expect(f.kind).toBe('timetable');
    expect(f.blocks).toHaveLength(1);
    expect(f.blocks[0]).toEqual(block());
    expect(f.subjects).toEqual([{ abbreviation: 'TSS', name: 'Testarea sistemelor software' }]);
    expect(f.validFrom).toBe('2026-10-08');
  });

  it('accepts an exam import', () => {
    const f = okFile(exams()) as ExamImport;
    expect(f.kind).toBe('exams');
    expect(f.exams[0]).toEqual({ ...exam(), unsure: [] });
  });

  it('rejects non-objects and wrong or missing format', () => {
    const msg =
      'This isn’t a Study Planner import. Copy the whole JSON block from Claude’s answer.';
    for (const v of [
      null,
      5,
      'x',
      [],
      {},
      { ...timetable(), format: 'other' },
      { ...timetable(), format: undefined },
    ])
      expect(err(v)).toBe(msg);
  });

  it('rejects kinds other than timetable/exams with the same message', () => {
    expect(err(timetable([block()], { kind: 'homework' }))).toBe(
      'This isn’t a Study Planner import. Copy the whole JSON block from Claude’s answer.',
    );
  });

  it('rejects a newer version, and a missing/invalid one as not an import', () => {
    expect(err(timetable([block()], { version: 2 }))).toBe(
      'This import was made for a newer version of the app.',
    );
    expect(err(timetable([block()], { version: 'x' }))).toContain('isn’t a Study Planner import');
  });

  it('checks the day', () => {
    for (const d of [0, 8, 1.5, '1', null])
      expect(err(timetable([block(), block({ day: d })]))).toBe(
        'Block 2: the day must be 1 (Monday) to 7 (Sunday).',
      );
  });

  it('checks times', () => {
    expect(err(timetable([block({ start: '9:40' })]))).toBe(
      'Block 1: “9:40” isn’t a time like 09:40.',
    );
    expect(err(timetable([block({ end: 'late' })]))).toBe(
      'Block 1: “late” isn’t a time like 09:40.',
    );
    expect(err(timetable([block({ start: 940 })]))).toBe('Block 1: “940” isn’t a time like 09:40.');
  });

  it('requires end after start', () => {
    for (const end of ['11:20', '10:00'])
      expect(err(timetable([block({ end })]))).toBe('Block 1: the class must end after it starts.');
  });

  it('checks the type but accepts null', () => {
    expect(err(timetable([block({ type: 'exam' })]))).toBe(
      'Block 1: the type must be course, seminar, lab or empty.',
    );
    expect(
      (okFile(timetable([block({ type: null })])) as TimetableImport).blocks[0].type,
    ).toBeNull();
  });

  it('checks weeks', () => {
    expect(err(timetable([block({ weeks: 'all' })]))).toBe(
      'Block 1: weeks must be every, odd or even.',
    );
  });

  it('checks groups, accepting ["all"]', () => {
    for (const g of [[], undefined, 'Grupa 1', [1], ['']])
      expect(err(timetable([block({ groups: g })]))).toBe(
        'Block 1: it doesn’t say which groups it’s for.',
      );
    const f = okFile(timetable([block({ groups: ['all'] })])) as TimetableImport;
    expect(f.blocks[0].groups).toEqual(['all']);
  });

  it('rejects a block with no subject', () => {
    expect(err(timetable([block({ subject: '  ' })]))).toBe(
      'Block 1: it doesn’t say which subject it is.',
    );
  });

  it('reports the first problem in field order', () => {
    expect(err(timetable([block({ day: 9, start: 'x' })]))).toContain('day');
    expect(err(timetable([block({ start: 'x', type: 'bad' })]))).toContain('isn’t a time');
  });

  it('checks exam dates', () => {
    expect(err(exams([exam(), exam({ date: '2027-02-30' })]))).toBe(
      'Exam 2: “2027-02-30” isn’t a date like 2027-01-20.',
    );
    expect(err(exams([exam({ date: undefined })]))).toContain('Exam 1: ');
  });

  it('checks exam start time', () => {
    expect(err(exams([exam({ start: '9:00' })]))).toBe('Exam 1: “9:00” isn’t a time like 09:40.');
  });

  it('rejects empty imports', () => {
    expect(err(timetable([]))).toBe('The import has no classes.');
    expect(err(timetable(undefined as never, { blocks: 'x' }))).toBe('The import has no classes.');
    expect(err(exams([]))).toBe('The import has no exams.');
    expect(err(exams([], { exams: undefined }))).toBe('The import has no exams.');
  });

  it('ignores unknown fields and drops them from the result', () => {
    const f = okFile(
      timetable([block({ extra: 1 })], {
        evil: '__proto__',
        subjects: [{ abbreviation: 'TSS', name: 'T', x: 1 }],
      }),
    ) as unknown as Record<string, unknown>;
    expect(f.evil).toBeUndefined();
    expect((f.blocks as Record<string, unknown>[])[0].extra).toBeUndefined();
    expect((f.subjects as Record<string, unknown>[])[0].x).toBeUndefined();
  });

  it('defaults optional fields', () => {
    const f = okFile({
      format: 'study-planner-import',
      version: 1,
      kind: 'timetable',
      blocks: [
        {
          day: 2,
          start: '08:00',
          end: '09:30',
          subject: 'X',
          type: null,
          weeks: 'odd',
          groups: ['all'],
        },
      ],
    }) as TimetableImport;
    expect(f.title).toBeNull();
    expect(f.validFrom).toBeNull();
    expect(f.groups).toEqual([]);
    expect(f.semigroups).toEqual([]);
    expect(f.subjects).toEqual([]);
    expect(f.blocks[0]).toEqual({
      day: 2,
      start: '08:00',
      end: '09:30',
      subject: 'X',
      type: null,
      room: null,
      teacher: null,
      online: false,
      groups: ['all'],
      semigroup: null,
      weeks: 'odd',
      choiceGroup: null,
      unsure: [],
    });
  });

  it('defaults unsure to [] and drops unknown field names', () => {
    const b = (okFile(timetable([block({ unsure: undefined })])) as TimetableImport).blocks[0];
    expect(b.unsure).toEqual([]);
    const c = (
      okFile(timetable([block({ unsure: ['room', 'color', 5, 'weeks'] })])) as TimetableImport
    ).blocks[0];
    expect(c.unsure).toEqual(['room', 'weeks']);
    const d = (okFile(timetable([block({ unsure: 'room' })])) as TimetableImport).blocks[0];
    expect(d.unsure).toEqual([]);
  });

  it('trims strings and nulls empty optional ones', () => {
    const f = okFile(
      timetable(
        [
          block({
            subject: ' TSS ',
            room: '  ',
            teacher: ' A. ',
            semigroup: ' 1 ',
            groups: [' Grupa 1 '],
          }),
        ],
        {
          title: '  T  ',
        },
      ),
    ) as TimetableImport;
    expect(f.title).toBe('T');
    expect(f.blocks[0].subject).toBe('TSS');
    expect(f.blocks[0].room).toBeNull();
    expect(f.blocks[0].teacher).toBe('A.');
    expect(f.blocks[0].semigroup).toBe('1');
    expect(f.blocks[0].groups).toEqual(['Grupa 1']);
  });

  it('treats non-array subjects as empty and ignores malformed subject entries', () => {
    expect((okFile(timetable([block()], { subjects: 'x' })) as TimetableImport).subjects).toEqual(
      [],
    );
    expect(
      (
        okFile(
          timetable([block()], {
            subjects: [null, 3, { abbreviation: '', name: 'n' }, { abbreviation: 'A' }],
          }),
        ) as TimetableImport
      ).subjects,
    ).toEqual([{ abbreviation: 'A', name: 'A' }]);
  });

  it('rejects a non-object block with a block message', () => {
    expect(err(timetable([null]))).toBe('Block 1: the day must be 1 (Monday) to 7 (Sunday).');
  });

  it('defaults exam optional fields to null', () => {
    const f = okFile(
      exams([{ subject: 'ALED', date: '2027-01-20', groups: ['all'] }]),
    ) as ExamImport;
    expect(f.exams[0]).toEqual({
      subject: 'ALED',
      subjectName: null,
      title: null,
      date: '2027-01-20',
      start: null,
      room: null,
      groups: ['all'],
      unsure: [],
    });
  });

  it('keeps known exam unsure fields and drops the rest', () => {
    const f = okFile(
      exams([exam({ unsure: ['room', 'date', 'teacher', 'type', 7] })]),
    ) as ExamImport;
    expect(f.exams[0].unsure).toEqual(['room', 'date']);
  });

  it('rejects an exam with no subject or groups', () => {
    expect(err(exams([exam({ subject: '' })]))).toBe('Exam 1: it doesn’t say which subject it is.');
    expect(err(exams([exam({ groups: [] })]))).toBe(
      'Exam 1: it doesn’t say which groups it’s for.',
    );
  });
});
