import { extractJson, parseImport } from '../../src/domain/importParse';

const TOO_LONG = 'This answer is too long. Ask Claude for just the JSON block.';
const NO_JSON = 'There’s no JSON in what you pasted. Copy Claude’s whole answer and try again.';
const BROKEN = 'The JSON is cut off or broken. Ask Claude to send the full JSON block again.';

const exams = {
  format: 'study-planner-import',
  version: 1,
  kind: 'exams',
  groups: ['A1'],
  exams: [{ subject: 'MATH', date: '2027-01-20', start: '09:00', groups: ['all'] }],
};
const json = JSON.stringify(exams, null, 2);

describe('extractJson', () => {
  it('returns the content of a json fence', () => {
    expect(extractJson('Here:\n```json\n{"a":1}\n```\nDone')).toBe('{"a":1}');
  });
  it('accepts an unlabeled fence, ~~~ fences, and uppercase JSON', () => {
    expect(extractJson('```\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJson('~~~json\n{"a":1}\n~~~')).toBe('{"a":1}');
    expect(extractJson('```JSON\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('first suitable fence wins and other languages are skipped', () => {
    expect(extractJson('```js\n{"x":0}\n```\n```json\n{"a":1}\n```\n```json\n{"b":2}\n```')).toBe(
      '{"a":1}',
    );
  });
  it('handles Windows newlines', () => {
    expect(extractJson('hi\r\n```json\r\n{"a":1}\r\n```\r\n')).toBe('{"a":1}');
  });
  it('extracts unfenced JSON from prose', () => {
    expect(extractJson('Sure! {"a":{"b":2}} hope that helps {x}')).toBe('{"a":{"b":2}}');
  });
  it('honours braces and escapes inside strings', () => {
    const t = 'x {"a":"} \\" {","b":1} y';
    expect(extractJson(t)).toBe('{"a":"} \\" {","b":1}');
  });
  it('returns null when there is no brace', () => {
    expect(extractJson('')).toBeNull();
    expect(extractJson('no json here')).toBeNull();
  });
  it('returns the tail from the first brace when unbalanced', () => {
    expect(extractJson('text {"a":[1,2')).toBe('{"a":[1,2');
  });
});

describe('parseImport', () => {
  it('parses a fenced answer with prose', () => {
    const r = parseImport(`Here you go!\n\`\`\`json\n${json}\n\`\`\`\nLet me know.`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file.kind).toBe('exams');
  });
  it('parses unfenced JSON with prose before and after', () => {
    expect(parseImport(`Sure.\n${json}\nEnjoy {braces}`).ok).toBe(true);
  });
  it('tolerates a BOM and surrounding whitespace', () => {
    expect(parseImport(`﻿  \n${json}\n  `).ok).toBe(true);
  });
  it('handles a } inside a string value', () => {
    const t = JSON.stringify({ ...exams, groups: ['A}1'] });
    const r = parseImport(`ok ${t} bye`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file.groups).toEqual(['A}1']);
  });
  it('uses the first fence when there are two', () => {
    const other = JSON.stringify({ ...exams, kind: 'bogus' });
    const r = parseImport(`\`\`\`json\n${json}\n\`\`\`\n\`\`\`json\n${other}\n\`\`\``);
    expect(r.ok).toBe(true);
  });
  it('reports truncated JSON as cut off', () => {
    expect(parseImport(json.slice(0, json.length - 10))).toEqual({ ok: false, error: BROKEN });
  });
  it('reports smart quotes as broken', () => {
    expect(parseImport('{“format”: 1}')).toEqual({ ok: false, error: BROKEN });
  });
  it('reports empty and brace-less pastes as no JSON', () => {
    expect(parseImport('')).toEqual({ ok: false, error: NO_JSON });
    expect(parseImport('   \n')).toEqual({ ok: false, error: NO_JSON });
    expect(parseImport('I could not read the picture.')).toEqual({ ok: false, error: NO_JSON });
  });
  it('rejects oversize pastes before anything else', () => {
    expect(parseImport('x'.repeat(200001))).toEqual({ ok: false, error: TOO_LONG });
    expect(parseImport(' '.repeat(200001))).toEqual({ ok: false, error: TOO_LONG });
  });
  it('accepts a paste of exactly 200000 chars', () => {
    expect(parseImport('x'.repeat(200000))).toEqual({ ok: false, error: NO_JSON });
  });
  it('passes validation errors through', () => {
    const r = parseImport('{"format":"other"}');
    expect(r).toEqual({
      ok: false,
      error: 'This isn’t a Study Planner import. Copy the whole JSON block from Claude’s answer.',
    });
  });
  it('retries from the next brace when the first block is not an import', () => {
    expect(parseImport(`{note} ${json}`).ok).toBe(true);
    expect(parseImport(`{"a":1} then ${json}`).ok).toBe(true);
    expect(parseImport(`{ oops ${json}`).ok).toBe(true);
  });
  it('reports the first problem when no block works', () => {
    expect(parseImport('{"a":1} {"b":2}')).toEqual({
      ok: false,
      error: 'This isn’t a Study Planner import. Copy the whole JSON block from Claude’s answer.',
    });
    expect(parseImport('{ {')).toEqual({ ok: false, error: BROKEN });
  });
  it('falls back to the rest of the text when the fence holds no import', () => {
    expect(parseImport(`\`\`\`json\n{"a":1}\n\`\`\`\n${json}`).ok).toBe(true);
  });
  it('gives up after a bounded number of retries', () => {
    expect(parseImport('{'.repeat(5000)).ok).toBe(false);
  });
});

describe('fence lines', () => {
  it('trims indented fences and whitespace around them', () => {
    expect(extractJson('  \t```json  \n{"a":1}\n   ```   \n')).toBe('{"a":1}');
    expect(extractJson('> x\n    ~~~\n{"a":1}\n    ~~~\t')).toBe('{"a":1}');
  });
  it('closes on a fence line that is only whitespace around the marker', () => {
    expect(extractJson('```json\n{"a":1}\n \u00a0```\u00a0 \nafter {"b":2}')).toBe('{"a":1}');
  });
});
