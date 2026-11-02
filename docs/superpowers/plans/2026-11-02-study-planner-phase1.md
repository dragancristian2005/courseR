# Study Planner, Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A web-first, installable study planner (Expo) with Google sign-in and cross-device sync, where a student sets up a semester, enters their timetable by hand, and uses Today, Week, class detail, homework, notes, links and subjects daily.

**Architecture:** Pure TypeScript domain logic (weeks, sessions, edits, selectors) in `planner/src/domain`, fully unit-tested and free of React and Firebase. A `Repository` interface hides storage; an in-memory implementation backs tests, a Firestore implementation (offline persistence, Google auth) backs the app. Screens in `planner/app` (expo-router) read through a store hook and follow the Orar visual tokens in `planner/src/ui/theme.ts`.

**Tech Stack:** Expo (current stable SDK at scaffold time) with expo-router, TypeScript strict, Jest via `jest-expo`, `@testing-library/react-native`, Firebase JS SDK (modular: Auth with Google provider, Firestore with `persistentLocalCache`), `@expo-google-fonts/schibsted-grotesk`, `@expo-google-fonts/newsreader`, Firebase Hosting for the web build.

**Spec:** `docs/superpowers/specs/2026-11-02-study-planner-design.md`
**Mockups:** https://claude.ai/artifact/3yJk4YmU92Cb5jzmATUsqG (the "Orar" rows are the reference; ignore the first-row drafts and "Direction B")

## Global Constraints

- App lives in `planner/`; all commands below run from `planner/` unless stated. Every commit step means `git add -A && git commit -m "<message>"` with the message given.
- Sign-in method: "Sign in with Google" only. Data is private per account; nothing is shared between students.
- Offline-first: every screen works offline; edits sync later. Conflicts: last write wins per record (`updatedAt`). Deletions are tombstones (`deleted: true`), never hard deletes in Firestore.
- Dates are local date strings `YYYY-MM-DD`, times are `HH:MM` strings; time zone Europe/Bucharest. Never store class times as `Date` instants.
- Odd/even: week 1 is the first teaching week and is odd; break weeks do not count; any teaching week's parity can be overridden by hand.
- Class patterns carry `validFrom`/`validTo`; changes never rewrite earlier weeks.
- Subjects switched off are hidden everywhere (Today, Week, class lists), never deleted.
- Colour tokens: paper `#F4F6F8`, ink `#17213A`, muted `#48536B`, rule `#C9CFD8`, course `#C3CBF2`, seminar `#F6D9B0`, lab `#BFE3DA`, now/urgent `#C8302A`.
- Type: Schibsted Grotesk for all app text, tabular figures for times; the student's own note text in Newsreader italic.
- Copy: sentence case, no all-caps labels, no dot-joined meta strings (`A · B`), buttons say exactly what they do ("Save semester", "Add homework", "Move this week", "Change every week").
- Touch targets at least 44 px; text contrast at least 4.5:1.
- Phase 1 has no reminders and no AI import (later phases).

## Review Focus

1. A break in the middle of the semester: the week after the break continues the odd/even sequence (week 12 even, break, week 13 odd), and the break has no sessions. Test in Task 3.
2. "Change every week" from a date: sessions (and the notes linked to them) before that date are unchanged. Test in Task 5.
3. Switching a subject off then on again: its sessions reappear and its notes and homework are intact. Test in Task 4 and Task 6.
4. Clock change at the end of October (25 Oct 2026): a class at 08:00 on 26 Oct is still at 08:00. Test in Task 2.
5. A brand-new account with no semester: Today and Week show a direct prompt to set up the semester instead of an empty or broken screen. Test in Task 11.

---

## File structure

```
planner/
  app/                         expo-router screens
    _layout.tsx                fonts, providers, auth gate
    sign-in.tsx
    (tabs)/_layout.tsx         tab bar (phone) / sidebar (wide)
    (tabs)/index.tsx           Today
    (tabs)/week.tsx
    (tabs)/homework.tsx
    (tabs)/notes.tsx
    (tabs)/links.tsx
    class/[sessionId].tsx      class detail
    class/edit.tsx             add/edit class pattern
    homework/edit.tsx
    note/edit.tsx
    link/edit.tsx
    settings/index.tsx
    settings/semester.tsx
    settings/subjects.tsx
    settings/backup.tsx
  src/domain/                  pure logic, no React/Firebase
    types.ts  dates.ts  weeks.ts  sessions.ts  edits.ts  selectors.ts  backup.ts
  src/data/
    repository.ts  memoryRepository.ts  firestoreRepository.ts  firestoreMapping.ts
    firebase.ts  auth.ts  StoreProvider.tsx  useStore.ts
  src/ui/
    theme.ts  Text.tsx  Button.tsx  Rule.tsx  SlotRow.tsx  WeekGrid.tsx  EmptyState.tsx  useLayout.ts
  public/manifest.json  public/sw.js  public/icons/*
  firebase.json  firestore.rules
  __tests__/...                mirrors src/ and app/
```

---

### Task 1: Scaffold the app with theme and fonts

**Files:**
- Create: `planner/` via `npx create-expo-app@latest planner --template tabs` then trim to the structure above
- Create: `planner/src/ui/theme.ts`, `planner/src/ui/Text.tsx`
- Modify: `planner/app/_layout.tsx`, `planner/package.json` (scripts `test`, `typecheck`, `web`)
- Test: `planner/__tests__/ui/theme.test.ts`, `planner/__tests__/ui/Text.test.tsx`

**Interfaces:**
- Produces: `theme` = `{ color: { paper, ink, muted, rule, course, seminar, lab, now }, font: { app: 'SchibstedGrotesk', appBold: 'SchibstedGrotesk_800ExtraBold', note: 'Newsreader_400Regular_Italic' }, space: (n: number) => number }`; `typeFill(type: ClassType): string`; `<Text variant="title"|"body"|"meta"|"time"|"note">` (time sets `fontVariant: ['tabular-nums']`).

- [ ] **Step 1: Scaffold and trim.** Run `npx create-expo-app@latest planner --template tabs`, enable `"strict": true` in `tsconfig.json`, add `jest-expo` preset and `@testing-library/react-native`, install the two font packages.
- [ ] **Step 2: Write failing tests.** `theme.test.ts`: `expect(theme.color.course).toBe('#C3CBF2')` and the same for every token in Global Constraints; `typeFill('seminar') === '#F6D9B0'`. `Text.test.tsx`: `variant="time"` renders with `fontVariant` containing `'tabular-nums'`; `variant="note"` uses `theme.font.note`.
- [ ] **Step 3: Run** `npx jest __tests__/ui` → FAIL (modules missing).
- [ ] **Step 4: Implement** `theme.ts` and `Text.tsx`; load fonts in `_layout.tsx` with `useFonts`, rendering nothing until loaded.
- [ ] **Step 5: Run** `npx jest __tests__/ui` → PASS; `npx tsc --noEmit` → no errors; `npx expo export -p web` → succeeds.
- [ ] **Step 6: Commit** `feat(planner): scaffold Expo app with Orar theme`.

### Task 2: Domain types and date helpers

**Files:**
- Create: `planner/src/domain/types.ts`, `planner/src/domain/dates.ts`
- Test: `planner/__tests__/domain/dates.test.ts`

**Interfaces:**
- Produces (types.ts):
  - `type ISODate = string` (`YYYY-MM-DD`), `type HHMM = string`
  - `type ClassType = 'course' | 'seminar' | 'lab'`; `type Parity = 'odd' | 'even'`; `type Repeat = 'every' | Parity`
  - `interface Base { id: string; updatedAt: number; deleted?: boolean }`
  - `Semester extends Base { name: string; firstDay: ISODate; lastDay: ISODate; breaks: { from: ISODate; to: ISODate }[]; parityOverrides: Record<number, Parity> }` (key = teaching week number)
  - `Subject extends Base { name: string; abbreviation: string; attending: boolean }`
  - `ClassPattern extends Base { subjectId: string; type: ClassType; weekday: 1|2|3|4|5|6|7; start: HHMM; end: HHMM; room: string; teacher: string; repeat: Repeat; validFrom: ISODate; validTo: ISODate | null; online: boolean }`
  - `SessionOverride extends Base { sessionId: string; kind: 'moved' | 'cancelled'; date?: ISODate; start?: HHMM; end?: HHMM; room?: string }`
  - `Session { id: string; patternId: string; subjectId: string; type: ClassType; date: ISODate; start: HHMM; end: HHMM; room: string; teacher: string; online: boolean; moved: boolean }` (derived, never stored; `id = \`${patternId}:${originalDate}\``)
  - `Exam extends Base { subjectId: string | null; title: string; date: ISODate; start: HHMM | null; room: string }`
  - `Homework extends Base { title: string; subjectId: string | null; due: ISODate; dueTime: HHMM | null; done: boolean }`
  - `Note extends Base { text: string; subjectId: string | null; sessionId: string | null; createdAt: number }`
  - `Link extends Base { title: string; url: string; subjectId: string | null }`
  - `interface PlannerData { semester: Semester | null; subjects: Subject[]; patterns: ClassPattern[]; overrides: SessionOverride[]; exams: Exam[]; homework: Homework[]; notes: Note[]; links: Link[] }`
- Produces (dates.ts): `addDays(d: ISODate, n: number): ISODate`, `weekdayOf(d: ISODate): 1..7` (Mon = 1), `mondayOf(d: ISODate): ISODate`, `compareDates(a, b): number`, `daysBetween(a, b): number`, `todayISO(now?: Date): ISODate` (local date), `timeToMinutes(t: HHMM): number`.

- [ ] **Step 1: Write failing tests** in `dates.test.ts`: `addDays('2026-10-24', 2) === '2026-10-26'` (crosses the 25 Oct clock change); `weekdayOf('2026-11-02') === 1`; `mondayOf('2026-11-05') === '2026-11-02'`; `daysBetween('2026-11-02', '2026-11-12') === 10`; `addDays('2026-12-31', 1) === '2027-01-01'`; `timeToMinutes('09:40') === 580`; `todayISO(new Date(2026, 10, 2, 23, 59)) === '2026-11-02'`.
- [ ] **Step 2: Run** `npx jest __tests__/domain/dates.test.ts` → FAIL.
- [ ] **Step 3: Implement** `types.ts` and `dates.ts`. Do date arithmetic on UTC midnight (`Date.UTC`) so clock changes cannot shift days.
- [ ] **Step 4: Run** the test → PASS.
- [ ] **Step 5: Commit** `feat(planner): domain types and date helpers`.

### Task 3: Semester weeks and odd/even

**Files:**
- Create: `planner/src/domain/weeks.ts`
- Test: `planner/__tests__/domain/weeks.test.ts`

**Interfaces:**
- Consumes: `Semester`, date helpers.
- Produces: `interface Week { monday: ISODate; number: number | null; parity: Parity | null; isBreak: boolean }`; `buildWeeks(s: Semester): Week[]` (one entry per calendar week from `mondayOf(firstDay)` through `lastDay`); `weekFor(s: Semester, d: ISODate): Week | null`.

- [ ] **Step 1: Write failing tests** with fixture `firstDay '2026-09-28'`, `lastDay '2027-01-15'`, `breaks [{from:'2026-12-21', to:'2027-01-03'}]`:
  - `buildWeeks(s).length === 16`
  - week starting `2026-11-02` has `number 6`, `parity 'even'`
  - weeks starting `2026-12-21` and `2026-12-28` have `isBreak true`, `number null`, `parity null`
  - week starting `2026-12-14` is `number 12, 'even'`; week starting `2027-01-04` is `number 13, 'odd'` (Review Focus 1)
  - with `parityOverrides {6: 'odd'}`, week 6 is `'odd'` and week 7 is still `'odd'` (override affects only that week)
  - `weekFor(s, '2026-11-05')!.number === 6`; `weekFor(s, '2027-02-01') === null`
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `buildWeeks` and `weekFor`. A week is a break if its Monday falls inside any break range.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(planner): semester weeks with odd/even and breaks`.

### Task 4: Generate dated sessions

**Files:**
- Create: `planner/src/domain/sessions.ts`
- Test: `planner/__tests__/domain/sessions.test.ts`

**Interfaces:**
- Consumes: `PlannerData`, `buildWeeks`.
- Produces: `sessionsBetween(data: PlannerData, from: ISODate, to: ISODate): Session[]` sorted by date then start; `sessionById(data: PlannerData, id: string): Session | null`.

Rules: for each non-break week and each non-deleted pattern whose subject is non-deleted and `attending`, the occurrence date is `monday + weekday - 1`; include it when within `[validFrom, validTo ?? lastDay]`, within the semester, and `repeat` is `'every'` or equals the week's parity. Then apply non-deleted overrides by `sessionId`: `cancelled` removes it; `moved` replaces date/start/end/room and sets `moved: true`. A moved session keeps its original `id`.

- [ ] **Step 1: Write failing tests** (fixture semester from Task 3; subject TSS attending; pattern seminar Monday 11:20–12:50 room 048 `repeat 'every'` `validFrom '2026-09-28'`):
  - `sessionsBetween(d, '2026-11-02', '2026-11-08')` has one session `{ id: 'p1:2026-11-02', start: '11:20', room: '048' }`
  - a pattern with `repeat 'odd'` yields nothing in week 6 and one session in week 7
  - nothing on `2026-12-21` (break)
  - TSS `attending false` → no sessions; set back to `true` → session `p1:2026-11-02` returns with the same id (Review Focus 3)
  - override `{ sessionId: 'p1:2026-11-02', kind: 'moved', date: '2026-11-03', start: '13:00', end: '14:30' }` → session on `2026-11-03` with `id 'p1:2026-11-02'`, `moved true`
  - override `kind 'cancelled'` → no session that day
  - pattern with `validTo '2026-10-31'` yields nothing after that date
  - `sessionById(d, 'p1:2026-11-02')` returns the moved session
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `sessionsBetween` and `sessionById` (parse `patternId` and original date from the id, then generate that one occurrence and apply overrides).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(planner): generate sessions from patterns`.

### Task 5: Edit operations

**Files:**
- Create: `planner/src/domain/edits.ts`
- Test: `planner/__tests__/domain/edits.test.ts`

**Interfaces:**
- Consumes: types, `sessionById`.
- Produces (all pure, return the records to upsert; `now` and `newId` injected for testability):
  - `moveThisWeek(session: Session, to: { date: ISODate; start: HHMM; end: HHMM; room?: string }, now: number): SessionOverride`
  - `cancelThisWeek(session: Session, now: number): SessionOverride`
  - `changeEveryWeek(pattern: ClassPattern, from: ISODate, changes: Partial<Pick<ClassPattern, 'type'|'weekday'|'start'|'end'|'room'|'teacher'|'repeat'|'online'>>, now: number, newId: () => string): { ended: ClassPattern; created: ClassPattern }`: `ended.validTo = addDays(from, -1)`, `created` copies the pattern with changes, `validFrom = from`, `validTo` = old `validTo`.

- [ ] **Step 1: Write failing tests:**
  - `moveThisWeek` returns `{ sessionId: session.id, kind: 'moved', date, start, end, updatedAt: now }`
  - `changeEveryWeek(p1, '2026-11-09', { start: '13:00', end: '14:30' }, …)` → `ended.validTo === '2026-11-08'`, `created.validFrom === '2026-11-09'`, `created.start === '13:00'`
  - after applying it, `sessionsBetween` for week 6 still returns `id 'p1:2026-11-02'` at `11:20`, and week 7 returns `id '<newId>:2026-11-09'` at `13:00` (Review Focus 2)
  - `changeEveryWeek` with `from` equal to `pattern.validFrom` sets `ended.deleted = true` instead of an empty range
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the three functions.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(planner): move, cancel and change-every-week edits`.

### Task 6: Selectors for screens

**Files:**
- Create: `planner/src/domain/selectors.ts`
- Test: `planner/__tests__/domain/selectors.test.ts`

**Interfaces:**
- Consumes: `sessionsBetween`, `weekFor`.
- Produces:
  - `todayAgenda(data: PlannerData, today: ISODate, nowMinutes: number): { week: Week | null; sessions: Session[]; currentSessionId: string | null; freeAfter: HHMM | null; setupNeeded: boolean }` (`setupNeeded` when no semester or no patterns)
  - `nextExam(data, today): { exam: Exam; daysAway: number } | null` (ignores past and deleted exams)
  - `homeworkGroups(data, today): { thisWeek: Homework[]; later: Homework[]; done: Homework[] }` (thisWeek = due on or before Sunday of today's week, including overdue; sorted by due)
  - `notesFor(data, filter: { subjectId?: string; sessionId?: string }): Note[]` newest first; a subject filter includes that subject's session notes
  - `linksBySubject(data): { general: Link[]; bySubject: { subject: Subject; links: Link[] }[] }` (attending subjects only, sorted by name)
  - `dueLabel(due: ISODate, today: ISODate): string` → `'Today'`, `'Tomorrow'`, weekday short (`'Thu 5'`) within 6 days, else `'16 Nov'`

- [ ] **Step 1: Write failing tests:** at `today '2026-11-02'`, `nowMinutes 625` (10:25) with patterns 09:40–11:10 and 11:20–12:50 → `currentSessionId` is the 09:40 session, `freeAfter '12:50'`; empty data → `setupNeeded true`; `nextExam` with an exam on `2026-11-12` → `daysAway 10`; `homeworkGroups` puts due `2026-11-03` and overdue `2026-11-01` in `thisWeek`, `2026-11-16` in `later`; `notesFor({subjectId: TSS})` includes a note with only `sessionId 'p1:2026-11-02'`; notes and homework of a switched-off subject remain returned by `notesFor` and `homeworkGroups` (Review Focus 3); `dueLabel` cases above.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the selectors.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(planner): screen selectors`.

### Task 7: Repository, in-memory store, and store hook

**Files:**
- Create: `planner/src/data/repository.ts`, `planner/src/data/memoryRepository.ts`, `planner/src/data/StoreProvider.tsx`, `planner/src/data/useStore.ts`
- Test: `planner/__tests__/data/memoryRepository.test.ts`, `planner/__tests__/data/useStore.test.tsx`

**Interfaces:**
- Produces:
  - `type Collection = 'subjects'|'patterns'|'overrides'|'exams'|'homework'|'notes'|'links'`
  - `interface Repository { subscribe(cb: (data: PlannerData) => void): () => void; upsert<T extends Base>(c: Collection, record: T): Promise<void>; remove(c: Collection, id: string): Promise<void>; saveSemester(s: Semester): Promise<void>; replaceAll(data: PlannerData): Promise<void> }` (`remove` writes a tombstone; `subscribe` delivers data with tombstoned records filtered out)
  - `createMemoryRepository(initial?: Partial<PlannerData>): Repository`
  - `<StoreProvider repository={…}>`; `useStore(): { data: PlannerData; repo: Repository }`

- [ ] **Step 1: Write failing tests:** upsert then subscribe sees the record; `remove` hides it from `subscribe` output; upserting an older `updatedAt` than stored does not overwrite (last write wins); `useStore` re-renders a test component when a record is upserted.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(planner): repository interface and in-memory store`.

### Task 8: Firebase auth and Firestore repository

**Files:**
- Create: `planner/src/data/firebase.ts`, `planner/src/data/auth.ts`, `planner/src/data/firestoreMapping.ts`, `planner/src/data/firestoreRepository.ts`, `planner/firestore.rules`, `planner/.env.example`
- Create: `planner/app/sign-in.tsx`; Modify: `planner/app/_layout.tsx` (auth gate)
- Test: `planner/__tests__/data/firestoreMapping.test.ts`, `planner/__tests__/app/sign-in.test.tsx`

**Interfaces:**
- Consumes: `Repository`, types.
- Produces: `initFirebase(): { app, auth, db }` (config from `EXPO_PUBLIC_FIREBASE_*` env vars; Firestore with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` on web); `useAuth(): { user: { uid: string; name: string } | null; loading: boolean; signIn(): Promise<void>; signOut(): Promise<void> }` (web: `signInWithPopup` with `GoogleAuthProvider`); `createFirestoreRepository(db, uid): Repository` storing each collection under `users/{uid}/{collection}/{id}` and the semester at `users/{uid}/meta/semester`; `toDoc(record)` / `fromDoc(id, doc)` in `firestoreMapping.ts`.
- `firestore.rules`: read/write only when `request.auth.uid == uid` on `users/{uid}/{document=**}`; deny everything else.

- [ ] **Step 1: Write failing tests:** `fromDoc(id, toDoc(record))` deep-equals the record for every collection type (no `undefined` fields written: Firestore rejects them, so `toDoc` drops them); `fromDoc` of a doc with `deleted: true` keeps the flag. `sign-in.test.tsx`: the screen shows the heading "Your timetable, on every device" and one button "Sign in with Google" that calls `signIn` (mock `useAuth`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** The auth gate in `_layout.tsx` shows `sign-in` when `user` is null and wraps the tabs in `StoreProvider` with `createFirestoreRepository(db, user.uid)` otherwise.
- [ ] **Step 4: Run** tests → PASS; then manually: create a Firebase project, enable Google sign-in and Firestore, fill `.env`, run `npx expo start --web`, sign in, and check a `users/{uid}` path appears after the first write (Task 17). Deploy rules with `firebase deploy --only firestore:rules`.
- [ ] **Step 5: Commit** `feat(planner): Google sign-in and Firestore sync`.

### Task 9: Backup export and import

**Files:**
- Create: `planner/src/domain/backup.ts`, `planner/app/settings/backup.tsx`
- Test: `planner/__tests__/domain/backup.test.ts`

**Interfaces:**
- Produces: `exportBackup(data: PlannerData, now: Date): string` (JSON `{ app: 'study-planner', version: 1, exportedAt, data }`); `parseBackup(json: string): { ok: true; data: PlannerData } | { ok: false; error: string }`.

- [ ] **Step 1: Write failing tests:** round trip returns equal data; wrong `app` → `{ ok: false, error: 'This file is not a Study Planner backup.' }`; `version: 2` → `error: 'This backup was made by a newer version of the app.'`; invalid JSON → `error: 'This file could not be read.'`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `backup.ts`; the screen offers "Download backup" (web: Blob download; native later) and "Restore from backup", which confirms "This replaces everything in your account with the backup. Continue?" and calls `repo.replaceAll`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(planner): backup export and restore`.

### Task 10: App shell, shared UI and wide layout

**Files:**
- Create: `planner/src/ui/Button.tsx`, `Rule.tsx`, `SlotRow.tsx`, `EmptyState.tsx`, `useLayout.ts`; `planner/app/(tabs)/_layout.tsx`, `planner/app/settings/index.tsx`
- Test: `planner/__tests__/ui/SlotRow.test.tsx`, `planner/__tests__/app/tabs-layout.test.tsx`

**Interfaces:**
- Produces: `<Button kind="primary"|"outline">`; `<Rule weight="hair"|"heavy">` (1 px `rule` / 2 px `ink`); `<SlotRow start end title subtitle type onPress now?: boolean>` (time column 64 px, cell filled with `typeFill(type)`, red `now` line and time tag when `now`); `<EmptyState title body actionLabel onAction>`; `useLayout(): 'phone' | 'wide'` (`wide` when window width ≥ 900).

- [ ] **Step 1: Write failing tests:** `SlotRow` with `type 'lab'` has background `#BFE3DA` and an accessible label "ITB, lab, 08:00 to 09:30, room 032"; with `now` renders the red line. Tabs layout: phone width renders a bottom tab bar with labels Today, Week, Homework, Notes, Links; width 1180 renders a sidebar with the same labels plus Settings.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Settings index lists Semester, Subjects, Exams, Backup, Sign out.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(planner): app shell, shared UI, wide layout`.

### Task 11: Today screen

**Files:**
- Modify: `planner/app/(tabs)/index.tsx`
- Test: `planner/__tests__/app/today.test.tsx`

**Interfaces:**
- Consumes: `todayAgenda`, `nextExam`, `homeworkGroups`, `dueLabel`, `SlotRow`, `EmptyState`.

Layout per mockup "Direction A: Orar": header "Monday 2 November" / "Week 6, even week"; one `SlotRow` per session with the current one marked `now`; collapsed thin rows for empty standard slots after the last class, ending "Free after 16:10"; homework due this week with checkboxes; next exam line "Next exam: {title}, {date}" with "{n} days". Timer re-renders every minute.

- [ ] **Step 1: Write failing tests** (memory repo, fixed clock 2026-11-02 10:25): shows "Monday 2 November" and "Week 6, even week"; TSS course row is marked now; ticking a homework checkbox upserts `done: true`; with empty data shows "Set up your semester" with button "Set up semester" navigating to `/settings/semester` (Review Focus 5); a break week shows "No classes this week, it's a break.".
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(planner): Today screen`.

### Task 12: Week screen

**Files:**
- Create: `planner/src/ui/WeekGrid.tsx`; Modify: `planner/app/(tabs)/week.tsx`
- Test: `planner/__tests__/app/week.test.tsx`

**Interfaces:**
- Produces: `<WeekGrid sessions monday today nowMinutes onPressSession density="compact"|"full">` (rows = standard slots 08:00, 09:40, 11:20, 13:00, 14:40, 16:20, 18:00, 19:40; a session spans rows by its duration; compact shows abbreviation + room, full shows name + type + room).

- [ ] **Step 1: Write failing tests:** header "Week 6" / "2 to 6 November, even week"; today's column header is highlighted; previous/next buttons (labels "Previous week", "Next week") change the header to week 5 / 7; a session starting at a non-standard time (e.g. 10:00) still renders in the row whose range contains it; tapping a cell navigates to `/class/{sessionId}`; empty state as in Task 11.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** On `wide` layout use `density="full"` and show class detail in a right panel instead of navigating.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(planner): week grid`.

### Task 13: Class detail and class editing

**Files:**
- Modify: `planner/app/class/[sessionId].tsx`; Create: `planner/app/class/edit.tsx`
- Test: `planner/__tests__/app/class.test.tsx`

**Interfaces:**
- Consumes: `sessionById`, `moveThisWeek`, `cancelThisWeek`, `changeEveryWeek`, `notesFor`, `linksBySubject`.

Detail per mockup "Orar: Class detail": header filled with type colour; rows Time, Room, Teacher, Repeats ("Every week", "Odd weeks", "Even weeks"); buttons "Move this week" and "Change every week"; Links, Homework, "Notes from this {type}" (Newsreader italic), "All {abbreviation} notes". Edit form fields: subject (pick or create), type, weekday, start, end, room, teacher, repeats, online; "Save class". "Change every week" asks "Starting from" (default: this session's date).

- [ ] **Step 1: Write failing tests:** renders the TSS seminar with "Every week"; "Move this week" with new date/time upserts an override and the screen shows the new time; "Change every week" from `2026-11-09` upserts two patterns per Task 5; adding a class with a new subject creates both the subject (`attending true`) and the pattern; unknown `sessionId` shows "This class is no longer in your timetable." with a button "Back to today".
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(planner): class detail and editing`.

### Task 14: Homework, exams, notes and links

**Files:**
- Modify: `planner/app/(tabs)/homework.tsx`, `notes.tsx`, `links.tsx`; Create: `planner/app/homework/edit.tsx`, `planner/app/exams.tsx`, `planner/app/exam/edit.tsx`, `planner/app/note/edit.tsx`, `planner/app/link/edit.tsx`
- Test: `planner/__tests__/app/homework.test.tsx`, `exams.test.tsx`, `notes.test.tsx`, `links.test.tsx`

**Interfaces:**
- Consumes: `homeworkGroups`, `nextExam`, `dueLabel`, `notesFor`, `linksBySubject`.

Exams (typed in by hand in Phase 1): list at `/exams`, reached from the next-exam line on Today and from Settings; upcoming first, past exams under "Past"; form fields subject (optional), title, date, start time (optional), room; "Save exam". Per mockups "Orar: Homework / Notes / Links". Homework: sections "This week", "Later", collapsed "Done ({n})", button "Add homework"; form fields title, subject (optional), due date, due time (optional); "Save homework". Notes: search box "Search notes" (matches text and subject name, case- and diacritic-insensitive), list newest first with link line ("TSS, seminar on Mon 2 Nov", "Tehnologii web, whole subject", "Not linked"); "New note"; editor with linked-to picker. Links: "University" and "By subject" sections, "Add link"; URLs without a scheme get `https://`; a subject with no links says "No links yet. Add one from the class.".

- [ ] **Step 1: Write failing tests:** homework grouping and done toggle; saving an exam on 2026-11-12 makes Today show "10 days"; a past exam is listed under "Past" and not as next exam; search "retelelor" finds a note on "Administrarea rețelelor"; a note created from class detail (route param `sessionId`) is linked to that session; link "portal.uvt.ro" is saved as "https://portal.uvt.ro"; opening a link calls `Linking.openURL`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(planner): homework, notes and links`.

### Task 15: Semester setup and subjects

**Files:**
- Modify: `planner/app/settings/semester.tsx`, `planner/app/settings/subjects.tsx`
- Test: `planner/__tests__/app/semester.test.tsx`, `subjects.test.tsx`

**Interfaces:**
- Consumes: `buildWeeks`, `Repository.saveSemester`, `Repository.upsert('subjects', …)`.

Per mockups "Orar: Semester setup / Subjects". Semester: "First day of classes", "Last day of classes", explainer "Holidays don’t count as weeks. If your faculty numbers a week differently, change its odd/even here.", week list with Odd/Even toggle per teaching week, break rows with "Remove", "Add a break", "Save semester". Subjects: "Attending" and "Not attending" lists with switches, "Add a subject by hand".

- [ ] **Step 1: Write failing tests:** entering 28 Sep 2026 to 15 Jan 2027 with a break 21 Dec to 3 Jan lists 14 numbered weeks and one break row; toggling week 6 to Odd saves `parityOverrides {6: 'odd'}`; last day before first day shows "The last day must be after the first day." and disables save; switching RPA off moves it to "Not attending" and upserts `attending: false`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(planner): semester setup and subjects`.

### Task 16: Installable web app and hosting

**Files:**
- Create: `planner/public/manifest.json`, `planner/public/sw.js`, `planner/public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `planner/firebase.json`
- Modify: `planner/app/+html.tsx` (manifest link, `apple-mobile-web-app-capable`, theme colour `#F4F6F8`, service worker registration)
- Test: `planner/__tests__/pwa/manifest.test.ts`

**Interfaces:**
- Produces: manifest `{ name: 'Study Planner', short_name: 'Planner', display: 'standalone', background_color: '#F4F6F8', theme_color: '#F4F6F8', start_url: '/' }`; `sw.js` precaches the exported app shell (cache-first for static assets, network-first for HTML with offline fallback to cached `/`); Firestore handles data offline itself.

- [ ] **Step 1: Write failing test:** manifest parses and has the fields above plus 192 and 512 icons.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; `firebase.json` hosts `dist/` with SPA rewrite to `/index.html`.
- [ ] **Step 4: Verify:** `npx jest` (all suites) → PASS; `npx tsc --noEmit` → clean; `npx expo export -p web && firebase deploy --only hosting` → prints a Hosting URL. On an iPhone: open the URL in Safari, Share → Add to Home Screen, open it, sign in, add a class; turn on airplane mode, reopen: Today still shows the class; add a note offline, turn airplane mode off, and see the note appear on a second device.
- [ ] **Step 5: Commit** `feat(planner): installable web app and hosting`.

---

## Later phases (separate plans)

2. AI timetable and exam import with review (own-key gate on web).
3. Calendar feed (ICS) and Notion push.
4. Native builds, local reminders, rewarded-ad gate.
5. iOS widgets.
6. Google Classroom import.
