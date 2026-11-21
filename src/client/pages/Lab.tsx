// QA page (#/lab, not linked from the menu): every card layout at every size the game uses.
import type { CSSProperties } from 'react';
import { Card, CardBack } from '../components/Card';

const SURV = ['bara', 'hana', 'marta', 'prospektorka', 'prorok', 'pumpar', 'bedrich', 'doktorka'];
const OPS = ['delostrelectvo', 'vymena', 'poslednikapka', 'kyselydest', 'sanitka'];
const BASES = ['bunkr', 'vezeni', 'hnizdo', 'radiostanice', 'krater', 'nemocnice'];

const SIZES: { label: string; w: number; h: number; compact?: boolean }[] = [
  { label: 'stůl – malý (54×75)', w: 54, h: 75, compact: true },
  { label: 'stůl – telefon (70×97)', w: 70, h: 97, compact: true },
  { label: 'stůl – desktop (104×144)', w: 104, h: 144, compact: true },
  { label: 'ruka (105×146)', w: 105, h: 146 },
  { label: 'ruka – telefon otevřená (166×230)', w: 166, h: 230 },
  { label: 'galerie (194×270)', w: 194, h: 270 },
  { label: 'booster (216×300)', w: 216, h: 300 },
  { label: 'detail (238×330)', w: 238, h: 330 },
];
const BASE_SIZES: { label: string; w: number; h: number; compact?: boolean }[] = [
  { label: 'stůl – malá (100×52)', w: 100, h: 52, compact: true },
  { label: 'stůl – telefon (130×68)', w: 130, h: 68, compact: true },
  { label: 'stůl – desktop (192×101)', w: 192, h: 101, compact: true },
  { label: 'galerie / detail (300×186)', w: 300, h: 186 },
  { label: 'velká (330×205)', w: 330, h: 205 },
];

const sz = (w: number, h: number): CSSProperties => ({ ['--w' as string]: `${w}px`, ['--h' as string]: `${h}px` });

export function Lab() {
  return (
    <div className="lab">
      <h1 className="stencil">Card lab</h1>
      {SIZES.map((s) => (
        <section key={s.label} data-lab={s.label}>
          <h3>{s.label}</h3>
          <div className="lab-row">
            {[...SURV, ...OPS].map((id) => <Card key={id} id={id} noZoom compact={s.compact} style={sz(s.w, s.h)} />)}
            <Card id="bara" noZoom compact={s.compact} damaged style={sz(s.w, s.h)} />
            <Card id="cisterna" noZoom compact={s.compact} style={sz(s.w, s.h)} />
            <Card id="najezd" noZoom compact={s.compact} style={sz(s.w, s.h)} />
            <CardBack id="tulak" noZoom compact={s.compact} style={sz(s.w, s.h)} />
            <CardBack id="deck" noZoom compact={s.compact} style={sz(s.w, s.h)} />
            <Card id="prorok" noZoom compact={s.compact} rarityFx style={sz(s.w, s.h)} />
            <Card id="pumpar" noZoom compact={s.compact} count="1/2" rarityFx style={sz(s.w, s.h)} />
          </div>
        </section>
      ))}
      {BASE_SIZES.map((s) => (
        <section key={s.label} data-lab={s.label}>
          <h3>{s.label}</h3>
          <div className="lab-row">
            {BASES.map((id) => <Card key={id} id={id} noZoom compact={s.compact} style={sz(s.w, s.h)} />)}
            <Card id="hnizdo" noZoom compact={s.compact} damage={1} hp={3} style={sz(s.w, s.h)} />
            <Card id="bunkr" noZoom compact={s.compact} destroyed style={sz(s.w, s.h)} />
          </div>
        </section>
      ))}
    </div>
  );
}
