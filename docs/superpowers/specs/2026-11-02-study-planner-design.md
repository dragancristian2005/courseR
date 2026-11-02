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

## Non-goals

- Shared groups, accounts between students, or syncing between classmates. Each student runs their own private copy.
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
- Distribution to other iPhones requires the Apple Developer Program ($99/year, App Store or TestFlight). The author accepts this cost when/if they decide to deploy; development on own devices is free.
- Timetable formats differ by university and faculty (see Timetable formats). No hand-written parser per layout.
- Notifications on iOS must be scheduled locally so they fire offline.

## Approaches considered

1. **Installable web app (PWA).** Free to host, one link for everyone, works offline. No home-screen widgets; iOS notifications less reliable.
2. **Cross-platform app with Expo (React Native), plus its web build.** One codebase for iPhone/iPad, Android and web; widgets possible (iOS widget written in Swift/WidgetKit); web build covers desktop so no Electron. Costs $99/year to share to iPhones.
3. **Native Swift app.** Best widgets and notifications, can write directly into Apple Calendar; Apple-only (excludes Android classmates), same $99/year.

**Chosen: 2 (Expo).** It gives the phone/iPad app and widgets the author wants, and the web build is a free way to share with classmates and to use on a laptop.

## Architecture

- **App:** Expo (React Native, TypeScript), targets iOS/iPadOS, Android, web.
- **Local-first data:** all user data (timetable, exams, homework, notes, links, settings) lives on the device in a local database. No user accounts. Daily use is fully offline.
- **Small server** with three jobs only:
  1. **Import:** receives an image/PDF, calls an AI vision model, returns structured JSON. Nothing is stored after the response.
  2. **Calendar feed:** hosts a per-user ICS subscription URL (unguessable token) that Google Calendar and Apple Calendar subscribe to. The app uploads a snapshot of the student's schedule (classes, exams; homework due dates optional) whenever it changes.
  3. **Notion push:** writes the schedule into a Notion database the student connects.
  The server never stores notes. It holds only the calendar snapshot and, if Notion is connected, the Notion credential.
- **Backup:** export/import of all local data to a file, so changing phones does not lose notes.

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
2. Server sends it to an AI vision model with instructions to return structured JSON for the whole sheet: groups, semigroups, blocks with spans.
3. App asks: which group (and semigroup, when present)?
4. App filters to blocks that apply to that group: blocks spanning the group's column, full-width blocks for everyone, semigroup-specific blocks.
5. Abbreviations are expanded by matching seminar/lab codes to course rows (RPA → Robotic Process Automation).
6. Type detection: explicit markers where present (Poli: `curs`, `(S)`, `(L)`); otherwise inferred, and always editable in review.
7. **Week parity:** a block split diagonally holds two alternating subjects. **Top-left half = odd week, bottom-right = even week.** This rule holds for both UVT and Politehnica.
8. **Subjects step:** student switches off subjects they do not attend.
9. **Review screen:** every block for the chosen group is shown and editable before anything is saved. Nothing is saved without review.
10. Saved patterns keep their source. Re-importing a newer version of the sheet (e.g. "orar valabil din 08 Octombrie") shows what changed instead of starting over.

### Exam import

Same flow for the exam-session table (a separate document, in table format): subject, date, time, room, for the student's group. Reviewed before saving. Exams can always be typed in by hand.

### Manual entry

Any class pattern, the full timetable, any exam, homework, note or link can be created and edited by hand. Import only saves typing.

### Semester setup

Once per semester: start date and holiday weeks. Required to turn weekly patterns into dated sessions and to count odd/even weeks correctly.

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
- Scheduled as local notifications on the device (work offline).

### Calendar publishing (one-way)

- **Google Calendar and Apple Calendar:** one ICS subscription URL, hosted by the server, covering attended classes and exams.
- **Notion:** push to a Notion database the student connects.
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

1. Manual entry, semester setup, Today, week grid, class detail, subjects on/off, homework, notes, links, local reminders, backup export.
2. AI timetable import with review, and exam import.
3. Calendar feed (Google/Apple) and Notion push.
4. iOS widgets.
5. Google Classroom homework import, if the university's Google Workspace allows third-party access.

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

## My calls (Claude's proposals, not explicitly decided)

- Mandatory review screen after any import.
- Semester setup (start date + holidays) as the source of week numbering.
- Re-import shows a diff instead of replacing.
- "Just this week / every week" choice when moving a class.
- Class reminders exist but are off by default; reminder timing adjustable per item.
- Local-first storage, no accounts; server stores only the calendar snapshot (and Notion credential); notes never leave the device except in a backup file.
- Backup export/import file.
- ICS subscription URL for Google/Apple; Notion via its API.
- Widget set: next class, homework due, today.

## Left to the builder

- Local database library and web persistence approach.
- AI model and prompt design for extraction (structured JSON output, validated against a schema).
- Server stack and hosting.
- Exact UI styling and component library.
- ICS details (time zone Europe/Bucharest, refresh cadence) and how the app uploads snapshots.
