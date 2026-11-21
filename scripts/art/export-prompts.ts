// Writes docs/ART-PROMPTS.md (+ docs/art-prompts.json) with copy-paste prompts for ChatGPT image generation.
//   npx tsx scripts/art/export-prompts.ts
import { writeFileSync } from 'node:fs';
import { CARDS } from '../../src/engine/cards';
import { ART, ART_STYLE } from './prompts';

const groups: [string, (id: string) => boolean][] = [
  ['Přeživší', (id) => CARDS[id]?.kind === 'survivor' && id !== 'tulak'],
  ['Operace', (id) => CARDS[id]?.kind === 'operation'],
  ['Základny (na šířku)', (id) => CARDS[id]?.kind === 'base'],
  ['Speciální', (id) => ['najezd', 'cisterna', 'tulak'].includes(id)],
  ['Herní stůl a produkt', (id) => ['playmat', 'cardback', 'booster'].includes(id)],
];

export function fullPrompt(id: string): string {
  const spec = ART[id];
  const ratio = spec.landscape ? 'Landscape 3:2 format.' : 'Portrait 2:3 format.';
  return `${ART_STYLE} ${ratio} ${spec.subject}`;
}

let md = `# Zadání ilustrací pro ChatGPT – Poslední kapka

Celkem **${Object.keys(ART).length} obrázků**. Ke každé kartě je jedno zadání a název souboru.

## Postup
1. V ChatGPT založ **nový chat** (aby se styl nemíchal s ničím jiným).
2. Pošli první zprávu **„Styl“** níže – ChatGPT si zapamatuje art direction.
3. Pak posílej zadání jednotlivých karet (stačí vždy jen řádek *Subject*). Když chceš jistotu stejného stylu, kopíruj celé dlouhé zadání.
4. Obrázek stáhni a **pojmenuj přesně podle názvu souboru** (např. \`pumpar.png\`). Na příponě nezáleží (png/jpg/webp).
5. Hotové obrázky mi pošli sem do chatu (klidně po skupinách nebo jako .zip). Zbytek udělám já: zmenším je, převedu do WebP a zapojím do hry.

Tipy: ilustrace postav a operací chtěj **na výšku (2:3)**, základny **na šířku (3:2)**. Když se obrázek nepovede (text v obraze, rámeček), napiš ChatGPT „bez textu a bez rámečku, jen ilustrace“ a vygeneruj znovu.

## Styl (pošli jako první zprávu)

\`\`\`
${ART_STYLE}
Remember this art direction for all following images in this chat. Each next message describes one card illustration.
\`\`\`
`;

for (const [title, pred] of groups) {
  const ids = Object.keys(ART).filter(pred);
  md += `\n## ${title} (${ids.length})\n`;
  for (const id of ids) {
    const spec = ART[id];
    md += `\n### ${CARDS[id]?.name ?? id} → \`${id}.png\` (${spec.landscape ? 'na šířku 3:2' : 'na výšku 2:3'})\n\n`;
    md += `Krátce (když už je styl v chatu):\n\n\`\`\`\n${spec.landscape ? 'Landscape 3:2.' : 'Portrait 2:3.'} ${spec.subject}\n\`\`\`\n\n`;
    md += `<details><summary>Celé zadání</summary>\n\n\`\`\`\n${fullPrompt(id)}\n\`\`\`\n</details>\n`;
  }
}

writeFileSync('docs/ART-PROMPTS.md', md);
const json = Object.keys(ART).map((id) => ({
  id, name: CARDS[id]?.name ?? id, kind: CARDS[id]?.kind ?? 'special', landscape: !!ART[id].landscape,
  file: `${id}.png`, short: `${ART[id].landscape ? 'Landscape 3:2.' : 'Portrait 2:3.'} ${ART[id].subject}`, full: fullPrompt(id),
}));
writeFileSync('docs/art-prompts.json', JSON.stringify({ style: ART_STYLE, items: json }, null, 1));
console.log(`docs/ART-PROMPTS.md: ${json.length} prompts`);
