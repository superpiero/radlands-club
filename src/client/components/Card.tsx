import { useId, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { CARDS, JUNK_LABEL } from '../../engine/cards';
import { Icon, JUNK_ICON } from './Icon';
import { useZoom } from '../zoom';
import { ART_IDS, ART_VERSION } from '../gen/art';

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

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Far-skyline motifs (original vector silhouettes), picked per card. */
const SKYLINES: ((y: number) => string)[] = [
  // mesas
  (y) => `M0 ${y} L8 ${y} L10 ${y - 9} L24 ${y - 10} L27 ${y} L44 ${y} L47 ${y - 6} L58 ${y - 7} L60 ${y} L76 ${y} L79 ${y - 13} L92 ${y - 12} L95 ${y} L100 ${y} V70 H0Z`,
  // ruined city
  (y) => `M0 ${y} V${y - 6} H5 V${y - 14} H9 V${y - 9} H13 V${y - 18} H16 L18 ${y - 15} V${y - 7} H24 V${y - 11} H28 V${y} H40 V${y - 8} H43 V${y - 20} H47 L49 ${y - 16} V${y - 4} H62 V${y - 12} H66 V${y - 9} H70 V${y} H82 V${y - 15} H85 L87 ${y - 11} H90 V${y - 5} H100 V70 H0Z`,
  // pylons & sagging cables
  (y) => `M0 ${y} H14 L17 ${y - 18} L20 ${y} H48 L51 ${y - 20} L54 ${y} H82 L85 ${y - 17} L88 ${y} H100 V70 H0Z M17 ${y - 16} Q34 ${y - 10} 51 ${y - 18} L51 ${y - 17.4} Q34 ${y - 9.4} 17 ${y - 15.4}Z M51 ${y - 18} Q68 ${y - 11} 85 ${y - 15} L85 ${y - 14.4} Q68 ${y - 10.4} 51 ${y - 17.4}Z`,
  // water tower & shacks
  (y) => `M0 ${y} H10 V${y - 5} H18 V${y} H30 L31 ${y - 12} H29 V${y - 19} H39 V${y - 12} H37 L38 ${y} H58 V${y - 6} L62 ${y - 9} L66 ${y - 6} V${y} H84 V${y - 4} H92 V${y} H100 V70 H0Z`,
  // wreck hills
  (y) => `M0 ${y} Q10 ${y - 8} 20 ${y - 2} L24 ${y - 6} H32 L35 ${y - 2} Q50 ${y - 10} 64 ${y - 1} L68 ${y - 7} L78 ${y - 8} L81 ${y - 2} Q90 ${y - 6} 100 ${y - 1} V70 H0Z`,
];

/** Procedural wasteland illustration backdrop – unique per card id. */
export function Scene({ id, hue, kind }: { id: string; hue: number; kind: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const h = hashStr(id);
  const r = (n: number) => ((h >>> (n * 3)) % 1000) / 1000;
  const night = kind === 'operation';
  const raid = kind === 'raid';
  const sunX = 16 + r(1) * 68;
  const sunY = 12 + r(2) * 14;
  const a = 40 + r(3) * 8, b = 44 + r(4) * 8, c = 54 + r(5) * 6, d = 57 + r(6) * 6;
  const sky1 = night ? `hsl(${(hue + 220) % 360} 45% 16%)` : raid ? `hsl(${hue} 80% 30%)` : `hsl(${(hue + 10) % 360} 70% 76%)`;
  const sky2 = night ? `hsl(${hue} 45% 34%)` : raid ? `hsl(${(hue + 25) % 360} 90% 52%)` : `hsl(${(hue + 35) % 360} 85% 62%)`;
  const sun = night ? '#f6f1dc' : `hsl(${(hue + 40) % 360} 100% 88%)`;
  const sky = SKYLINES[h % SKYLINES.length];
  return (
    <svg className="scene" viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`sk${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky1} /><stop offset="1" stopColor={sky2} /></linearGradient>
        <radialGradient id={`sn${uid}`}><stop offset="0" stopColor={sun} stopOpacity="1" /><stop offset=".35" stopColor={sun} stopOpacity=".9" /><stop offset="1" stopColor={sun} stopOpacity="0" /></radialGradient>
        <linearGradient id={`gr${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={`hsl(${hue} 28% ${night ? 14 : 24}%)`} /><stop offset="1" stopColor={`hsl(${hue} 30% ${night ? 7 : 12}%)`} /></linearGradient>
      </defs>
      <rect width="100" height="70" fill={`url(#sk${uid})`} />
      <circle cx={sunX} cy={sunY} r={night ? 16 : 26} fill={`url(#sn${uid})`} opacity={night ? 0.5 : 0.85} />
      <circle cx={sunX} cy={sunY} r={night ? 4.5 : 7.5} fill={sun} opacity={night ? 0.9 : 0.95} />
      {night && Array.from({ length: 9 }, (_, i) => <circle key={i} cx={(i * 13 + r(i + 7) * 11) % 100} cy={3 + ((h >>> i) % 24)} r={0.35 + (i % 3) * 0.2} fill="#fff" opacity=".75" />)}
      <path d={sky(a)} fill={`hsl(${hue} ${night ? 25 : 30}% ${night ? 22 : 42}%)`} opacity=".55" />
      <path d={`M0 ${b} Q 22 ${b - 7} 45 ${b + 1} T 100 ${b - 1} V70 H0Z`} fill={`hsl(${hue} 32% ${night ? 16 : 30}%)`} opacity=".75" />
      <path d={`M0 ${c} Q 30 ${c - 6} 58 ${d} T 100 ${c} V70 H0Z`} fill={`url(#gr${uid})`} />
      {Array.from({ length: 7 }, (_, i) => <circle key={`d${i}`} cx={(r(i + 3) * 100 + i * 17) % 100} cy={20 + ((h >>> (i + 2)) % 40)} r=".45" fill="#fff" opacity=".35" />)}
      <ellipse cx="50" cy={c + 6} rx="22" ry="2.6" fill="#000" opacity=".35" />
    </svg>
  );
}

function longestWord(name: string): number {
  return Math.max(6, ...name.split(/\s+/).map((w) => w.length));
}

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
  const hasArt = ART_IDS.has(def.id);
  const cls = [
    'card', `k-${def.kind}`,
    p.compact && 'compact', p.className, p.onClick && 'clickable', p.damaged && 'damaged', p.destroyed && 'destroyed',
    p.notReady && !p.destroyed && 'notready', p.usable && 'usable', p.selected && 'selected',
    p.target && 'target', p.target && p.target !== 'danger' && p.target, p.dimmed && 'dimmed', p.enter && 'enter',
    def.rarity && def.collectible !== false && `r-${def.rarity}`, p.rarityFx && 'rfx', hasArt && 'has-art',
  ].filter(Boolean).join(' ');
  const hp = p.hp ?? def.hp ?? 2;
  const hover = p.noZoom ? undefined : () => zoom.set({ id: p.id, uid: p.uid });
  const leave = p.noZoom ? undefined : () => zoom.clear(p.id);
  const costVal = p.costOverride ?? def.cost;

  const art = hasArt ? (
    <div className="art art-img"><img src={`/art/${def.id}.webp?v=${ART_VERSION}`} alt="" loading="lazy" decoding="async" draggable={false} /></div>
  ) : (
    <div className="art" style={artStyle(def.hue, def.kind)}>
      <Scene id={def.id} hue={def.hue} kind={def.kind} />
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
        <div className="frame" />
        {art}
        <div className="bside">
          <div className="head">
            <div className="name" style={{ ['--nl' as string]: longestWord(def.name) }}>{def.name}</div>
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
      <div className="frame" />
      <div className="head">
        {costVal !== undefined && (
          <span className="cost" title="Cena ve vodě"><Icon name="water-drop" /><span>{costVal}</span></span>
        )}
        <div className="name" style={{ ['--nl' as string]: longestWord(def.name) }}>{def.name}</div>
        {def.kind === 'operation' && (
          <span className={`fuse ${def.countdown === 0 ? 'instant' : ''}`} title={def.countdown === 0 ? 'Okamžitá operace' : `Odpočet: ${def.countdown}`}>
            <Icon name="sands-of-time" />{def.countdown === 0 ? '⚡' : def.countdown}
          </span>
        )}
      </div>
      <div className={`art ${hasArt ? 'art-img' : ''}`} style={hasArt ? undefined : artStyle(def.hue, def.kind)}>
        {hasArt ? <img src={`/art/${def.id}.webp?v=${ART_VERSION}`} alt="" loading="lazy" decoding="async" draggable={false} /> : (
          <>
            <Scene id={def.id} hue={def.hue} kind={def.kind} />
            <div className="halftone" />
            <Icon name={def.icon} className="glyph" />
          </>
        )}
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
      {p.id === 'tulak' && ART_IDS.has('tulak') && <div className="art art-img"><img src={`/art/tulak.webp?v=${ART_VERSION}`} alt="" loading="lazy" draggable={false} /></div>}
      <svg className="backlogo" viewBox="0 0 64 64"><path d="M32 6c7 12 17 22 17 33a17 17 0 0 1-34 0c0-11 10-21 17-33z" fill="currentColor" /><path d="M24 41a8 8 0 0 0 8 8" stroke="#15110d" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>
      <div className="backtxt">{p.id === 'tulak' ? 'TULÁK' : 'KAPKA'}</div>
      {p.badges && <div className="badges">{p.badges}</div>}
    </div>
  );
}
