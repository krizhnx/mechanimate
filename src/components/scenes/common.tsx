import type { ReactNode } from "react";

export const W = 800;
export const H = 440;

export function makeView(b: { xmin: number; xmax: number; ymin: number; ymax: number }, pad = 30, w = W, h = H) {
  const s = Math.min((w - 2 * pad) / (b.xmax - b.xmin), (h - 2 * pad) / (b.ymax - b.ymin));
  const ox = (w - s * (b.xmax - b.xmin)) / 2;
  const oy = (h - s * (b.ymax - b.ymin)) / 2;
  return {
    s,
    sx: (x: number) => ox + (x - b.xmin) * s,
    sy: (y: number) => h - (oy + (y - b.ymin) * s),
  };
}

interface ArrowProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  label?: ReactNode;
  width?: number;
  dim?: boolean;
  glow?: boolean;
  dashed?: boolean;
  double?: boolean;
  labelOffset?: number;
  labelSide?: "end" | "left" | "right";
}

export function Arrow({ x1, y1, x2, y2, color, label, width = 3, dim, glow, dashed, double, labelOffset = 14, labelSide = "end" }: ArrowProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!(len > 3)) return null;
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.min(11 + width, len * 0.6);
  const px = -uy;
  const py = ux;
  const tri = (tx: number, ty: number) => {
    const bx = tx - ux * head;
    const by = ty - uy * head;
    return `${tx},${ty} ${bx + px * head * 0.45},${by + py * head * 0.45} ${bx - px * head * 0.45},${by - py * head * 0.45}`;
  };
  const w = glow ? width + 1.5 : width;
  let lx = x2 + ux * labelOffset;
  let ly = y2 + uy * labelOffset;
  if (labelSide !== "end") {
    const sgn = labelSide === "left" ? 1 : -1;
    lx = (x1 + x2) / 2 + px * labelOffset * sgn;
    ly = (y1 + y2) / 2 + py * labelOffset * sgn;
  }
  return (
    <g opacity={dim ? 0.22 : 1} className={glow ? "glow" : undefined} style={{ color }}>
      <line x1={x1} y1={y1} x2={x2 - ux * head * 0.8} y2={y2 - uy * head * 0.8} stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={dashed ? "6 5" : undefined} />
      <polygon points={tri(x2, y2)} fill={color} />
      {double && <polygon points={tri(x2 - ux * head * 0.9, y2 - uy * head * 0.9)} fill={color} />}
      {label !== undefined && (
        <text x={lx} y={ly} fill={color} fontSize={13} fontWeight={600} textAnchor="middle" dominantBaseline="middle" className="halo">
          {label}
        </text>
      )}
    </g>
  );
}

export function DimLine({
  x1,
  y1,
  x2,
  y2,
  label,
  color = "#cbd5e1",
  glow,
  dim,
  offset = 14,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: ReactNode;
  color?: string;
  glow?: boolean;
  dim?: boolean;
  offset?: number;
}) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 6) return null;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const px = -uy;
  const py = ux;
  const h = 7;
  const head = (tx: number, ty: number, d: number) =>
    `${tx},${ty} ${tx - ux * h * d + px * h * 0.5},${ty - uy * h * d + py * h * 0.5} ${tx - ux * h * d - px * h * 0.5},${ty - uy * h * d - py * h * 0.5}`;
  return (
    <g opacity={dim ? 0.3 : 1} className={glow ? "glow" : undefined}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={glow ? 2.5 : 1.4} />
      <polygon points={head(x2, y2, 1)} fill={color} />
      <polygon points={head(x1, y1, -1)} fill={color} />
      <text x={(x1 + x2) / 2 + px * offset} y={(y1 + y2) / 2 + py * offset} fill={color} fontSize={13} fontWeight={600} textAnchor="middle" dominantBaseline="middle" className="halo">
        {label}
      </text>
    </g>
  );
}

export function Hatch({ x1, x2, y, flip }: { x1: number; x2: number; y: number; flip?: boolean }) {
  const lines = [];
  for (let x = x1; x < x2; x += 12) lines.push(<line key={x} x1={x} y1={y} x2={x - 8} y2={y + (flip ? -8 : 8)} stroke="#64748b" strokeWidth={1} />);
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="#94a3b8" strokeWidth={2} />
      {lines}
    </g>
  );
}

export function Mass({ x, y, w, h, label, sub, rotate, cx, cy, color = "#334155" }: { x: number; y: number; w: number; h: number; label: string; sub?: string; rotate?: number; cx?: number; cy?: number; color?: string }) {
  const tr = rotate ? `rotate(${rotate} ${cx ?? x + w / 2} ${cy ?? y + h / 2})` : undefined;
  return (
    <g transform={tr}>
      <rect x={x} y={y} width={w} height={h} rx={5} fill={color} stroke="#cbd5e1" strokeWidth={1.5} />
      <text x={x + w / 2} y={y + h / 2 - (sub ? 6 : 0)} fill="#f8fafc" fontSize={14} fontWeight={700} textAnchor="middle" dominantBaseline="middle">
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 10} fill="#cbd5e1" fontSize={11} textAnchor="middle" dominantBaseline="middle">
          {sub}
        </text>
      )}
    </g>
  );
}

export function Pulley({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#1e293b" stroke="#cbd5e1" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={3} fill="#cbd5e1" />
    </g>
  );
}

export function AngleArc({ cx, cy, r, from, to, label, color = "#e2e8f0" }: { cx: number; cy: number; r: number; from: number; to: number; label: string; color?: string }) {
  // angles in radians, mathematical convention (counter-clockwise from +x), screen y flipped
  const x1 = cx + r * Math.cos(from);
  const y1 = cy - r * Math.sin(from);
  const x2 = cx + r * Math.cos(to);
  const y2 = cy - r * Math.sin(to);
  const sweep = to > from ? 0 : 1;
  const mid = (from + to) / 2;
  return (
    <g>
      <path d={`M ${x1} ${y1} A ${r} ${r} 0 0 ${sweep} ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={1.5} />
      <text x={cx + (r + 13) * Math.cos(mid)} y={cy - (r + 13) * Math.sin(mid)} fill={color} fontSize={13} textAnchor="middle" dominantBaseline="middle" className="halo">
        {label}
      </text>
    </g>
  );
}
