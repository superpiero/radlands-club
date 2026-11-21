import { useState } from 'react';
import { go } from '../App';
import { Icon } from '../components/Icon';
import { getFlag, getName, randomName, setName } from '../prefs';
import { logout, selectDeck, selectedDeck, useAccount } from '../account';
import { deckSize, validateDeck } from '../../shared/collection';

export function Home() {
  const [name, setNm] = useState(getName() || '');
  const [code, setCode] = useState('');
  const [bases, setBases] = useState<'draft' | 'random'>('draft');
  const [level, setLevel] = useState<'easy' | 'normal' | 'hard'>(() => (getFlag('botWon', false) ? 'normal' : 'easy'));
  const acc = useAccount();
  const prof = acc.profile;
  const [deckModeSel, setDeckMode] = useState<'classic' | 'collection' | null>(null);
  const deckMode = deckModeSel ?? (prof ? 'collection' : 'classic');
  const [deckSel, setDeckSel] = useState<string>(selectedDeck() ?? '');
  const decks = prof?.decks ?? [];
  const curDeck = decks.find((d) => d.id === deckSel) ?? decks[0];
  const deckOk = curDeck ? validateDeck(curDeck.cards, prof!.collection).length === 0 : false;
  const mode = prof ? deckMode : 'classic';

  const ensureName = () => {
    const n = name.trim() || randomName();
    setName(n);
    setNm(n);
    return n;
  };

  const q = bases === 'random' ? '?bases=random' : '';
  const [timer, setTimer] = useState<number>(0);
  const qNew = `?${bases === 'random' ? 'bases=random&' : ''}decks=${mode}${timer ? `&timer=${timer}` : ''}`;
  const canOnline = mode === 'classic' || deckOk;

  return (
    <div className="home">
      <div className="logo">
        <img className="emblem" src="/emblem.svg" alt="" width={48} height={56} />
        <h1>POSLEDNÍ<br />KAP<span className="drop">K</span>A</h1>
        <div className="tag">Noční proud · karetní duel o vodu pro 2 hráče</div>
      </div>

      <div className="panel home-card" style={{ width: 'min(1000px, 100%)' }}>
        <div className="acc-strip">
          {prof ? (
            <>
              <span className="stat" style={{ fontSize: 19, fontWeight: 800 }}><Icon name="gas-mask" /> {prof.name}</span>
              <span className="stat pill"><Icon name="water-drop" /> {prof.kapky} kapek</span>
              <span className="stat pill" title="Výhry · prohry"><Icon name="trophy-cup" className="ico-win" /> {prof.stats.wins} · <Icon name="death-skull" className="ico-loss" /> {prof.stats.losses}</span>
              <div className="row">
                <button className={`btn small ${prof.unopened > 0 ? 'primary pulse' : ''}`} onClick={() => go('/boosters')}>
                  Boostery{prof.unopened > 0 && <span className="badge-dot">{prof.unopened}</span>}
                </button>
                <button className="btn small" onClick={() => go('/decks')}>Kolekce a balíčky</button>
                <button className="btn small ghost" onClick={() => logout()}>Odhlásit</button>
              </div>
            </>
          ) : (
            <>
              <span className="muted">Sbírej karty, otevírej boostery a hraj s vlastním balíčkem:</span>
              <div className="row">
                <button className="btn small primary" onClick={() => go('/register')}>Registrace (3 boostery zdarma)</button>
                <button className="btn small" onClick={() => go('/login')}>Přihlášení</button>
              </div>
            </>
          )}
        </div>
        {!prof && <div className="row">
          <label style={{ fontWeight: 700, fontSize: 18 }} htmlFor="nm">Tvoje přezdívka:</label>
          <input id="nm" className="field" style={{ maxWidth: 320 }} value={name} placeholder="např. Rezavý Jarda" maxLength={20}
            onChange={(e) => setNm(e.target.value)} onBlur={() => name.trim() && setName(name.trim())} />
          <span className="muted">Základny:</span>
          <div className="seg">
            <button className={bases === 'draft' ? 'on' : ''} onClick={() => setBases('draft')} title="Každý dostane 6 základen a vybere si 3">Výběr 3 ze 6</button>
            <button className={bases === 'random' ? 'on' : ''} onClick={() => setBases('random')} title="Rychlá hra – 3 náhodné základny">Náhodné</button>
          </div>
        </div>}
        {prof && <div className="row">
          <span className="muted">Základny:</span>
          <div className="seg">
            <button className={bases === 'draft' ? 'on' : ''} onClick={() => setBases('draft')}>Výběr 3 ze 6</button>
            <button className={bases === 'random' ? 'on' : ''} onClick={() => setBases('random')}>Náhodné</button>
          </div>
        </div>}
      </div>

      <div className="home-grid">
        <div className="panel home-card">
          <h2><Icon name="wifi-router" /> Hrát online</h2>
          <p>Založ stůl a pošli kamarádovi odkaz nebo čtyřmístný kód. Funguje přes internet, LAN i Hamachi.</p>
          {prof && (
            <>
              <div className="seg">
                <button className={deckMode === 'collection' ? 'on' : ''} onClick={() => setDeckMode('collection')} title="Každý hraje se svým balíčkem z kolekce">Sběratelský</button>
                <button className={deckMode === 'classic' ? 'on' : ''} onClick={() => setDeckMode('classic')} title="Jeden společný balíček 72 karet">Klasika</button>
              </div>
              {deckMode === 'collection' && (
                <div className="row">
                  <select className="field" value={curDeck?.id ?? ''} onChange={(e) => { setDeckSel(e.target.value); selectDeck(e.target.value); }}>
                    {decks.map((d) => <option key={d.id} value={d.id}>{d.name} ({deckSize(d.cards)} karet)</option>)}
                  </select>
                  {!deckOk && <span className="why">Balíček není platný – uprav ho v Kolekci.</span>}
                </div>
              )}
            </>
          )}
          <div className="row">
            <span className="muted">Čas na tah:</span>
            <div className="seg">
              {[0, 60, 90, 120].map((t) => <button key={t} className={timer === t ? 'on' : ''} onClick={() => setTimer(t)}>{t ? `${t} s` : 'bez limitu'}</button>)}
            </div>
          </div>
          <button className="btn primary" disabled={!canOnline} onClick={() => { ensureName(); if (curDeck) selectDeck(curDeck.id); go(`/new${qNew}`); }}>
            <Icon name="play-button" /> Založit stůl
          </button>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (code.trim()) { ensureName(); if (curDeck) selectDeck(curDeck.id); go(`/room/${code.trim().toUpperCase()}`); } }}>
            <input className="field" style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '.2em' }} placeholder="KÓD" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn" type="submit" disabled={!code.trim()}>Připojit</button>
          </form>
        </div>

        <div className="panel home-card">
          <h2><Icon name="robot-golem" /> Proti botovi</h2>
          <p>Trénink proti počítači. Ideální na naučení pravidel – běží jen v prohlížeči.</p>
          <div className="seg">
            {(['easy', 'normal', 'hard'] as const).map((l) => (
              <button key={l} className={level === l ? 'on' : ''} onClick={() => setLevel(l)}>{{ easy: 'Lehký', normal: 'Střední', hard: 'Těžký' }[l]}</button>
            ))}
          </div>
          <button className="btn" onClick={() => { ensureName(); go(`/bot?level=${level}${bases === 'random' ? '&bases=random' : ''}`); }}>
            <Icon name="crossed-swords" /> Hrát proti botovi
          </button>
        </div>

        <div className="panel home-card">
          <h2><Icon name="tabletop-players" /> Jeden počítač</h2>
          <p>Dva hráči u jednoho zařízení. Před každým předáním se ruka schová.</p>
          <input className="field" placeholder="Jméno 2. hráče" maxLength={20} defaultValue={(() => { try { return localStorage.getItem('pk.name2') ?? ''; } catch { return ''; } })()}
            onChange={(e) => { try { localStorage.setItem('pk.name2', e.target.value.slice(0, 20)); } catch { /* ignore */ } }} />
          <button className="btn" onClick={() => { ensureName(); go(`/hotseat${q}`); }}>
            <Icon name="swap-bag" /> Hrát u jednoho PC
          </button>
        </div>

        <div className="panel home-card">
          <h2><Icon name="rule-book" /> Pravidla a karty</h2>
          <p>Kompletní pravidla, přehled stavů na stole a databáze všech karet.</p>
          <div className="row">
            <button className="btn" onClick={() => go('/rules')}><Icon name="rule-book" /> Pravidla</button>
            <button className="btn" onClick={() => go('/cards')}><Icon name="magnifying-glass" /> Karty</button>
          </div>
        </div>
      </div>

      <div className="footer-note">
        Vlastní fanouškovská hra pro kamarády, žádný komerční produkt. Ikony: <a href="https://game-icons.net" target="_blank" rel="noreferrer">game-icons.net</a> (CC BY 3.0) – Lorc, Delapouite a další.
      </div>
    </div>
  );
}
