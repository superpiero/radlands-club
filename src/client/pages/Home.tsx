import { useState } from 'react';
import { go } from '../App';
import { Icon } from '../components/Icon';
import { getName, randomName, setName } from '../prefs';

export function Home() {
  const [name, setNm] = useState(getName() || '');
  const [code, setCode] = useState('');
  const [bases, setBases] = useState<'draft' | 'random'>('draft');
  const [level, setLevel] = useState<'easy' | 'normal' | 'hard'>('normal');

  const ensureName = () => {
    const n = name.trim() || randomName();
    setName(n);
    setNm(n);
    return n;
  };

  const q = bases === 'random' ? '?bases=random' : '';

  return (
    <div className="home">
      <div className="logo">
        <h1>POSLEDNÍ<br />KAP<span className="drop">K</span>A</h1>
        <div className="tag">Karetní duel o vodu v pustině · pro 2 hráče</div>
      </div>

      <div className="panel home-card" style={{ width: 'min(1000px, 100%)' }}>
        <div className="row">
          <label style={{ fontWeight: 700, fontSize: 18 }} htmlFor="nm">Tvoje přezdívka:</label>
          <input id="nm" className="field" style={{ maxWidth: 320 }} value={name} placeholder="např. Rezavý Jarda" maxLength={20}
            onChange={(e) => setNm(e.target.value)} onBlur={() => name.trim() && setName(name.trim())} />
          <span className="muted">Základny:</span>
          <div className="seg">
            <button className={bases === 'draft' ? 'on' : ''} onClick={() => setBases('draft')} title="Každý dostane 6 základen a vybere si 3">Výběr 3 ze 6</button>
            <button className={bases === 'random' ? 'on' : ''} onClick={() => setBases('random')} title="Rychlá hra – 3 náhodné základny">Náhodné</button>
          </div>
        </div>
      </div>

      <div className="home-grid">
        <div className="panel home-card">
          <h2><Icon name="wifi-router" /> Hrát online</h2>
          <p>Založ stůl a pošli kamarádovi odkaz nebo čtyřmístný kód. Funguje přes internet, LAN i Hamachi.</p>
          <button className="btn primary" onClick={() => { ensureName(); go(`/new${q}`); }}>
            <Icon name="play-button" /> Založit stůl
          </button>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (code.trim()) { ensureName(); go(`/room/${code.trim().toUpperCase()}`); } }}>
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
