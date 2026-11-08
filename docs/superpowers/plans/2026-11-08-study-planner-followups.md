# Study Planner, follow-ups #10 and #11 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Clear the small items deferred from the Phase 1 reviews (issue #10) and the Phase 2 reviews (issue #11).

**Branch:** `followups-10-11` (from main after Phase 6).

**Spec:** `docs/superpowers/specs/2026-11-02-study-planner-design.md`. Every item here only polishes behaviour the spec already describes.

## Global Constraints

- All earlier Global Constraints apply:
  - dates `YYYY-MM-DD` and times `HH:MM`;
  - LWW by `updatedAt`, with `stamp()` for edits, and tombstones only;
  - theme tokens, sentence case, typographic ’ and touch targets ≥ 44px;
  - Prettier, TDD, `npx tsc --noEmit` and `npm run format:check`.
- No new runtime dependencies. A dev dependency is allowed only for Task 3.
- Behaviour that isn't named here stays unchanged.

## Decisions (controller, 2026-11-08)

- **Two plan entries mapped to one existing subject:** the subject is on if any entry is on. Today the first entry wins.
- **Breaks that start or end mid-week:** keep counting whole weeks. Semester setup shows the hint "A break week counts as a whole week, even if it starts mid-week."
- **"Moved" marker:**
  - a small "Moved" label on the class block in Today and Week, using the existing muted label style;
  - cancelled classes are shown on Week struck through and muted. Today keeps hiding them.

---

### Task 1: Schedule views (#10)

- [ ] "Moved" marker on Today and Week. Cancelled classes are struck through on Week.
- [ ] Hide "Change every week" on a cancelled occurrence.
- [ ] Classes moved into a break week are shown on Today and Week. A move is explicit, so it wins over the break.
- [ ] The "Free after" line also shows when the last class ends at 19:40 or later. Find the cut-off bug and test 19:40 and 21:20.
- [ ] Refresh the "now" line when the app returns from the background (`AppState` change and web `visibilitychange`).
- [ ] Commit `fix(planner): schedule view follow-ups`.

### Task 2: App hygiene (#10)

- [ ] Service worker:
  - trim old cached bundles on activate (keep the current cache only);
  - run `cache.put` inside `event.waitUntil` on the cache-first path.
- [ ] The write-error banner respects the top safe area.
- [ ] Stamp override edits against tombstoned overrides as well, so a re-created move isn't rejected by the rules (`updatedAt` must be greater).
- [ ] Reuse the shared UI pieces (TextButton, HomeworkRow, Button) in ClassDetail, Today, Backup and StoreGate where they are hand-rolled copies, with no visual change.
- [ ] tsconfig: drop the unused `@/*` alias and keep Node types out of app code. Tests may keep them.
- [ ] Semester setup hint for breaks (Decisions).
- [ ] Commit `chore(planner): app hygiene follow-ups`.

### Task 3: Firestore rules tests (#10)

- [ ] Add `@firebase/rules-unit-testing` and `firebase-tools` as dev dependencies, and an npm script `test:rules` that runs the tests in the Firestore emulator. Keep them out of the default `npx jest` run.
- [ ] Tests:
  - owner read/write in `users/{uid}/**`;
  - another uid denied;
  - unauthenticated denied;
  - delete denied;
  - `updatedAt` must be a number;
  - an update must have a strictly greater `updatedAt`.
- [ ] README: how to run them (needs Java).
- [ ] If the emulator can't be downloaded in this environment, commit the tests and the script anyway, and record that they weren't run here.
- [ ] Commit `test(planner): Firestore rules tests`.

### Task 4: Exam review (#11)

- [ ] The duplicate re-check at save uses the user's edited date and start, not the sheet's.
- [ ] When every row turned out to be already saved by the time Save was tapped, say "These exams were already saved." and navigate as after a save.
- [ ] Use the wording "No exams for all" when the sheet lists no groups. Find the current copy and make it read naturally, e.g. "No exams found in this sheet."
- [ ] Shared UI: one empty-state component for "Nothing to review", and one save-lock hook, used by both review screens.
- [ ] Commit `fix(planner): exam review follow-ups`.

### Task 5: Timetable import (#11)

- [ ] On re-import, show "N teachers updated" when only teachers changed.
- [ ] Back stack after saving an import: navigation lands on the destination so that back doesn't return to the paste box. Use `router.dismissAll()` then replace, or the equivalent that works on web.
- [ ] "Check this" outline: "Done" marks an unsure class as checked.
- [ ] Two plan entries mapped to one subject: any entry on means the subject is on (Decisions).
- [ ] Parser polish:
  - retry from the next `{` when the first brace block fails;
  - trim fence lines, including whitespace-only and indented fences;
  - truncate echoed values in error messages to 40 characters plus `…`.
- [ ] Commit `fix(planner): timetable import follow-ups`.
