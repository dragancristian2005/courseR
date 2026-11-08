export type ISODate = string; // YYYY-MM-DD, local date
export type HHMM = string; // HH:MM, local time (Europe/Bucharest)

export type ClassType = 'course' | 'seminar' | 'lab';
export type Parity = 'odd' | 'even';
export type Repeat = 'every' | Parity;

export interface Base {
  id: string;
  updatedAt: number;
  deleted?: boolean;
}

export interface Semester extends Base {
  name: string;
  firstDay: ISODate;
  lastDay: ISODate;
  breaks: { from: ISODate; to: ISODate }[];
  /** key = teaching week number */
  parityOverrides: Record<number, Parity>;
}

export interface Subject extends Base {
  name: string;
  abbreviation: string;
  attending: boolean;
}

export interface ClassPattern extends Base {
  subjectId: string;
  type: ClassType;
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  start: HHMM;
  end: HHMM;
  room: string;
  teacher: string;
  repeat: Repeat;
  validFrom: ISODate;
  validTo: ISODate | null;
  online: boolean;
  /** Where the pattern came from; absent = manual. */
  source?: 'import' | 'manual';
}

export interface SessionOverride extends Base {
  sessionId: string;
  kind: 'moved' | 'cancelled';
  date?: ISODate;
  start?: HHMM;
  end?: HHMM;
  room?: string;
}

/** Derived, never stored. id = `${patternId}:${originalDate}`. */
export interface Session {
  id: string;
  patternId: string;
  subjectId: string;
  type: ClassType;
  date: ISODate;
  start: HHMM;
  end: HHMM;
  room: string;
  teacher: string;
  online: boolean;
  moved: boolean;
}

export interface Exam extends Base {
  subjectId: string | null;
  title: string;
  date: ISODate;
  start: HHMM | null;
  room: string;
}

export interface Homework extends Base {
  title: string;
  subjectId: string | null;
  due: ISODate | null;
  dueTime: HHMM | null;
  done: boolean;
  /** Set on homework imported from Google Classroom. */
  source?: 'classroom';
  /** Classroom identifier of the coursework this homework was imported from. */
  externalId?: string;
  /** What Classroom said at the last import; used to detect the student's own edits. */
  imported?: { title: string; due: ISODate | null; dueTime: HHMM | null };
}

/** A Classroom course; `id` is the Classroom course id. `subjectId: null` means "Don't import". */
export interface ClassroomCourse extends Base {
  name: string;
  subjectId: string | null;
}

export interface Note extends Base {
  text: string;
  subjectId: string | null;
  sessionId: string | null;
  createdAt: number;
}

export interface Link extends Base {
  title: string;
  url: string;
  subjectId: string | null;
}

export interface PlannerData {
  semester: Semester | null;
  subjects: Subject[];
  patterns: ClassPattern[];
  overrides: SessionOverride[];
  exams: Exam[];
  homework: Homework[];
  notes: Note[];
  links: Link[];
  classroomCourses: ClassroomCourse[];
}
