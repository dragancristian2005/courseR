# Study Planner, Phase 6 (Google Classroom import) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the student's Google Classroom assignments as homework (linked to planner subjects, turned-in ones done, no duplicates on re-import), reviewed before saving, with no server.

**Architecture:** The browser asks Google for read-only Classroom access through Firebase Auth (popup in a tab, redirect in the installed app) and calls the Classroom REST API directly (the spike on this branch proved the UVT account allows it). Pure domain code decides what to import and how; one screen walks through linking courses to subjects and reviewing. Course links are stored as a new synced collection.

**Tech Stack:** Existing app stack; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-02-study-planner-design.md` (section "Google Classroom import", decided 2026-11-08)

## Global Constraints

- All earlier Global Constraints apply (dates `YYYY-MM-DD`, times `HH:MM`, LWW by `updatedAt` with `stamp()` for edits of existing records, tombstones only, theme tokens, sentence case, typographic ’, touch targets ≥ 44px, Prettier).
- Scopes exactly: `https://www.googleapis.com/auth/classroom.courses.readonly`, `https://www.googleapis.com/auth/classroom.coursework.me.readonly`. Read-only; the access token is kept in memory only, never stored.
- What is imported from each PUBLISHED assignment of each ACTIVE course linked to a subject: no due date → imported; due today or later → imported; due before today and not turned in → imported (shows as Overdue); due before today and turned in → skipped.
- Turned in = the student's submission state is `TURNED_IN` or `RETURNED` → `done: true`.
- Classroom `dueDate`/`dueTime` are UTC; convert to Europe/Bucharest local date and time. `dueDate` without `dueTime` → that date, `dueTime: null`.
- Nothing is saved before "Save homework". Typed homework (no `source`) is never changed.
- Re-import never creates a duplicate: homework is matched by `source: 'classroom'` + `externalId` (the courseWork id).

## Review Focus

1. An assignment due 2026-11-12 23:59 UTC appears as due 2026-11-13 01:59 Bucharest time (winter, +2); one due 2026-06-30 22:00 UTC appears as 2026-07-01 01:00 (summer, +3). Test in Task 4.
2. Re-import of unchanged Classroom data → nothing to save ("Everything from Classroom is already in your homework."). Test in Task 4/5.
3. A homework the student edited after import (title, due or due time differ from what was imported) and that Classroom has also changed → a question, not a silent overwrite. Test in Task 4.
4. Homework without a due date shows in its own "No due date" section, never on Today, never "Overdue". Test in Task 1.
5. The installed iPhone app (standalone) gets the token through the redirect flow and lands back on the import screen with the token. Test in Task 3 (mocked).

---

## File structure

```
planner/src/domain/types.ts            Homework.due nullable; Homework source/externalId/imported; ClassroomCourse; PlannerData.classroomCourses
planner/src/domain/selectors.ts        homeworkGroups: noDue group; dueLabel(null)
planner/src/domain/classroomImport.ts  planClassroomImport()
planner/src/data/classroom.ts          getClassroomToken(), fetchClassroom()
planner/src/data/auth.ts               keep the access token from a redirect result
planner/app/classroom/index.tsx        connect → link courses → review → save
planner/app/dev/classroom.tsx          (spike, deleted in Task 5)
```

### Task 1: Homework without a due date

**Files:** Modify `src/domain/types.ts` (`Homework.due: ISODate | null`), `src/domain/selectors.ts`, `src/ui/HomeworkRow.tsx`, `src/ui/ClassDetail.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/homework.tsx`, `app/homework/edit.tsx`, `src/domain/backup.ts` (accept `due: null`); Tests in the matching `__tests__` files.

- `homeworkGroups(data, today)` returns `{ thisWeek, later, noDue, done }`: `noDue` = open homework with `due === null`, sorted by title; `thisWeek`/`later` only dated ones (unchanged rules); `done` sorted by due descending with null last.
- `dueLabel(due: ISODate | null, today)`: null → `''`. HomeworkRow shows no due text when the label is empty.
- Homework tab: section "No due date" after "Later" (only when non-empty). Today: unchanged (only `thisWeek`). ClassDetail homework list: undated after dated.
- Homework form: "Due date" becomes optional (empty → null); "Due time" only allowed when a date is set ("Add a due date first."). Validation messages unchanged otherwise.
- Backup: a homework record with `due: null` is valid.

- [ ] **Step 1: Write failing tests** (Review Focus 4): noDue grouping; dueLabel(null); tab section; Today excludes undated; form saves `due: null`; due time without date error; backup round-trip with null due.
- [ ] **Step 2–4:** FAIL → implement → PASS; full suite + tsc.
- [ ] **Step 5: Commit** `feat(planner): homework without a due date`.

### Task 2: Classroom records in the data model

**Files:** Modify `src/domain/types.ts`, `src/data/repository.ts` (`Collection` adds `'classroomCourses'`, `emptyPlannerData`), `src/data/memoryRepository.ts`, `src/data/firestoreRepository.ts` (COLLECTIONS), `src/domain/backup.ts` (validate the new collection; missing in an old backup → `[]`); Tests accordingly.

- `ClassroomCourse extends Base { name: string; subjectId: string | null }` — `id` is the Classroom course id; `subjectId: null` means "Don't import".
- `Homework` gains optional `source?: 'classroom'`, `externalId?: string`, `imported?: { title: string; due: ISODate | null; dueTime: HHMM | null }` (what Classroom said at the last import; used to detect the student's own edits).
- `PlannerData.classroomCourses: ClassroomCourse[]`.

- [ ] **Step 1: Write failing tests:** memory repo upsert/subscribe for the new collection; Firestore mapping round trip; backup with and without `classroomCourses`; Homework with the new optional fields survives backup and Firestore mapping.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(planner): store Classroom course links`.

### Task 3: Talk to Classroom

**Files:** Create `src/data/classroom.ts`; Modify `src/data/auth.ts`; Test `__tests__/data/classroom.test.ts`, extend `__tests__/data/auth.test.ts` (or the existing auth tests).

**Interfaces:**
- `getClassroomToken(): Promise<string | 'redirecting'>` — web only. Provider = GoogleAuthProvider with both scopes. Normal tab: `reauthenticateWithPopup(currentUser, provider)` → access token. Installed app (`chooseSignInMethod` = 'redirect'): `reauthenticateWithRedirect` → returns 'redirecting' (the page leaves).
- In `auth.ts`, the existing `getRedirectResult` call keeps `GoogleAuthProvider.credentialFromResult(result)?.accessToken` in a module holder when the result's scopes include Classroom; export `takeClassroomToken(): string | null` (returns once, then clears). The import screen calls it on mount.
- `fetchClassroom(token): Promise<{ courses: { id: string; name: string; section: string | null }[]; work: { id: string; courseId: string; title: string; dueDate: {year; month; day} | null; dueTime: {hours?; minutes?} | null }[]; turnedIn: Set<string> /* courseWork ids */ }>` — `courses.list?studentId=me&courseStates=ACTIVE`, then per course `courseWork.list?courseWorkStates=PUBLISHED` and `courseWork/-/studentSubmissions.list?userId=me`; follow `nextPageToken` everywhere (pageSize 100).
- Errors → `ClassroomError` with `kind: 'denied' | 'blocked' | 'network' | 'other'` and messages: denied (popup closed / consent refused) `Classroom access wasn’t allowed.`; blocked (403 with `PERMISSION_DENIED`/admin policy) `Your school’s Google account doesn’t allow this app to read Classroom.`; network `Couldn’t reach Google Classroom. Check your connection and try again.`; other `Something went wrong reading Classroom. Try again.`

- [ ] **Step 1: Write failing tests** with mocked `firebase/auth` and `fetch`: popup path returns the token; standalone path calls reauthenticateWithRedirect and returns 'redirecting'; redirect result with Classroom scope is taken once; pagination across 2 pages for courses, work and submissions; turnedIn from TURNED_IN/RETURNED only; error kinds mapping.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(planner): read Google Classroom`.

### Task 4: Plan the import

**Files:** Create `src/domain/classroomImport.ts`; Test `__tests__/domain/classroomImport.test.ts`

**Interfaces:**
- `toLocalDue(dueDate, dueTime): { due: ISODate | null; dueTime: HHMM | null }` — UTC → Europe/Bucharest (use `Intl.DateTimeFormat` with `timeZone: 'Europe/Bucharest'`, en-GB parts; no dueTime → date unchanged, time null).
- `suggestSubject(courseName: string, subjects: Subject[]): string | null` — attending, live subjects; match when the folded course name equals or contains the folded subject name, or equals the folded abbreviation (reuse `fold` from importPlan.ts); first match by longest name.
- `planClassroomImport(fetched, data, today: ISODate): { unlinkedCourses: { id; name; suggestion: string | null }[]; items: ClassroomItem[] }` where `ClassroomItem = { workId; courseId; subjectId; title; due; dueTime; done; action: 'new' | 'update' | 'unchanged' | 'conflict'; existing?: Homework }`. Courses without a live `ClassroomCourse` record are `unlinkedCourses` and contribute no items until linked; courses linked to `null` are skipped. Include rules per Global Constraints. Existing homework matched by `source === 'classroom' && externalId === workId` (live only): unchanged when title/due/dueTime equal and done matches the rule below; edited-by-student = its title/due/dueTime differ from `imported`; Classroom changed = new values differ from `imported`; both → `conflict`; only Classroom changed → `update`; only student edited → `unchanged` (keep theirs). `done`: a turned-in assignment sets done true; never un-done a homework the student ticked.
- `applyClassroomImport(plan, answers: { conflicts: Record<workId, 'mine' | 'classroom'> }, links: ClassroomCourse[], data, now, newId): { courses: ClassroomCourse[]; homework: Homework[] }` — new homework with `source: 'classroom'`, `externalId`, `imported` snapshot, `updatedAt: now`; updates with `stamp(existing)` and a fresh `imported`; 'mine' keeps the student's fields but refreshes `imported` (so the question isn't asked again).

- [ ] **Step 1: Write failing tests:** Review Focus 1, 2 and 3; include rules (no due, future, overdue-not-turned-in, overdue-turned-in skipped); done never un-set; unlinked courses listed with suggestions (diacritics: "Testarea Sistemelor Software" → TSS subject); "Don't import" courses skipped; apply creates/updates as specified.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(planner): plan a Classroom import`.

### Task 5: Import from Classroom screen

**Files:** Create `app/classroom/index.tsx` (+ row components in `src/ui/` if > ~300 lines); Modify `app/(tabs)/homework.tsx` (header text button "Import from Classroom"), `app/settings/index.tsx` (row "Google Classroom" → `/classroom`); Delete `app/dev/classroom.tsx`; Modify `planner/README.md` (short "Import homework from Google Classroom" section incl. the Google Cloud setup: enable the Classroom API, add the two scopes as full URLs, add test users while the app is in Testing); Test `__tests__/app/classroom.test.tsx`.

- Start: title "Import from Classroom", body "Adds your Google Classroom assignments to Homework. Nothing is saved until you tap Save.", primary "Connect to Classroom" → token (on mount, `takeClassroomToken()` first) → "Reading Classroom…" → fetch → plan. Errors show the ClassroomError message with "Try again".
- Link step (only when `unlinkedCourses` exist): heading "Which subject is each course?"; per course: course name, chips of attending subjects (suggestion preselected) and "Don’t import"; primary "Continue" enabled when every course has a choice.
- Review: grouped by subject; each row title + due label (or "No due date") + "Done" mark for turned-in; markers "New", "Updated"; conflicts: "You changed this, and Classroom changed it too." with choices "Keep mine" / "Use Classroom’s" (shows both values). Line: "{n} new, {u} updated". Nothing to do → "Everything from Classroom is already in your homework." and disabled "Nothing to add".
- Save: useRef lock; upsert course links first, then homework; then `router.replace('/homework')`; failure → "Couldn’t save. Try again."
- Settings row "Google Classroom" opens the same screen; course links can be changed there later (out of scope now: the screen re-asks only for unlinked courses).

- [ ] **Step 1: Write failing tests** (mock `src/data/classroom.ts`): connect → link step → review → save upserts links then homework and navigates; redirect token on mount skips Connect; each error message; nothing-to-add state; conflict choice required before Save; spike route removed.
- [ ] **Step 2–4:** FAIL → implement → PASS; full suite, tsc, format:check, web export.
- [ ] **Step 5: Commit** `feat(planner): import homework from Google Classroom`.
- [ ] **Step 6 (user, manual):** deploy, import from Classroom in a Safari tab and in the installed app; check due times, done marks, and that a second import adds nothing.
