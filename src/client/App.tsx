import { useEffect, useState } from 'react';
import { Gallery } from './pages/Gallery';
import { Home } from './pages/Home';
import { Rules } from './pages/Rules';
import { GameRoute } from './pages/GameRoute';
import { AccountPage } from './pages/AccountPage';
import { Boosters } from './pages/Boosters';
import { Decks } from './pages/Decks';
import { ErrorBoundary } from './components/ErrorBoundary';

export type Route =
  | { page: 'home' }
  | { page: 'rules' }
  | { page: 'cards' }
  | { page: 'login' }
  | { page: 'register' }
  | { page: 'boosters' }
  | { page: 'decks' }
  | { page: 'room'; code: string; spectate?: boolean }
  | { page: 'new'; baseMode: 'draft' | 'random'; deckMode: 'classic' | 'collection' }
  | { page: 'bot'; baseMode: 'draft' | 'random'; level: 'easy' | 'normal' | 'hard' }
  | { page: 'hotseat'; baseMode: 'draft' | 'random' };

function parse(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const q = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  const baseMode = q.get('bases') === 'random' ? 'random' : 'draft';
  switch (parts[0]) {
    case 'rules': return { page: 'rules' };
    case 'cards': return { page: 'cards' };
    case 'login': return { page: 'login' };
    case 'register': return { page: 'register' };
    case 'boosters': return { page: 'boosters' };
    case 'decks': return { page: 'decks' };
    case 'room': return parts[1] ? { page: 'room', code: parts[1].toUpperCase(), spectate: q.get('watch') === '1' } : { page: 'home' };
    case 'new': return { page: 'new', baseMode, deckMode: q.get('decks') === 'collection' ? 'collection' : 'classic' };
    case 'bot': {
      const lv = q.get('level');
      return { page: 'bot', baseMode, level: lv === 'easy' || lv === 'hard' ? lv : 'normal' };
    }
    case 'hotseat': return { page: 'hotseat', baseMode };
    default: return { page: 'home' };
  }
}

export function go(path: string) {
  location.hash = path;
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return (
    <div className="grain" style={{ height: '100%' }}>
      <div className="app-bg" />
      {route.page === 'home' && <Home />}
      {route.page === 'rules' && <Rules />}
      {route.page === 'cards' && <Gallery />}
      {(route.page === 'login' || route.page === 'register') && <AccountPage mode={route.page} />}
      {route.page === 'boosters' && <Boosters />}
      {route.page === 'decks' && <Decks />}
      {(route.page === 'room' || route.page === 'new' || route.page === 'bot' || route.page === 'hotseat') && (
        <ErrorBoundary><GameRoute key={JSON.stringify(route)} route={route} /></ErrorBoundary>
      )}
    </div>
  );
}
