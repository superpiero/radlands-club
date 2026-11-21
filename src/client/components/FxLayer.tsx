import { useLayoutEffect, useRef, useState } from 'react';
import type { Fx, PlayerIdx } from '../../engine/types';
import type { GameView } from '../../engine/view';
import { sfx } from '../sound';
import { Icon } from './Icon';

interface Spawn { key: number; cls: string; rect: { x: number; y: number; w: number; h: number }; content?: React.ReactNode }

let spawnKey = 0;

function rectsNow(): Map<string, DOMRect> {
  const m = new Map<string, DOMRect>();
  document.querySelectorAll<HTMLElement>('[data-uid]').forEach((el) => m.set(el.dataset.uid!, el.getBoundingClientRect()));
  return m;
}

/** Visual + audio feedback for engine Fx events. */
export function FxLayer({ view, me, onTurn }: { view: GameView; me: PlayerIdx; onTurn: (p: PlayerIdx) => void }) {
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const lastRev = useRef<number>(-1);
  const [spawns, setSpawns] = useState<Spawn[]>([]);

  useLayoutEffect(() => {
    const now = rectsNow();
    if (view.rev !== lastRev.current && lastRev.current !== -1) {
      const out: Spawn[] = [];
      const sounds = new Set<keyof typeof sfx>();
      const at = (uid: string) => {
        const r = now.get(uid) ?? prevRects.current.get(uid);
        return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
      };
      for (const f of view.fx as Fx[]) {
        switch (f.t) {
          case 'damage': {
            const r = at(f.uid);
            if (r) out.push({ key: ++spawnKey, cls: f.destroyed ? 'boom' : 'hit', rect: r, content: f.destroyed ? <Icon name="explosion-rays" /> : null });
            sounds.add(f.destroyed ? 'destroy' : 'hit');
            const el = document.querySelector(`[data-uid="${f.uid}"]`);
            if (el && !f.destroyed) { el.classList.remove('shake'); void (el as HTMLElement).offsetWidth; el.classList.add('shake'); }
            break;
          }
          case 'boom': {
            const r = at(f.uid);
            if (r) out.push({ key: ++spawnKey, cls: 'boom', rect: r, content: <Icon name="explosion-rays" /> });
            sounds.add('boom');
            break;
          }
          case 'restore': {
            const r = at(f.uid);
            if (r) out.push({ key: ++spawnKey, cls: 'heal', rect: r, content: '+' });
            sounds.add('heal');
            break;
          }
          case 'stun': {
            const r = at(f.uid);
            if (r) out.push({ key: ++spawnKey, cls: 'stun', rect: r, content: <Icon name="knockout" /> });
            sounds.add('stun');
            break;
          }
          case 'water': {
            const el = document.querySelector(`[data-water="${f.player}"]`);
            if (el && f.n > 0) {
              const r = el.getBoundingClientRect();
              out.push({ key: ++spawnKey, cls: 'float', rect: { x: r.left, y: r.top - 10, w: r.width, h: r.height }, content: `+${f.n}💧` });
            }
            sounds.add('water');
            break;
          }
          case 'play': sounds.add('play'); break;
          case 'draw': if (f.player === me) sounds.add('draw'); break;
          case 'raid': sounds.add('raid'); break;
          case 'event': sounds.add('card'); break;
          case 'junk': sounds.add('card'); break;
          case 'ability': sounds.add('click'); break;
          case 'turn': onTurn(f.player); if (f.player === me) sounds.add('turn'); break;
        }
      }
      // play at most 3 distinct sounds, prioritised
      const order: (keyof typeof sfx)[] = ['boom', 'destroy', 'raid', 'hit', 'turn', 'heal', 'stun', 'play', 'water', 'card', 'draw', 'click'];
      let n = 0;
      for (const s of order) if (sounds.has(s) && n < 3) { setTimeout(() => sfx[s](), n * 90); n++; }
      if (out.length) {
        setSpawns((s) => [...s, ...out]);
        const keys = new Set(out.map((o) => o.key));
        setTimeout(() => setSpawns((s) => s.filter((x) => !keys.has(x.key))), 1300);
      }
    }
    lastRev.current = view.rev;
    prevRects.current = now;
  });

  return (
    <div className="fx-layer">
      {spawns.map((s) => (
        <div key={s.key} className={`fx ${s.cls}`} style={{ left: s.rect.x, top: s.rect.y, width: s.rect.w, height: s.rect.h }}>{s.content}</div>
      ))}
    </div>
  );
}
