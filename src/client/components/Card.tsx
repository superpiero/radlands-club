import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
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

/**
 * Curated wasteland palettes (sun-bleached desert; teal only where water lives).
 * sky top/bottom, sun, far skyline, mid dunes, ground top/bottom, dust motes.
 */
export interface Palette { sky: [string, string]; sun: string; far: string; mid: string; ground: [string, string]; dust: string; night?: boolean }
export const PALETTES: Record<string, Palette> = {
  noon:    { sky: ['#f4e4c1', '#e6b479'], sun: '#fff7e0', far: '#c4885a', mid: '#9c5a35', ground: ['#6b3d22', '#2a180e'], dust: '#fff3d6' },
  dawn:    { sky: ['#f0d2b4', '#df966c'], sun: '#fff0d4', far: '#b0745a', mid: '#874a34', ground: ['#57301f', '#22130c'], dust: '#ffe6cf' },
  haze:    { sky: ['#e8dfc6', '#c8ae80'], sun: '#fffbea', far: '#a5946c', mid: '#7a6846', ground: ['#4f412b', '#1f190f'], dust: '#fff8e4' },
  copper:  { sky: ['#f1b47e', '#bc552d'], sun: '#ffe5b4', far: '#8a3c24', mid: '#662915', ground: ['#40180d', '#1a0a05'], dust: '#ffd9ad' },
  dust:    { sky: ['#e3c58f', '#b4854a'], sun: '#fbeac0', far: '#977041', mid: '#75512f', ground: ['#4a321e', '#1d140b'], dust: '#fff0cc' },
  well:    { sky: ['#d5e2d6', '#e2c497'], sun: '#fffcee', far: '#7c988b', mid: '#5c6d5a', ground: ['#3c3e2d', '#191911'], dust: '#f2fff9' },
  dusk:    { sky: ['#1f2433', '#6e4a3b'], sun: '#f3ead2', far: '#3b3237', mid: '#2a2226', ground: ['#1a1416', '#0b0809'], dust: '#f6ecd8', night: true },
  ember:   { sky: ['#1c1411', '#7a391e'], sun: '#ffd9a8', far: '#4a2416', mid: '#311710', ground: ['#1e0e09', '#0a0504'], dust: '#ffcf9c', night: true },
  moon:    { sky: ['#10222a', '#2e5a60'], sun: '#e9fbff', far: '#1c3a40', mid: '#14292e', ground: ['#0d1b1e', '#050b0c'], dust: '#dff8ff', night: true },
  storm:   { sky: ['#2e2a22', '#8a6a3e'], sun: '#f6e6c0', far: '#4a3d2b', mid: '#352b1f', ground: ['#211a12', '#0d0a07'], dust: '#f8e9c8', night: true },
  raid:    { sky: ['#3a120a', '#c4471f'], sun: '#ffd2a0', far: '#5a1a0c', mid: '#3e1208', ground: ['#250a05', '#0e0302'], dust: '#ffc69a' },
  cistern: { sky: ['#0f2b31', '#3f8f99'], sun: '#eafcff', far: '#1d4950', mid: '#143338', ground: ['#0c2226', '#040c0e'], dust: '#e6fbff', night: true },
};
const DAY = ['noon', 'dawn', 'haze', 'copper', 'dust'];
const NIGHT = ['dusk', 'ember', 'moon', 'storm'];

export function paletteFor(id: string, kind: string): Palette {
  const h = hashStr(id);
  if (kind === 'raid') return PALETTES.raid;
  if (kind === 'cistern') return PALETTES.cistern;
  if (kind === 'operation') return PALETTES[NIGHT[h % NIGHT.length]];
  if (CARDS[id]?.junk === 'water' && h % 2 === 0) return PALETTES.well;
  return PALETTES[DAY[h % DAY.length]];
}

/** Procedural wasteland illustration backdrop – unique per card id. */
export function Scene({ id, kind }: { id: string; hue?: number; kind: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const h = hashStr(id);
  const r = (n: number) => ((h >>> (n * 3)) % 1000) / 1000;
  const pal = paletteFor(id, kind);
  const night = !!pal.night;
  const sunX = 16 + r(1) * 68;
  const sunY = 12 + r(2) * 14;
  const a = 40 + r(3) * 8, b = 44 + r(4) * 8, c = 54 + r(5) * 6, d = 57 + r(6) * 6;
  const sky = SKYLINES[h % SKYLINES.length];
  return (
    <svg className="scene" viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`sk${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={pal.sky[0]} /><stop offset="1" stopColor={pal.sky[1]} /></linearGradient>
        <radialGradient id={`sn${uid}`}><stop offset="0" stopColor={pal.sun} stopOpacity="1" /><stop offset=".3" stopColor={pal.sun} stopOpacity=".75" /><stop offset="1" stopColor={pal.sun} stopOpacity="0" /></radialGradient>
        <linearGradient id={`gr${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={pal.ground[0]} /><stop offset="1" stopColor={pal.ground[1]} /></linearGradient>
        <linearGradient id={`hz${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={pal.sky[1]} stopOpacity="0" /><stop offset=".6" stopColor={pal.sky[1]} stopOpacity=".55" /><stop offset="1" stopColor={pal.sky[1]} stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="100" height="70" fill={`url(#sk${uid})`} />
      <circle cx={sunX} cy={sunY} r={night ? 16 : 28} fill={`url(#sn${uid})`} opacity={night ? 0.45 : 0.8} />
      <circle cx={sunX} cy={sunY} r={night ? 4.2 : 7} fill={pal.sun} opacity={night ? 0.92 : 0.96} />
      {night && Array.from({ length: 11 }, (_, i) => <circle key={i} cx={(i * 13 + r(i + 7) * 11) % 100} cy={3 + ((h >>> i) % 24)} r={0.3 + (i % 3) * 0.18} fill={pal.dust} opacity=".7" />)}
      <path d={sky(a)} fill={pal.far} opacity={night ? 0.8 : 0.6} />
      <rect y={a - 12} width="100" height="16" fill={`url(#hz${uid})`} />
      <path d={`M0 ${b} Q 22 ${b - 7} 45 ${b + 1} T 100 ${b - 1} V70 H0Z`} fill={pal.mid} opacity=".9" />
      <path d={`M0 ${c} Q 30 ${c - 6} 58 ${d} T 100 ${c} V70 H0Z`} fill={`url(#gr${uid})`} />
      {Array.from({ length: 7 }, (_, i) => <circle key={`d${i}`} cx={(r(i + 3) * 100 + i * 17) % 100} cy={20 + ((h >>> (i + 2)) % 40)} r=".4" fill={pal.dust} opacity=".4" />)}
      <ellipse cx="50" cy={c + 6} rx="22" ry="2.6" fill="#000" opacity=".35" />
    </svg>
  );
}

function longestWord(name: string): number {
  return Math.max(6, ...name.split(/\s+/).map((w) => w.length));
}

// Width of the longest word of a card name in `em` of the title font, so CSS can size names to fit exactly.
// The font is read from the --f-title token, so a new title face needs no code change.
const emCache = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null | undefined;
const fontWaiters = new Set<() => void>();
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.addEventListener('loadingdone', () => { nameStyleCache = null; for (const f of fontWaiters) f(); });
}
interface NameStyle { font: string; first: string; upper: boolean; ls: number }
let nameStyleCache: NameStyle | null = null;
/** Reads how card names are actually rendered (the theme may change font, weight, case or tracking). */
function nameStyle(): NameStyle {
  if (nameStyleCache) return nameStyleCache;
  const fallback: NameStyle = { font: '800 100px sans-serif', first: 'sans-serif', upper: true, ls: 0.03 };
  if (typeof document === 'undefined' || !document.body) return fallback;
  const probe = document.createElement('div');
  probe.className = 'card k-survivor';
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;--w:200px;--h:280px';
  probe.innerHTML = '<div class="head"><div class="name fit"><span class="nm">Ab</span></div></div>';
  document.body.appendChild(probe);
  try {
    const nm = probe.querySelector('.nm') as HTMLElement;
    const cs = getComputedStyle(nm);
    const size = parseFloat(cs.fontSize) || 16;
    const ls = cs.letterSpacing === 'normal' ? 0 : (parseFloat(cs.letterSpacing) || 0) / size;
    const upper = getComputedStyle(probe.querySelector('.name') as HTMLElement).textTransform === 'uppercase' || cs.textTransform === 'uppercase';
    const family = cs.fontFamily || 'sans-serif';
    return (nameStyleCache = { font: `${cs.fontStyle === 'italic' ? 'italic ' : ''}${cs.fontWeight} 100px ${family}`, first: family.split(',')[0].trim(), upper, ls });
  } finally {
    probe.remove();
  }
}
function nameEm(name: string): { em: number; exact: boolean } {
  const st = nameStyle();
  const key = `${st.font}|${st.upper}|${name}`;
  const hit = emCache.get(key);
  if (hit !== undefined) return { em: hit, exact: true };
  const words = (st.upper ? name.toUpperCase() : name).split(/\s+/);
  const longest = Math.max(...words.map((w) => w.length));
  try {
    const ready = document.fonts?.check(st.font.replace(/^.*?100px /, '100px '));
    if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d');
    if (ready && measureCtx) {
      measureCtx.font = st.font;
      // + the rendered letter-spacing and a hair of safety
      const em = Math.max(3, ...words.map((w) => measureCtx!.measureText(w).width / 100 + w.length * (st.ls + 0.012)));
      emCache.set(key, em);
      return { em, exact: true };
    }
  } catch { /* keep the estimate */ }
  return { em: Math.max(3, longest * 0.62), exact: false }; // until the font is ready
}

function CardName({ name }: { name: string }) {
  const [, bump] = useState(0);
  const { em, exact } = nameEm(name);
  useEffect(() => {
    if (exact) return;
    const f = () => bump((n) => n + 1);
    fontWaiters.add(f);
    return () => { fontWaiters.delete(f); };
  }, [exact]);
  return (
    <div className="name fit" style={{ ['--nl' as string]: longestWord(name), ['--nem' as string]: em.toFixed(3) }}>
      <span className="nm">{name}</span>
    </div>
  );
}

/** Background behind the procedural scene (shows while the SVG paints, and under the glyph). */
export function artStyle(_hue: number, kind: string, id = ''): CSSProperties {
  const pal = paletteFor(id, kind);
  return { background: `linear-gradient(180deg, ${pal.sky[0]} 0%, ${pal.sky[1]} 55%, ${pal.ground[1]} 100%)` };
}

/** Shrinks a text box until it fits its height (large bases have a narrow text column). */
function useFitText(ref: { current: HTMLElement | null }, on: boolean, key: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    const fit = () => {
      el.style.fontSize = '';
      const base = parseFloat(getComputedStyle(el).fontSize) || 12;
      let scale = 1;
      while (el.scrollHeight > el.clientHeight + 1 && scale > 0.62) {
        scale -= 0.05;
        el.style.fontSize = `${(base * scale).toFixed(2)}px`;
      }
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el.parentElement ?? el);
    const onFonts = () => fit();
    document.fonts?.addEventListener('loadingdone', onFonts);
    return () => { ro?.disconnect(); document.fonts?.removeEventListener('loadingdone', onFonts); };
  }, [on, key, ref]);
}

export function Card(p: CardProps) {
  const def = CARDS[p.id];
  const zoom = useZoom();
  const baseTextRef = useRef<HTMLDivElement>(null);
  useFitText(baseTextRef, !!def && def.kind === 'base' && !p.compact, p.id);
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
    <div className="art" style={artStyle(def.hue, def.kind, def.id)}>
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
            <CardName name={def.name} />
            <span className="draws" title="Počet karet, které si na začátku hry líznete"><Icon name="card-draw" />{def.draw}</span>
          </div>
          {hp > 2 && (
            <div className="hp">{Array.from({ length: hp - 1 }, (_, i) => <i key={i} className={i < (p.damage ?? 0) ? 'lost' : ''} />)}</div>
          )}
          <div className="text" ref={baseTextRef}>
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
        <CardName name={def.name} />
      </div>
      <div className={`art ${hasArt ? 'art-img' : ''}`} style={hasArt ? undefined : artStyle(def.hue, def.kind, def.id)}>
        {hasArt ? <img src={`/art/${def.id}.webp?v=${ART_VERSION}`} alt="" loading="lazy" decoding="async" draggable={false} /> : (
          <>
            <Scene id={def.id} hue={def.hue} kind={def.kind} />
            <div className="halftone" />
            <Icon name={def.icon} className="glyph" />
          </>
        )}
        {def.kind === 'operation' && (
          <span className={`fuse ${def.countdown === 0 ? 'instant' : ''}`} title={def.countdown === 0 ? 'Okamžitá operace – provede se hned' : `Odpočet: provede se za ${def.countdown} ${def.countdown === 1 ? 'tah' : 'tahy'}`}>
            {def.countdown === 0 ? <Icon name="focused-lightning" /> : <><Icon name="sands-of-time" />{def.countdown}</>}
          </span>
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
      {p.id !== 'tulak' && ART_IDS.has('cardback') && <div className="art art-img back-full"><img src={`/art/cardback.webp?v=${ART_VERSION}`} alt="" loading="lazy" draggable={false} /></div>}
      <svg className="backlogo" viewBox="0 0 64 64"><path d="M32 6c7 12 17 22 17 33a17 17 0 0 1-34 0c0-11 10-21 17-33z" fill="currentColor" /><path d="M24 41a8 8 0 0 0 8 8" stroke="#15110d" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>
      <div className="backtxt">{p.id === 'tulak' ? 'TULÁK' : 'KAPKA'}</div>
      {p.badges && <div className="badges">{p.badges}</div>}
    </div>
  );
}
