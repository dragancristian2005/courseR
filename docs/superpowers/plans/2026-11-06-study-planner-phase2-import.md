# Study Planner, Phase 2 (Import by copy and paste) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student turn a photo or PDF of their timetable (and exam table) into their planner by sending it to the Claude app with a ready-made prompt, pasting the JSON answer back, and confirming it on a review screen.

**Architecture:** No AI call from the app. Pure domain modules define the import format, build the prompt, parse and validate the pasted answer, and turn it into planner records for one group (with questions the student must answer). Screens under `app/import/` walk the student through copy prompt → paste answer → review → save, reusing the Phase 1 repository and edit helpers.

**Tech Stack:** Existing Phase 1 stack (Expo + expo-router, TypeScript strict, Jest/jest-expo, RNTL 14, Firestore repository). New dependency: `expo-clipboard` (install with `npx expo install expo-clipboard`).

**Spec:** `docs/superpowers/specs/2026-11-02-study-planner-design.md` (sections "Paying for AI import", "Timetable import", "Exam import")

## Global Constraints

- All Phase 1 Global Constraints still apply (see `docs/superpowers/plans/2026-11-02-study-planner-phase1.md`): dates `YYYY-MM-DD`, times `HH:MM`; LWW by `updatedAt` with `stamp()` for edits of existing records; tombstones only; theme tokens; sentence case; typographic ’; touch targets ≥ 44px; Prettier config in `planner/.prettierrc`.
- The app never sends the image or the key anywhere; it only reads text the student pastes.
- Week parity: a diagonally split block holds two subjects; **top-left = odd weeks, bottom-right = even weeks**.
- Nothing from an import is saved before the review screen's "Save timetable" / "Save exams".
- New patterns from an import use `validFrom = OPEN_START`, `validTo = null`, and `source: 'import'`; hand-made ones `source: 'manual'` (field optional; absent = manual).
- Abbreviation and name matching is case- and diacritic-insensitive (`ȘP` = `SP`).
- Pasted text is untrusted input: validate everything, never `eval`, cap pasted size at 200 KB ("This answer is too long. Ask Claude for just the JSON block.").

## Review Focus

1. Claude wraps the JSON in prose or a ```json fence, or adds a trailing sentence: the parser still finds the JSON. Test in Task 2.
2. A block marked for groups "1-4" (or a list) or "all": applies to group 2; a block for a different semigroup does not. Test in Task 4.
3. A diagonal block → two blocks with `weeks: "odd"` and `weeks: "even"`; both reach the planner with the right `repeat`. Test in Task 4.
4. Re-importing the same sheet creates no duplicates; a subject already in the planner (matched by abbreviation or name) is reused, not duplicated. Test in Task 4.
5. Malformed answer (missing `version`, unknown `type`, bad time "9:40", end before start): a clear message naming the first problem, nothing saved. Test in Task 2.

---

## The import format (version 1)

```json
{
  "format": "study-planner-import",
  "version": 1,
  "kind": "timetable",
  "title": "Informatică anul 3, semestrul I 2026–2027",
  "validFrom": "2026-10-08",
  "groups": ["Grupa 1", "Grupa 2"],
  "semigroups": ["1", "2"],
  "subjects": [{ "abbreviation": "TSS", "name": "Testarea sistemelor software" }],
  "blocks": [
    {
      "day": 1, "start": "11:20", "end": "12:50",
      "subject": "TSS", "type": "seminar", "room": "048", "teacher": "Mutescul A.",
      "online": false,
      "groups": ["Grupa 1", "Grupa 2"], "semigroup": null,
      "weeks": "every",
      "choiceGroup": null,
      "unsure": ["type"]
    }
  ]
}
```

- `day` 1 = Monday … 7 = Sunday. `type` is `"course" | "seminar" | "lab" | null` (null = not marked on the sheet). `groups` is the list of group labels the block applies to, or `["all"]`. `semigroup` is a semigroup label or null (whole group). `weeks` is `"every" | "odd" | "even"`. `choiceGroup` is a short id shared by alternatives the student attends only one of (stacked optional courses in one slot, the same subject offered in several slots such as DCT), else null. `unsure` lists field names Claude could not read confidently (subset of `subject`, `type`, `room`, `teacher`, `start`, `end`, `weeks`). `validFrom` and `title` are optional (null if absent on the sheet). `subjects` maps every abbreviation used in `blocks` to its full name when the sheet shows it (name may equal the abbreviation).
- Exams: `{ "format": "study-planner-import", "version": 1, "kind": "exams", "groups": [...], "exams": [{ "subject": "ALED", "subjectName": "Algebră liniară și ecuații diferențiale", "title": "Exam", "date": "2027-01-20", "start": "09:00", "room": "A02", "groups": ["all"] }] }` (`start`, `room`, `subjectName` may be null).

## File structure

```
planner/src/domain/
  importFormat.ts     types for the format + validateImport()
  importParse.ts      extractJson() + parseImport()
  importPrompt.ts     buildPrompt(kind)
  importPlan.ts       planTimetableImport(), applyAnswers()
  examImport.ts       planExamImport()
  importDiff.ts       diffImport()  (re-import)
planner/src/data/clipboard.ts      copyText(), readText()
planner/src/ui/ImportSteps.tsx     step header shared by the import screens
planner/app/import/index.tsx       choose what to import
planner/app/import/prompt.tsx      copy the prompt, open Claude
planner/app/import/paste.tsx       paste the answer
planner/app/import/review.tsx      timetable review
planner/app/import/exams.tsx       exam review
planner/__tests__/domain/import*.test.ts, __tests__/app/import*.test.tsx
```

---

### Task 1: Import format types and validator

**Files:** Create `planner/src/domain/importFormat.ts`; Modify `planner/src/domain/types.ts` (`ClassPattern.source?: 'import' | 'manual'`); Test `planner/__tests__/domain/importFormat.test.ts`

**Interfaces:**
- Produces: `ImportBlock`, `TimetableImport`, `ExamImport`, `ImportFile = TimetableImport | ExamImport` (fields exactly as "The import format" above); `validateImport(value: unknown): { ok: true; file: ImportFile } | { ok: false; error: string }`.
- Error messages (first problem wins, in field order): `'This isn’t a Study Planner import. Copy the whole JSON block from Claude’s answer.'` (wrong/missing `format`), `'This import was made for a newer version of the app.'` (version > 1), `'Block {n}: the day must be 1 (Monday) to 7 (Sunday).'`, `'Block {n}: “{value}” isn’t a time like 09:40.'`, `'Block {n}: the class must end after it starts.'`, `'Block {n}: the type must be course, seminar, lab or empty.'`, `'Block {n}: weeks must be every, odd or even.'`, `'Block {n}: it doesn’t say which groups it’s for.'`, `'Exam {n}: “{value}” isn’t a date like 2027-01-20.'`, `'The import has no classes.'` / `'The import has no exams.'`. `{n}` is 1-based.

- [ ] **Step 1: Write failing tests:** the format example above validates; each message above for a crafted bad input; `type: null` accepted; `groups: ["all"]` accepted; extra unknown fields ignored; `unsure` defaults to `[]` when missing.
- [ ] **Step 2: Run** `npx jest __tests__/domain/importFormat.test.ts` → FAIL.
- [ ] **Step 3: Implement** with hand-written guards (no new validation library), reusing `isDate`/time checks from `src/domain/dates.ts`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(planner): import format and validation`.

### Task 2: Parse pasted answers

**Files:** Create `planner/src/domain/importParse.ts`; Test `planner/__tests__/domain/importParse.test.ts`

**Interfaces:**
- Consumes: `validateImport`.
- Produces: `extractJson(text: string): string | null` (content of the first ```json or ``` fence if present, else the substring from the first `{` to its matching `}` respecting strings/escapes); `parseImport(text: string): { ok: true; file: ImportFile } | { ok: false; error: string }` with errors `'This answer is too long. Ask Claude for just the JSON block.'` (> 200 000 chars), `'There’s no JSON in what you pasted. Copy Claude’s whole answer and try again.'`, `'The JSON is cut off or broken. Ask Claude to send the full JSON block again.'` (JSON.parse fails), then validateImport's messages.

- [ ] **Step 1: Write failing tests** (Review Focus 1 and 5): fenced, unfenced with prose before and after, a `}` inside a string value, two fences (first wins), truncated JSON, empty paste, oversize paste, and pass-through of a validation error.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement. Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(planner): parse pasted import answers`.

### Task 3: The prompt

**Files:** Create `planner/src/domain/importPrompt.ts`; Test `planner/__tests__/domain/importPrompt.test.ts`

**Interfaces:**
- Produces: `buildPrompt(kind: 'timetable' | 'exams'): string` — exact text below, with the format example for that kind embedded where marked.

Timetable prompt (exact):

```
You are helping me import my university timetable into my study planner app.
The attached photo or PDF is the official timetable for my year. Read ALL of it, for every group, and answer with ONE JSON block and nothing else.

Rules:
- Use exactly the format shown below ("format": "study-planner-import", "version": 1, "kind": "timetable").
- One entry in "blocks" per class on the sheet. "day" is 1 for Monday up to 7 for Sunday. Times are 24-hour "HH:MM", e.g. "08:00", "09:40".
- "groups" lists the group column headers the block covers, written exactly as on the sheet (e.g. "Grupa 1"). If a block spans every group, use ["all"].
- If groups are split into semigroups (e.g. "semigrupa 1"), put the semigroup in "semigroup"; otherwise null.
- A cell split by a diagonal line holds two classes that alternate weekly: the TOP-LEFT half is ODD weeks ("weeks": "odd"), the BOTTOM-RIGHT half is EVEN weeks ("weeks": "even"). Make two blocks. Otherwise "weeks": "every".
- "type": "course" for lectures (marked curs, (C), (CO) or written in full across groups), "seminar" for (S), "lab" for (L). If the sheet doesn't say, use null and add "type" to "unsure".
- Use the abbreviation as "subject" when the sheet uses one, and list every abbreviation with its full name in "subjects" (match abbreviations to full course names on the sheet; ignore accents and Romanian letters when matching, e.g. ȘP = SP). If no full name is shown, repeat the abbreviation.
- Several alternative classes in the same slot (optional courses), or the same subject offered at different times where a student attends only one: give them the same short "choiceGroup" id, e.g. "opt-mon-13". Otherwise null.
- "online": true when the room says online.
- If you can't read something confidently, still give your best guess and list the field name in "unsure".
- If the sheet shows a "valid from" date, put it in "validFrom" as "YYYY-MM-DD"; otherwise null.
- Don't invent classes that aren't on the sheet.

Format example:
<FORMAT EXAMPLE>
```

Exams prompt (exact): same first line with "exam schedule" instead of "timetable", then rules: one entry per exam; dates "YYYY-MM-DD" (assume the academic year shown on the sheet); "start" "HH:MM" or null; "groups" as above; "subject" the abbreviation or name as on the sheet with "subjectName" the full name if shown; "title" "Exam" unless the sheet says e.g. "Colocviu" or "Proiect"; same "unsure" and "don't invent" rules; then the exams format example.

- [ ] **Step 1: Write failing tests:** both prompts contain "TOP-LEFT half is ODD", "\"version\": 1", their own kind, and an embedded example that `parseImport` accepts (round trip: `parseImport(buildPrompt(k))` finds and validates the example).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(planner): import prompts for timetable and exams`.

### Task 4: Plan a timetable import for one group

**Files:** Create `planner/src/domain/importPlan.ts`; Test `planner/__tests__/domain/importPlan.test.ts`

**Interfaces:**
- Consumes: `TimetableImport`, `PlannerData`, `OPEN_START`, `newId` (inject as `newId: () => string`), `stamp`.
- Produces:
  - `groupOptions(file): { groups: string[]; semigroups: string[] }` (from `file.groups`/`semigroups`, falling back to labels seen in blocks, `"all"` excluded).
  - `blocksFor(file, group: string, semigroup: string | null): ImportBlock[]` — block applies when its `groups` includes `"all"` or the group (exact match after trim + case/diacritic-insensitive compare, and also when the group label's number is inside a range label like `"1-4"`), and its `semigroup` is null or equals the chosen one.
  - `type ImportQuestion = { kind: 'choose-one'; id: string; options: number[] } | { kind: 'type'; block: number } | { kind: 'unsure'; block: number; fields: string[] }` (block indexes into `blocksFor` output).
  - `planTimetableImport(file, data, group, semigroup): { blocks: ImportBlock[]; questions: ImportQuestion[]; subjects: { abbreviation: string; name: string; existingId: string | null }[] }`.
  - `type ImportAnswers = { chosen: Record<string, number>; types: Record<number, ClassType>; attending: Record<string, boolean> /* by abbreviation */; edits: Record<number, Partial<ImportBlock>> }`.
  - `applyAnswers(plan, answers, data, now: number, newId): { subjects: Subject[]; patterns: ClassPattern[] }` — keeps only the chosen option of each choiceGroup; applies type answers and edits; reuses existing subjects matched by abbreviation (else name), creating the rest (`attending` from answers, default true); sets `attending` on reused subjects only if the answer differs (with `stamp`); one pattern per kept block (`repeat` from `weeks`, `validFrom: OPEN_START`, `validTo: null`, `source: 'import'`); skips a block identical (subject, type, weekday, start, end, room, repeat) to an existing live pattern (Review Focus 4).
- `isComplete(plan, answers): boolean` — every choose-one and type question answered.

- [ ] **Step 1: Write failing tests** with two fixtures in `__tests__/fixtures/`: `uvt-info3.json` (UVT style: groups "Grupa 1"…"Grupa 8", courses ["all"], seminars spanning ["Grupa 1","Grupa 2","Grupa 3","Grupa 4"], a stacked optional pair at Monday 13:00 with one choiceGroup, DCT offered Wed and Thu with one choiceGroup, ȘP course + SP lab) and `poli-1b.json` (semigroups "1"/"2", a diagonal pair odd/even, type markers). Cases: Review Focus 2, 3, 4; questions generated for each choiceGroup and each null type; `isComplete` false until answered; applyAnswers keeps only chosen alternatives; ȘP/SP map to one subject; reused existing subject not duplicated; switched-off subject (attending false) still created but with attending false.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(planner): plan a timetable import for one group`.

### Task 5: Exam import and re-import diff

**Files:** Create `planner/src/domain/examImport.ts`, `planner/src/domain/importDiff.ts`; Tests `__tests__/domain/examImport.test.ts`, `importDiff.test.ts`

**Interfaces:**
- `planExamImport(file: ExamImport, data, group): { exams: Exam[]; skipped: number }` — exams for the group (same group matching as Task 4), subject linked by abbreviation/name match (else `subjectId: null` and title prefixed with the subject name), skipping exams identical (subject, date, start) to an existing live exam; ids via injected `newId`, `updatedAt` now.
- `diffImport(newPatterns: ClassPattern[], data): { added: ClassPattern[]; removed: ClassPattern[]; unchanged: ClassPattern[] }` — compares against existing live patterns with `source === 'import'` that are open-ended (`validTo === null`), by (subjectId, type, weekday, start, end, room, repeat).
- `applyDiff(diff, from: ISODate, now: number, newId): ClassPattern[]` — `removed` patterns end at `addDays(from, -1)` (tombstoned when `from <= validFrom`, same rule as `changeEveryWeek`) with `stamp`; `added` get `validFrom: from`. Earlier weeks never change.

- [ ] **Step 1: Write failing tests:** exam group filtering; subject match with diacritics; duplicates skipped; diff of the same sheet = all unchanged; a moved class = 1 removed + 1 added; applyDiff ends removed patterns the day before `from` and starts added ones on `from`; sessions before `from` unchanged (`sessionsBetween`).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(planner): exam import and re-import changes`.

### Task 6: Import screens: start, prompt, paste

**Files:** Create `planner/src/data/clipboard.ts`, `planner/src/ui/ImportSteps.tsx`, `planner/app/import/index.tsx`, `prompt.tsx`, `paste.tsx`; Modify `planner/app/settings/index.tsx` (rows "Import timetable", "Import exams"), `planner/src/ui/SetupPrompt.tsx` (secondary button "Import from a photo" → `/import`); Tests `__tests__/app/import-start.test.tsx`

**Interfaces:**
- `copyText(text: string): Promise<boolean>`, `readText(): Promise<string>` via `expo-clipboard` (mock in tests).
- `/import`: title "Import"; two rows "Timetable" ("Classes, seminars and labs from the official sheet") and "Exams" ("The exam session table") → `/import/prompt?kind=`.
- `/import/prompt`: `ImportSteps` shows three numbered steps "Copy the prompt", "Ask Claude", "Paste the answer" (this IS a sequence) with the current one in ink; body: "Copy this prompt, open the Claude app, attach a photo or PDF of your {timetable|exam schedule}, paste the prompt and send it." Buttons: primary "Copy prompt" (→ shows "Prompt copied." for 3 s), outline "Open Claude" (`openLink('https://claude.ai/new')`), primary "Next: paste the answer" → `/import/paste?kind=`. A collapsible "Show the prompt" reveals the text (selectable).
- `/import/paste`: multiline field labelled "Claude’s answer" (placeholder "Paste the whole answer here"), "Paste from clipboard" text button (`readText`), primary "Check answer": runs `parseImport`; error shown under the field in urgent colour; on success with the wrong kind: "This is an {exams|timetable} import. Go back and choose {Exams|Timetable}." ; on success navigates to `/import/review` or `/import/exams` passing the parsed file in a small in-memory import session store (`src/data/importSession.ts`: `setPending(file)`, `getPending()`, `clearPending()`; not persisted).

- [ ] **Step 1: Write failing tests:** start → prompt navigation per kind; copy calls copyText with `buildPrompt(kind)` and shows "Prompt copied."; Open Claude calls openLink with the claude.ai URL; paste with junk shows the parse error; paste of a valid timetable sets pending and navigates to review; wrong kind message; Settings rows and SetupPrompt button navigate to `/import`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(planner): import flow: copy prompt and paste answer`.

### Task 7: Timetable review screen

**Files:** Create `planner/app/import/review.tsx` (+ row components in `planner/src/ui/` if it passes ~300 lines); Test `__tests__/app/import-review.test.tsx`

Per mockup "Orar: Import review" (Check your timetable). Flow on one screen, top to bottom:
1. Header "Check your timetable"; subtitle `{title}` if present.
2. Group picker: chips for `groupOptions().groups` ("Which group are you in?"), then semigroup chips when semigroups exist ("Which semigroup?"). Nothing below renders until chosen.
3. Summary line: "{n} classes found, {q} need a look. Nothing is saved until you tap Save."
4. Day sections (Monday…): each block as a `SlotRow`-style row; blocks with an open question get the red outline and the question inline:
   - choose-one: "These classes are alternatives. Which do you attend?" with radio options (subject name, type, room, day/time).
   - type: "The sheet doesn’t say if this is a course, seminar or lab." with Course/Seminar/Lab chips.
   - unsure: "Check this: {fields in words} may be misread." with an "Edit" text button opening inline fields (subject, type, start, end, room, teacher, weeks) stored in `answers.edits`.
5. "Subjects" section: every subject in the plan with an attending switch (same pattern as Settings → Subjects), default on; already-existing subjects show "Already in your planner".
6. If the planner already has imported classes: a "This replaces your imported classes from" date field (default today, or `validFrom` from the file if later than today) and a line "{a} new, {r} removed, {u} unchanged" from `diffImport`.
7. Footer: primary "Save timetable" disabled until `isComplete`, with "Answer the {q} questions above to save." under it.
8. Save: `applyAnswers` → (if imported classes exist) `diffImport` + `applyDiff(from)` else plain create → upsert subjects and patterns → `clearPending()` → `router.replace('/')`.
- No pending import → "Nothing to review. Start an import from Settings." + "Go to import" → `/import`.

- [ ] **Step 1: Write failing tests** with the UVT fixture: group chips; picking Grupa 1 shows its blocks only; the Monday 13:00 alternatives question; Save disabled until answered; switching a subject off; save upserts the expected subjects/patterns (`source: 'import'`, `validFrom: OPEN_START`) and navigates; a second import of the same file shows "0 new, 0 removed, N unchanged" and saves nothing new; no pending → message.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(planner): timetable import review`.

### Task 8: Exam review screen and docs

**Files:** Create `planner/app/import/exams.tsx`; Modify `planner/README.md` (section "Import your timetable"); Test `__tests__/app/import-exams.test.tsx`

- `/import/exams`: "Check your exams"; group chips; list (subject, title, "Thu 21 Jan, 09:00, room A02", unsure marks with inline edit for date/start/room); "{skipped} already in your planner" line when > 0; primary "Save exams" → upsert → `clearPending()` → `router.replace('/exams')`.
- README: a short section explaining the copy-paste import, that it works with a free Claude account, and that nothing is saved until review.

- [ ] **Step 1: Write failing tests:** group filtering, duplicate count line, save upserts and navigates, inline date edit validation ("Enter a date like 2027-01-20.").
- [ ] **Step 2–4:** FAIL → implement → PASS; full suite, `npx tsc --noEmit`, `npm run format:check`, `npx expo export -p web`.
- [ ] **Step 5: Commit** `feat(planner): exam import review`.
- [ ] **Step 6 (user, manual):** on the deployed app, import the real UVT sheet and the Poli sheet through the Claude app; note any misread pattern so the prompt can be tuned.
