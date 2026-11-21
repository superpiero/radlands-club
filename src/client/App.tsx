import { useEffect, useState } from 'react';
import { Gallery } from './pages/Gallery';
import { Home } from './pages/Home';
import { Rules } from './pages/Rules';
import { GameRoute } from './pages/GameRoute';

export type Route =
  | { page: 'home' }
  | { page: 'rules' }
  | { page: 'cards' }
  | { page: 'room'; code: string; spectate?: boolean }
  | { page: 'new'; baseMode: 'draft' | 'random' }
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
    case 'room': return parts[1] ? { page: 'room', code: parts[1].toUpperCase(), spectate: q.get('watch') === '1' } : { page: 'home' };
    case 'new': return { page: 'new', baseMode };
    case 'bot': return { page: 'bot', baseMode, level: (q.get('level') as 'easy' | 'normal' | 'hard') || 'normal' };
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
      {(route.page === 'room' || route.page === 'new' || route.page === 'bot' || route.page === 'hotseat') && (
        <GameRoute key={JSON.stringify(route)} route={route} />
      )}
    </div>
  );
}
