// Game-feel layer: FLIP card movement, projectiles, impacts, sounds.
// Runs after every committed render; compares DOM rects of [data-uid] elements with the previous render.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Fx, PlayerIdx } from '../../engine/types';
import type { GameView } from '../../engine/view';
import { sfx } from '../sound';
import { Drop, Icon } from './Icon';
import { burst, dust } from './Particles';

interface R { x: number; y: number; w: number; h: number }
interface Spawn { key: number; cls: string; rect: R; content?: ReactNode; style?: React.CSSProperties; delay?: number }

let spawnKey = 0;

export const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

function rectsNow(): Map<string, R> {
  const m = new Map<string, R>();
  document.querySelectorAll<HTMLElement>('[data-uid]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0) m.set(el.dataset.uid!, { x: r.left, y: r.top, w: r.width, h: r.height });
  });
  return m;
}

function center(r: R) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }

/** Animate an element from an old rect to where it is now (FLIP, additive so CSS transforms survive). */
function flip(el: HTMLElement, from: R, to: R, ms = 420) {
  const dx = from.x + from.w / 2 - (to.x + to.w / 2);
  const dy = from.y + from.h / 2 - (to.y + to.h / 2);
  const s = from.w / Math.max(1, to.w);
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Math.abs(1 - s) < 0.08) return;
  try {
    el.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${s})`, zIndex: 30 }, { transform: 'translate(0, 0) scale(1)', zIndex: 30 }],
      { duration: ms, easing: 'cubic-bezier(.2,.9,.25,1.05)', composite: 'add' } as KeyframeAnimationOptions,
    );
  } catch { /* older browsers */ }
}

export function FxLayer({ view, me, onTurn, onThirst }: { view: GameView; me: PlayerIdx; onTurn: (p: PlayerIdx) => void; onThirst?: (p: PlayerIdx, first: boolean) => void }) {
  const prevRects = useRef<Map<string, R>>(new Map());
  const lastRev = useRef<number>(-1);
  const prevWater = useRef<number>(view.players[me].water);
  const [spawns, setSpawns] = useState<Spawn[]>([]);

  useLayoutEffect(() => {
    const now = rectsNow();
    const reduced = reducedMotion();
    if (view.rev !== lastRev.current && lastRev.current !== -1) {
      const prev = prevRects.current;
      const out: Spawn[] = [];
      const sounds: { s: keyof typeof sfx; at: number }[] = [];
      const at = (uid: string) => now.get(uid) ?? prev.get(uid) ?? null;
      const fx = view.fx as Fx[];
      const drew = fx.some((f) => f.t === 'draw' && f.player === me);
      const deckRect = now.get('deck-pile');

      // 1) FLIP: everything that moved since last render
      if (!reduced) {
        document.querySelectorAll<HTMLElement>('[data-uid]').forEach((el) => {
          const uid = el.dataset.uid!;
          const to = now.get(uid);
          if (!to) return;
          const from = prev.get(uid);
          if (from) flip(el, from, to);
          else if (drew && deckRect && el.closest('.hand')) flip(el, deckRect, to, 520);
        });
      }

      // 2) impacts, projectiles, sounds
      let t = 0;
      for (const f of fx) {
        switch (f.t) {
          case 'damage': {
            const target = at(f.uid);
            if (!target) break;
            const src = f.src ? at(f.src) : null;
            let delay = 0;
            if (src && !reduced) {
              const a = center(src);
              const b = center(target);
              const dist = Math.hypot(b.x - a.x, b.y - a.y);
              if (dist > 30) {
                const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
                out.push({ key: ++spawnKey, cls: 'projectile', rect: { x: a.x, y: a.y, w: 0, h: 0 },
                  style: { ['--dx' as string]: `${b.x - a.x}px`, ['--dy' as string]: `${b.y - a.y}px`, ['--ang' as string]: `${ang}deg`, animationDelay: `${t}ms` }, delay: t });
                sounds.push({ s: 'whoosh', at: t });
                delay = t + 320;
                t += 140;
              }
            }
            out.push({ key: ++spawnKey, cls: f.destroyed ? 'boom' : 'hit', rect: target, content: f.destroyed ? <Icon name="explosion-rays" /> : null, style: { animationDelay: `${delay}ms` }, delay });
            sounds.push({ s: f.destroyed ? 'destroy' : 'hit', at: delay });
            const el = document.querySelector<HTMLElement>(`[data-uid="${f.uid}"]`);
            setTimeout(() => {
              if (f.destroyed) {
                dust(target.x, target.y, target.w, target.h);
                burst(target.x + target.w / 2, target.y + target.h / 2, '#ff9a4d', 26);
                if (el?.classList.contains('k-base') || !el) {
                  document.body.classList.remove('screen-shake');
                  void document.body.offsetWidth;
                  document.body.classList.add('screen-shake');
                  setTimeout(() => document.body.classList.remove('screen-shake'), 500);
                }
              } else if (el) {
                el.classList.remove('shake');
                void el.offsetWidth;
                el.classList.add('shake');
                burst(target.x + target.w / 2, target.y + target.h / 2, '#ff6a4d', 10);
              }
            }, delay);
            break;
          }
          case 'boom': {
            const r = at(f.uid);
            if (r) out.push({ key: ++spawnKey, cls: 'boom', rect: r, content: <Icon name="explosion-rays" /> });
            sounds.push({ s: 'boom', at: 0 });
            break;
          }
          case 'restore': {
            const r = at(f.uid);
            if (r) {
              out.push({ key: ++spawnKey, cls: 'heal', rect: r, content: '+' });
              burst(r.x + r.w / 2, r.y + r.h / 2, '#8be07a', 14);
            }
            sounds.push({ s: 'heal', at: 0 });
            break;
          }
          case 'stun': {
            const r = at(f.uid);
            if (r) out.push({ key: ++spawnKey, cls: 'stun', rect: r, content: <Icon name="knockout" /> });
            sounds.push({ s: 'stun', at: 0 });
            break;
          }
          case 'water': {
            const el = document.querySelector(`[data-water="${f.player}"]`);
            if (el && f.n > 0) {
              const r = el.getBoundingClientRect();
              out.push({ key: ++spawnKey, cls: 'float', rect: { x: r.left, y: r.top + 4, w: r.width, h: r.height }, content: <span>+{f.n}<Drop /></span> });
            }
            sounds.push({ s: 'water', at: 0 });
            break;
          }
          case 'play': sounds.push({ s: 'play', at: 0 }); break;
          case 'draw': if (f.player === me) sounds.push({ s: 'draw', at: 0 }); break;
          case 'raid': sounds.push({ s: 'raid', at: 0 }); break;
          case 'event': sounds.push({ s: 'card', at: 0 }); break;
          case 'junk': sounds.push({ s: 'card', at: 0 }); break;
          case 'ability': {
            sounds.push({ s: 'click', at: 0 });
            const r = at(f.uid);
            if (r && !reduced) out.push({ key: ++spawnKey, cls: 'activate', rect: r });
            break;
          }
          case 'turn': onTurn(f.player); if (f.player === me) sounds.push({ s: 'turn', at: 0 }); break;
          case 'thirst': onThirst?.(f.player, !!f.first); sounds.push({ s: 'raid', at: 0 }); break;
        }
      }

      // 3) water spent: drops fly from my pool to the used card
      const w = view.players[me].water;
      if (!reduced && view.active === me && w < prevWater.current) {
        const spent = Math.min(4, prevWater.current - w);
        const pool = document.querySelector(`[data-water="${me}"]`)?.getBoundingClientRect();
        const used = fx.find((f) => f.t === 'ability' || f.t === 'play' || f.t === 'event');
        const target = used && 'uid' in used ? at(used.uid) : null;
        if (pool && target) {
          const b = center(target);
          for (let i = 0; i < spent; i++) {
            const a = { x: pool.left + 12 + i * 22, y: pool.top + 12 };
            out.push({ key: ++spawnKey, cls: 'dropfly', rect: { x: a.x, y: a.y, w: 0, h: 0 }, style: { ['--dx' as string]: `${b.x - a.x}px`, ['--dy' as string]: `${b.y - a.y}px`, animationDelay: `${i * 70}ms` }, content: <Icon name="water-drop" /> });
          }
        }
      }
      prevWater.current = w;

      // play at most 4 sounds, deduplicated per timestamp bucket
      const seen = new Set<string>();
      let n = 0;
      for (const { s, at: when } of sounds) {
        const k = `${s}@${Math.round(when / 100)}`;
        if (seen.has(k) || n >= 4) continue;
        seen.add(k);
        n++;
        setTimeout(() => sfx[s](), when);
      }
      if (out.length) {
        setSpawns((sp) => [...sp, ...out]);
        const keys = new Set(out.map((o) => o.key));
        const maxDelay = Math.max(0, ...out.map((o) => o.delay ?? 0));
        setTimeout(() => setSpawns((sp) => sp.filter((x) => !keys.has(x.key))), 1400 + maxDelay);
      }
    } else if (lastRev.current === -1) {
      prevWater.current = view.players[me].water;
    }
    lastRev.current = view.rev;
    prevRects.current = now;
  });

  return (
    <div className="fx-layer">
      {spawns.map((s) => (
        <div key={s.key} className={`fx ${s.cls}`} style={{ left: s.rect.x, top: s.rect.y, width: s.rect.w, height: s.rect.h, ...s.style }}>{s.content}</div>
      ))}
    </div>
  );
}
