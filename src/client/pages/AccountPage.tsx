import { useState } from 'react';
import { go } from '../App';
import { login, register, useAccount } from '../account';
import { Icon } from '../components/Icon';
import { setName } from '../prefs';
import { sfx } from '../sound';

export function AccountPage({ mode }: { mode: 'login' | 'register' }) {
  const acc = useAccount();
  const [name, setNm] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reg = mode === 'register';

  if (acc.profile) {
    return (
      <div className="waiting"><div className="panel">
        <h2 className="stencil" style={{ margin: 0 }}>Přihlášen(a) jako {acc.profile.name}</h2>
        <button className="btn primary" onClick={() => go('/')}>Pokračovat</button>
      </div></div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (reg && pw !== pw2) { setErr('Hesla se neshodují.'); return; }
    setBusy(true);
    try {
      const p = reg ? await register(name, pw) : await login(name, pw);
      setName(p.name);
      sfx.win();
      go(reg ? '/boosters?welcome=1' : '/');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Něco se pokazilo.');
      sfx.error();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="waiting">
      <form className="panel" onSubmit={submit} style={{ textAlign: 'left' }}>
        <h2 className="stencil" style={{ margin: 0, textAlign: 'center' }}>{reg ? 'Registrace' : 'Přihlášení'}</h2>
        {reg && (
          <p className="muted" style={{ margin: 0 }}>
            Účet ti uloží kolekci karet na tomto serveru. Hned po registraci dostaneš <b>startovní sadu</b> a otevřeš si <b>3 uvítací boostery</b>.
          </p>
        )}
        <label>Jméno<input className="field" value={name} onChange={(e) => setNm(e.target.value)} autoComplete="username" maxLength={20} autoFocus /></label>
        <label>Heslo<input className="field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={reg ? 'new-password' : 'current-password'} /></label>
        {reg && <label>Heslo znovu<input className="field" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></label>}
        {err && <div className="toast err" style={{ animation: 'none' }}>{err}</div>}
        <button className="btn primary" type="submit" disabled={busy || !name.trim() || !pw}>{busy ? 'Moment…' : reg ? 'Vytvořit účet' : 'Přihlásit'}</button>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn ghost small" onClick={() => go('/')}><Icon name="return-arrow" /> Zpět</button>
          <button type="button" className="btn ghost small" onClick={() => go(reg ? '/login' : '/register')}>{reg ? 'Už mám účet' : 'Nemám účet – registrace'}</button>
        </div>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>Účet platí jen na tomto herním serveru. Heslo je uložené bezpečně zahashované.</p>
      </form>
    </div>
  );
}
