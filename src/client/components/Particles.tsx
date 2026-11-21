// Lightweight canvas particle system (sparks, dust, confetti). One global canvas.
import { useEffect, useRef } from 'react';

interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'spark' | 'confetti' | 'dust'; rot: number; vr: number }

const parts: P[] = [];
let running = false;
let canvasEl: HTMLCanvasElement | null = null;

const reduced = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

function loop() {
  const c = canvasEl;
  if (!c) { running = false; return; }
  const ctx = c.getContext('2d');
  if (!ctx) { running = false; return; }
  const dpr = window.devicePixelRatio || 1;
  if (c.width !== innerWidth * dpr || c.height !== innerHeight * dpr) {
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life++;
    if (p.life > p.max) { parts.splice(i, 1); continue; }
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.kind === 'confetti' ? 0.12 : p.kind === 'dust' ? -0.01 : 0.18;
    p.vx *= 0.985;
    p.rot += p.vr;
    const a = 1 - p.life / p.max;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = p.color;
    if (p.kind === 'confetti') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.kind === 'spark' ? a + 0.3 : 1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(loop);
  else running = false;
}

function kick() {
  if (!running && canvasEl) { running = true; requestAnimationFrame(loop); }
}

/** Radial spark burst at screen coordinates. */
export function burst(x: number, y: number, color = '#ffd36a', n = 30) {
  if (reduced()) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 2 + Math.random() * 6;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 0, max: 40 + Math.random() * 30, size: 1.5 + Math.random() * 3, color, kind: 'spark', rot: 0, vr: 0 });
  }
  kick();
}

/** Confetti rain from the top (victory). */
export function confetti(n = 160) {
  if (reduced()) return;
  const colors = ['#3fb8c9', '#8fe3ef', '#e9b949', '#e8742f', '#f1e6d2', '#7fc35d'];
  for (let i = 0; i < n; i++) {
    parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 3, life: 0, max: 160 + Math.random() * 80, size: 6 + Math.random() * 6, color: colors[i % colors.length], kind: 'confetti', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3 });
  }
  kick();
}

/** Dust puff (destroyed card). */
export function dust(x: number, y: number, w: number, h: number) {
  if (reduced()) return;
  for (let i = 0; i < 26; i++) {
    parts.push({ x: x + Math.random() * w, y: y + Math.random() * h, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 1.5, life: 0, max: 50 + Math.random() * 40, size: 3 + Math.random() * 5, color: 'rgba(190,170,140,.8)', kind: 'dust', rot: 0, vr: 0 });
  }
  kick();
}

export function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    canvasEl = ref.current;
    kick();
    return () => { if (canvasEl === ref.current) canvasEl = null; };
  }, []);
  return <canvas ref={ref} className="particles" aria-hidden />;
}
