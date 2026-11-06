import { validateImport } from '../../src/domain/importFormat';
import {
  EXAMS_EXAMPLE,
  PROMPT_FIRST_LINE_EXAMS,
  PROMPT_FIRST_LINE_TIMETABLE,
  TIMETABLE_EXAMPLE,
  buildPrompt,
} from '../../src/domain/importPrompt';
import { parseImport } from '../../src/domain/importParse';

const KINDS = ['timetable', 'exams'] as const;
const LAST_LINE = 'Answer with the JSON block only.';

describe('buildPrompt', () => {
  it.each(KINDS)('%s prompt has the key rules and its own kind', (kind) => {
    const p = buildPrompt(kind);
    if (kind === 'timetable') expect(p).toContain('TOP-LEFT half is ODD');
    expect(p).toContain('"version": 1');
    expect(p).toContain(`"kind": "${kind}"`);
  });

  it('lists the allowed unsure names', () => {
    expect(buildPrompt('timetable')).toContain(
      '(one of: subject, type, room, teacher, start, end, weeks)',
    );
    expect(buildPrompt('exams')).toContain('(one of: subject, date, start, room)');
  });

  it('spells out the top-level groups and the exam year rule', () => {
    expect(buildPrompt('timetable')).toContain('"semigroups" lists every semigroup label');
    expect(buildPrompt('exams')).toContain('exams in January–August are in 2027');
  });

  it.each(KINDS)('%s prompt round-trips through parseImport', (kind) => {
    const r = parseImport(buildPrompt(kind));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file.kind).toBe(kind);
  });

  it('starts with the exported first lines', () => {
    expect(buildPrompt('timetable').split('\n')[0]).toBe(PROMPT_FIRST_LINE_TIMETABLE);
    expect(buildPrompt('exams').split('\n')[0]).toBe(PROMPT_FIRST_LINE_EXAMS);
    expect(PROMPT_FIRST_LINE_EXAMS).toBe(
      'You are helping me import my university exam schedule into my study planner app.',
    );
  });

  it.each(KINDS)('%s prompt has no tabs and ends with the last line', (kind) => {
    const p = buildPrompt(kind);
    expect(p).not.toContain('\t');
    expect(p.endsWith(`\`\`\`\n${LAST_LINE}`)).toBe(true);
  });
});

describe('examples', () => {
  it('both validate', () => {
    expect(validateImport(TIMETABLE_EXAMPLE).ok).toBe(true);
    expect(validateImport(EXAMS_EXAMPLE).ok).toBe(true);
  });

  it('timetable example has one odd and one even block and lists their subjects', () => {
    const weeks = TIMETABLE_EXAMPLE.blocks.map((b) => b.weeks);
    expect(weeks.filter((w) => w === 'odd')).toHaveLength(1);
    expect(weeks.filter((w) => w === 'even')).toHaveLength(1);
    const abbrs = TIMETABLE_EXAMPLE.subjects.map((s) => s.abbreviation);
    for (const b of TIMETABLE_EXAMPLE.blocks) expect(abbrs).toContain(b.subject);
  });

  it('exams example has two exams', () => {
    expect(EXAMS_EXAMPLE.exams).toHaveLength(2);
    expect(EXAMS_EXAMPLE.exams.map((e) => e.unsure)).toEqual([[], ['room']]);
  });
});
