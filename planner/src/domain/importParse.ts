import { validateImport } from './importFormat';
import type { ImportResult } from './importFormat';

const MAX_LENGTH = 200000;

const TOO_LONG = 'This answer is too long. Ask Claude for just the JSON block.';
const NO_JSON = 'There’s no JSON in what you pasted. Copy Claude’s whole answer and try again.';
const BROKEN = 'The JSON is cut off or broken. Ask Claude to send the full JSON block again.';

const FENCE = /^\s*(`{3,}|~{3,})\s*([^\s`~]*)\s*$/;

/** Content of the first ```json (or unlabeled) fence that holds a `{`, or null. */
function fencedJson(text: string): string | null {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const open = FENCE.exec(lines[i]);
    if (!open) continue;
    const marker = open[1];
    const info = open[2].toLowerCase();
    const body: string[] = [];
    let closed = false;
    for (i++; i < lines.length; i++) {
      const close = FENCE.exec(lines[i]);
      if (
        close &&
        close[2] === '' &&
        close[1][0] === marker[0] &&
        close[1].length >= marker.length
      ) {
        closed = true;
        break;
      }
      body.push(lines[i]);
    }
    if (!closed) return null;
    const content = body.join('\n').trim();
    if ((info === '' || info === 'json') && content.includes('{')) return content;
  }
  return null;
}

/** From the `{` at `start` through its matching `}`; the rest of the text if never closed. */
function scanObject(text: string, start: number): string {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}

const clean = (text: string): string => text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');

/** Pull the JSON out of a pasted answer: a ```json fence if there is one, else the first {...}. */
export function extractJson(text: string): string | null {
  const t = clean(text);
  const fenced = fencedJson(t);
  if (fenced !== null) return fenced;
  const start = t.indexOf('{');
  return start === -1 ? null : scanObject(t, start);
}

/** Most `{` starts tried, so a long paste of braces can't make parsing quadratic. */
const MAX_TRIES = 25;

/** Where to look, best first: the fence, then the object at each `{` of the text. */
function* candidates(text: string): Generator<string> {
  const t = clean(text);
  const fenced = fencedJson(t);
  if (fenced !== null) yield fenced;
  let tries = 0;
  for (let at = t.indexOf('{'); at !== -1 && tries < MAX_TRIES; at = t.indexOf('{', at + 1)) {
    yield scanObject(t, at);
    tries++;
  }
}

/** Turn Claude’s pasted answer into a validated import. Never evaluates the text. */
export function parseImport(text: string): ImportResult {
  if (text.length > MAX_LENGTH) return { ok: false, error: TOO_LONG };
  let first: ImportResult | null = null;
  for (const raw of candidates(text)) {
    let result: ImportResult;
    try {
      result = validateImport(JSON.parse(raw));
    } catch {
      result = { ok: false, error: BROKEN };
    }
    if (result.ok) return result;
    first ??= result;
  }
  return first ?? { ok: false, error: NO_JSON };
}
