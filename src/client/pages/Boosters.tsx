import { useEffect, useRef, useState } from 'react';
import { CARDS } from '../../engine/cards';
import { BOOSTER_PRICE, RARITY_LABEL, type PulledCard } from '../../shared/collection';
import { go } from '../App';
import { applyPendingProfile, buyBooster, openBoosterApi, refreshProfile, useAccount } from '../account';
import { Card, CardBack } from '../components/Card';
import { Icon } from '../components/Icon';
import { sfx } from '../sound';
import { Particles, burst } from '../components/Particles';
import { ART_IDS, ART_VERSION } from '../gen/art';

type Stage = 'idle' | 'shaking' | 'torn' | 'done';

export function Boosters() {
  const acc = useAccount();
  const welcome = location.hash.includes('welcome=1');
  const [stage, setStage] = useState<Stage>('idle');
  const [cards, setCards] = useState<PulledCard[]>([]);
  const [flipped, setFlipped] = useState<boolean[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const packRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void refreshProfile(); }, []);
  const allFlipped = flipped.length > 0 && flipped.every(Boolean);
  useEffect(() => {
    if (stage === 'torn' && allFlipped) {
      applyPendingProfile();
      setStage('done');
    }
  }, [allFlipped, stage]);

  if (!acc.session) {
    return (
      <div className="waiting"><div className="panel">
        <h2 className="stencil" style={{ margin: 0 }}>Boostery</h2>
        <p className="muted">Pro sbírání karet se musíš přihlásit.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn primary" onClick={() => go('/register')}>Registrace</button>
          <button className="btn" onClick={() => go('/login')}>Přihlášení</button>
        </div>
      </div></div>
    );
  }
  const p = acc.profile;
  const unopened = p?.unopened ?? 0;

  const open = async () => {
    if (stage !== 'idle' || unopened <= 0) return;
    setErr(null);
    setStage('shaking');
    sfx.rumble();
    const started = performance.now();
    let pulled: PulledCard[];
    try {
      pulled = await openBoosterApi();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Booster se nepodařilo otevřít.');
      setStage('idle');
      return;
    }
    const wait = Math.max(0, 1000 - (performance.now() - started));
    setTimeout(() => {
      const r = packRef.current?.getBoundingClientRect();
      if (r) burst(r.left + r.width / 2, r.top + r.height / 2, '#ffe9a8', 60);
      sfx.tear();
      setCards(pulled);
      setFlipped(pulled.map(() => false));
      setStage('torn');
    }, wait);
  };

  const flip = (i: number, el?: HTMLElement | null) => {
    if (flipped[i]) return;
    const c = cards[i];
    setFlipped((f) => f.map((x, j) => (j === i ? true : x)));
    const r = el?.getBoundingClientRect();
    const color = { common: '#d8cdb8', uncommon: '#7fd36b', rare: '#5fb6ff', legendary: '#ffb43a' }[c.rarity];
    if (r) burst(r.left + r.width / 2, r.top + r.height / 2, color, c.rarity === 'legendary' ? 90 : c.rarity === 'rare' ? 45 : 18);
    if (c.rarity === 'legendary') { sfx.legendary(); document.body.classList.add('screen-shake'); setTimeout(() => document.body.classList.remove('screen-shake'), 500); }
    else if (c.rarity === 'rare') sfx.rare();
    else sfx.flip();
  };


  const next = () => { setCards([]); setFlipped([]); setStage('idle'); };

  return (
    <div className="booster-page">
      <Particles />
      <div className="topnav" style={{ padding: '14px 16px 0' }}>
        <button className="btn small" onClick={() => go('/')}><Icon name="return-arrow" /> Domů</button>
        <button className="btn small" onClick={() => go('/decks')}><Icon name="swap-bag" /> Kolekce a balíčky</button>
        <div style={{ flex: 1 }} />
        <span className="pill"><Icon name="water-drop" /> {p?.kapky ?? 0} kapek</span>
        <button className="btn small" disabled={(p?.kapky ?? 0) < BOOSTER_PRICE} onClick={async () => { try { await buyBooster(); sfx.water(); } catch (e) { setErr((e as Error).message); } }}>
          Koupit booster ({BOOSTER_PRICE} kapek)
        </button>
      </div>
      {welcome && stage === 'idle' && (p?.stats.boostersOpened ?? 0) === 0 && (
        <div className="welcome">
          <h2>Vítej v pustině, {p?.name}!</h2>
          <p>Do kolekce ti přibyla startovní sada a máš připravené 3 uvítací boostery. Každý obsahuje 5 karet – poslední je vždy vzácná nebo legendární.</p>
        </div>
      )}
      {err && <div className="toast err" style={{ margin: '10px auto', width: 'fit-content' }}>{err}</div>}

      <div className="booster-stage">
        {(stage === 'idle' || stage === 'shaking') && (
          <div className="pack-zone">
            {unopened > 0 ? (
              <>
                <div ref={packRef} className={`pack ${stage === 'shaking' ? 'shaking' : ''}`} onClick={open} role="button" aria-label="Otevřít booster">
                  {ART_IDS.has('booster') && <img className="pack-art" src={`/art/booster.webp?v=${ART_VERSION}`} alt="" draggable={false} />}
                  <div className="pack-foil" />
                  <div className="pack-label">
                    <svg viewBox="0 0 64 64" className="pack-drop"><path d="M32 6c7 12 17 22 17 33a17 17 0 0 1-34 0c0-11 10-21 17-33z" fill="currentColor" /></svg>
                    <div className="pack-title">POSLEDNÍ<br />KAPKA</div>
                    <div className="pack-sub">5 karet · zásobovací balík</div>
                  </div>
                  <div className="pack-tape" />
                  {unopened > 1 && <div className="pack-count">×{unopened}</div>}
                </div>
                <p className="muted" style={{ textAlign: 'center' }}>{stage === 'shaking' ? 'Trhám plombu…' : 'Klikni na balík a otevři ho.'}</p>
              </>
            ) : (
              <div className="panel" style={{ padding: 24, textAlign: 'center', maxWidth: 520 }}>
                <h2 className="stencil" style={{ marginTop: 0 }}>Žádné neotevřené boostery</h2>
                <p className="muted">Další boostery získáš za kapky: výhra online = 100 kapek, prohra = 50 (hra musí mít aspoň 6 tahů). Booster stojí {BOOSTER_PRICE} kapek.</p>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button className="btn primary" onClick={() => go('/decks')}>Postavit balíček</button>
                  <button className="btn" onClick={() => go('/')}>Hrát</button>
                </div>
              </div>
            )}
          </div>
        )}

        {(stage === 'torn' || stage === 'done') && (
          <div className="pulled">
            <div className="pulled-row">
              {cards.map((c, i) => (
                <div key={i} className={`pulled-card r-${c.rarity} ${flipped[i] ? 'flipped' : ''}`} style={{ animationDelay: `${i * 90}ms` }}
                  onClick={(e) => flip(i, e.currentTarget)}>
                  <div className="flip-inner">
                    <div className="face back"><CardBack id="pack" noZoom /><div className="rarity-aura" /></div>
                    <div className="face front">
                      <Card id={c.id} noZoom rarityFx />
                      {flipped[i] && c.isNew && <div className="tag-new">NOVÁ!</div>}
                      {flipped[i] && c.dust > 0 && <div className="tag-dust">+{c.dust} kapek</div>}
                    </div>
                  </div>
                  {flipped[i] && <div className={`rarity-name r-${c.rarity}`}>{RARITY_LABEL[c.rarity]}</div>}
                </div>
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
              {!allFlipped && <button className="btn" onClick={() => cards.forEach((_, i) => setTimeout(() => flip(i, document.querySelectorAll<HTMLElement>('.pulled-card')[i]), i * 260))}>Otočit vše</button>}
              {allFlipped && unopened > 0 && <button className="btn primary pulse" onClick={next}>Otevřít další ({unopened})</button>}
              {allFlipped && <button className="btn" onClick={() => go('/decks')}>Do kolekce</button>}
            </div>
            {allFlipped && <p className="muted" style={{ textAlign: 'center' }}>{cards.map((c) => CARDS[c.id]?.name).join(' · ')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
