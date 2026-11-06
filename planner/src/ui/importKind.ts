export type ImportKind = 'timetable' | 'exams';

/** Anything other than "exams" is treated as a timetable import. */
export function toKind(param: string | string[] | undefined): ImportKind {
  return param === 'exams' ? 'exams' : 'timetable';
}
