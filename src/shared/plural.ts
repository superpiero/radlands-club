/** Czech plural: 1 → one, 2–4 → few, else many (plural(5,'karta','karty','karet') = 'karet'). */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n);
  if (a === 1) return one;
  if (a >= 2 && a <= 4) return few;
  return many;
}
