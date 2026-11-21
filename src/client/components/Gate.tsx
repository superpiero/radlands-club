import { go } from '../App';
import { Card } from './Card';
import { Icon } from './Icon';

/** Logged-out invitation for collection screens: a fan of real cards + what you get. */
export function Gate({ title, text }: { title: string; text: string }) {
  return (
    <div className="waiting gate">
      <div className="panel gate-panel">
        <div className="gate-fan" aria-hidden>
          <Card id="matka" noZoom rarityFx className="f1" />
          <Card id="pramen" noZoom className="f2" />
          <Card id="prorok" noZoom rarityFx className="f3" />
        </div>
        <h2 className="stencil">{title}</h2>
        <p className="muted">{text}</p>
        <ul className="gate-perks">
          <li><Icon name="stockpiles" /> Startovní sada a <b>3 boostery zdarma</b></li>
          <li><Icon name="water-drop" /> Kapky za každou online hru</li>
          <li><Icon name="card-play" /> Vlastní balíčky z tvé kolekce</li>
        </ul>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn primary" onClick={() => go('/register')}>Registrace</button>
          <button className="btn" onClick={() => go('/login')}>Přihlášení</button>
          <button className="btn ghost" onClick={() => go('/')}>Domů</button>
        </div>
      </div>
    </div>
  );
}
