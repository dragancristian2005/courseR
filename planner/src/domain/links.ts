/** Only web, mail and phone-free schemes are allowed for stored links. */
export function isSafeLinkUrl(url: string): boolean {
  return /^(https?|mailto):/i.test(url.trim());
}
