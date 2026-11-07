import { addDays } from './dates';
import type { HHMM, ISODate } from './types';

export type IcsEvent = {
  uid: string;
  summary: string;
  location?: string;
  description?: string;
} & ({ kind: 'timed'; date: ISODate; start: HHMM; end: HHMM } | { kind: 'allDay'; date: ISODate });

const TZID = 'Europe/Bucharest';
const MAX_OCTETS = 75;

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZID}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0300',
  'TZNAME:EEST',
  'DTSTART:19700329T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0200',
  'TZNAME:EET',
  'DTSTART:19701025T040000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

export function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function octets(ch: string): number {
  const c = ch.codePointAt(0)!;
  return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
}

export function foldLine(line: string): string {
  const lines: string[] = [];
  let cur = '';
  let used = 0;
  for (const ch of line) {
    const n = octets(ch);
    // Continuation lines carry a leading space, which counts toward the limit.
    if (used + n > MAX_OCTETS) {
      lines.push(cur);
      cur = ' ';
      used = 1;
    }
    cur += ch;
    used += n;
  }
  lines.push(cur);
  return lines.join('\r\n');
}

const compactDate = (d: ISODate) => d.replace(/-/g, '');
const compactTime = (t: HHMM) => t.replace(':', '') + '00';
const pad = (n: number) => String(n).padStart(2, '0');

function stamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function eventLines(e: IcsEvent, dtstamp: string): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${dtstamp}`];
  if (e.kind === 'timed') {
    lines.push(
      `DTSTART;TZID=${TZID}:${compactDate(e.date)}T${compactTime(e.start)}`,
      `DTEND;TZID=${TZID}:${compactDate(e.date)}T${compactTime(e.end)}`,
    );
  } else {
    lines.push(
      `DTSTART;VALUE=DATE:${compactDate(e.date)}`,
      `DTEND;VALUE=DATE:${compactDate(addDays(e.date, 1))}`,
    );
  }
  lines.push(`SUMMARY:${escapeText(e.summary)}`);
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  lines.push('END:VEVENT');
  return lines;
}

export function buildCalendar(events: IcsEvent[], opts: { name: string; now: Date }): string {
  const dtstamp = stamp(opts.now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Study Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    `X-WR-TIMEZONE:${TZID}`,
    ...VTIMEZONE,
    ...events.flatMap((e) => eventLines(e, dtstamp)),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
