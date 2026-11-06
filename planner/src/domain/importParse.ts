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

/** From the first `{` through its matching `}`; the rest of the text if never closed. */
function scanObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
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

/** Pull the JSON out of a pasted answer: a ```json fence if there is one, else the first {...}. */
export function extractJson(text: string): string | null {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  return fencedJson(clean) ?? scanObject(clean);
}

/** Turn Claude’s pasted answer into a validated import. Never evaluates the text. */
export function parseImport(text: string): ImportResult {
  if (text.length > MAX_LENGTH) return { ok: false, error: TOO_LONG };
  const raw = extractJson(text);
  if (raw === null) return { ok: false, error: NO_JSON };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, error: BROKEN };
  }
  return validateImport(value);
}
