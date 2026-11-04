/** A new record id: lowercase base36 timestamp plus random, never containing ':'. */
export function newId(): string {
  const rand = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return Date.now().toString(36) + rand;
}
