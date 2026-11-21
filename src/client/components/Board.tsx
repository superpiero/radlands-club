import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { CARDS, JUNK_LABEL, JUNK_TEXT } from '../../engine/cards';
import type { Action, CardInst, PlayerIdx, PromptOption } from '../../engine/types';
import type { BaseView, GameView, PersonView, PlayerView } from '../../engine/view';
import { go } from '../App';
import type { Conn, ConnState, NetConn } from '../conn';
import { EMOTES, isEmote } from '../../shared/protocol';
import { getFlag, setFlag } from '../prefs';
import { isMuted, setMuted, sfx } from '../sound';
import { zoomStore } from '../zoom';
import { Card, CardBack } from './Card';
import { FxLayer } from './FxLayer';
import { Icon, JUNK_ICON } from './Icon';
import { Sidebar } from './Sidebar';
import { confetti, Particles } from './Particles';

type Sel =
  | { kind: 'hand'; uid: string; x: number; y: number }
  | { kind: 'board'; uid: string; x: number; y: number }
  | { kind: 'cistern'; x: number; y: number }
  | { kind: 'endturn'; x: number; y: number };

const COLS = ['levý', 'prostřední', 'pravý'];

export function Board({ conn, state, view }: { conn: Conn; state: ConnState; view: GameView }) {
  const me: PlayerIdx = view.you ?? 0;
  const opp = (1 - me) as PlayerIdx;
  const spectator = view.you === null;
  const P = view.players[me];
  const O = view.players[opp];
  const pending = view.pending;
  const legal = view.legal;
  const myTurn = view.phase === 'play' && view.active === me && !spectator;
  const canAct = myTurn && !pending && view.step === 'actions';

  const [sel, setSel] = useState<Sel | null>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [banner, setBanner] = useState<{ text: string; mine: boolean; key: number } | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [inspect, setInspect] = useState<string | null>(null);
  const [handOpen, setHandOpen] = useState(false);
  const [muted, setMut] = useState(isMuted());
  const [tipsOn, setTipsOn] = useState(getFlag('tips', true));
  const [revealMin, setRevealMin] = useState(false);
  const prevHand = useRef<Set<string>>(new Set((P.hand ?? []).map((h) => h.uid)));
  const [newHand, setNewHand] = useState<Set<string>>(new Set());

  // reset transient UI when state changes
  useEffect(() => { setSel(null); }, [view.rev]);
  useEffect(() => { setMulti([]); setOrder([]); setRevealMin(false); }, [pending?.id]);
  useEffect(() => {
    const cur = new Set((P.hand ?? []).map((h) => h.uid));
    const fresh = new Set([...cur].filter((u) => !prevHand.current.has(u)));
    prevHand.current = cur;
    if (fresh.size) {
      setNewHand(fresh);
      const t = setTimeout(() => setNewHand(new Set()), 600);
      return () => clearTimeout(t);
    }
  }, [P.hand]);

  // game over sound
  const overRef = useRef(view.phase === 'over');
  useEffect(() => {
    if (view.phase === 'over' && !overRef.current) {
      if (view.winner === me) sfx.win(); else sfx.lose();
    }
    overRef.current = view.phase === 'over';
  }, [view.phase, view.winner, me]);

  const act = useCallback((a: Action) => { conn.act(a); }, [conn]);
  const answer = useCallback((choice: string[]) => { if (pending) { sfx.click(); act({ t: 'answer', promptId: pending.id, choice }); } }, [pending, act]);

  // ---- prompt option maps ----
  const optByUid = useMemo(() => {
    const m = new Map<string, PromptOption>();
    if (!pending) return m;
    for (const o of pending.options) {
      const r = o.ref;
      if (r && (r.t === 'person' || r.t === 'base' || r.t === 'event' || r.t === 'hand')) m.set(r.uid, o);
    }
    return m;
  }, [pending]);
  const slotOpts = useMemo(() => (pending ? pending.options.filter((o) => o.ref?.t === 'slot') : []), [pending]);
  const colOpts = useMemo(() => {
    const m = new Map<string, PromptOption>();
    if (pending) for (const o of pending.options) if (o.ref?.t === 'column') m.set(`${o.ref.player}:${o.ref.col}`, o);
    return m;
  }, [pending]);
  const modalMode = !!pending && (pending.kind === 'order' || pending.kind === 'reveal' || (!!pending.reveal && pending.options.some((o) => o.ref?.t === 'card')));
  const looseOpts = pending && !modalMode ? pending.options.filter((o) => !o.ref || o.ref.t === 'none' || o.ref.t === 'card') : [];

  // ---- interactions ----
  const clickCard = (uid: string, e: MouseEvent, kind: 'hand' | 'board') => {
    if (pending) {
      const o = optByUid.get(uid);
      // not an option: let the click bubble (e.g. to a highlighted column), or just show the card
      if (!o) {
        if (colOpts.size === 0) {
          e.stopPropagation();
          const id = idOf(uid);
          if (id) setInspect(id);
        }
        return;
      }
      e.stopPropagation();
      if (pending.kind === 'multi') {
        sfx.click();
        setMulti((m) => (m.includes(o.id) ? m.filter((x) => x !== o.id) : m.length < (pending.max ?? 99) ? [...m, o.id] : m));
      } else answer([o.id]);
      return;
    }
    e.stopPropagation();
    const mine = kind === 'hand' || P.columns.flat().some((x) => x.uid === uid) || P.bases.some((b) => b.uid === uid);
    if (!canAct || !mine) {
      const id = idOf(uid);
      if (id) setInspect(id);
      return;
    }
    sfx.click();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSel({ kind, uid, x: r.left + r.width / 2, y: kind === 'hand' ? r.top : r.top + r.height / 2 });
    if (kind === 'hand') setHandOpen(false);
  };
  const idOf = (uid: string): string | null => {
    for (const pl of view.players) {
      for (const x of pl.columns.flat()) if (x.uid === uid) return x.id;
      for (const b of pl.bases) if (b.uid === uid) return b.id;
      for (const e of pl.queue) if (e?.uid === uid) return e.id;
      for (const h of pl.hand ?? []) if (h.uid === uid) return h.id;
    }
    return null;
  };

  const clickCistern = (e: MouseEvent) => {
    e.stopPropagation();
    if (!canAct || !P.cisternHome) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSel({ kind: 'cistern', x: r.left + r.width / 2, y: r.top });
  };

  const endTurn = (e: MouseEvent) => {
    if (!canAct) return;
    const usable = (legal?.playable.length ?? 0) + (legal?.abilities.length ?? 0) + (legal?.canDraw ? 1 : 0);
    if (P.water > 0 && usable > 0) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setSel({ kind: 'endturn', x: r.left + r.width / 2, y: r.top });
      return;
    }
    act({ t: 'endTurn' });
  };

  // keyboard shortcuts
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Escape') {
        if (sel) setSel(null);
        else if (view.canCancel) act({ t: 'cancel' });
      }
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && view.canUndo) act({ t: 'undo' });
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [sel, view.canCancel, view.canUndo, act]);

  const viewRef = useRef(view);
  viewRef.current = view;
  const [recap, setRecap] = useState<{ lines: string[]; key: number } | null>(null);
  const onTurn = useCallback((p: PlayerIdx) => {
    if (spectator) return;
    setBanner({ text: p === me ? 'TVŮJ TAH' : `TAH: ${viewRef.current.players[p].name}`, mine: p === me, key: Date.now() });
    if (p === me && state.mode !== 'hotseat') {
      // summarise what the opponent did since their turn started
      const log = viewRef.current.log;
      let start = -1;
      for (let i = log.length - 1; i >= 0; i--) {
        if (log[i].kind === 'turn' && log[i].player === opp && log[i].text.startsWith('—')) { start = i; break; }
      }
      if (start >= 0) {
        const lines = log.slice(start + 1)
          .filter((e) => ['play', 'event', 'damage', 'destroy', 'win'].includes(e.kind) || (e.kind === 'info' && /Sabotáž|nálož|vrací|odkryl|Radar/.test(e.text)))
          .filter((e) => !(e.kind === 'turn'))
          .map((e) => e.text)
          .slice(-8);
        if (lines.length) setRecap({ lines, key: Date.now() });
      }
    }
  }, [me, opp, spectator, state.mode]);
  useEffect(() => {
    if (!recap) return;
    const t = setTimeout(() => setRecap(null), 9000);
    return () => clearTimeout(t);
  }, [recap]);
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 1600);
    return () => clearTimeout(t);
  }, [banner]);

  // ---- render helpers ----
  const personCard = (x: PersonView, owner: PlayerIdx, col: number, idx: number, len: number) => {
    const o = optByUid.get(x.uid);
    const mine = owner === me;
    const usable = canAct && mine && !!legal?.abilities.some((a) => a.uid === x.uid);
    const protectedNow = idx < len - 1 && !view.players[owner].exposed[col];
    const badges: ReactNode[] = [];
    if (protectedNow) badges.push(<span key="sh" className="badge b-shield" title="Krytý – nelze běžně zasáhnout"><Icon name="shield" /></span>);
    if (x.stunPending || x.stunned) badges.push(<span key="st" className="badge b-stun" title="Omráčený – v příštím tahu majitele nebude připravený"><Icon name="knockout" /></span>);
    if (x.stash > 0) badges.push(<span key="w" className="badge b-water" title="Uložená voda – +2 na začátku tahu"><Icon name="water-drop" />+2</span>);
    if (!x.faceDown && x.notReady && !x.damaged && (mine || x.stunned)) badges.push(<span key="nr" className="badge" title={x.notReady}><Icon name="hourglass" /></span>);
    const common = {
      uid: x.uid, compact: true, onClick: (e: MouseEvent) => clickCard(x.uid, e, 'board'),
      target: o ? (pending?.kind === 'multi' && multi.includes(o.id) ? 'neutral' as const : (o.tone ?? 'neutral')) : null,
      dimmed: !!pending && !o && optByUid.size > 0,
      enter: x.justPlayed,
      badges: badges.length ? badges : undefined,
      selected: sel?.kind === 'board' && sel.uid === x.uid,
    };
    if (x.faceDown) return <CardBack id="tulak" {...common} />;
    return <Card id={x.id} {...common} damaged={x.damaged} notReady={x.notReady} usable={usable && !pending} title={x.notReady ?? undefined} />;
  };

  const baseCard = (b: BaseView, owner: PlayerIdx, col: number) => {
    const o = optByUid.get(b.uid);
    const mine = owner === me;
    const usable = canAct && mine && !!legal?.abilities.some((a) => a.uid === b.uid);
    const pl = view.players[owner];
    const badges: ReactNode[] = [];
    if (!b.destroyed && pl.columns[col].length > 0 && !pl.exposed[col]) badges.push(<span key="sh" className="badge b-shield" title="Krytá – před ní stojí přeživší"><Icon name="shield" /></span>);
    if (b.immune) badges.push(<span key="im" className="badge b-immune" title="Bunkr je teď nezranitelný">NEZRANITELNÝ</span>);
    if (b.charge !== null) badges.push(<span key="ch" className="badge b-charge" title={`Nálož hráče ${view.players[b.charge].name} – vybuchne na začátku jeho tahu`}><Icon name="time-dynamite" />NÁLOŽ</span>);
    if (b.stored > 0) badges.push(<span key="st" className="badge b-water" title="Uložená voda"><Icon name="water-drop" />{b.stored}</span>);
    if (mine && !b.destroyed && !b.ready && CARDS[b.id].abilities.length) badges.push(<span key="nr" className="badge" title="Schopnost už byla v tomto tahu použita"><Icon name="hourglass" /></span>);
    return (
      <Card id={b.id} uid={b.uid} compact damage={b.damage} hp={b.hp} destroyed={b.destroyed}
        onClick={(e) => clickCard(b.uid, e, 'board')}
        target={o ? (o.tone ?? 'neutral') : null}
        dimmed={!!pending && !o && optByUid.size > 0}
        usable={usable && !pending}
        selected={sel?.kind === 'board' && sel.uid === b.uid}
        badges={badges.length ? badges : undefined} />
    );
  };

  const column = (owner: PlayerIdx, col: number) => {
    const pl = view.players[owner];
    const people = pl.columns[col];
    const colOpt = colOpts.get(`${owner}:${col}`);
    const ghosts = owner === me ? slotOpts.filter((o) => o.ref?.t === 'slot' && o.ref.col === col) : [];
    // build slot list from base outward: index 0 = back
    const items: ReactNode[] = [];
    const ghost = (o: PromptOption) => (
      <div key={o.id} className="slotp"><div className="ghost-slot" onClick={(e) => { e.stopPropagation(); answer([o.id]); }}>
        {o.ref?.t === 'slot' && o.ref.pos === 'front' ? 'SEM\n(vepředu)' : o.ref?.t === 'slot' && o.ref.pos === 'back' ? 'SEM\n(vzadu)' : 'SEM'}
      </div></div>
    );
    const back = ghosts.find((g) => g.ref?.t === 'slot' && g.ref.pos === 'back');
    const front = ghosts.find((g) => g.ref?.t === 'slot' && (g.ref.pos === 'front' || g.ref.pos === 'only'));
    if (back) items.push(ghost(back));
    people.forEach((x, idx) => items.push(<div key={x.uid} className="slotp">{personCard(x, owner, col, idx, people.length)}</div>));
    if (front) items.push(ghost(front));
    while (items.length < 2) items.push(<div key={`e${items.length}`} className="slotp empty" />);
    return (
      <div key={col} className={`col ${pl.exposed[col] ? 'exposed' : ''} ${colOpt ? 'col-target' : ''}`} onClick={colOpt ? (e) => { e.stopPropagation(); answer([colOpt.id]); } : undefined}>
        {pl.exposed[col] && <div className="exposed-tag">ODKRYTO</div>}
        <div data-col={`${owner}:${col}`}>{baseCard(pl.bases[col], owner, col)}</div>
        {items.slice(0, 2)}
      </div>
    );
  };

  const queue = (owner: PlayerIdx) => {
    const pl = view.players[owner];
    return (
      <div className="queue" title="Fronta operací: místo 1 se vyhodnotí na začátku příštího tahu majitele">
        {(owner === me ? [2, 1, 0] : [0, 1, 2]).map((i) => {
          const e = pl.queue[i];
          const o = e ? optByUid.get(e.uid) : undefined;
          return (
            <div key={i} className={`qslot ${i === 0 ? 'first' : ''} ${o ? `target-ev ${o.tone === 'danger' ? '' : 'neutral'}` : ''}`}>
              <span className="qn">{i + 1}</span>
              {e && (
                <div className={`qcard ${e.id === 'najezd' ? 'raid' : 'op'}`} data-uid={e.uid}
                  onMouseEnter={() => zoomStore.set({ id: e.id })} onMouseLeave={() => zoomStore.clear(e.id)}
                  onClick={(ev) => { ev.stopPropagation(); if (o) answer([o.id]); else setInspect(e.id); }}>
                  <Icon name={CARDS[e.id].icon} />{CARDS[e.id].name}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const homeZone = (owner: PlayerIdx) => {
    const pl = view.players[owner];
    const mine = owner === me;
    return (
      <div className="home-zone">
        <div className={`token raid ${pl.raidHome ? '' : 'away'}`} data-uid={`raidtok-${owner}`} onMouseEnter={() => zoomStore.set({ id: 'najezd' })} onMouseLeave={() => zoomStore.clear('najezd')}
          title={pl.raidHome ? 'Nájezd je doma – rozebráním karty s ikonou Nájezdu ho pošleš do fronty' : 'Nájezd je ve frontě'}>
          <Icon name="flaming-claw" />Nájezd
        </div>
        <div className={`token cistern ${pl.cisternHome ? '' : 'away'} ${mine && canAct && legal?.canTakeCistern ? 'clickable' : ''}`}
          onClick={mine ? clickCistern : undefined} onMouseEnter={() => zoomStore.set({ id: 'cisterna' })} onMouseLeave={() => zoomStore.clear('cisterna')}
          title={pl.cisternHome ? 'Cisterna: za 1 vodu ji vezmi do ruky, později ji rozeber za +1 vodu' : 'Cisterna je v ruce'}>
          <Icon name="oil-drum" />Cisterna
        </div>
      </div>
    );
  };

  const water = (pl: PlayerView, owner: PlayerIdx) => {
    const show = view.active === owner && view.phase === 'play';
    const n = show ? pl.water : 0;
    const drops = Math.max(3, n);
    return (
      <div className="waterpool" data-water={owner} title={`Voda k utracení v tomto tahu: ${n}`}>
        {Array.from({ length: Math.min(drops, 8) }, (_, i) => (
          <Icon key={i} name="water-drop" className={`wd ${i < n ? (i >= 3 ? 'extra' : '') : 'spent'}`} />
        ))}
        {drops > 8 && <span className="wcount">×{n}</span>}
        {pl.waterPenalty > 0 && <span className="pill" title="Sucho – příští tah o vodu méně">−{pl.waterPenalty} 💧</span>}
      </div>
    );
  };

  const emoteFor = (seat: PlayerIdx) => {
    const now = Date.now();
    const e = [...state.emotes].reverse().find((x) => x.seat === seat && now - x.ts < 2600);
    return e && isEmote(e.id) ? <div key={e.ts} className="emote-bubble" style={{ left: 60, top: seat === me ? -36 : 44 }}>{EMOTES[e.id]}</div> : null;
  };
  // re-render to expire emote bubbles
  const [, force] = useState(0);
  useEffect(() => {
    if (!state.emotes.length) return;
    const t = setTimeout(() => force((x) => x + 1), 2700);
    return () => clearTimeout(t);
  }, [state.emotes]);

  // ---- prompt bar ----
  const promptBar = () => {
    if (view.phase === 'over') return <div className="prompt wait"><span className="ptitle">Konec hry</span></div>;
    if (pending && !modalMode) {
      return (
        <div className="prompt">
          <span className="ptitle">{pending.title}</span>
          {pending.kind === 'multi' && <span className="muted">(vybráno {multi.length}/{pending.max})</span>}
          {looseOpts.length > 0 && (
            <div className="opts">
              {looseOpts.map((o) => <button key={o.id} className="btn small" onClick={() => answer([o.id])}>{o.label}</button>)}
            </div>
          )}
          {pending.kind === 'multi' && <button className="btn primary small" disabled={multi.length < (pending.min ?? 0)} onClick={() => answer(multi)}>Potvrdit</button>}
          {pending.optional && <button className="btn small" onClick={() => answer([])}>Přeskočit</button>}
          {view.canCancel && <button className="btn ghost small" onClick={() => act({ t: 'cancel' })}>Zrušit</button>}
        </div>
      );
    }
    if (view.waitingFor) {
      return <div className="prompt wait"><span className="ptitle">Čeká se na: {view.players[view.waitingFor.player].name} – {view.waitingFor.title}</span></div>;
    }
    if (view.phase === 'chooseFirst') return <div className="prompt wait"><span className="ptitle">Losuje se začínající hráč…</span></div>;
    if (canAct) {
      return (
        <div className="prompt wait">
          <span className="ptitle" style={{ color: 'var(--water-2)' }}>
            Tvůj tah · {P.water} {P.water === 1 ? 'voda' : P.water >= 2 && P.water <= 4 ? 'vody' : 'vod'} · klikni na kartu v ruce nebo na stole
          </span>
        </div>
      );
    }
    return (
      <div className="prompt wait">
        <span className="ptitle">{spectator ? `Na tahu: ${view.players[view.active].name}` : `Hraje ${O.name}${state.botThinking ? ' (přemýšlí…)' : '…'}`}</span>
      </div>
    );
  };

  // ---- popover ----
  const popover = () => {
    if (!sel) return null;
    const style = { left: Math.max(8, Math.min(window.innerWidth - 350, sel.x - 170)), top: undefined as number | undefined, bottom: undefined as number | undefined };
    if (sel.kind === 'hand' || sel.kind === 'cistern' || sel.kind === 'endturn') style.bottom = Math.max(8, window.innerHeight - sel.y + 8);
    else style.top = Math.min(window.innerHeight - 260, sel.y + 10);
    let body: ReactNode = null;
    if (sel.kind === 'endturn') {
      body = (
        <>
          <div className="ptitle">Ukončit tah?</div>
          <div className="muted">Zbývá ti {P.water} vody – nevyužitá voda na konci tahu propadá.</div>
          <button className="btn danger" onClick={() => { setSel(null); act({ t: 'endTurn' }); }}>Ano, ukončit tah</button>
          <button className="btn ghost" onClick={() => setSel(null)}>Ještě hraju</button>
        </>
      );
    } else if (sel.kind === 'cistern') {
      body = (
        <>
          <div className="ptitle">Cisterna</div>
          <button className="btn opt" disabled={!legal?.canTakeCistern} onClick={() => { setSel(null); act({ t: 'takeCistern' }); }}>
            Vzít do ruky (1 💧)<small>Později ji rozeber a získáš 1 vodu navíc – voda se tak přenese do dalšího tahu.</small>
          </button>
        </>
      );
    } else if (sel.kind === 'hand') {
      const c = P.hand?.find((h) => h.uid === sel.uid);
      if (!c) return null;
      const def = CARDS[c.id];
      const playable = legal?.playable.includes(c.uid);
      const why = legal?.blocked[c.uid];
      const cost = def.kind === 'survivor' ? legal?.personCost[c.uid] ?? def.cost : def.cost;
      body = (
        <>
          <div className="ptitle">{def.name}</div>
          {def.kind === 'survivor' && (
            <button className="btn opt primary" disabled={!playable} onClick={() => { setSel(null); act({ t: 'playPerson', uid: c.uid }); }}>
              Zahrát za {cost} 💧<small>Postav přeživšího do sloupce před základnu.</small>
            </button>
          )}
          {def.kind === 'operation' && (
            <button className="btn opt primary" disabled={!playable} onClick={() => { setSel(null); act({ t: 'playEvent', uid: c.uid }); }}>
              Zahrát za {def.cost} 💧<small>{def.countdown === 0 ? 'Okamžitě se vyhodnotí.' : `Do fronty na místo ${def.countdown}.`} {def.effectText}</small>
            </button>
          )}
          {!playable && why && def.kind !== 'cistern' && <div className="why">{why}</div>}
          <button className="btn opt" onClick={() => { setSel(null); act({ t: 'junk', uid: c.uid }); }}>
            <span><Icon name={JUNK_ICON[def.junk!]} /> Rozebrat: {def.kind === 'cistern' ? '+1 voda (Cisterna se vrátí)' : JUNK_LABEL[def.junk!]}</span>
            <small>{def.kind === 'cistern' ? 'Získáš 1 vodu navíc.' : `Karta se odhodí. ${JUNK_TEXT[def.junk!]}`}</small>
          </button>
        </>
      );
    } else if (sel.kind === 'board') {
      const person = P.columns.flat().find((x) => x.uid === sel.uid);
      const base = P.bases.find((b) => b.uid === sel.uid);
      const id = person ? person.id : base?.id;
      if (!id) return null;
      const def = CARDS[id];
      body = (
        <>
          <div className="ptitle">{person?.faceDown ? 'Tulák' : def.name}</div>
          {person?.faceDown && <div className="muted">Tulák nemá žádné schopnosti – jen chrání.</div>}
          {!person?.faceDown && def.abilities.length === 0 && <div className="muted">{def.trait ? `Vlastnost: ${def.trait}` : 'Tato karta nemá schopnost.'}</div>}
          {!person?.faceDown && def.abilities.map((ab, idx) => {
            const ok = legal?.abilities.some((a) => a.uid === sel.uid && a.idx === idx);
            const why = legal?.blocked[`${sel.uid}:${idx}`];
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button className="btn opt primary" disabled={!ok} onClick={() => { setSel(null); act({ t: 'ability', uid: sel.uid, idx }); }}>
                  Použít za {ab.cost} 💧<small>{ab.text}</small>
                </button>
                {!ok && why && <div className="why">{why}</div>}
              </div>
            );
          })}
        </>
      );
    }
    const detailId = sel.kind === 'hand' || sel.kind === 'board' ? idOf(sel.uid) : sel.kind === 'cistern' ? 'cisterna' : null;
    return (
      <div className="pop panel" style={style} onClick={(e) => e.stopPropagation()}>
        {body}
        {detailId && <button className="btn ghost small" onClick={() => { setSel(null); setInspect(detailId); }}><Icon name="magnifying-glass" /> Detail karty</button>}
      </div>
    );
  };

  // ---- modal prompts (reveal / order / pick from revealed cards) ----
  const modal = () => {
    if (!pending || !modalMode || revealMin) return null;
    const cards: CardInst[] = pending.reveal ?? [];
    if (pending.kind === 'reveal') {
      return (
        <div className="overlay"><div className="modal panel">
          <h2>{pending.title}</h2>
          <div className="cardrow">{cards.length ? cards.map((c) => <Card key={c.uid} id={c.id} noZoom />) : <p className="muted">Nic tu není.</p>}</div>
          <button className="btn primary" onClick={() => answer([pending.options[0].id])}>{pending.options[0].label}</button>
        </div></div>
      );
    }
    if (pending.kind === 'order') {
      return (
        <div className="overlay"><div className="modal panel">
          <h2>{pending.title}</h2>
          <p className="muted" style={{ margin: 0 }}>Klikej na karty v pořadí, v jakém mají ležet – první bude navrchu.</p>
          <div className="cardrow">
            {pending.options.map((o) => {
              const i = order.indexOf(o.id);
              const c = cards.find((x) => x.uid === o.id);
              return (
                <div key={o.id} style={{ position: 'relative' }}>
                  {i >= 0 && <div className="ordernum">{i + 1}</div>}
                  <Card id={c?.id ?? 'tulak'} noZoom onClick={() => { sfx.click(); setOrder((ord) => (ord.includes(o.id) ? ord.filter((x) => x !== o.id) : [...ord, o.id])); }} selected={i >= 0} />
                </div>
              );
            })}
          </div>
          <div className="row">
            <button className="btn ghost" onClick={() => setOrder([])}>Vynulovat</button>
            <button className="btn primary" disabled={order.length !== pending.options.length} onClick={() => answer(order)}>Potvrdit pořadí</button>
          </div>
        </div></div>
      );
    }
    return (
      <div className="overlay"><div className="modal panel">
        <h2>{pending.title}</h2>
        <div className="cardrow">
          {pending.options.map((o) => {
            const c = cards.find((x) => x.uid === o.id) ?? (o.ref?.t === 'card' ? { uid: o.id, id: o.ref.id } : null);
            return c ? <Card key={o.id} id={c.id} noZoom onClick={() => answer([o.id])} target="good" /> : <button key={o.id} className="btn" onClick={() => answer([o.id])}>{o.label}</button>;
          })}
        </div>
        <button className="btn ghost small" onClick={() => setRevealMin(true)}>Podívat se na stůl</button>
      </div></div>
    );
  };

  const hand = P.hand ?? [];
  const handTilt = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.hand .card');
    document.querySelectorAll<HTMLElement>('.hand .card.tilt').forEach((c) => { if (c !== el) c.classList.remove('tilt'); });
    if (!el || el.classList.contains('selected')) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(px - 0.5) * 18}deg`);
    el.style.setProperty('--rx', `${(0.5 - py) * 14}deg`);
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
    el.classList.add('tilt');
  };
  const handTiltEnd = () => document.querySelectorAll<HTMLElement>('.hand .card.tilt').forEach((c) => c.classList.remove('tilt'));
  const handPlayable = (uid: string) => canAct && (legal?.playable.includes(uid) || true);

  // tips for new players
  const tip = (() => {
    if (!tipsOn || spectator || view.phase !== 'play') return null;
    if (pending && pending.title.startsWith('Kam postavíš')) return <>Vyber <b>zlaté pole</b> ve svém sloupci. Přeživší vepředu kryje toho vzadu i základnu.</>;
    if (pending) return null;
    const oppRaid = O.queue[0]?.id === 'najezd';
    if (canAct && oppRaid) return <>Pozor: soupeřův <b>Nájezd</b> je na místě 1 – na začátku jeho tahu poškodí jednu tvou základnu (vybereš si kterou).</>;
    if (canAct && view.turn <= 2 && P.peopleCount === 0) return <>Začni tím, že <b>klikneš na kartu v ruce</b>: přeživšího můžeš zahrát za vodu, nebo kartu <b>rozebrat</b> pro okamžitý efekt.</>;
    if (canAct && P.water >= 2 && (legal?.playable.length ?? 0) === 0 && (legal?.abilities.length ?? 0) === 0) return <>Zbylou vodu můžeš využít na <b>Líznout kartu (2 💧)</b> nebo vzít <b>Cisternu</b> (1 💧).</>;
    if (canAct && (legal?.abilities.length ?? 0) > 0 && view.turn <= 6) return <>Karty se <b>svítícím okrajem</b> jsou připravené – klikni na ně a použij schopnost.</>;
    return null;
  })();

  const pbar = (owner: PlayerIdx) => {
    const pl = view.players[owner];
    const isMe = owner === me;
    const active = view.active === owner && view.phase === 'play';
    return (
      <div className={`pbar ${active ? 'active' : ''}`} style={{ position: 'relative' }}>
        {emoteFor(owner)}
        <div className="who">
          <div className="avatar"><Icon name={isMe ? 'gas-mask' : 'death-skull'} /></div>
          <span className="nm">{pl.name}</span>
          {state.room && (state.room.score[0] + state.room.score[1] > 0) && <span className="pill" title="Výhry v této sérii">🏆 {state.room.score[owner]}</span>}
          {state.room && state.mode === 'online' && state.room.seats[owner] && !state.room.seats[owner]!.connected && (
            <span className="pill" title="Hráč je odpojený">odpojen {Math.floor((state.room.seats[owner]!.awayMs ?? 0) / 1000)} s</span>
          )}
          {!isMe && !spectator && view.phase === 'play' && state.mode === 'online' && state.room?.seats[owner] && !state.room.seats[owner]!.connected
            && (state.room.seats[owner]!.awayMs ?? 0) >= (state.room.claimWinMs ?? 120000) && (
            <button className="btn small danger" onClick={() => (conn as NetConn).claimWin()}>Soupeř je pryč – vzít výhru</button>
          )}
        </div>
        {active && <span className="pill turn">na tahu</span>}
        {!isMe && (
          <div className="handbacks" title={`Karet v ruce: ${pl.handCount}`}>
            {Array.from({ length: Math.min(pl.handCount, 10) }, (_, i) => <div key={i} className="mini" />)}
            <span className="muted" style={{ marginLeft: 6 }}>{pl.handCount}</span>
          </div>
        )}
        {water(pl, owner)}
        <span className="pill hide-sm" title="Přeživších ve hře (max 6)"><Icon name="hooded-figure" />{pl.peopleCount}/6</span>
        {view.personal && !isMe && <span className="pill hide-sm" title={`Vlastní balíček soupeře: ${pl.deckCount} karet, odhozeno ${pl.discardCount}`}><Icon name="stockpiles" />{pl.deckCount}</span>}
        <div className="spacer" />
        {isMe && !spectator && (
          <div className="actions-bar">
            {view.canUndo && <button className="btn small" onClick={() => act({ t: 'undo' })} title="Vrátit poslední akci (Ctrl+Z)"><Icon name="return-arrow" /> Zpět</button>}
            <button className="btn small" disabled={!legal?.canDraw} onClick={() => act({ t: 'drawCard' })} title="Zaplať vodu a lízni kartu">
              <Icon name="card-draw" /> Líznout ({legal?.drawCost ?? 2}💧)
            </button>
            <button className={`btn primary ${canAct && P.water === 0 && (legal?.abilities.length ?? 0) === 0 ? 'pulse' : ''}`} disabled={!canAct} onClick={endTurn}>
              <Icon name="checkered-flag" /> Konec tahu
            </button>
          </div>
        )}
        {!isMe && (
          <div className="actions-bar">
            <button className="btn small ghost mobile-only" onClick={() => setSideOpen(true)}><Icon name="hamburger-menu" /></button>
            <button className="btn small ghost" onClick={() => { setMuted(!muted); setMut(!muted); }} title={muted ? 'Zapnout zvuk' : 'Vypnout zvuk'}><Icon name={muted ? 'speaker-off' : 'speaker'} /></button>
            <button className="btn small ghost hide-sm" onClick={() => { setTipsOn(!tipsOn); setFlag('tips', !tipsOn); }} title="Nápověda pro začátečníky">{tipsOn ? 'Tipy: ZAP' : 'Tipy: VYP'}</button>
            {!spectator && view.phase === 'play' && (
              <button className="btn small ghost" onClick={() => { if (confirm('Opravdu se vzdát? Soupeř vyhraje tuto hru.')) act({ t: 'concede' }); }} title="Vzdát hru"><Icon name="broken-shield" /><span className="hide-sm"> Vzdát</span></button>
            )}
            <button className="btn small ghost" onClick={() => { if (view.phase === 'over' || confirm('Opustit hru? (Online místo zůstane rezervované – můžeš se vrátit stejným odkazem.)')) go('/'); }} title="Odejít"><Icon name="exit-door" /></button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="game" onClick={() => setSel(null)}>
      <div className="table">
        {pbar(opp)}
        <div className="side opp">
          {queue(opp)}
          <div className="cols">{[0, 1, 2].map((c) => column(opp, c))}</div>
          {homeZone(opp)}
        </div>
        <div className="center">
          <div className="pilebox">
            <div className="pile deck" data-uid="deck-pile" title={`Balíček: ${view.deckCount} karet${view.reshuffles ? ' (už jednou zamíchán – až dojde, je remíza!)' : ''}`}>
              <Icon name="stockpiles" /><span className="pc">{view.deckCount}</span>
            </div>
            <div className="pile discard" title="Odhazovací balíček (vrchní karta)">
              {view.discardTop ? <Card id={view.discardTop.id} compact style={{ ['--h' as string]: 'calc(var(--ch) * .62)', ['--w' as string]: 'calc(var(--cw) * .62)' }} /> : <span className="muted" style={{ fontSize: 12 }}>odhoz</span>}
              <span className="pc">{view.discardCount}</span>
            </div>
          </div>
          <div className="status">{promptBar()}</div>
          <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
            {tip && <div className="tip"><button className="btn ghost small" onClick={() => { setTipsOn(false); setFlag('tips', false); }}>×</button>{tip}</div>}
            <span className="pill">Tah {view.turn}</span>
          </div>
        </div>
        <div className="side me">
          {queue(me)}
          <div className="cols">{[0, 1, 2].map((c) => column(me, c))}</div>
          {homeZone(me)}
        </div>
        {pbar(me)}
        <div className={`hand-wrap ${handOpen ? 'open' : ''}`}>
          {!spectator && hand.length > 0 && (
            <button className="btn small hand-toggle" onClick={(e) => { e.stopPropagation(); setHandOpen(!handOpen); }}>
              {handOpen ? '▼ Schovat ruku' : `▲ Ruka (${hand.length})`}
            </button>
          )}
          {spectator ? <div className="hand-empty">Sleduješ hru jako divák.</div> : hand.length === 0 ? <div className="hand-empty">Prázdná ruka.</div> : (
            <div className="hand" style={{ ['--n' as string]: hand.length }} onMouseMove={handTilt} onMouseLeave={handTiltEnd}>
              {hand.map((c) => {
                const o = optByUid.get(c.uid);
                const cant = canAct && !legal?.playable.includes(c.uid) && CARDS[c.id].kind !== 'cistern';
                return (
                  <Card key={c.uid} id={c.id} uid={c.uid}
                    onClick={(e) => clickCard(c.uid, e, 'hand')}
                    costOverride={CARDS[c.id].kind === 'survivor' ? legal?.personCost[c.uid] : undefined}
                    selected={(sel?.kind === 'hand' && sel.uid === c.uid) || (!!o && multi.includes(o.id))}
                    target={o && !multi.includes(o.id) ? (o.tone ?? 'neutral') : null}
                    className={`${cant ? 'cant' : ''}`}
                    enter={newHand.has(c.uid)}
                    dimmed={!!pending && optByUid.size > 0 && !o && handPlayable(c.uid)} />
                );
              })}
            </div>
          )}
        </div>
      </div>
      <Sidebar view={view} state={state} me={me} onChat={(t) => conn.chat(t)} onEmote={(id) => conn.emote(id)} mobileOpen={sideOpen} onClose={() => setSideOpen(false)} />
      {popover()}
      {modal()}
      {revealMin && pending && <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 61 }}><button className="btn primary" onClick={() => setRevealMin(false)}>Zpět k výběru</button></div>}
      {inspect && (
        <div className="overlay inspect" onClick={(e) => { e.stopPropagation(); setInspect(null); }}>
          <div className="inspect-inner">
            <Card id={inspect} noZoom rarityFx />
            <div className="muted" style={{ textAlign: 'center' }}>Klepnutím zavřeš</div>
          </div>
        </div>
      )}
      {view.phase === 'chooseFirst' && <ChooseFirst view={view} me={me} act={act} />}
      {view.phase === 'over' && <GameOver view={view} me={me} state={state} conn={conn} />}
      {recap && (
        <div className="recap panel" key={recap.key} onClick={(e) => { e.stopPropagation(); setRecap(null); }} title="Klikni pro zavření">
          <div className="recap-title"><Icon name="eye-target" /> Co udělal(a) {O.name}</div>
          {recap.lines.map((l, i) => <div key={i} className="recap-line">{l}</div>)}
        </div>
      )}
      {banner && <div className="banner" key={banner.key}><div className={`inner ${banner.mine ? 'mine' : ''}`}>{banner.text}</div></div>}
      <FxLayer view={view} me={me} onTurn={onTurn} />
      <Particles />
    </div>
  );
}

function ChooseFirst({ view, me, act }: { view: GameView; me: PlayerIdx; act: (a: Action) => void }) {
  const mine = view.coinWinner === me && view.you !== null;
  return (
    <div className="overlay">
      <div className="modal panel" style={{ maxWidth: 560, textAlign: 'center' }}>
        <h2><Icon name="coinflip" /> Hod mincí</h2>
        {mine ? (
          <>
            <p>Los padl na tebe! Kdo začne?</p>
            <p className="muted" style={{ margin: 0 }}>Začínající hráč dostane v prvním tahu jen <b>1 vodu</b> místo 3.</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn primary" onClick={() => act({ t: 'chooseFirst', first: me })}>Začnu já</button>
              <button className="btn" onClick={() => act({ t: 'chooseFirst', first: (1 - me) as PlayerIdx })}>Ať začne soupeř</button>
            </div>
          </>
        ) : (
          <p>Los padl na hráče <b>{view.players[view.coinWinner].name}</b> – vybírá, kdo začne…</p>
        )}
        <div className="cardrow" style={{ marginTop: 6 }}>
          {view.players[me].bases.map((b) => <Card key={b.uid} id={b.id} noZoom compact />)}
        </div>
        <p className="muted" style={{ margin: 0 }}>Tvoje základny. Začáteční ruka: {view.players[me].handCount} karet.</p>
      </div>
    </div>
  );
}

function GameOver({ view, me, state, conn }: { view: GameView; me: PlayerIdx; state: ConnState; conn: Conn }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (view.winner === me && view.you !== null) { confetti(); setTimeout(() => confetti(90), 700); }
  }, [view.winner, me, view.you]);
  if (hidden) {
    return <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 61 }}><button className="btn primary" onClick={() => setHidden(false)}>Zobrazit výsledek</button></div>;
  }
  const win = view.winner === me;
  const draw = view.winner === 'draw';
  const spectator = view.you === null;
  const room = state.room;
  const iWant = room && view.you !== null ? room.rematch[view.you] : false;
  const theyWant = room && view.you !== null ? room.rematch[1 - view.you] : false;
  return (
    <div className="overlay gameover">
      <div className="panel">
        <Icon name={draw ? 'sands-of-time' : win ? 'trophy-cup' : 'broken-skull'} className="" />
        <h1 className={!win && !draw ? 'lose' : ''}>{draw ? 'REMÍZA' : spectator ? `${view.players[view.winner as PlayerIdx].name} vyhrává` : win ? 'VÍTĚZSTVÍ!' : 'PORÁŽKA'}</h1>
        <p className="muted" style={{ margin: 0 }}>{view.winReason}</p>
        <p className="muted" style={{ margin: 0 }}>Hra trvala {view.turn} tahů.</p>
        {state.reward && (
          <p style={{ margin: 0, color: 'var(--water-2)', fontWeight: 800, fontSize: 20 }}>
            {state.reward.gain > 0 ? `+${state.reward.gain} kapek do kolekce` : 'Za tak krátkou hru se kapky nepřipisují.'}
          </p>
        )}
        {state.reward && state.reward.gain > 0 && <button className="btn small" onClick={() => go('/boosters')}>Do obchodu s boostery</button>}
        {!spectator && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn primary" disabled={!!iWant} onClick={() => conn.rematch()}>{iWant ? 'Čekám na soupeře…' : theyWant ? 'Přijmout odvetu' : 'Odveta'}</button>
            <button className="btn" onClick={() => setHidden(true)}>Prohlédnout stůl</button>
            <button className="btn ghost" onClick={() => go('/')}>Domů</button>
          </div>
        )}
        {theyWant && !iWant && <p style={{ color: 'var(--gold)', margin: 0 }}>Soupeř chce odvetu!</p>}
      </div>
    </div>
  );
}
