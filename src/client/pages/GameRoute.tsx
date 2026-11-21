import { useEffect, useMemo, useState } from 'react';
import type { Route } from '../App';
import { go } from '../App';
import { type Conn, type ConnState, LocalConn, NetConn } from '../conn';
import { getName, getToken, randomName, setName } from '../prefs';
import { account, selectedDeck } from '../account';
import { GameScreen } from './GameScreen';

const BOT_NAMES: Record<string, string> = { easy: 'Bot Prášek', normal: 'Bot Rezák', hard: 'Bot Vyprahlý' };

export function GameRoute({ route }: { route: Route }) {
  const online = route.page === 'room' || route.page === 'new';
  const needName = online && !getName() && !account.get().profile;
  const [ready, setReady] = useState(!needName);
  if (!ready) return <NamePrompt onDone={() => setReady(true)} />;
  return <GameRouteInner route={route} />;
}

function NamePrompt({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(randomName());
  return (
    <div className="waiting">
      <form className="panel" onSubmit={(e) => { e.preventDefault(); setName(n.trim() || randomName()); onDone(); }}>
        <h2 className="stencil" style={{ margin: 0 }}>Jak ti říkají?</h2>
        <p className="muted" style={{ margin: 0 }}>Tohle jméno uvidí soupeř u stolu.</p>
        <input className="field" value={n} maxLength={20} autoFocus onChange={(e) => setN(e.target.value)} />
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn primary" type="submit">Sednout ke stolu</button>
          <button className="btn ghost" type="button" onClick={() => go('/')}>Zpět</button>
        </div>
      </form>
    </div>
  );
}

function GameRouteInner({ route }: { route: Route }) {
  const conn: Conn = useMemo(() => {
    let name = getName();
    if (!name) { name = randomName(); setName(name); }
    switch (route.page) {
      case 'new':
        return new NetConn(name, getToken(), { t: 'create', options: { baseMode: route.baseMode, deckMode: route.deckMode }, deckId: selectedDeck() ?? undefined });
      case 'room':
        return new NetConn(name, getToken(), { t: 'join', code: route.code, spectate: route.spectate, deckId: selectedDeck() ?? undefined });
      case 'bot':
        return new LocalConn('bot', [name, BOT_NAMES[route.level]], { baseMode: route.baseMode, botLevel: route.level });
      case 'hotseat': {
        let n2 = '';
        try { n2 = localStorage.getItem('pk.name2') ?? ''; } catch { /* ignore */ }
        return new LocalConn('hotseat', [name, n2 || 'Hráč 2'], { baseMode: route.baseMode });
      }
      default:
        throw new Error('bad route');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [state, setState] = useState<ConnState>(conn.state);
  useEffect(() => {
    const un = conn.subscribe(setState);
    return () => { un(); conn.close(); };
  }, [conn]);
  return <GameScreen conn={conn} state={state} />;
}
