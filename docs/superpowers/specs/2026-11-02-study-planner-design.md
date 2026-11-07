# Study Planner: design

Date: 2026-11-02
Status: draft, awaiting approval
Mockups: https://claude.ai/artifact/3yJk4YmU92Cb5jzmATUsqG (Today agenda, week grid, class detail, widgets)

## Intent and the why

A personal study and schedule planner for university students, built first for the author (Informatică, anul 3, West University of Timișoara / UVT) and usable by any classmate, or a student at another university such as Politehnica Timișoara.

University timetables are published as dense, whole-year grids (a photo or PDF covering 8+ groups). Students re-read these every week, track exams and homework separately, and keep university links scattered. The app pulls the student's own timetable and exams into one clean place on their phone, with reminders, notes, homework and links, so it is something students would actually keep using.

Success: the author and classmates use it daily instead of the PDF; importing a new timetable takes minutes, not an evening of typing; nobody misses an exam or a homework deadline because of the app.

## Goals

- A calendar of the student's own courses, seminars and labs, built from their timetable, with real dates.
- Import from a photo or PDF of the official timetable, and of the exam-session table, using AI to read it, with a mandatory review step.
- Full manual entry and editing as an equal alternative to import (no upload required ever).
- The student chooses which subjects they attend; unattended subjects are hidden everywhere.
- Homework as its own item with due date, done checkbox and reminder.
- Notes linked to a session, a subject, or nothing.
- Links: a general list plus links attached to subjects.
- Reminders: exams and homework.
- One-way publishing of the schedule to Google Calendar, Apple Calendar and Notion.
- Home-screen widgets (iOS first).
- Works offline for daily use.
- The same data on all of one student's devices (iPhone, iPad, laptop/web), via a Google sign-in account.

## Non-goals

- Shared groups or syncing between classmates. Each student's account is private; nothing is shared between students.
- Two-way calendar sync. Edits in Google/Apple/Notion are not read back. The app is the source of truth.
- Grades, attendance tracking, social features.
- Google Classroom import in the first version (planned later; see Phasing).

## Anti-goals (failure even if it technically works)

- An import that silently saves wrong times, rooms or week parity. A wrong lab time is worse than none.
- An app that needs internet to show today's classes, notes or homework.
- Notification spam (pinging before every class by default).
- Showing subjects the student does not attend.

## Constraints

- Primary devices: iPhone and iPad. Desktop use through the web version. Android is a free side effect, not a target to polish.
- Distribution to other iPhones requires the Apple Developer Program ($99/year, App Store or TestFlight). The author has not decided when or whether to pay; it depends on how useful the app proves in their own use. Without it, a native build on the author's own iPhone expires every 7 days, and iOS widgets (which need App Groups) are unavailable. The plan therefore must not depend on the native iOS build for daily use until the fee is paid (see Phasing).
- Timetable formats differ by university and faculty (see Timetable formats). No hand-written parser per layout.
- Notifications on iOS must be scheduled locally so they fire offline.

## Approaches considered

1. **Installable web app (PWA).** Free to host, one link for everyone, works offline. No home-screen widgets; iOS notifications less reliable.
2. **Cross-platform app with Expo (React Native), plus its web build.** One codebase for iPhone/iPad, Android and web; widgets possible (iOS widget written in Swift/WidgetKit); web build covers desktop so no Electron. Costs $99/year to share to iPhones.
3. **Native Swift app.** Best widgets and notifications, can write directly into Apple Calendar; Apple-only (excludes Android classmates), same $99/year.

**Chosen: 2 (Expo).** It gives the phone/iPad app and widgets the author wants, and the web build is a free way to share with classmates and to use on a laptop.

## Visual design: "Orar" (chosen)

The app borrows the visual language students already read every week: the printed orar sheet. Reference mockup: "Direction A: Orar" on the mockups canvas.

- **Colour tokens:** paper `#F4F6F8` (background), ink `#17213A` (text, rules, strong lines), muted ink `#48536B` (secondary text), rule `#C9CFD8` (hairlines), course fill `#C3CBF2`, seminar fill `#F6D9B0`, lab fill `#BFE3DA`, now/urgent red `#C8302A`. Type colours must stay distinguishable by lightness as well as hue.
- **Type:** Schibsted Grotesk, one family. Times use tabular figures and are the largest element in each row. Sentence case everywhere; no all-caps labels, no dot-joined meta strings.
- **Layout:** the day is a column cut from the timetable. A time spine on the left; filled slots are full-width cells in their type colour; empty slots collapse to thin ruled rows. Sections are separated by rules and spacing, not cards. A heavy ink rule closes the header, the day, and sits above the tab bar.
- **The one bold element:** the red "now" line across the current slot, with the time in a small red tag. Everything else stays quiet.
- **User-written text** (notes) appears in a different typeface from app text, so the student can tell their words from the app's (face left to the builder).
- **Week grid and iPad:** same tokens; the week view is the sheet itself, Monday to Friday columns, one row per slot.

## Architecture

- **App:** Expo (React Native, TypeScript), targets iOS/iPadOS, Android, web.
- **Accounts:** sign in with Google ("Sign in with Google" is the only sign-up method). One account per student; data is private to that account.
- **Offline-first with sync:** each device keeps a full local copy of the student's data (timetable, exams, homework, notes, links, settings) and works offline. Changes sync through the backend to the student's other devices when online. Conflicts: last write wins per record (my call; a single student rarely edits the same item on two devices at once). Deletions sync as tombstones.
- **Backend** (stack left to the builder; a hosted backend with Google auth and offline sync, e.g. Firebase or Supabase, fits) with these jobs:
  1. **Auth and sync:** stores the student's data, including notes, scoped to their account.
  2. **Import:** receives an image/PDF, calls an AI vision model, returns structured JSON. The uploaded file is not kept after the response.
  3. **Calendar feed and Notion push:** deferred (see Calendar publishing); Phase 3 exports an `.ics` file from the app with no server.
- **Backup:** export of all data to a file (my call; less critical now that data syncs, kept as a safety net).

### Paying for AI import

Decided 2026-11-06: **the app does not call an AI API in Phase 2.** The author's Claude subscription does not include API usage, and classmates would each need a paid API key. Instead the student uses the Claude app they already have (free or paid) through copy and paste:

1. The planner shows a ready-made prompt with **Copy prompt** (and a link to open Claude).
2. The student attaches the timetable photo/PDF in the Claude app, pastes the prompt, sends it.
3. The student copies Claude's answer (a JSON block in the app's import format) and pastes it into the planner.
4. The planner validates it and opens the review screen.

No API key, no server, no cost. A direct API import (own key, or the rewarded-ad gate on native) can be added later behind the same review screen; the original policy below is kept for that later step.

- Later, optional: **watch a rewarded ad** to unlock one import (native apps), or **enter your own AI API key** (stored only on the device).

## Data model (conceptual)

- **Semester:** start date, end date, holiday weeks. Defines teaching weeks and odd/even numbering (week 1 = first teaching week, odd).
- **Subject:** full name, abbreviation (e.g. RPA → Robotic Process Automation), color, `attending` flag, attached links.
- **Class pattern** (recurring block): subject, type (course / seminar / lab), weekday, start, end, room, teacher, week parity (every / odd / even), source (imported or manual), online flag.
- **Session:** a dated occurrence generated from a pattern and the semester (skipping holidays, honoring parity). Can carry a one-off override (moved, cancelled).
- **Exam:** subject, date, time, room, type, reminder setting.
- **Homework:** title, subject (optional), due date (and optional time), done, reminder setting.
- **Note:** text, link to a session, a subject, or nothing. Session notes also appear under their subject.
- **Link:** title, URL, either general or attached to a subject.

## Features

### Home and navigation

Tabs: **Today** (home), Calendar (week grid), Homework, Notes, Links.

- **Today (home, chosen):** next-exam countdown card, today's classes as a list (time, name, type, room, teacher), homework due soon with checkboxes. Tapping a class opens Class detail.
- **Calendar:** week grid Monday–Friday, blocks colored by type (course / seminar / lab), week number and odd/even badge, swipe between weeks.
- **Class detail:** subject name, type, date/time/room/teacher, week parity, the subject's links (one tap to open Classroom or an online meeting), its homework, notes for this session, link to all notes for the subject, and move/edit actions.

### Moving and editing blocks

Blocks are movable in the app. When moving a class, the app asks: **just this week** (one-off override on that session) or **every week** (changes the pattern). Available from Class detail and by dragging on the week grid.

### Subjects attended

A Subjects list shows every subject found by import or added manually, each with an on/off switch. Off hides all of its blocks (course, seminar, lab) from Today, Calendar, widgets, reminders and the calendar feeds. Hidden subjects are kept, not deleted, and can be switched back on. Stacked optional slots (e.g. UVT Monday 13:00 RPA vs Blockchain) resolve through this.

### Timetable import

1. Student picks a photo or PDF.
2. The student sends it to the Claude app with the planner's import prompt and pastes back the JSON answer (see Paying for AI import). The JSON describes the whole sheet: groups, semigroups, blocks with the groups they apply to.
3. App asks: which group (and semigroup, when present)?
4. App filters to blocks that apply to that group: blocks spanning the group's column, full-width blocks for everyone, semigroup-specific blocks.
5. Abbreviations are expanded by matching seminar/lab codes to course rows (RPA → Robotic Process Automation). Matching ignores diacritics: UVT writes the same subject as `ȘP` on the course and `SP` on the labs (Șabloane de proiectare).
6. Type detection: explicit markers where present (Poli: `curs`, `(S)`, `(L)`); otherwise inferred, and always editable in review.
7. **Week parity:** a block split diagonally holds two alternating subjects. **Top-left half = odd week, bottom-right = even week.** This rule holds for both UVT and Politehnica.
8. **Subjects step:** student switches off subjects they do not attend.
   - **Choose-one offerings:** some subjects are offered in several slots and the student attends one (e.g. UVT `DCT`, a subject from another field of study, offered Wednesday and Thursday 16:20 to 19:30; stacked optional courses in one slot). The review screen asks which one the student attends and keeps only that one.
9. **Review screen:** every block for the chosen group is shown and editable before anything is saved. Nothing is saved without review.
10. Saved patterns keep their source. Re-importing a newer version of the sheet (e.g. "orar valabil din 08 Octombrie") shows what changed instead of starting over.

### Exam import

Same flow for the exam-session table (a separate document, in table format): subject, date, time, room, for the student's group. Reviewed before saving. Exams can always be typed in by hand.

### Manual entry

Any class pattern, the full timetable, any exam, homework, note or link can be created and edited by hand. Import only saves typing.

### Semester setup

Once per semester: start date and holiday weeks. Required to turn weekly patterns into dated sessions and to count odd/even weeks correctly.

Odd/even (my call): by default holidays do not count, so week 1 is the first teaching week (odd) and parity alternates across teaching weeks only. Semester setup shows the full list of weeks with their computed parity, and the student can flip any single week. This covers faculties whose official week calendar breaks the simple rule.

### Timetable changes over time (my call)

Class patterns carry an effective date range. An imported sheet's "valid from" date, or an "every week" edit, applies from a date onward. Earlier weeks keep their sessions, and the notes attached to them are never moved or lost.

### Homework

Own item: title, subject, due date, done checkbox, reminder. Shows on Today, the Homework tab, Class detail, and the homework widget.

### Notes

Free text, linked to a session, a subject, or nothing.

### Links

General list (portal, email, library, etc.) and per-subject links (Classroom page, Teams/meet link for online classes like MELL). Shown on Class detail.

### Reminders

- Exams: 1 day before (default).
- Homework: 1 day before due (default).
- Adjustable per item.
- Class reminders: available, **off by default**.
- Scheduled as local notifications on the device (work offline). Each device schedules from its synced copy.
- Web build (my call): no reminders in the first version; the web app says so. Phones get them through the native app (Android installable for free).

### Calendar publishing (one-way)

Decided 2026-11-07: **no server and no live subscription in Phase 3.**

- **Add to calendar (Phase 3):** the app builds one `.ics` calendar file with every attended class session from this week to the end of the semester (odd/even, breaks, one-off moves and cancellations already applied) and every upcoming exam, in Europe/Bucharest time. On iPhone/iPad, Apple Calendar opens it and the student taps Add All; Google Calendar imports the same file on the web (Settings → Import). It is a snapshot: after timetable changes the student adds it again (the file names its own calendar, "Study Planner", so the old one can be deleted first).
- **Live updates (Phase 4):** the native app writes directly into the phone's calendar and keeps those events updated; no server needed.
- **Live subscription URL and Notion:** deferred. Both would need a small server (Cloudflare Worker): Google/Apple subscriptions poll a public URL, and Notion's API refuses browser requests. Revisit if wanted.
- Edits happen only in the app.

### Widgets (iOS first)

- Small: next class (time, name, room, and what follows).
- Small: homework due soon.
- Medium: today's schedule.

## Timetable formats (reference)

Two real sheets drove this design:

- **UVT, Facultatea de Informatică, anul 3:** one grid, groups 1–8 as columns, 90-minute slots (08:00–21:10, Mon–Fri). Full-width rows are courses marked `(CO)` with full names and teacher titles; seminars/labs are abbreviations with teacher and room, spanning one or more groups; some slots stack 2–3 optional courses; some classes are `online`; `DCT` rows span all groups. No explicit seminar/lab marker. No parity splits on this sheet, but other UVT sheets have them.
- **Politehnica Timișoara, anul I:** groups split into semigroups 1 and 2; 2-hour slots (08–20); types marked `curs`, `(S)`, `(L)`; diagonal split blocks for odd/even weeks; extra info such as evaluation type (`E`/`D`), credits, "valid from" date, labs at other faculties; color per subject. Sheets may be cropped.

## Phasing (suggested order)

Because the Apple fee is undecided, the author's daily use starts on the **web build, installed to the iPhone/iPad home screen**. Every phase ships on web first; native-only items wait for the fee.

1. Google sign-in and sync, manual entry, semester setup, Today, week grid, class detail, subjects on/off, homework, notes, links, backup export. Web build usable daily on iPhone/iPad.
2. AI timetable import with review, and exam import (own-key gate on web).
3. Add to calendar (`.ics` export, no server); live subscription and Notion deferred.
4. Native app builds: local reminders, rewarded-ad gate. Android installable free; iOS on the author's devices.
5. iOS widgets (needs the paid Apple account).
6. Google Classroom homework import, if the university's Google Workspace allows third-party access.

## Decided in conversation

- Each student runs a private copy; no shared data.
- One-way sync only; edit in the app.
- Expo cross-platform app; widgets; web build for desktop.
- Timetable and exams can be imported from image/PDF or typed manually.
- Diagonal splits: top-left odd, bottom-right even.
- Notes link to session, subject, or nothing.
- Homework is its own item with due date and reminder; Classroom import later.
- Reminders: exams and homework 1 day before.
- Links: general list and per subject.
- Subjects the student does not attend are switched off and hidden everywhere.
- Home screen: Today agenda.
- Data is the same on all of a student's devices; login with Google.
- AI import is unlocked by watching an ad or entering your own API key; the policy may change if the app is released.
- The $99 Apple fee is undecided; depends on how useful the app proves.

## My calls (Claude's proposals, not explicitly decided)

- Mandatory review screen after any import.
- Semester setup (start date + holidays) as the source of week numbering.
- Re-import shows a diff instead of replacing.
- "Just this week / every week" choice when moving a class.
- Class reminders exist but are off by default; reminder timing adjustable per item.
- Offline-first local copy on each device, synced through the backend; last write wins per record.
- Backup export file kept as a safety net.
- ICS subscription URL for Google/Apple; Notion via pasted integration token, one row per session and exam.
- Widget set: next class, homework due, today.
- Odd/even: holidays don't count; any week's parity can be flipped by hand.
- Class patterns have effective date ranges; changes never rewrite past weeks.
- Web build has no reminders in v1; web offers only the own-key import option.
- Own AI key stays on the student's devices, never stored on the server.
- Daily use starts on the web build until the Apple fee is decided.

## Left to the builder

- Backend product, local database and sync library, web persistence approach.
- AI model and prompt design for extraction (structured JSON output, validated against a schema).
- Server stack and hosting.
- Exact UI styling and component library.
- ICS details (time zone Europe/Bucharest, refresh cadence) and how the app uploads snapshots.
