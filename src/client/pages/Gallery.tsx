import { useState } from 'react';
import { BASES, CISTERN, JUNK_LABEL, OPERATIONS, RAID, SURVIVORS, type CardDef } from '../../engine/cards';
import { go } from '../App';
import { Card, CardBack } from '../components/Card';
import { Icon } from '../components/Icon';

type Filter = 'all' | 'survivor' | 'operation' | 'base' | 'special';
const RARITY_NAME: Record<string, string> = { common: 'běžná', uncommon: 'neobvyklá', rare: 'vzácná', legendary: 'legendární' };

export function Gallery() {
  const [f, setF] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const match = (c: CardDef) => {
    if (!q.trim()) return true;
    const s = `${c.name} ${c.trait ?? ''} ${c.effectText ?? ''} ${c.abilities.map((a) => a.text).join(' ')} ${c.junk ? JUNK_LABEL[c.junk] : ''}`.toLowerCase();
    return s.includes(q.trim().toLowerCase());
  };
  const section = (title: string, cards: CardDef[], bases = false) => {
    const list = cards.filter(match);
    if (!list.length) return null;
    return (
      <>
        <h2>{title} <span className="muted" style={{ fontSize: 18 }}>({list.length})</span></h2>
        <div className={`gallery ${bases ? 'bases' : ''}`}>
          {list.map((c) => (
            <div key={c.id}>
              <Card id={c.id} noZoom rarityFx />
              <div className="copies">{c.copies > 0 ? `${c.copies}× v klasickém balíčku · ${RARITY_NAME[c.rarity ?? 'common']}` : bases ? `Zásoby: ${c.draw}` : `Jen sběratelský režim · ${RARITY_NAME[c.rarity ?? 'common']}`}</div>
            </div>
          ))}
        </div>
      </>
    );
  };
  const total = [...SURVIVORS, ...OPERATIONS].reduce((s, c) => s + c.copies, 0);
  return (
    <div className="page">
      <div className="inner" style={{ width: 'min(1200px, 100%)' }}>
        <div className="topnav">
          <button className="btn small" onClick={() => go('/')}><Icon name="return-arrow" /> Domů</button>
          <button className="btn small" onClick={() => go('/rules')}><Icon name="rule-book" /> Pravidla</button>
        </div>
        <h1>Databáze karet</h1>
        <p className="muted">Klasický balíček: {total} karet ({SURVIVORS.filter((c) => c.copies > 0).length} druhů přeživších a {OPERATIONS.filter((c) => c.copies > 0).length} druhů operací, vše 2×). Sběratelský režim přidává {[...SURVIVORS, ...OPERATIONS].filter((c) => c.copies === 0).length} vzácných a legendárních karet. Základen je {BASES.length} – do každé hry se jich použije 6.</p>
        <div className="filters">
          {(['all', 'survivor', 'operation', 'base', 'special'] as Filter[]).map((k) => (
            <button key={k} className={`btn small ${f === k ? 'primary' : ''}`} onClick={() => setF(k)}>
              {{ all: 'Vše', survivor: 'Přeživší', operation: 'Operace', base: 'Základny', special: 'Speciální' }[k]}
            </button>
          ))}
          <input className="field" style={{ maxWidth: 260 }} placeholder="Hledat (např. nálož, voda…)" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {(f === 'all' || f === 'survivor') && section('Přeživší', SURVIVORS)}
        {(f === 'all' || f === 'operation') && section('Operace', OPERATIONS)}
        {(f === 'all' || f === 'base') && section('Základny', BASES, true)}
        {(f === 'all' || f === 'special') && (
          <>
            <h2>Speciální karty</h2>
            <div className="gallery">
              <div><Card id={RAID.id} noZoom /><div className="copies">1× každý hráč</div></div>
              <div><Card id={CISTERN.id} noZoom /><div className="copies">1× každý hráč</div></div>
              <div><CardBack id="tulak" noZoom /><div className="copies">Tulák (rub karty)</div></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
