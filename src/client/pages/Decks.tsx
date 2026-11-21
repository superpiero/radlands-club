import { useEffect, useMemo, useRef, useState } from 'react';
import { CARDS, type CardDef } from '../../engine/cards';
import {
  autoDeck, collectibleCards, DECK_MAX, DECK_MIN, deckSize, maxCopies, RARITY_LABEL, type Rarity, validateDeck,
} from '../../shared/collection';
import { go } from '../App';
import { Gate } from '../components/Gate';
import { deleteDeck, refreshProfile, saveDeck, selectDeck, selectedDeck, useAccount } from '../account';
import { Card } from '../components/Card';
import { Drop, Icon } from '../components/Icon';
import { sfx } from '../sound';

type KindF = 'all' | 'survivor' | 'operation';

export function Decks() {
  const acc = useAccount();
  const p = acc.profile;
  const [deckId, setDeckId] = useState<string | null>(null);
  const [name, setName] = useState('Nový balíček');
  const [cards, setCards] = useState<Record<string, number>>({});
  const [kind, setKind] = useState<KindF>('all');
  const [rar, setRar] = useState<Rarity | 'all'>('all');
  const [q, setQ] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { void refreshProfile(); }, []);
  // load the selected deck once, when the profile first arrives
  const loaded = useRef(false);
  useEffect(() => {
    if (!p || loaded.current) return;
    loaded.current = true;
    const id = selectedDeck();
    const d = p.decks.find((x) => x.id === id) ?? p.decks[0];
    if (d) { setDeckId(d.id); setName(d.name); setCards({ ...d.cards }); }
  }, [p, deckId]);

  const col = p?.collection ?? {};
  const all = useMemo(() => collectibleCards(), []);
  const list = all.filter((c) => {
    if (kind !== 'all' && c.kind !== kind) return false;
    if (rar !== 'all' && c.rarity !== rar) return false;
    if (ownedOnly && !(col[c.id] > 0)) return false;
    if (q.trim()) {
      const s = `${c.name} ${c.trait ?? ''} ${c.effectText ?? ''} ${c.abilities.map((a) => a.text).join(' ')}`.toLowerCase();
      if (!s.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  }).sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0) || a.name.localeCompare(b.name, 'cs'));

  if (!acc.session) {
    return (
      <Gate title="Kolekce a balíčky" text="Postav si vlastní balíček z karet, které nasbíráš. Kolekci mají registrovaní hráči." />
    );
  }
  if (!p) return <div className="waiting"><div className="panel">Načítám kolekci…</div></div>;

  const size = deckSize(cards);
  const errs = validateDeck(cards, col);
  const add = (c: CardDef) => {
    const n = cards[c.id] ?? 0;
    if (n >= Math.min(maxCopies(c.id), col[c.id] ?? 0)) { sfx.error(); return; }
    if (size >= DECK_MAX) { sfx.error(); setMsg(`Maximum je ${DECK_MAX} karet.`); return; }
    sfx.click();
    setCards({ ...cards, [c.id]: n + 1 });
    setDirty(true);
  };
  const remove = (id: string) => {
    const n = cards[id] ?? 0;
    if (!n) return;
    sfx.click();
    const next = { ...cards };
    if (n === 1) delete next[id]; else next[id] = n - 1;
    setCards(next);
    setDirty(true);
  };
  const curve = [0, 1, 2, 3, 4].map((cost) => Object.entries(cards).filter(([id]) => Math.min(4, CARDS[id]?.cost ?? 0) === cost).reduce((s, [, n]) => s + n, 0));
  const curveMax = Math.max(1, ...curve);
  const nSurv = Object.entries(cards).filter(([id]) => CARDS[id]?.kind === 'survivor').reduce((s, [, n]) => s + n, 0);
  const owned = all.filter((c) => (col[c.id] ?? 0) > 0).length;
  const deckList = Object.entries(cards).map(([id, n]) => ({ def: CARDS[id], n })).filter((x) => x.def).sort((a, b) => (a.def.cost ?? 0) - (b.def.cost ?? 0) || a.def.name.localeCompare(b.def.name, 'cs'));

  const save = async () => {
    try {
      const id = await saveDeck({ id: deckId ?? undefined, name, cards });
      setDeckId(id);
      selectDeck(id);
      setDirty(false);
      setMsg(errs.length ? 'Uloženo (zatím neúplné – ke hře musí být platný).' : 'Uloženo ✓ – balíček je vybraný pro hru.');
      sfx.heal();
    } catch (e) {
      setMsg((e as Error).message);
      sfx.error();
    }
  };

  return (
    <div className="page deckpage">
      <div className="inner" style={{ width: 'min(1400px, 100%)' }}>
        <div className="topnav">
          <button className="btn small" onClick={() => { if (!dirty || confirm('Neuložené změny se ztratí. Odejít?')) go('/'); }}><Icon name="return-arrow" /> Domů</button>
          <button className="btn small" onClick={() => go('/boosters')}>Boostery {p.unopened > 0 && <span className="pill turn">{p.unopened}</span>}</button>
          <div style={{ flex: 1 }} />
          <span className="pill"><Icon name="water-drop" /> {p.kapky} kapek</span>
          <span className="pill">Kolekce: {owned}/{all.length}</span>
        </div>
        <h1>Kolekce a balíčky</h1>
        <div className="deck-layout">
          <section>
            <div className="filters">
              {(['all', 'survivor', 'operation'] as KindF[]).map((k) => (
                <button key={k} className={`btn small ${kind === k ? 'primary' : ''}`} onClick={() => setKind(k)}>{{ all: 'Vše', survivor: 'Přeživší', operation: 'Operace' }[k]}</button>
              ))}
              <select className="field" style={{ width: 150 }} value={rar} onChange={(e) => setRar(e.target.value as Rarity | 'all')}>
                <option value="all">Všechny vzácnosti</option>
                {(['common', 'uncommon', 'rare', 'legendary'] as Rarity[]).map((r) => <option key={r} value={r}>{RARITY_LABEL[r]}</option>)}
              </select>
              <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} /> jen vlastněné</label>
              <input className="field" style={{ maxWidth: 220 }} placeholder="Hledat…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="gallery collection-grid">
              {list.map((c) => {
                const have = col[c.id] ?? 0;
                const inDeck = cards[c.id] ?? 0;
                return (
                  <div key={c.id} className={`colcard ${have ? '' : 'unowned'}`}>
                    <Card id={c.id} noZoom onClick={() => add(c)} count={have ? `${inDeck}/${Math.min(have, maxCopies(c.id))}` : '0'} rarityFx />
                    <div className="copies">{have ? `Máš ${have}×` : 'Nemáš'} · {RARITY_LABEL[(c.rarity ?? 'common') as Rarity]}</div>
                  </div>
                );
              })}
              {list.length === 0 && <p className="muted">Nic neodpovídá filtru.</p>}
            </div>
          </section>
          <aside className="deck-panel panel">
            <div className="row">
              <select className="field" style={{ flex: 1 }} value={deckId ?? ''} onChange={(e) => {
                if (dirty && !confirm('Neuložené změny se ztratí. Pokračovat?')) return;
                const d = p.decks.find((x) => x.id === e.target.value);
                if (d) { setDeckId(d.id); setName(d.name); setCards({ ...d.cards }); selectDeck(d.id); setDirty(false); }
              }}>
                {p.decks.map((d) => <option key={d.id} value={d.id}>{d.name} ({deckSize(d.cards)})</option>)}
                {deckId === null && <option value="">(nový)</option>}
              </select>
              <button className="btn small" onClick={() => { setDeckId(null); setName('Nový balíček'); setCards({}); setDirty(true); }}>Nový</button>
            </div>
            <input className="field" value={name} maxLength={30} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
            <div className="deck-stats">
              <b className={size < DECK_MIN || size > DECK_MAX ? 'bad' : 'ok'}>{size} karet (min {DECK_MIN}, max {DECK_MAX})</b>
              <span className="muted">{nSurv} přeživších · {size - nSurv} operací</span>
            </div>
            <div className="curve" title="Rozložení cen (0–4+)">
              {curve.map((n, i) => (
                <div key={i} className="bar"><div className="fill" style={{ height: `${(n / curveMax) * 100}%` }} /><span>{n}</span><small>{i === 4 ? '4+' : i}<Drop /></small></div>
              ))}
            </div>
            <div className="decklist">
              {deckList.length === 0 && <p className="muted">Klikáním na karty vlevo je přidáš do balíčku.</p>}
              {deckList.map(({ def, n }) => (
                <div key={def.id} className={`dl r-${def.rarity}`} onClick={() => remove(def.id)} title="Kliknutím odebereš">
                  <span className="dc">{def.cost ?? 0}</span>
                  <span className="dn">{def.name}</span>
                  <span className="dx">{n > 1 ? `×${n}` : ''}</span>
                </div>
              ))}
            </div>
            {errs.length > 0 && size > 0 && <div className="why">{errs[0]}</div>}
            {msg && <div className="muted">{msg}</div>}
            <div className="row">
              <button className="btn primary" onClick={save}>Uložit</button>
              <button className="btn" onClick={() => { setCards(autoDeck(col)); setDirty(true); sfx.play(); }} title="Sestaví balíček z tvé kolekce">Doplnit automaticky</button>
              {deckId && p.decks.length > 1 && (
                <button className="btn ghost small" onClick={async () => {
                  if (!confirm('Smazat balíček?')) return;
                  await deleteDeck(deckId);
                  const rest = p.decks.filter((d) => d.id !== deckId);
                  if (rest[0]) { setDeckId(rest[0].id); setName(rest[0].name); setCards({ ...rest[0].cards }); selectDeck(rest[0].id); } else { setDeckId(null); setCards({}); }
                  setDirty(false);
                }}>Smazat</button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
