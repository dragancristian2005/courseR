import type { ExamImport } from './importFormat';
import { findSubject, fold, matchesGroup, RANGE, uniqueByFold } from './importPlan';
import type { Exam, PlannerData } from './types';

/**
 * Exams from the file that apply to the chosen group, ready to save. Exams already in the
 * planner (same subject, date and start) are skipped and counted. `unsure` maps a new exam's id
 * to the fields Claude flagged, for the review screen.
 */
export function planExamImport(
  file: ExamImport,
  data: PlannerData,
  group: string,
  now: number,
  newId: () => string,
): { exams: Exam[]; skipped: number; unsure: Record<string, string[]> } {
  const live = data.exams.filter((e) => !e.deleted);
  const exams: Exam[] = [];
  const unsure: Record<string, string[]> = {};
  let skipped = 0;

  for (const e of file.exams) {
    if (!matchesGroup(e.groups, group)) continue;
    const subject = findSubject(data, e.subject, e.subjectName ?? e.subject);
    const base = e.title ?? 'Exam';
    const title = subject === null ? `${e.subjectName ?? e.subject}: ${base}` : base;
    const subjectId = subject?.id ?? null;
    const taken = (x: Exam) =>
      x.subjectId === subjectId &&
      x.date === e.date &&
      x.start === e.start &&
      (subjectId !== null || x.title === title);
    if (live.some(taken) || exams.some(taken)) {
      skipped++;
      continue;
    }
    const exam: Exam = {
      id: newId(),
      updatedAt: now,
      subjectId,
      title,
      date: e.date,
      start: e.start,
      room: e.room ?? '',
    };
    exams.push(exam);
    if (e.unsure.length > 0) unsure[exam.id] = [...e.unsure];
  }
  return { exams, skipped, unsure };
}

/** Group labels to offer for an exams file: its list, else those seen in the exams. */
export function examGroupOptions(file: ExamImport): string[] {
  return file.groups.length > 0
    ? uniqueByFold(file.groups)
    : uniqueByFold(
        file.exams.flatMap((e) => e.groups).filter((g) => fold(g) !== 'all' && !RANGE.test(g)),
      );
}
