// Generates docs/CARDS.md and docs/cards.json from the card database.
//   npm run docs:cards
import { writeFileSync } from 'node:fs';
import { BASES, CISTERN, JUNK_LABEL, OPERATIONS, RAID, SURVIVORS, type CardDef } from '../src/engine/cards';

const row = (c: CardDef) => {
  const ab = c.abilities.map((a) => `**[${a.cost}💧]** ${a.text}`).join('<br>');
  const parts = [ab, c.trait ? `_Vlastnost:_ ${c.trait}` : '', c.effectText ? `_Efekt:_ ${c.effectText}` : ''].filter(Boolean).join('<br>');
  return parts || '—';
};

let md = `# Databáze karet – Poslední kapka\n\n> Generováno z \`src/engine/cards.ts\` (\`npm run docs:cards\`). Neupravovat ručně.\n\n`;
const deck = [...SURVIVORS, ...OPERATIONS].reduce((s, c) => s + c.copies, 0);
const inDeck = (l: { copies?: number }[]) => l.filter((c) => (c.copies ?? 2) > 0).length;
const collOnly = SURVIVORS.length + OPERATIONS.length - inDeck(SURVIVORS) - inDeck(OPERATIONS);
md += `Klasický balíček: **${deck} karet** – ${inDeck(SURVIVORS)} druhů přeživších a ${inDeck(OPERATIONS)} druhů operací, každá 2×` +
  (collOnly ? ` (+${collOnly} karet jen pro sběratelský režim)` : '') + `.  \nZákladen: **${BASES.length}** (každý hráč dostane 6, vybere 3).\n\n`;

md += `## Přeživší (${SURVIVORS.length})\n\n| Karta | Cena | Rozebrání | Schopnosti / vlastnosti |\n|---|---|---|---|\n`;
for (const c of SURVIVORS) md += `| **${c.name}** \`${c.id}\` | ${c.cost}💧 | ${JUNK_LABEL[c.junk!]} | ${row(c)} |\n`;

md += `\n## Operace (${OPERATIONS.length})\n\n| Karta | Cena | Odpočet | Rozebrání | Efekt |\n|---|---|---|---|---|\n`;
for (const c of OPERATIONS) md += `| **${c.name}** \`${c.id}\` | ${c.cost}💧 | ${c.countdown === 0 ? '⚡ ihned' : c.countdown} | ${JUNK_LABEL[c.junk!]} | ${c.effectText}${c.playNeeds ? ` _(Nelze zahrát, pokud ${c.playNeeds.charAt(0).toLowerCase() + c.playNeeds.slice(1).replace(/\.$/, '')}.)_` : ''} |\n`;

md += `\n## Základny (${BASES.length})\n\n| Základna | Zásoby (karty) | Odolnost | Schopnost / vlastnost |\n|---|---|---|---|\n`;
for (const c of BASES) md += `| **${c.name}** \`${c.id}\` | ${c.draw} | ${c.hp ?? 2} | ${row(c)} |\n`;

md += `\n## Speciální karty\n\n| Karta | Popis |\n|---|---|\n`;
md += `| **${RAID.name}** | Odpočet ${RAID.countdown}. ${RAID.effectText} |\n`;
md += `| **${CISTERN.name}** | ${CISTERN.effectText} |\n`;
md += `| **Tulák** | Vrchní karta balíčku lícem dolů. Nemá schopnosti, kryje. Poškozením je zničen a vrací se lícem dolů navrch balíčku. |\n`;

const junkCount: Record<string, number> = {};
for (const c of [...SURVIVORS, ...OPERATIONS]) junkCount[c.junk!] = (junkCount[c.junk!] ?? 0) + c.copies;
md += `\n## Rozložení efektů rozebrání v balíčku\n\n| Efekt | Počet karet |\n|---|---|\n`;
for (const [k, v] of Object.entries(junkCount)) md += `| ${JUNK_LABEL[k as keyof typeof JUNK_LABEL]} | ${v} |\n`;

writeFileSync('docs/CARDS.md', md);
const json = [...SURVIVORS, ...OPERATIONS, ...BASES, RAID, CISTERN].map((c) => ({
  id: c.id, name: c.name, kind: c.kind, cost: c.cost, junk: c.junk, countdown: c.countdown, draw: c.draw, hp: c.hp,
  abilities: c.abilities.map((a) => ({ cost: a.cost, text: a.text })), trait: c.trait, effect: c.effectText, copies: c.copies, flavor: c.flavor,
}));
writeFileSync('docs/cards.json', JSON.stringify(json, null, 2));
console.log('docs/CARDS.md + docs/cards.json written');
