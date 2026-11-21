import { useEffect, useRef, useState } from 'react';
import { go } from '../App';
import { Board } from '../components/Board';
import { Draft } from '../components/Draft';
import { Icon } from '../components/Icon';
import type { Conn, ConnState } from '../conn';
import { sfx } from '../sound';

export function GameScreen({ conn, state }: { conn: Conn; state: ConnState }) {
  const { view, room } = state;
  const [handoverOk, setHandoverOk] = useState<number | null>(null);
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

  if (view.phase === 'draft') {
    return (
      <>
        {toasts}
        <Draft view={view} onPick={(bases) => conn.act({ t: 'draftPick', bases })} mode={state.mode} />
      </>
    );
  }

  return (
    <>
      {toasts}
      <Board conn={conn} state={state} view={view} />
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
          <>
            <h2 className="stencil" style={{ margin: 0 }}>{state.errors.length ? 'Nepodařilo se připojit' : 'Připojuji…'}</h2>
            <p className="muted">{state.errors.length ? state.errors[state.errors.length - 1].msg : 'Hledám stůl na serveru.'}</p>
          </>
        ) : (
          <>
            <div className="muted" style={{ fontWeight: 700, letterSpacing: '.1em' }}>KÓD STOLU</div>
            <div className="room-code">{room.code}</div>
            <div className="pill" style={{ alignSelf: 'center' }}>{room.options.deckMode === 'collection' ? 'Sběratelský stůl – každý hraje se svým balíčkem' : 'Klasika – společný balíček'}</div>
            <div className="copybox">
              <input className="field" readOnly value={link} onFocus={(e) => e.target.select()} />
              <button className="btn primary" onClick={copy}>{copied ? 'Zkopírováno ✓' : 'Kopírovat odkaz'}</button>
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
