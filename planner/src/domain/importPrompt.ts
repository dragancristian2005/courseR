import type { ExamImport, ImportFile, TimetableImport } from './importFormat';

export const TIMETABLE_EXAMPLE: TimetableImport = {
  format: 'study-planner-import',
  version: 1,
  kind: 'timetable',
  title: 'Informatică anul 3, semestrul I 2026–2027',
  validFrom: '2026-10-08',
  groups: ['Grupa 1', 'Grupa 2', 'Grupa 7'],
  semigroups: ['1', '2'],
  subjects: [
    { abbreviation: 'TSS', name: 'Testarea sistemelor software' },
    { abbreviation: 'Chimie', name: 'Chimie' },
    { abbreviation: 'Fizica', name: 'Fizica' },
  ],
  blocks: [
    {
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
    },
    {
      day: 3,
      start: '10:00',
      end: '12:00',
      subject: 'Chimie',
      type: 'lab',
      room: 'L1',
      teacher: null,
      online: false,
      groups: ['Grupa 7'],
      semigroup: '1',
      weeks: 'odd',
      choiceGroup: null,
      unsure: [],
    },
    {
      day: 3,
      start: '10:00',
      end: '12:00',
      subject: 'Fizica',
      type: 'lab',
      room: 'L2',
      teacher: null,
      online: false,
      groups: ['Grupa 7'],
      semigroup: '1',
      weeks: 'even',
      choiceGroup: null,
      unsure: [],
    },
  ],
};

export const EXAMS_EXAMPLE: ExamImport = {
  format: 'study-planner-import',
  version: 1,
  kind: 'exams',
  groups: ['Grupa 1', 'Grupa 2'],
  exams: [
    {
      subject: 'ALED',
      subjectName: 'Algebră liniară și ecuații diferențiale',
      title: 'Exam',
      date: '2027-01-20',
      start: '09:00',
      room: 'A02',
      groups: ['all'],
      unsure: [],
    },
    {
      subject: 'TSS',
      subjectName: null,
      title: 'Proiect',
      date: '2027-01-25',
      start: null,
      room: null,
      groups: ['Grupa 1'],
      unsure: ['room'],
    },
  ],
};

export const PROMPT_FIRST_LINE_TIMETABLE =
  'You are helping me import my university timetable into my study planner app.';
export const PROMPT_FIRST_LINE_EXAMS =
  'You are helping me import my university exam schedule into my study planner app.';

const LAST_LINE = 'Answer with the JSON block only.';

const TIMETABLE_INTRO = `${PROMPT_FIRST_LINE_TIMETABLE}
The attached photo or PDF is the official timetable for my year. Read ALL of it, for every group, and answer with ONE JSON block and nothing else.`;

const TIMETABLE_RULES = `Rules:
- Use exactly the format shown below ("format": "study-planner-import", "version": 1, "kind": "timetable").
- One entry in "blocks" per class on the sheet. "day" is 1 for Monday up to 7 for Sunday. Times are 24-hour "HH:MM", e.g. "08:00", "09:40".
- "groups" lists the group column headers the block covers, written exactly as on the sheet (e.g. "Grupa 1"). If a block spans every group, use ["all"].
- At the top level, "groups" lists every group column header on the sheet, and "semigroups" lists every semigroup label (e.g. ["1", "2"]), or [] if there are none.
- If groups are split into semigroups (e.g. "semigrupa 1"), put the semigroup in "semigroup"; otherwise null. Write just the semigroup's label, e.g. "1".
- A cell split by a diagonal line holds two classes that alternate weekly: the TOP-LEFT half is ODD weeks ("weeks": "odd"), the BOTTOM-RIGHT half is EVEN weeks ("weeks": "even"). Make two blocks. Otherwise "weeks": "every".
- "type": "course" for lectures (marked curs, (C), (CO) or written in full across groups), "seminar" for (S), "lab" for (L). If the sheet doesn't say, use null and add "type" to "unsure".
- Use the abbreviation as "subject" when the sheet uses one, and list every abbreviation with its full name in "subjects" (match abbreviations to full course names on the sheet; ignore accents and Romanian letters when matching, e.g. ȘP = SP). If no full name is shown, repeat the abbreviation.
- Several alternative classes in the same slot (optional courses), or the same subject offered at different times where a student attends only one: give them the same short "choiceGroup" id, e.g. "opt-mon-13". Otherwise null.
- "online": true when the room says online.
- If you can't read something confidently, still give your best guess and list the field name in "unsure" (one of: subject, type, room, teacher, start, end, weeks).
- If the sheet shows a "valid from" date, put it in "validFrom" as "YYYY-MM-DD"; otherwise null.
- Don't invent classes that aren't on the sheet.`;

const EXAMS_INTRO = `${PROMPT_FIRST_LINE_EXAMS}
The attached photo or PDF is the official exam schedule for my year. Read ALL of it, for every group, and answer with ONE JSON block and nothing else.`;

const EXAMS_RULES = `Rules:
- Use exactly the format shown below ("format": "study-planner-import", "version": 1, "kind": "exams").
- One entry in "exams" per exam on the sheet.
- Dates are "YYYY-MM-DD". Use the academic year shown on the sheet: for "2026–2027", exams in September–December are in 2026 and exams in January–August are in 2027.
- "start" is the start time as 24-hour "HH:MM", or null if the sheet doesn't give one.
- "groups" lists the group column headers the exam covers, written exactly as on the sheet (e.g. "Grupa 1"). If an exam is for every group, use ["all"]. The top-level "groups" lists every group on the sheet.
- "subject" is the abbreviation or name exactly as on the sheet. Put the full course name in "subjectName" if the sheet shows it; otherwise null.
- "title" is "Exam" unless the sheet says something else, such as "Colocviu" or "Proiect".
- "room" is the room as written on the sheet, or null.
- If you can't read something confidently, still give your best guess and list the field name in "unsure" (one of: subject, date, start, room).
- Don't invent exams that aren't on the sheet.`;

const fence = (value: unknown): string => '```json\n' + JSON.stringify(value, null, 2) + '\n```';

export function buildPrompt(kind: 'timetable' | 'exams'): string {
  const [intro, rules, example] =
    kind === 'timetable'
      ? [TIMETABLE_INTRO, TIMETABLE_RULES, TIMETABLE_EXAMPLE]
      : [EXAMS_INTRO, EXAMS_RULES, EXAMS_EXAMPLE];
  return `${intro}\n\n${rules}\n\nFormat example:\n${fence(example)}\n${LAST_LINE}`;
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

/** True when a parsed file is exactly the worked example from the prompt, not a real answer. */
export function isPromptExample(file: ImportFile): boolean {
  const example = file.kind === 'timetable' ? TIMETABLE_EXAMPLE : EXAMS_EXAMPLE;
  return canonical(file) === canonical(example);
}
