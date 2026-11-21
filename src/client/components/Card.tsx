import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { CARDS, JUNK_LABEL } from '../../engine/cards';
import { Icon, JUNK_ICON } from './Icon';
import { useZoom } from '../zoom';

export interface CardProps {
  id: string;
  uid?: string;
  compact?: boolean;
  className?: string;
  onClick?: (e: MouseEvent) => void;
  damaged?: boolean;
  destroyed?: boolean;
  damage?: number;
  hp?: number;
  notReady?: string | null;
  usable?: boolean;
  selected?: boolean;
  target?: 'danger' | 'good' | 'neutral' | null;
  dimmed?: boolean;
  badges?: ReactNode;
  costOverride?: number;
  style?: CSSProperties;
  enter?: boolean;
  noZoom?: boolean;
  title?: string;
  /** Premium rarity frame + foil shimmer (collection / booster screens). */
  rarityFx?: boolean;
  /** Owned / in-deck counter shown in the corner (collection screens). */
  count?: ReactNode;
}

const RARITY_NAMES: Record<string, string> = { common: 'Běžná', uncommon: 'Neobvyklá', rare: 'Vzácná', legendary: 'Legendární' };

const KIND_LABEL: Record<string, string> = {
  survivor: 'Přeživší',
  operation: 'Operace',
  base: 'Základna',
  raid: 'Nájezd',
  cistern: 'Cisterna',
};

export function artStyle(hue: number, kind: string): CSSProperties {
  const sat = kind === 'operation' ? 45 : 55;
  return {
    background: `radial-gradient(circle at 50% 38%, hsl(${hue} ${sat}% 72%) 0%, hsl(${hue} ${sat}% 55%) 45%, hsl(${(hue + 20) % 360} ${sat - 10}% 32%) 100%)`,
  };
}

export function Card(p: CardProps) {
  const def = CARDS[p.id];
  const zoom = useZoom();
  if (!def || p.id === 'tulak') return <CardBack {...p} />;
  const cls = [
    'card', `k-${def.kind}`,
    p.compact && 'compact', p.className, p.onClick && 'clickable', p.damaged && 'damaged', p.destroyed && 'destroyed',
    p.notReady && !p.destroyed && 'notready', p.usable && 'usable', p.selected && 'selected',
    p.target && 'target', p.target && p.target !== 'danger' && p.target, p.dimmed && 'dimmed', p.enter && 'enter',
    def.rarity && def.collectible !== false && `r-${def.rarity}`, p.rarityFx && 'rfx',
  ].filter(Boolean).join(' ');
  const hp = p.hp ?? def.hp ?? 2;
  const hover = p.noZoom ? undefined : () => zoom.set({ id: p.id, uid: p.uid });
  const leave = p.noZoom ? undefined : () => zoom.clear(p.id);
  const costVal = p.costOverride ?? def.cost;

  const art = (
    <div className="art" style={artStyle(def.hue, def.kind)}>
      <div className="sunburst" />
      <div className="halftone" />
      <Icon name={def.icon} className="glyph" />
    </div>
  );

  const abilities = def.abilities.map((ab, i) => (
    <div className="ab" key={i}>
      <span className="abc"><Icon name="water-drop" />{ab.cost}</span>
      <span className="ab-text">{ab.text}</span>
    </div>
  ));

  const stateOverlays = (
    <>
      {p.damaged && !p.destroyed && <div className="crack" />}
      {p.destroyed && <div className="rubble" />}
      {p.destroyed && <div className="badge-stamp">ZNIČENO</div>}
      {p.damaged && !p.destroyed && def.kind !== 'base' && <div className="badge-stamp">POŠKOZEN</div>}
      {def.kind === 'base' && !p.destroyed && (p.damage ?? 0) > 0 && <div className="crack" />}
      {def.kind === 'base' && !p.destroyed && (p.damage ?? 0) > 0 && <div className="badge-stamp">POŠKOZENO</div>}
      {p.badges && <div className="badges">{p.badges}</div>}
      {def.rarity && def.collectible !== false && <div className="gem" title={RARITY_NAMES[def.rarity]} />}
      {p.rarityFx && (def.rarity === 'rare' || def.rarity === 'legendary') && <div className="foil" />}
      {p.count !== undefined && <div className="count-badge">{p.count}</div>}
    </>
  );

  if (def.kind === 'base') {
    return (
      <div className={cls} data-uid={p.uid} onClick={p.onClick} onMouseEnter={hover} onMouseLeave={leave} style={p.style} title={p.title}>
        <div className="tex" />
        {art}
        <div className="bside">
          <div className="head">
            <div className="name">{def.name}</div>
            <span className="draws" title="Počet karet, které si na začátku hry líznete"><Icon name="card-draw" />{def.draw}</span>
          </div>
          {hp > 2 && (
            <div className="hp">{Array.from({ length: hp - 1 }, (_, i) => <i key={i} className={i < (p.damage ?? 0) ? 'lost' : ''} />)}</div>
          )}
          <div className="text">
            {def.trait && <div className="trait"><span className="trait-text">{def.trait}</span>{p.compact && <span>⟨vlastnost⟩</span>}</div>}
            {abilities}
            {!def.trait && def.abilities.length === 0 && <div className="flavor">{def.flavor}</div>}
          </div>
        </div>
        {stateOverlays}
      </div>
    );
  }

  return (
    <div className={cls} data-uid={p.uid} onClick={p.onClick} onMouseEnter={hover} onMouseLeave={leave} style={p.style} title={p.title}>
      <div className="tex" />
      <div className="head">
        {costVal !== undefined && (
          <span className="cost" title="Cena ve vodě"><Icon name="water-drop" /><span>{costVal}</span></span>
        )}
        <div className="name">{def.name}</div>
        {def.kind === 'operation' && (
          <span className={`fuse ${def.countdown === 0 ? 'instant' : ''}`} title={def.countdown === 0 ? 'Okamžitá operace' : `Odpočet: ${def.countdown}`}>
            <Icon name="sands-of-time" />{def.countdown === 0 ? '⚡' : def.countdown}
          </span>
        )}
      </div>
      <div className="art" style={artStyle(def.hue, def.kind)}>
        <div className="sunburst" />
        <div className="halftone" />
        <Icon name={def.icon} className="glyph" />
        {def.junk && def.kind !== 'cistern' && (
          <div className="junk" title={`Rozebrání: ${JUNK_LABEL[def.junk]}`}><Icon name={JUNK_ICON[def.junk]} />{!p.compact && JUNK_LABEL[def.junk]}</div>
        )}
      </div>
      {def.kind === 'operation' && <div className="stamp">OPERACE</div>}
      <div className="typeline">{KIND_LABEL[def.kind]}</div>
      <div className="text">
        {def.trait && <div className="trait"><span className="trait-text">{def.trait}</span>{p.compact && <span>⟨vlastnost⟩</span>}</div>}
        {abilities}
        {def.effectText && <div className="ab"><span className="ab-text">{def.effectText}</span>{p.compact && <span>efekt</span>}</div>}
        {!p.compact && def.abilities.length === 0 && !def.effectText && !def.trait && <div className="flavor">{def.flavor}</div>}
      </div>
      {stateOverlays}
    </div>
  );
}

export function CardBack(p: CardProps & { label?: string }) {
  const zoom = useZoom();
  const cls = ['card', 'k-back', p.compact && 'compact', p.className, p.onClick && 'clickable', p.target && 'target', p.target && p.target !== 'danger' && p.target, p.dimmed && 'dimmed', p.enter && 'enter', p.selected && 'selected'].filter(Boolean).join(' ');
  return (
    <div className={cls} data-uid={p.uid} onClick={p.onClick} style={p.style} onMouseEnter={p.noZoom ? undefined : () => zoom.set({ id: 'tulak', uid: p.uid })} onMouseLeave={p.noZoom ? undefined : () => zoom.clear('tulak')}>
      <svg className="backlogo" viewBox="0 0 64 64"><path d="M32 6c7 12 17 22 17 33a17 17 0 0 1-34 0c0-11 10-21 17-33z" fill="currentColor" /><path d="M24 41a8 8 0 0 0 8 8" stroke="#15110d" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>
      <div className="backtxt">{p.id === 'tulak' ? 'TULÁK' : 'KAPKA'}</div>
      {p.badges && <div className="badges">{p.badges}</div>}
    </div>
  );
}
