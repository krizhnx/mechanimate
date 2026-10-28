import type { ProjectileSim } from "../../shared/physics";
import { fmt } from "../../shared/physics";
import type { Highlight } from "../../shared/types";
import { C, OPEN, shownBy } from "../../sceneUtils";
import type { Reveal } from "../../sceneUtils";
import { AngleArc, Arrow, DimLine, H, W, makeView } from "./common";

interface Props {
  sim: ProjectileSim;
  t: number;
  highlight: Highlight;
  labels?: Record<string, string>;
  showVectors: boolean;
  objectLabel?: string;
  reveal?: Reveal;
}

export function ProjectileScene({ sim, t, highlight, labels, showVectors, reveal = OPEN }: Props) {
  const shown = shownBy(reveal);
  const R = Math.max(sim.range, 0);
  const Hm = Math.max(sim.maxHeight, 0.5);
  const span = Math.max(R, Hm * 1.3, 1);
  const view = makeView(
    {
      xmin: -0.17 * span,
      xmax: Math.max(R, 0.25 * span) + 0.1 * span,
      ymin: -0.12 * Hm - 0.03 * span,
      ymax: Hm * 1.12 + 0.05 * span,
    },
    28
  );
  const { sx, sy } = view;

  const tc = Math.min(t, sim.tFlight);
  const p = sim.at(tc);
  const N = 140;
  const full: string[] = [];
  const done: string[] = [];
  for (let i = 0; i <= N; i++) {
    const tt = (sim.tFlight * i) / N;
    const q = sim.at(tt);
    const pt = `${sx(q.x).toFixed(1)},${sy(q.y).toFixed(1)}`;
    full.push(pt);
    if (tt <= tc) done.push(pt);
  }
  done.push(`${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`);

  const hl = (...hs: Highlight[]) => hs.includes(highlight);
  const focusVectors = hl("components", "horizontal", "vertical");
  const O = labels?.origin ?? "O";
  const Nl = labels?.base ?? "N";
  const A = labels?.landing ?? "A";
  const groundY = sy(0);
  const vScale = (0.15 * W) / Math.max(sim.U, 1);
  const bx = sx(p.x);
  const by = sy(p.y);
  const top = sim.at(sim.tMax);
  const landed = t >= sim.tFlight - 1e-6;

  // ghost dots every 0.5 s (equal time intervals -> equal horizontal spacing)
  const ghosts = [];
  for (let k = 0.5; k < tc; k += 0.5) {
    const q = sim.at(k);
    ghosts.push(<circle key={k} cx={sx(q.x)} cy={sy(q.y)} r={3} fill={C.path} opacity={0.45} />);
  }

  return (
    <g>
      {/* ground */}
      <rect x={-1500} y={groundY} width={W + 3000} height={H - groundY + 1500} fill="url(#ground)" />
      <line x1={-1500} y1={groundY} x2={W + 1500} y2={groundY} stroke="#3d5546" strokeWidth={2} />
      {/* cliff */}
      {sim.H > 0.001 && <rect x={-1500} y={sy(sim.H)} width={sx(0) + 1500} height={groundY - sy(sim.H)} fill="url(#rock)" stroke="#94a3b8" strokeWidth={1} />}

      {/* dimension lines */}
      {sim.H > 0.001 && (
        <DimLine x1={sx(0) - 26} y1={groundY} x2={sx(0) - 26} y2={sy(sim.H)} label={shown(sim.H) ? `${fmt(sim.H, 3)} m` : "H = ?"} glow={hl("vertical", "landing")} dim={focusVectors && !hl("vertical")} offset={-30} />
      )}
      {R > 0.01 && <DimLine x1={sx(0)} y1={groundY + 22} x2={sx(R)} y2={groundY + 22} label={shown(R) ? `${fmt(R, 3)} m` : "? m"} glow={hl("horizontal", "time", "landing")} offset={14} />}

      {/* max height marker */}
      {sim.tMax > 0 && (
        <g opacity={hl("max_height") ? 1 : 0.45} className={hl("max_height") ? "glow" : undefined}>
          <line x1={sx(0)} y1={sy(sim.maxHeight)} x2={sx(top.x)} y2={sy(sim.maxHeight)} stroke={C.accel} strokeDasharray="4 4" strokeWidth={1.5} />
          <DimLine x1={sx(top.x)} y1={groundY} x2={sx(top.x)} y2={sy(sim.maxHeight)} label={shown(sim.maxHeight) ? `${fmt(sim.maxHeight, 3)} m` : "max height = ?"} color={C.accel} glow={hl("max_height")} offset={-34} />
        </g>
      )}

      {/* trajectory */}
      <polyline points={full.join(" ")} fill="none" stroke={C.path} strokeOpacity={0.35} strokeWidth={2} strokeDasharray="5 6" />
      <polyline points={done.join(" ")} fill="none" stroke={C.path} strokeWidth={hl("trajectory") ? 4 : 2.5} className={hl("trajectory") ? "glow" : undefined} />
      {ghosts}

      {/* launch angle */}
      <line x1={sx(0)} y1={sy(sim.H)} x2={sx(0) + 70} y2={sy(sim.H)} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={1} />
      {Math.abs(sim.theta) > 0.01 && <AngleArc cx={sx(0)} cy={sy(sim.H)} r={36} from={0} to={sim.theta} label="θ" />}
      {/* initial velocity arrow (faded once launched) */}
      <Arrow
        x1={sx(0)}
        y1={sy(sim.H)}
        x2={sx(0) + sim.ux * vScale}
        y2={sy(sim.H) - sim.uy * vScale}
        color={C.v}
        label={shown(sim.U) ? `${fmt(sim.U, 3)} m/s` : "U"}
        dim={t > 0.05 && !hl("components")}
        width={2}
      />

      {/* labels */}
      <text x={sx(0) - 10} y={sy(sim.H) - 12} fill={C.ink} fontSize={15} fontStyle="italic" textAnchor="end" className="halo">
        {O}
      </text>
      {sim.H > 0.001 && (
        <text x={sx(0) + 8} y={groundY - 8} fill={C.ink} fontSize={15} fontStyle="italic" className="halo">
          {Nl}
        </text>
      )}
      <text x={sx(R) + 6} y={groundY - 8} fill={C.ink} fontSize={15} fontStyle="italic" className="halo">
        {A}
      </text>
      <circle cx={sx(R)} cy={groundY} r={landed ? 7 : 4} fill="none" stroke={hl("landing") ? C.accel : "#e2e8f0"} strokeWidth={2} className={hl("landing") ? "glow" : undefined} />

      {/* velocity vectors on the particle */}
      {showVectors && !landed && (
        <g>
          <Arrow x1={bx} y1={by} x2={bx + p.vx * vScale} y2={by} color={C.vx} label={reveal.exam ? "vₓ" : `vₓ ${fmt(p.vx, 3)}`} glow={hl("components", "horizontal")} dim={focusVectors && !hl("components", "horizontal")} />
          <Arrow x1={bx} y1={by} x2={bx} y2={by - p.vy * vScale} color={C.vy} label={reveal.exam ? "v_y" : `v_y ${fmt(p.vy, 3)}`} glow={hl("components", "vertical")} dim={focusVectors && !hl("components", "vertical")} />
          <Arrow x1={bx} y1={by} x2={bx + p.vx * vScale} y2={by - p.vy * vScale} color={C.v} width={2} dashed dim={focusVectors && !hl("components")} />
          <Arrow x1={bx + 22} y1={by - 6} x2={bx + 22} y2={by + 28} color={C.weight} width={2} label="g" dim={!hl("vertical", "time")} />
        </g>
      )}

      {/* the particle */}
      <circle cx={bx} cy={by} r={8} fill="#f8fafc" stroke="#0f172a" strokeWidth={2} />
    </g>
  );
}
