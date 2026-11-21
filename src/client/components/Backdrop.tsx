// Original procedural wasteland panorama used behind the home page and other menus.
// Pure SVG + CSS (no images), so it costs nothing to load and scales to any screen.

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return (s % 10000) / 10000; };
}

/** Broken-city skyline between x0 and x1 standing on `base`. */
function city(seed: number, x0: number, x1: number, base: number, minH: number, maxH: number): string {
  const r = rng(seed);
  let d = `M${x0} ${base}`;
  let x = x0;
  while (x < x1) {
    const w = 18 + r() * 46;
    const h = minH + r() * (maxH - minH);
    const top = base - h;
    const broken = r() < 0.35;
    d += ` V${top.toFixed(1)}`;
    if (broken) d += ` L${(x + w * 0.45).toFixed(1)} ${(top + 6 + r() * 14).toFixed(1)} L${(x + w * 0.7).toFixed(1)} ${(top + 2).toFixed(1)}`;
    d += ` H${(x + w).toFixed(1)}`;
    if (r() < 0.3) { d += ` V${(base - 4).toFixed(1)}`; x += w + 8 + r() * 30; d += ` H${x.toFixed(1)}`; } else x += w;
  }
  return `${d} V${base} Z`;
}

function WindPump({ x, base, h, cls }: { x: number; base: number; h: number; cls?: string }) {
  const top = base - h;
  const rr = h * 0.17;
  const blades = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return `M${(Math.cos(a) * rr * 0.25).toFixed(1)} ${(Math.sin(a) * rr * 0.25).toFixed(1)} L${(Math.cos(a + 0.13) * rr).toFixed(1)} ${(Math.sin(a + 0.13) * rr).toFixed(1)} L${(Math.cos(a - 0.05) * rr).toFixed(1)} ${(Math.sin(a - 0.05) * rr).toFixed(1)}Z`;
  }).join(' ');
  const w = h * 0.12;
  return (
    <g className={cls}>
      <path d={`M${x - w} ${base} L${x - 2} ${top + rr * 0.3} H${x + 2} L${x + w} ${base} H${x + w - 3} L${x} ${top + rr * 0.6} L${x - w + 3} ${base}Z`} />
      {[0.3, 0.55, 0.8].map((f) => <path key={f} d={`M${x - w * f} ${top + h * f} H${x + w * f}`} strokeWidth={Math.max(1.2, h * 0.008)} stroke="currentColor" fill="none" />)}
      <path d={`M${x} ${top} l${rr * 1.3} ${-rr * 0.12} l0 ${rr * 0.5} Z`} />
      <g transform={`translate(${x} ${top})`}><g className="rotor">
        <path d={blades} />
        <circle r={rr * 0.16} />
      </g></g>
    </g>
  );
}

export function Panorama({ variant = 'home' }: { variant?: 'home' | 'page' }) {
  const stars = rng(7);
  return (
    <div className={`backdrop backdrop-${variant}`} aria-hidden>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="bdSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#170f14" />
            <stop offset=".2" stopColor="#331a1b" />
            <stop offset=".38" stopColor="#7a3820" />
            <stop offset=".52" stopColor="#c8693a" />
            <stop offset=".62" stopColor="#efa766" />
            <stop offset=".7" stopColor="#f7d398" />
          </linearGradient>
          <radialGradient id="bdSun"><stop offset="0" stopColor="#fff1d2" /><stop offset=".22" stopColor="#ffd9a0" stopOpacity=".95" /><stop offset=".5" stopColor="#ff9f5a" stopOpacity=".35" /><stop offset="1" stopColor="#ff8a40" stopOpacity="0" /></radialGradient>
          <linearGradient id="bdHaze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6c98a" stopOpacity="0" /><stop offset=".55" stopColor="#f2b877" stopOpacity=".55" /><stop offset="1" stopColor="#f2b877" stopOpacity="0" /></linearGradient>
          <linearGradient id="bdGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a1b10" /><stop offset=".4" stopColor="#1d0f09" /><stop offset="1" stopColor="#120c09" /></linearGradient>
          <linearGradient id="bdWater" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3fb8c9" stopOpacity="0" /><stop offset=".5" stopColor="#8fe3ef" stopOpacity=".9" /><stop offset="1" stopColor="#3fb8c9" stopOpacity="0" /></linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#bdSky)" />
        {Array.from({ length: 60 }, (_, i) => (
          <circle key={i} cx={stars() * 1600} cy={stars() * 240} r={0.6 + stars() * 1.3} fill="#f6ecd8" opacity={0.25 + stars() * 0.5} className={i % 5 === 0 ? 'twinkle' : undefined} />
        ))}
        <circle cx="1060" cy="590" r="420" fill="url(#bdSun)" />
        <circle cx="1060" cy="590" r="80" fill="#fff0cf" opacity=".95" />
        {/* far mesas */}
        <path fill="#9a4a2a" opacity=".75" d="M0 640 L70 640 L96 572 L250 562 L276 640 L470 640 L494 596 L626 590 L646 640 L820 640 L852 532 L1010 522 L1040 640 L1240 640 L1266 584 L1400 578 L1424 640 L1600 640 V900 H0Z" />
        <rect y="560" width="1600" height="120" fill="url(#bdHaze)" />
        {/* ruined city, water tower and pumps */}
        <path fill="#5a2616" d={city(11, 380, 900, 668, 18, 84)} />
        <path fill="#5a2616" d={city(5, 1180, 1600, 668, 14, 60)} />
        <g fill="#4a1f12" color="#4a1f12">
          <path d="M1092 668 L1100 610 H1106 L1099 668Z M1132 668 L1124 610 H1118 L1125 668Z M1088 612 H1136 V586 Q1112 574 1088 586Z" />
          <WindPump x={300} base={668} h={120} />
          <WindPump x={1500} base={668} h={96} />
        </g>
        {/* teal glint: the last water */}
        <path d="M640 682 Q800 674 960 682" stroke="url(#bdWater)" strokeWidth="3" fill="none" className="glint" />
        {/* near dunes */}
        <path fill="url(#bdGround)" d="M0 700 Q220 650 470 690 T 940 684 T 1360 694 T 1600 676 V900 H0Z" />
        {/* foreground: big wind pump and fence */}
        <g fill="#0d0805" color="#0d0805">
          <WindPump x={150} base={780} h={330} cls="fg" />
          {Array.from({ length: 9 }, (_, i) => <rect key={i} x={1250 + i * 42} y={724 + (i % 3) * 3} width="5" height={52 - (i % 4) * 6} transform={`rotate(${(i % 3) - 1} ${1252 + i * 42} 760)`} />)}
          <path d="M1250 740 Q1420 752 1600 734" stroke="#0d0805" strokeWidth="2.2" fill="none" />
          <path d="M0 790 Q300 740 640 772 T 1600 760 V900 H0Z" />
        </g>
      </svg>
      <div className="dust" />
    </div>
  );
}
