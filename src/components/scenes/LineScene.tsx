import type { LineSim } from "../../shared/physics";
import { fmt, motion1D } from "../../shared/physics";
import type { Highlight } from "../../shared/types";
import { C, niceStep, OPEN, shownBy } from "../../sceneUtils";
import type { Reveal } from "../../sceneUtils";
import { Arrow, H, W } from "./common";

interface Props {
  sim: LineSim;
  t: number;
  highlight: Highlight;
  labels?: Record<string, string>;
  showVectors: boolean;
  objectLabel?: string;
  reveal?: Reveal;
}

export function LineScene({ sim, t, highlight, labels, showVectors, objectLabel, reveal = OPEN }: Props) {
  const shown = shownBy(reveal);
  let smin = 0;
  let smax = 0;
  let vmax = 0.001;
  for (let i = 0; i <= 80; i++) {
    const st = motion1D(sim.phases, (sim.duration * i) / 80);
    smin = Math.min(smin, st.s);
    smax = Math.max(smax, st.s);
    vmax = Math.max(vmax, Math.abs(st.v));
  }
  const span = Math.max(smax - smin, 1);
  const x0 = 110;
  const x1 = W - 120;
  const sx = (s: number) => x0 + ((s - smin) / span) * (x1 - x0);
  const roadY = 290;
  const st = motion1D(sim.phases, t);
  const cx = sx(st.s);
  const hl = (...hs: Highlight[]) => hs.includes(highlight);
  const isCar = /car|van|lorry|truck|bus|vehicle|train|cyclist|bike/i.test(objectLabel ?? "") || sim.m > 300;
  const halfW = isCar ? 48 : 30;
  const midY = roadY - 26;

  const step = niceStep(span / 8);
  const ticks = [];
  for (let k = Math.ceil(smin / step); k * step <= smax + 1e-9; k++) {
    const s = k * step;
    ticks.push(
      <g key={k}>
        <line x1={sx(s)} y1={roadY + 14} x2={sx(s)} y2={roadY + 22} stroke="#64748b" />
        <text x={sx(s)} y={roadY + 36} fill={C.muted} fontSize={11} textAnchor="middle">
          {fmt(s, 3)} m
        </text>
      </g>
    );
  }

  // equal-time markers: spacing grows when accelerating
  const marks = [];
  const dtMark = sim.duration > 8 ? 2 : sim.duration > 3 ? 1 : 0.5;
  for (let k = 0; k <= t + 1e-9; k += dtMark) {
    const sk = motion1D(sim.phases, k).s;
    marks.push(
      <g key={k} opacity={0.75}>
        <circle cx={sx(sk)} cy={roadY + 6} r={4} fill={C.v} />
        <text x={sx(sk)} y={roadY - 6 - (Math.round(k / dtMark) % 2) * 0} fill={C.v} fontSize={10} textAnchor="middle" opacity={0.85}>
          {fmt(k, 2)}s
        </text>
      </g>
    );
  }

  const maxF = Math.max(Math.abs(sim.D), sim.R, Math.abs(sim.m * sim.a), 1);
  const kF = 150 / maxF;
  const resultant = sim.m * st.a;
  const vLen = (st.v / vmax) * 110;

  return (
    <g>
      <rect x={-1500} y={roadY + 10} width={W + 3000} height={H - roadY + 1500} fill="url(#ground)" />
      <rect x={-1500} y={roadY} width={W + 3000} height={12} fill="#2a2d35" />
      <line x1={-1500} y1={roadY + 6} x2={W + 1500} y2={roadY + 6} stroke="#e5e7eb" strokeDasharray="18 14" strokeWidth={1.5} opacity={0.6} />
      {ticks}

      {/* signpost at s = 0 */}
      <g>
        <line x1={sx(0)} y1={roadY} x2={sx(0)} y2={roadY - 90} stroke="#cbd5e1" strokeWidth={3} />
        <rect x={sx(0) - 38} y={roadY - 112} width={76} height={24} rx={4} fill="#166534" stroke="#cbd5e1" />
        <text x={sx(0)} y={roadY - 100} fill="#f8fafc" fontSize={11} textAnchor="middle" dominantBaseline="middle">
          {labels?.start ?? "start"}
        </text>
      </g>
      {marks}

      {/* object */}
      {isCar ? (
        <g>
          <rect x={cx - halfW} y={roadY - 44} width={halfW * 2} height={28} rx={8} fill="#2563eb" stroke="#bfdbfe" strokeWidth={1.5} />
          <path d={`M ${cx - 26} ${roadY - 44} L ${cx - 16} ${roadY - 62} L ${cx + 18} ${roadY - 62} L ${cx + 30} ${roadY - 44} Z`} fill="#1d4ed8" stroke="#bfdbfe" strokeWidth={1.5} />
          <circle cx={cx - 28} cy={roadY - 12} r={10} fill="#0f172a" stroke="#cbd5e1" strokeWidth={2} />
          <circle cx={cx + 28} cy={roadY - 12} r={10} fill="#0f172a" stroke="#cbd5e1" strokeWidth={2} />
          <text x={cx} y={roadY - 29} fill="#f8fafc" fontSize={12} fontWeight={700} textAnchor="middle" dominantBaseline="middle">
            {sim.m > 0 ? `${fmt(sim.m)} kg` : objectLabel ?? ""}
          </text>
        </g>
      ) : (
        <g>
          <rect x={cx - halfW} y={roadY - 50} width={halfW * 2} height={50} rx={6} fill="#334155" stroke="#cbd5e1" strokeWidth={1.5} />
          <text x={cx} y={roadY - 25} fill="#f8fafc" fontSize={12} fontWeight={700} textAnchor="middle" dominantBaseline="middle">
            {sim.m > 0 ? `${fmt(sim.m)} kg` : objectLabel ?? "P"}
          </text>
        </g>
      )}

      {/* forces */}
      {showVectors && sim.useForces && (
        <g>
          {sim.D !== 0 && st.v >= 0 && (
            <Arrow x1={cx + halfW} y1={midY} x2={cx + halfW + sim.D * kF} y2={midY} color={C.driving} label={shown(sim.D) ? `D = ${fmt(sim.D)} N` : "D = ?"} glow={hl("forces")} dim={hl("velocity", "acceleration")} labelOffset={42} />
          )}
          {sim.R > 0 && Math.abs(st.v) > 1e-6 && (
            <Arrow x1={cx - halfW} y1={midY} x2={cx - halfW - sim.R * kF} y2={midY} color={C.resistance} label={shown(sim.R) ? `${fmt(sim.R)} N` : "R"} glow={hl("forces")} dim={hl("velocity", "acceleration")} labelOffset={30} />
          )}
          {Math.abs(resultant) > 1e-6 && (
            <Arrow x1={cx} y1={roadY - 140} x2={cx + resultant * kF} y2={roadY - 140} color={C.resultant} label={shown(resultant) ? `resultant ${fmt(Math.abs(resultant))} N` : "resultant = ?"} glow={hl("resultant")} dim={!hl("resultant", "forces")} labelOffset={70} width={3} />
          )}
        </g>
      )}

      {/* acceleration (double arrow, exam style) */}
      {Math.abs(st.a) > 1e-9 && (
        <Arrow
          x1={cx - 28 * Math.sign(st.a)}
          y1={roadY - 108}
          x2={cx + 36 * Math.sign(st.a)}
          y2={roadY - 108}
          color={C.accel}
          double
          label={shown(st.a) ? `${fmt(Math.abs(st.a), 3)} m s⁻²` : "a"}
          glow={hl("acceleration")}
          dim={!hl("acceleration", "resultant") && highlight !== "none"}
          labelOffset={46}
        />
      )}

      {/* velocity */}
      {showVectors && Math.abs(vLen) > 3 && (
        <Arrow x1={cx} y1={roadY + 84} x2={cx + vLen} y2={roadY + 84} color={C.v} label={reveal.exam ? "v" : `v = ${fmt(st.v, 3)} m/s`} glow={hl("velocity")} labelSide="left" labelOffset={-14} />
      )}
    </g>
  );
}
