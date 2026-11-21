import { useState } from 'react';
import { CARDS } from '../../engine/cards';
import type { GameView } from '../../engine/view';
import { sfx } from '../sound';
import { Card } from './Card';
import { plural } from '../../shared/plural';
import { Panorama } from './Backdrop';

export function Draft({ view, onPick, mode }: { view: GameView; onPick: (bases: string[]) => void; mode: string }) {
  const me = view.you ?? 0;
  const pv = view.players[me];
  const opp = view.players[1 - me];
  const [picked, setPicked] = useState<string[]>([]);
  const opts = pv.draftOptions ?? [];

  if (pv.draftDone) {
    return (
      <div className="draft">
        <Panorama variant="page" />
        <h2>Základny vybrány</h2>
        <p className="muted">{mode === 'bot' ? 'Bot vybírá…' : `Čekám, až si ${opp.name} vybere základny…`}</p>
      </div>
    );
  }

  const toggle = (id: string) => {
    sfx.click();
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p));
  };
  const draws = picked.reduce((s, id) => s + (CARDS[id].draw ?? 0), 0);
  const order = ['levý', 'prostřední', 'pravý'];

  return (
    <div className="draft">
      <Panorama variant="page" />
      <h2>{pv.name}: vyber 3 základny</h2>
      <p className="muted" style={{ margin: 0, textAlign: 'center', maxWidth: 760 }}>
        Základny chráníš celou hru – když padnou všechny tři, prohráváš. Číslo s kartou udává, kolik karet si za základnu líznete do začáteční ruky.
        Pořadí kliknutí určuje sloupec (1. = levý).
      </p>
      <div className="grid">
        {opts.map((id) => {
          const i = picked.indexOf(id);
          return (
            <div key={id} style={{ position: 'relative' }}>
              {i >= 0 && <div className="ordernum" title={`${order[i]} sloupec`}>{i + 1}</div>}
              <Card id={id} className={i >= 0 ? 'picked' : ''} onClick={() => toggle(id)} />
            </div>
          );
        })}
      </div>
      <div className="row">
        <span className="sum">Začáteční ruka: <b>{draws}</b> {plural(draws, 'karta', 'karty', 'karet')}</span>
        <button className="btn primary" disabled={picked.length !== 3} onClick={() => { sfx.play(); onPick(picked); }}>
          Potvrdit základny ({picked.length}/3)
        </button>
      </div>
      <p className="muted">{opp.draftDone ? `${opp.name} už má vybráno.` : `${opp.name} vybírá…`}</p>
    </div>
  );
}
