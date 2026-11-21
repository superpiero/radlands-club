// Persistent local preferences (name, token, tips…). All access is guarded.

function get(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function put(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* ignore */ }
}

export function getName(): string {
  return get('pk.name') ?? '';
}
export function setName(n: string) {
  put('pk.name', n.slice(0, 20));
}

export function getToken(): string {
  let t = get('pk.token');
  if (!t) {
    t = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    put('pk.token', t);
  }
  return t;
}

export function getFlag(key: string, def = false): boolean {
  const v = get(`pk.flag.${key}`);
  return v === null ? def : v === '1';
}
export function setFlag(key: string, v: boolean) {
  put(`pk.flag.${key}`, v ? '1' : '0');
}

const NAMES = ['Prašná Lída', 'Rezavý Jarda', 'Kapitán Sucho', 'Vodník Vašek', 'Pouštní Bětka', 'Kanystr Karel', 'Šrotová Eva', 'Benzín Béďa'];
export function randomName(): string {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}
