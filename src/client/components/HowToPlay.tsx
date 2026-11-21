import { useState, type ReactNode } from 'react';
import { Card, CardBack } from './Card';
import { Icon } from './Icon';

interface Slide { title: string; body: ReactNode; visual: ReactNode }

const SLIDES: Slide[] = [
  {
    title: 'Cíl hry',
    body: <>Každý hráč má <b>3 základny</b>. Kdo jako první zničí všechny tři soupeřovy, <b>vyhrává</b> – okamžitě, i uprostřed tahu.</>,
    visual: <div className="ht-row"><Card id="studna" noZoom compact /><Card id="pevnost" noZoom compact /><Card id="krater" noZoom compact destroyed /></div>,
  },
  {
    title: 'Voda',
    body: <>Na začátku tahu dostaneš <b>3 vody</b> 💧 a lízneš kartu. Vodou platíš přeživší, operace i schopnosti. <b>Co neutratíš, propadne.</b> Zbyla 1? Vezmi Cisternu. Zbyly 2? Lízni kartu.</>,
    visual: <div className="ht-row ht-water">{[0, 1, 2].map((i) => <Icon key={i} name="water-drop" />)}</div>,
  },
  {
    title: 'Přeživší a krytí',
    body: <>Přeživší stavíš do sloupce <b>před základnu</b> (max. 2). Útočit jde jen na <b>nekryté</b> karty: ten vepředu kryje toho vzadu i základnu. Cenné postavy dávej dozadu.</>,
    visual: (
      <div className="ht-col">
        <Card id="bara" noZoom compact />
        <Card id="felcar" noZoom compact badges={<span className="badge b-shield"><Icon name="shield" /></span>} />
        <Card id="dilna" noZoom compact badges={<span className="badge b-shield"><Icon name="shield" /></span>} />
      </div>
    ),
  },
  {
    title: 'Rozebrání karet',
    body: <>Každou kartu z ruky můžeš místo zahrání <b>rozebrat</b> – zdarma ji odhodíš a provedeš efekt z ikony na kartě: Nájezd, Zranit, Opravit, Líznout, Tulák nebo Voda navíc.</>,
    visual: <div className="ht-row"><Card id="hana" noZoom /><div className="ht-arrow">→</div><div className="ht-junk"><Icon name="flaming-claw" /> Nájezd</div></div>,
  },
  {
    title: 'Operace a Nájezd',
    body: <>Operace se položí do <b>fronty</b> (místa 1–3) a odpočítávají se. Na začátku tvého tahu se vyhodnotí ta na místě 1. Tvůj <b>Nájezd</b> poškodí základnu, kterou si soupeř vybere – <b>i když je krytá</b>.</>,
    visual: <div className="ht-row"><Card id="karavana" noZoom /><Card id="najezd" noZoom /></div>,
  },
  {
    title: 'Stavy na stole',
    body: <>Svítící okraj = můžeš použít schopnost. Vybledlá karta s hodinami = už není připravená. Prasklina = poškozená (další zásah ji zničí). Tulák je karta lícem dolů – padne na první ránu.</>,
    visual: <div className="ht-row"><Card id="zved" noZoom compact usable /><Card id="pumpar" noZoom compact notReady="použito" /><Card id="kat" noZoom compact damaged /><CardBack id="tulak" noZoom compact /></div>,
  },
];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <div className="overlay" onClick={(e) => e.stopPropagation()}>
      <div className="modal panel howto">
        <div className="ht-step">Jak hrát · {i + 1}/{SLIDES.length}</div>
        <h2>{s.title}</h2>
        <div className="ht-visual" key={i}>{s.visual}</div>
        <p className="ht-body">{s.body}</p>
        <div className="ht-dots">{SLIDES.map((_, k) => <button key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Krok ${k + 1}`} />)}</div>
        <div className="row" style={{ justifyContent: 'center' }}>
          {i > 0 && <button className="btn" onClick={() => setI(i - 1)}>Zpět</button>}
          {!last && <button className="btn primary" onClick={() => setI(i + 1)}>Další</button>}
          {last && <button className="btn primary pulse" onClick={onClose}>Jdu hrát!</button>}
          {!last && <button className="btn ghost small" onClick={onClose}>Přeskočit</button>}
        </div>
      </div>
    </div>
  );
}
