import { isDate, isTime, timeToMinutes } from './dates';
import type { ClassType, HHMM, ISODate, Repeat } from './types';

/** Field names Claude may flag as hard to read. */
export type UnsureField = 'subject' | 'type' | 'room' | 'teacher' | 'start' | 'end' | 'weeks';

const UNSURE_FIELDS: readonly UnsureField[] = [
  'subject',
  'type',
  'room',
  'teacher',
  'start',
  'end',
  'weeks',
];

/** Exam field names Claude may flag as hard to read. */
export type ExamUnsureField = 'subject' | 'date' | 'start' | 'room';

const EXAM_UNSURE_FIELDS: readonly ExamUnsureField[] = ['subject', 'date', 'start', 'room'];

export interface ImportSubject {
  abbreviation: string;
  name: string;
}

export interface ImportBlock {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  start: HHMM;
  end: HHMM;
  /** Abbreviation as written on the sheet. */
  subject: string;
  type: ClassType | null;
  room: string | null;
  teacher: string | null;
  online: boolean;
  /** Group labels, or ['all']. */
  groups: string[];
  semigroup: string | null;
  weeks: Repeat;
  choiceGroup: string | null;
  unsure: UnsureField[];
}

export interface TimetableImport {
  format: 'study-planner-import';
  version: 1;
  kind: 'timetable';
  title: string | null;
  validFrom: ISODate | null;
  groups: string[];
  semigroups: string[];
  subjects: ImportSubject[];
  blocks: ImportBlock[];
}

export interface ImportExam {
  subject: string;
  subjectName: string | null;
  title: string | null;
  date: ISODate;
  start: HHMM | null;
  room: string | null;
  groups: string[];
  unsure: ExamUnsureField[];
}

export interface ExamImport {
  format: 'study-planner-import';
  version: 1;
  kind: 'exams';
  groups: string[];
  exams: ImportExam[];
}

export type ImportFile = TimetableImport | ExamImport;

export type ImportResult = { ok: true; file: ImportFile } | { ok: false; error: string };

const NOT_AN_IMPORT =
  'This isn’t a Study Planner import. Copy the whole JSON block from Claude’s answer.';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Trimmed string, or null when absent, not a string or empty. */
function optStr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

/** Non-empty trimmed strings only; anything else is dropped. */
function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = optStr(x);
    if (s !== null) out.push(s);
  }
  return out;
}

/** Like strList, but null when the input is not a list of only non-empty strings. */
function requiredGroups(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out = strList(v);
  return out.length === v.length ? out : null;
}

const MAX_SHOWN = 40;

/** A value echoed in an error message: at most 40 characters, then an ellipsis. */
const show = (v: unknown): string => {
  const text = v === undefined || v === null ? '' : typeof v === 'string' ? v : String(v);
  const chars = Array.from(text);
  return chars.length > MAX_SHOWN ? `${chars.slice(0, MAX_SHOWN).join('')}…` : text;
};

function readSubjects(v: unknown): ImportSubject[] {
  if (!Array.isArray(v)) return [];
  const out: ImportSubject[] = [];
  for (const s of v) {
    if (!isRec(s)) continue;
    const abbreviation = optStr(s.abbreviation);
    if (abbreviation === null) continue;
    out.push({ abbreviation, name: optStr(s.name) ?? abbreviation });
  }
  return out;
}

function readBlock(raw: unknown, n: number): ImportBlock | string {
  const b: Rec = isRec(raw) ? raw : {};
  const label = `Block ${n}`;
  const day = b.day;
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 7)
    return `${label}: the day must be 1 (Monday) to 7 (Sunday).`;
  for (const key of ['start', 'end'] as const) {
    const t = b[key];
    if (typeof t !== 'string' || !isTime(t))
      return `${label}: “${show(t)}” isn’t a time like 09:40.`;
  }
  const start = b.start as string;
  const end = b.end as string;
  if (timeToMinutes(end) <= timeToMinutes(start))
    return `${label}: the class must end after it starts.`;
  const subject = optStr(b.subject);
  if (subject === null) return `${label}: it doesn’t say which subject it is.`;
  const type = b.type;
  if (type !== null && type !== 'course' && type !== 'seminar' && type !== 'lab')
    return `${label}: the type must be course, seminar, lab or empty.`;
  const weeks = b.weeks;
  if (weeks !== 'every' && weeks !== 'odd' && weeks !== 'even')
    return `${label}: weeks must be every, odd or even.`;
  const groups = requiredGroups(b.groups);
  if (groups === null) return `${label}: it doesn’t say which groups it’s for.`;
  const unsure = strList(b.unsure).filter((f): f is UnsureField =>
    (UNSURE_FIELDS as readonly string[]).includes(f),
  );
  return {
    day: day as ImportBlock['day'],
    start,
    end,
    subject,
    type,
    room: optStr(b.room),
    teacher: optStr(b.teacher),
    online: b.online === true,
    groups,
    semigroup: optStr(b.semigroup),
    weeks,
    choiceGroup: optStr(b.choiceGroup),
    unsure,
  };
}

function readExam(raw: unknown, n: number): ImportExam | string {
  const e: Rec = isRec(raw) ? raw : {};
  const label = `Exam ${n}`;
  const subject = optStr(e.subject);
  if (subject === null) return `${label}: it doesn’t say which subject it is.`;
  if (typeof e.date !== 'string' || !isDate(e.date))
    return `${label}: “${show(e.date)}” isn’t a date like 2027-01-20.`;
  let start: string | null = null;
  if (e.start !== null && e.start !== undefined) {
    if (typeof e.start !== 'string' || !isTime(e.start))
      return `${label}: “${show(e.start)}” isn’t a time like 09:40.`;
    start = e.start;
  }
  const groups = requiredGroups(e.groups);
  if (groups === null) return `${label}: it doesn’t say which groups it’s for.`;
  const unsure = strList(e.unsure).filter((f): f is ExamUnsureField =>
    (EXAM_UNSURE_FIELDS as readonly string[]).includes(f),
  );
  return {
    subject,
    subjectName: optStr(e.subjectName),
    title: optStr(e.title),
    date: e.date,
    start,
    room: optStr(e.room),
    groups,
    unsure,
  };
}

/**
 * Validate an untrusted, already-parsed value. Returns a normalized import
 * (defaults filled, unknown fields dropped, strings trimmed) or the first problem.
 */
export function validateImport(value: unknown): ImportResult {
  if (!isRec(value) || value.format !== 'study-planner-import') return fail(NOT_AN_IMPORT);
  const version = value.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    return fail(NOT_AN_IMPORT);
  if (version > 1) return fail('This import was made for a newer version of the app.');
  const kind = value.kind;
  if (kind !== 'timetable' && kind !== 'exams') return fail(NOT_AN_IMPORT);

  if (kind === 'timetable') {
    const rawBlocks = Array.isArray(value.blocks) ? value.blocks : [];
    const blocks: ImportBlock[] = [];
    for (let i = 0; i < rawBlocks.length; i++) {
      const b = readBlock(rawBlocks[i], i + 1);
      if (typeof b === 'string') return fail(b);
      blocks.push(b);
    }
    if (blocks.length === 0) return fail('The import has no classes.');
    const validFrom = optStr(value.validFrom);
    return {
      ok: true,
      file: {
        format: 'study-planner-import',
        version: 1,
        kind: 'timetable',
        title: optStr(value.title),
        validFrom: validFrom !== null && isDate(validFrom) ? validFrom : null,
        groups: strList(value.groups),
        semigroups: strList(value.semigroups),
        subjects: readSubjects(value.subjects),
        blocks,
      },
    };
  }

  const rawExams = Array.isArray(value.exams) ? value.exams : [];
  const exams: ImportExam[] = [];
  for (let i = 0; i < rawExams.length; i++) {
    const e = readExam(rawExams[i], i + 1);
    if (typeof e === 'string') return fail(e);
    exams.push(e);
  }
  if (exams.length === 0) return fail('The import has no exams.');
  return {
    ok: true,
    file: {
      format: 'study-planner-import',
      version: 1,
      kind: 'exams',
      groups: strList(value.groups),
      exams,
    },
  };
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
