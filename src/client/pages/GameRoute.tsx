import { useEffect, useMemo, useState } from 'react';
import type { Route } from '../App';
import { type Conn, type ConnState, LocalConn, NetConn } from '../conn';
import { getName, getToken, randomName, setName } from '../prefs';
import { selectedDeck } from '../account';
import { GameScreen } from './GameScreen';

const BOT_NAMES: Record<string, string> = { easy: 'Bot Prášek', normal: 'Bot Rezák', hard: 'Bot Vyprahlý' };

export function GameRoute({ route }: { route: Route }) {
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
      case 'hotseat':
        return new LocalConn('hotseat', [name, 'Hráč 2'], { baseMode: route.baseMode });
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
