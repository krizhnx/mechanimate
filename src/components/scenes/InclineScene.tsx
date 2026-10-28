import type { InclineSim } from "../../shared/physics";
import { fmt, motion1D } from "../../shared/physics";
import type { Highlight } from "../../shared/types";
import { C, OPEN, shownBy } from "../../sceneUtils";
import type { Reveal } from "../../sceneUtils";
import { AngleArc, Arrow, H, Mass, W } from "./common";

interface Props {
  sim: InclineSim;
  t: number;
  highlight: Highlight;
  showVectors: boolean;
  objectLabel?: string;
  reveal?: Reveal;
}

export function InclineScene({ sim, t, highlight, showVectors, objectLabel, reveal = OPEN }: Props) {
  const shown = shownBy(reveal);
  const hl = (...hs: Highlight[]) => hs.includes(highlight);
  const forceFocus = hl("weights", "normal", "friction", "forces", "components", "resultant");
  const show = (...kinds: Highlight[]) => ({ glow: hl(...kinds), dim: forceFocus && !hl(...kinds) });

  const alpha = sim.alpha;
  const y0 = H - 30;
  const Bx = 70;
  const Lb = Math.min(640, 320 / Math.max(Math.tan(alpha), 1e-3));
  const Ht = Lb * Math.tan(alpha);
  const rightX = Bx + Lb;
  const Ls = Math.hypot(Lb, Ht);
  const e = { x: Math.cos(alpha), y: -Math.sin(alpha) };
  const n = { x: -Math.sin(alpha), y: -Math.cos(alpha) };
  const bw = 62;
  const bh = 38;

  let smin = 0;
  let smax = 0;
  for (let i = 0; i <= 80; i++) {
    const s = motion1D(sim.phases, (sim.duration * i) / 80).s;
    smin = Math.min(smin, s);
    smax = Math.max(smax, s);
  }
  const k = Math.min((Ls - bw - 60) / Math.max(smax - smin, 0.05), 160);
  const st = motion1D(sim.phases, t);
  const d = 30 + bw / 2 + k * (st.s - smin);
  const cx = Bx + e.x * d + n.x * (bh / 2);
  const cy = y0 + e.y * d + n.y * (bh / 2);
  const front = { x: cx + e.x * (bw / 2), y: cy + e.y * (bw / 2) };
  const back = { x: cx - e.x * (bw / 2), y: cy - e.y * (bw / 2) };
  const topC = { x: cx + n.x * (bh / 2), y: cy + n.y * (bh / 2) };

  const W_ = sim.m * sim.g;
  const maxF = Math.max(W_, Math.abs(sim.P), sim.normal, 1);
  const kF = 90 / maxF;
  const fr = sim.frictionAt(t); // signed, up-slope positive
  const showComponents = hl("components", "weights");

  return (
    <g>
      <rect x={-1500} y={y0} width={W + 3000} height={H - y0 + 1500} fill="url(#ground)" />
      <polygon points={`${Bx},${y0} ${rightX},${y0} ${rightX},${y0 - Ht}`} fill="#3b4252" stroke="#94a3b8" strokeWidth={1.5} />
      <AngleArc cx={Bx} cy={y0} r={50} from={0} to={alpha} label={`${fmt(alpha * (180 / Math.PI), 3)}°`} />
      {sim.mu > 0 && (
        <text x={Bx + 120} y={y0 - 8} fill={C.muted} fontSize={11}>
          rough, μ = {fmt(sim.mu, 3)}
        </text>
      )}

      <Mass x={cx - bw / 2} y={cy - bh / 2} w={bw} h={bh} label={objectLabel && objectLabel.length < 8 ? objectLabel : "P"} sub={`${fmt(sim.m)} kg`} rotate={-alpha * (180 / Math.PI)} cx={cx} cy={cy} />

      {showVectors && (
        <g>
          <Arrow x1={cx} y1={cy} x2={cx} y2={cy + W_ * kF} color={C.weight} label={`${fmt(sim.m)}g`} {...show("weights", "forces")} />
          {showComponents && (
            <g>
              <Arrow x1={cx} y1={cy} x2={cx - e.x * sim.weightAlong * kF} y2={cy - e.y * sim.weightAlong * kF} color={C.weight} dashed width={2} label={reveal.exam ? "mg sinα" : `mg sinα ${fmt(sim.weightAlong, 3)}`} labelOffset={40} />
              <Arrow x1={cx} y1={cy} x2={cx - n.x * sim.normal * kF} y2={cy - n.y * sim.normal * kF} color={C.weight} dashed width={2} label={reveal.exam ? "mg cosα" : `mg cosα ${fmt(sim.normal, 3)}`} labelOffset={40} />
            </g>
          )}
          <Arrow x1={topC.x} y1={topC.y} x2={topC.x + n.x * sim.normal * kF} y2={topC.y + n.y * sim.normal * kF} color={C.normal} label={shown(sim.normal) ? `R ${fmt(sim.normal, 3)}` : "R"} {...show("normal", "forces")} />
          {Math.abs(fr) > 1e-6 && (
            <Arrow
              x1={fr > 0 ? front.x : back.x}
              y1={fr > 0 ? front.y : back.y}
              x2={(fr > 0 ? front.x : back.x) + e.x * fr * kF}
              y2={(fr > 0 ? front.y : back.y) + e.y * fr * kF}
              color={C.friction}
              label={shown(fr) ? `F ${fmt(Math.abs(fr), 3)}` : "F"}
              {...show("friction", "forces")}
            />
          )}
          {Math.abs(sim.P) > 1e-6 && (
            <Arrow
              x1={sim.P > 0 ? front.x : back.x}
              y1={(sim.P > 0 ? front.y : back.y) - 8}
              x2={(sim.P > 0 ? front.x : back.x) + e.x * sim.P * kF}
              y2={(sim.P > 0 ? front.y : back.y) - 8 + e.y * sim.P * kF}
              color={C.pull}
              label={`P ${fmt(Math.abs(sim.P), 3)}`}
              {...show("forces", "resultant")}
            />
          )}
          {Math.abs(st.v) > 1e-3 && (
            <Arrow
              x1={topC.x + n.x * 46}
              y1={topC.y + n.y * 46}
              x2={topC.x + n.x * 46 + e.x * Math.sign(st.v) * Math.min(90, 12 + Math.abs(st.v) * 10)}
              y2={topC.y + n.y * 46 + e.y * Math.sign(st.v) * Math.min(90, 12 + Math.abs(st.v) * 10)}
              color={C.v}
              label={reveal.exam ? "v" : `v ${fmt(Math.abs(st.v), 3)}`}
              glow={hl("velocity")}
              labelOffset={26}
            />
          )}
        </g>
      )}
      {Math.abs(st.a) > 1e-9 && (
        <Arrow
          x1={topC.x + n.x * 84 - e.x * 26 * Math.sign(st.a)}
          y1={topC.y + n.y * 84 - e.y * 26 * Math.sign(st.a)}
          x2={topC.x + n.x * 84 + e.x * 30 * Math.sign(st.a)}
          y2={topC.y + n.y * 84 + e.y * 30 * Math.sign(st.a)}
          color={C.accel}
          double
          label={shown(st.a) ? `${fmt(Math.abs(st.a), 3)} m s⁻²` : "a"}
          glow={hl("acceleration", "resultant")}
          labelOffset={44}
        />
      )}
    </g>
  );
}
