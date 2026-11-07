# Study Planner, Phase 3 (Add to calendar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One tap exports the student's classes and exams as a `.ics` calendar file that Apple Calendar adds with "Add All" and Google Calendar can import, with no server.

**Architecture:** A pure RFC 5545 writer (`ics.ts`) and a pure builder (`calendarExport.ts`) that turns `PlannerData` into events using the existing `sessionsBetween` (so odd/even, breaks, moves, cancellations and hidden subjects are already applied). A small platform module hands the file to the browser; a Settings screen explains and triggers it.

**Tech Stack:** Existing app stack. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-02-study-planner-design.md` (section "Calendar publishing (one-way)", decision of 2026-11-07)

## Global Constraints

- All Phase 1/2 Global Constraints apply (dates `YYYY-MM-DD`, times `HH:MM`, theme tokens, sentence case, typographic ’, touch targets ≥ 44px, Prettier config).
- No network calls; the file is built on the device.
- Times are local Europe/Bucharest wall-clock times written with `TZID=Europe/Bucharest` and a matching `VTIMEZONE` (EET/EEST: +02:00 standard, +03:00 daylight; daylight from the last Sunday of March at 03:00 local, standard from the last Sunday of October at 04:00 local).
- Lines end with CRLF and are folded at 75 octets (UTF-8 aware, continuation lines start with one space); text values escape `\\`, `;`, `,` and newlines (`\n`).
- Only attended subjects; tombstoned records never appear.
- Each event has a stable `UID` so a re-import into the same calendar can update instead of duplicating where the calendar app supports it.

## Review Focus

1. A class at 08:00 on 26 Oct 2026 (the day after the clock change) is written as `DTSTART;TZID=Europe/Bucharest:20261026T080000`. Test in Task 1/2.
2. An odd-weeks class appears only in odd weeks, a break week has no classes, a moved session appears at its new time, a cancelled one is missing. Test in Task 2.
3. Romanian characters (ș, ț, ă, î, â) survive and line folding never splits a multi-byte character. Test in Task 1.
4. An exam with no start time is an all-day event (`DTSTART;VALUE=DATE:`); one with a start lasts 2 hours. Test in Task 2.
5. No semester / no classes and no exams → the screen explains instead of producing an empty file. Test in Task 3.

---

## File structure

```
planner/src/domain/ics.ts             escapeText, foldLine, buildCalendar
planner/src/domain/calendarExport.ts  calendarEvents, exportCalendar
planner/src/data/calendarFile.ts      saveCalendarFile (web download / native stub)
planner/app/settings/calendar.tsx     "Add to calendar" screen
planner/__tests__/domain/ics.test.ts, calendarExport.test.ts, __tests__/app/calendar.test.tsx
```

### Task 1: ICS writer

**Files:** Create `planner/src/domain/ics.ts`; Test `planner/__tests__/domain/ics.test.ts`

**Interfaces:**
- `type IcsEvent = { uid: string; summary: string; location?: string; description?: string } & ({ kind: 'timed'; date: ISODate; start: HHMM; end: HHMM } | { kind: 'allDay'; date: ISODate })`
- `escapeText(s: string): string`, `foldLine(line: string): string` (returns the folded line joined with `\r\n `), `buildCalendar(events: IcsEvent[], opts: { name: string; now: Date }): string`.
- Output: `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//Study Planner//EN`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, `X-WR-CALNAME:{name}`, `X-WR-TIMEZONE:Europe/Bucharest`, the `VTIMEZONE` block, then one `VEVENT` per event with `UID`, `DTSTAMP` (UTC `YYYYMMDDTHHMMSSZ` from `now`), `DTSTART`/`DTEND` (timed: `;TZID=Europe/Bucharest:YYYYMMDDTHHMMSS`; all-day: `;VALUE=DATE:YYYYMMDD` and `DTEND` the next day), `SUMMARY`, optional `LOCATION`, `DESCRIPTION`; `END:VCALENDAR`. CRLF throughout, final CRLF.

- [ ] **Step 1: Write failing tests:** escaping of `\`, `;`, `,`, newline; folding a 200-char ASCII line into ≤75-octet lines; folding a line of `ș` characters never splits a character (each physical line is valid UTF-8 and ≤75 octets); one timed event (Review Focus 1 value), one all-day event with DTEND next day (31 Dec → 1 Jan); VTIMEZONE contains `TZID:Europe/Bucharest`, `TZOFFSETFROM:+0200`/`TZOFFSETTO:+0300` with `RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU` and the reverse for October; every line ends with CRLF.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(planner): ics calendar writer`.

### Task 2: Calendar export builder

**Files:** Create `planner/src/domain/calendarExport.ts`; Test `planner/__tests__/domain/calendarExport.test.ts`

**Interfaces:**
- Consumes `sessionsBetween`, `buildCalendar`, `TYPE_LABEL` (move/import from where it lives; domain must not import ui — if `TYPE_LABEL` is in ui, add an equivalent in domain).
- `calendarEvents(data: PlannerData, from: ISODate, opts: { classes: boolean; exams: boolean }): IcsEvent[]` — classes: `sessionsBetween(data, from, semester.lastDay)` (none without a semester); summary `{subject name} ({type label lower-case})`, e.g. `Testarea sistemelor software (seminar)`; location room or `Online`; description lines `Teacher: {teacher}` (if any) and `Moved this week` for moved sessions; uid `{session.id with ':' replaced by '-'}@study-planner`. Exams: live exams with `date >= from`; summary `{subject name}: {title}` or `{title}` when unlinked; timed 2 h when `start` exists, else all-day; location room if any; uid `exam-{id}@study-planner`. Sorted by date then start.
- `exportCalendar(data, from, opts, now: Date): { ics: string; count: number }` with calendar name `Study Planner`.

- [ ] **Step 1: Write failing tests** (Review Focus 2 and 4, reuse the Phase 1 semester fixture style): odd-weeks class only in odd weeks; break week empty; moved session at new time with "Moved this week"; cancelled absent; switched-off subject absent; tombstoned exam absent; past exam (before `from`) absent; exam all-day vs timed 2 h; classes-only and exams-only options; no semester → classes empty but exams still exported; `count` equals events.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(planner): build calendar export from the planner`.

### Task 3: Add to calendar screen

**Files:** Create `planner/src/data/calendarFile.ts`, `planner/app/settings/calendar.tsx`; Modify `planner/app/settings/index.tsx` (row "Add to calendar" after Exams), `planner/README.md` (short "Add to your calendar" section after the import section); Test `planner/__tests__/app/calendar.test.tsx`

- `saveCalendarFile(ics: string, filename: string): Promise<'shared' | 'downloaded' | 'unsupported'>` — web: if `navigator.canShare?.({ files: [file] })` use `navigator.share({ files: [new File([ics], filename, { type: 'text/calendar' })], title: 'Study Planner' })` → 'shared' (iOS share sheet offers Calendar / Files); else Blob + temporary `<a download>` → 'downloaded' (revoke URL after 1 s). Native: `'unsupported'` for now (Phase 4 writes to the calendar directly). Cancelled share (AbortError) → resolves 'shared' without error message.
- Screen "Add to calendar": body "Adds your classes from this week to the end of the semester, and your upcoming exams, to your phone’s calendar. It’s a copy: if your timetable changes, add it again." Checkboxes "Classes" and "Exams" (both on). Primary button "Add to calendar" (filename `study-planner.ics`). After success: "Done. In Apple Calendar, tap Add All. To avoid duplicates next time, delete the “Study Planner” calendar first." For Google: a short paragraph "Google Calendar: open calendar.google.com on a computer, Settings → Import, and choose the downloaded study-planner.ics." Empty: nothing to export (no semester+classes and no upcoming exams, or both boxes off) → button disabled with "Nothing to add yet. Set up your semester and classes, or add an exam." `unsupported` → "On this device, use the web app to export your calendar for now." Errors → "Couldn’t create the calendar file. Try again."
- README: 3–4 sentences matching the screen.

- [ ] **Step 1: Write failing tests:** Settings row navigates; button calls `saveCalendarFile` with an ics containing the expected class and exam (mock module); checkbox off removes exams; empty state copy and disabled button (Review Focus 5); success message; unsupported and error messages.
- [ ] **Step 2–4:** FAIL → implement → PASS; full suite, `npx tsc --noEmit`, `npm run format:check`, `npx expo export -p web`.
- [ ] **Step 5: Commit** `feat(planner): add to calendar`.
- [ ] **Step 6 (user, manual):** on iPhone (Safari and the installed app) tap Add to calendar → Calendar → Add All; check odd/even weeks, times after the October clock change and exam times; import the file in Google Calendar on a computer.
