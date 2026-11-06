import type { ExamImport } from './importFormat';
import { matchesGroup, subjectKey } from './importPlan';
import type { Exam, PlannerData, Subject } from './types';

function findSubject(data: PlannerData, abbreviation: string, name: string): Subject | null {
  const live = data.subjects.filter((s) => !s.deleted);
  const ak = subjectKey(abbreviation);
  const nk = subjectKey(name);
  return (
    live.find((s) => subjectKey(s.abbreviation) === ak) ??
    live.find((s) => subjectKey(s.name) === nk) ??
    null
  );
}

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
