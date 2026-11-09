import { buildCalendar, escapeText, foldLine } from '../../src/domain/ics';
import type { IcsEvent } from '../../src/domain/ics';

const NOW = new Date(Date.UTC(2026, 9, 20, 9, 5, 7));
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeText('a\\b;c,d')).toBe('a\\\\b\\;c\\,d');
    expect(escapeText('x\ny')).toBe('x\\ny');
    expect(escapeText('x\r\ny')).toBe('x\\ny');
  });
});

describe('foldLine', () => {
  it('folds a long ASCII line into lines of at most 75 octets', () => {
    const folded = foldLine('A'.repeat(200));
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    expect(enc.encode(parts[0]).length).toBeLessThanOrEqual(75);
    for (const p of parts.slice(1)) {
      expect(p.startsWith(' ')).toBe(true);
      expect(enc.encode(p).length).toBeLessThanOrEqual(75);
    }
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe('A'.repeat(200));
  });

  it('never splits a multi-byte character', () => {
    const line = 'SUMMARY:' + 'ș'.repeat(100);
    const parts = foldLine(line).split('\r\n');
    for (const p of parts) {
      expect(enc.encode(p).length).toBeLessThanOrEqual(75);
      expect(() => dec.decode(enc.encode(p))).not.toThrow();
      expect(p).not.toContain('�');
    }
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
  });

  it('leaves short lines alone', () => {
    expect(foldLine('abc')).toBe('abc');
  });
});

describe('buildCalendar', () => {
  const timed: IcsEvent = {
    uid: 'a@study-planner',
    summary: 'Curs, ș',
    kind: 'timed',
    date: '2026-10-26',
    start: '08:00',
    end: '09:40',
    location: 'Room 1',
    description: 'Teacher: X',
  };
  const allDay: IcsEvent = {
    uid: 'b@study-planner',
    summary: 'Exam',
    kind: 'allDay',
    date: '2026-12-31',
  };
  const out = buildCalendar([timed, allDay], { name: 'Study Planner', now: NOW });

  it('has header and ends with CRLF on every line', () => {
    expect(
      out.startsWith(
        'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Study Planner//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:Study Planner\r\nX-WR-TIMEZONE:Europe/Bucharest\r\n',
      ),
    ).toBe(true);
    expect(out.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(out.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('writes a timed event in Bucharest time the day after the clock change', () => {
    expect(out).toContain('DTSTART;TZID=Europe/Bucharest:20261026T080000\r\n');
    expect(out).toContain('DTEND;TZID=Europe/Bucharest:20261026T094000\r\n');
    expect(out).toContain('DTSTAMP:20261020T090507Z\r\n');
    expect(out).toContain('SUMMARY:Curs\\, ș\r\n');
    expect(out).toContain('LOCATION:Room 1\r\n');
    expect(out).toContain('DESCRIPTION:Teacher: X\r\n');
  });

  it('writes an all-day event with DTEND the next day', () => {
    expect(out).toContain('DTSTART;VALUE=DATE:20261231\r\n');
    expect(out).toContain('DTEND;VALUE=DATE:20270101\r\n');
  });

  it('escapes semicolons in summary and location', () => {
    const o = buildCalendar([{ ...allDay, summary: 'A;B', location: 'C;D' }], {
      name: 'n',
      now: NOW,
    });
    expect(o).toContain('SUMMARY:A\\;B\r\n');
    expect(o).toContain('LOCATION:C\\;D\r\n');
  });

  it('omits empty location and description', () => {
    const o = buildCalendar([{ ...allDay, location: '', description: undefined }], {
      name: 'n',
      now: NOW,
    });
    expect(o).not.toContain('LOCATION');
    expect(o).not.toContain('DESCRIPTION');
  });

  it('includes the Bucharest VTIMEZONE', () => {
    expect(out).toContain(
      'BEGIN:VTIMEZONE\r\nTZID:Europe/Bucharest\r\nBEGIN:DAYLIGHT\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0300\r\nTZNAME:EEST\r\nDTSTART:19700329T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:+0300\r\nTZOFFSETTO:+0200\r\nTZNAME:EET\r\nDTSTART:19701025T040000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n',
    );
  });
});

describe('LAST-MODIFIED and SEQUENCE', () => {
  const base: IcsEvent = {
    uid: 'c@study-planner',
    summary: 'X',
    kind: 'allDay',
    date: '2026-12-31',
  };

  it('writes both when lastModified is set', () => {
    const ms = Date.UTC(2026, 10, 9, 12, 30, 5);
    const out = buildCalendar([{ ...base, lastModified: ms }], { name: 'S', now: NOW });
    expect(out).toContain('\r\nLAST-MODIFIED:20261109T123005Z\r\n');
    expect(out).toContain(`\r\nSEQUENCE:${Math.floor((ms - Date.UTC(2024, 0, 1)) / 1000)}\r\n`);
  });

  it('a later edit gives a higher SEQUENCE', () => {
    const seq = (ms: number) =>
      Number(
        /SEQUENCE:(\d+)/.exec(
          buildCalendar([{ ...base, lastModified: ms }], { name: 'S', now: NOW }),
        )![1],
      );
    expect(seq(Date.UTC(2026, 10, 9, 12))).toBeGreaterThan(seq(Date.UTC(2026, 10, 9, 11)));
  });

  it('writes neither when lastModified is missing', () => {
    const out = buildCalendar([base], { name: 'S', now: NOW });
    expect(out).not.toContain('LAST-MODIFIED');
    expect(out).not.toContain('SEQUENCE');
  });
});
