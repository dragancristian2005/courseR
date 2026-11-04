/** Only web, mail and phone-free schemes are allowed for stored links. */
export function isSafeLinkUrl(url: string): boolean {
  return /^(https?|mailto):/i.test(url.trim());
}

/** Trims the address and adds https:// when it has no scheme. The result may still be unsafe. */
export function normalizeLinkUrl(raw: string): string {
  const t = raw.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
}
