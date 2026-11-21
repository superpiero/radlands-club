import { useEffect, useRef, useState } from 'react';
import { go } from '../App';
import { Board } from '../components/Board';
import { Draft } from '../components/Draft';
import { Icon } from '../components/Icon';
import type { Conn, ConnState } from '../conn';
import { sfx } from '../sound';
import { Card } from '../components/Card';
import type { GameView } from '../../engine/view';
import { HowToPlay } from '../components/HowToPlay';
import { getFlag, setFlag } from '../prefs';

interface Showcase { id: string; label: string; key: number }

const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/** Which opponent actions in this update deserve a big "card reveal" before the board updates. */
function showcaseFor(v: GameView, mode: string): Showcase | null {
  if (v.you === null || mode === 'hotseat') return null;
  const opp = 1 - v.you;
  const findId = (uid: string) => {
    for (const pl of v.players) {
      for (const col of pl.columns) for (const x of col) if (x.uid === uid) return x.faceDown ? null : x.id;
      for (const b of pl.bases) if (b.uid === uid) return b.id;
    }
    return null;
  };
  for (const f of v.fx) {
    if (f.t === 'play' && f.player === opp) { const id = findId(f.uid); if (id) return { id, label: 'Soupeř verbuje', key: v.rev }; }
    if (f.t === 'event' && f.player === opp && f.id !== 'najezd') return { id: f.id, label: 'Soupeř spouští operaci', key: v.rev };
    if (f.t === 'junk' && f.player === opp && f.id !== 'cisterna') return { id: f.id, label: 'Soupeř rozebírá', key: v.rev };
    if (f.t === 'ability' && f.player === opp) { const id = findId(f.uid); if (id) return { id, label: 'Soupeř používá', key: v.rev }; }
  }
  return null;
}

/** Buffers incoming views so opponent actions are revealed one by one (card showcase first). */
function useBufferedView(view: GameView | null, mode: string): { shown: GameView | null; showcase: Showcase | null; skip: () => void } {
  const [shown, setShown] = useState<GameView | null>(view);
  const [showcase, setShowcase] = useState<Showcase | null>(null);
  const queue = useRef<GameView[]>([]);
  const busy = useRef(false);
  const skipRef = useRef<(() => void) | null>(null);
  const pump = useRef<() => void>(() => {});
  pump.current = () => {
    if (busy.current) return;
    const next = queue.current.shift();
    if (!next) return;
    const sc = queue.current.length < 3 && !reduced() ? showcaseFor(next, mode) : null;
    if (!sc) {
      setShown(next);
      pump.current();
      return;
    }
    busy.current = true;
    const turnStart = next.fx.some((f) => f.t === 'turn');
    const lead = turnStart ? 1150 : 0; // let the turn banner finish first
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      skipRef.current = null;
      setShowcase(null);
      setShown(next);
      busy.current = false;
      setTimeout(() => pump.current(), 220);
    };
    setTimeout(() => {
      setShowcase(sc);
      skipRef.current = finish;
      setTimeout(finish, 1500);
    }, lead);
  };
  useEffect(() => {
    if (!view) return;
    queue.current.push(view);
    pump.current();
  }, [view]);
  return { shown: shown ?? view, showcase, skip: () => skipRef.current?.() };
}

export function GameScreen({ conn, state }: { conn: Conn; state: ConnState }) {
  const { room } = state;
  const { shown: view, showcase, skip } = useBufferedView(state.view, state.mode);
  const [howtoDone, setHowtoDone] = useState(() => getFlag('howtoSeen', false));
  // first win against the bot unlocks "Střední" as the default difficulty
  const v0 = state.view;
  useEffect(() => {
    if (state.mode === 'bot' && v0?.phase === 'over' && v0.you !== null && v0.winner === v0.you) setFlag('botWon', true);
  }, [state.mode, v0?.phase, v0?.winner, v0?.you]);
  const [handoverOk, setHandoverOk] = useState<number | null>(null);
  const gameNo = state.room?.gameNo ?? 0;
  useEffect(() => { setHandoverOk(null); }, [gameNo]);
  const lastErr = useRef(0);

  useEffect(() => {
    const e = state.errors[state.errors.length - 1];
    if (e && e.id !== lastErr.current) {
      lastErr.current = e.id;
      sfx.error();
    }
  }, [state.errors]);

  const toasts = (
    <div className="toast-host">
      {state.status !== 'connected' && state.mode === 'online' && (
        <div className="toast err">{state.status === 'connecting' ? 'Připojuji se k serveru…' : 'Spojení přerušeno – zkouším znovu…'}</div>
      )}
      {state.errors.map((e) => <div key={e.id} className="toast err">{e.msg}</div>)}
    </div>
  );

  // Online: waiting room until both seats are filled
  if (state.mode === 'online' && (!room || !view)) {
    return (
      <>
        {toasts}
        <WaitingRoom state={state} />
      </>
    );
  }
  if (!view) return toasts;

  // Hot-seat: hide everything when the device changes hands
  if (state.mode === 'hotseat' && view.you !== null && handoverOk !== view.you && view.phase !== 'over') {
    const nm = view.players[view.you].name;
    return (
      <div className="handover">
        <div>
          <h1>Předej zařízení</h1>
          <p style={{ fontSize: 22 }}>Na řadě je <b>{nm}</b>{view.pending ? ' (musí se rozhodnout)' : ''}.</p>
          <button className="btn primary" autoFocus onClick={() => { setHandoverOk(view.you); sfx.click(); }}>Jsem {nm} – pokračovat</button>
          <div style={{ marginTop: 16 }}><button className="btn ghost small" onClick={() => go('/')}>Ukončit hru</button></div>
        </div>
      </div>
    );
  }

  if (view.phase === 'draft' && view.you === null) {
    return (
      <>
        {toasts}
        <div className="waiting"><div className="panel">
          <h2 className="stencil" style={{ margin: 0 }}>Hráči vybírají základny</h2>
          <p className="muted">{view.players.map((p) => `${p.name}: ${p.draftDone ? 'hotovo' : 'vybírá…'}`).join(' · ')}</p>
        </div></div>
      </>
    );
  }
  if (view.phase === 'draft') {
    return (
      <>
        {toasts}
        <Draft view={view} onPick={(bases) => conn.act({ t: 'draftPick', bases })} mode={state.mode} />
        {!howtoDone && <HowToPlay onClose={() => { setFlag('howtoSeen', true); setHowtoDone(true); }} />}
      </>
    );
  }

  return (
    <>
      {toasts}
      <Board conn={conn} state={state} view={view} />
      {showcase && (
        <div className="showcase dim" key={showcase.key} onClick={skip} title="Klikni pro přeskočení">
          <div className="sc-inner">
            <div className="sc-label">{showcase.label}</div>
            <Card id={showcase.id} noZoom rarityFx />
          </div>
        </div>
      )}
    </>
  );
}

function WaitingRoom({ state }: { state: ConnState }) {
  const room = state.room;
  const link = room ? `${location.origin}${location.pathname}#/room/${room.code}` : '';
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="waiting">
      <div className="panel">
        {!room ? (
          state.fatal ? (
            <>
              <h2 className="stencil" style={{ margin: 0 }}>{state.replaced ? 'Hraješ v jiném okně' : 'Ke stolu se nejde připojit'}</h2>
              <p>{state.fatal}</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                {state.replaced && <button className="btn primary" onClick={() => location.reload()}>Převzít hru zde</button>}
                <button className={`btn ${state.replaced ? '' : 'primary'}`} onClick={() => { location.hash = '/new'; }}>Založit nový stůl</button>
                {/přihlas/.test(state.fatal) && <button className="btn" onClick={() => go('/login')}>Přihlásit se</button>}
                {/přihlas/.test(state.fatal) && location.hash.includes('/room/') && <button className="btn" onClick={() => { location.hash = location.hash.replace(/\?.*$/, '') + '?watch=1'; location.reload(); }}>Sledovat jako divák</button>}
              </div>
            </>
          ) : (
            <>
              <h2 className="stencil" style={{ margin: 0 }}>Připojuji…</h2>
              <p className="muted">Hledám stůl na serveru.</p>
            </>
          )
        ) : (
          <>
            <div className="muted" style={{ fontWeight: 700, letterSpacing: '.1em' }}>KÓD STOLU</div>
            <div className="room-code">{room.code}</div>
            <div className="pill" style={{ alignSelf: 'center' }}>{room.options.deckMode === 'collection' ? 'Sběratelský stůl – každý hraje se svým balíčkem' : 'Klasika – společný balíček'}{room.options.turnSeconds ? <> · <Icon name="stopwatch" className="ico-inline" /> {room.options.turnSeconds} s na tah</> : ''}</div>
            <div className="copybox">
              <input className="field" readOnly value={link} onFocus={(e) => e.target.select()} />
              <button className="btn primary" onClick={copy}>{copied ? <>Zkopírováno <Icon name="check-mark" className="ico-inline" /></> : 'Kopírovat odkaz'}</button>
            </div>
            <p className="muted" style={{ margin: 0 }}>Pošli odkaz kamarádovi. Hra začne, jakmile si sedne ke stolu.</p>
            <div className="seats">
              {room.seats.map((s, i) => (
                <div key={i} className={`seat ${s ? 'filled' : ''}`}>
                  {s ? (<><span className={`dot ${s.connected ? 'on' : ''}`} />{s.name}{room.you === i ? ' (ty)' : ''}</>) : <span className="muted">čeká se…</span>}
                </div>
              ))}
            </div>
          </>
        )}
        <div><button className="btn ghost small" onClick={() => go('/')}><Icon name="exit-door" /> Zpět</button></div>
      </div>
    </div>
  );
}
