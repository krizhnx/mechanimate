import type { PulleySim } from "../../shared/physics";
import { fmt, motion1D } from "../../shared/physics";
import type { Highlight } from "../../shared/types";
import { C, OPEN, shownBy } from "../../sceneUtils";
import type { Reveal } from "../../sceneUtils";
import { AngleArc, Arrow, DimLine, H, Hatch, Mass, Pulley, W } from "./common";

interface Props {
  sim: PulleySim;
  t: number;
  highlight: Highlight;
  labels?: Record<string, string>;
  showVectors: boolean;
  reveal?: Reveal;
}

function useFocus(highlight: Highlight) {
  const hl = (...hs: Highlight[]) => hs.includes(highlight);
  const forceFocus = hl("tension", "weights", "friction", "normal");
  const show = (kind: Highlight) => ({ glow: hl(kind), dim: forceFocus && !hl(kind) });
  return { hl, show };
}

function slackPath(x: number, y1: number, y2: number, amount: number) {
  const bulge = Math.min(40, 6 + amount * 60);
  return `M ${x} ${y1} C ${x + bulge} ${y1 + (y2 - y1) * 0.3}, ${x - bulge} ${y1 + (y2 - y1) * 0.7}, ${x} ${y2}`;
}

export function PulleyScene(props: Props) {
  if (props.sim.mode === "hanging") return <HangingPulley {...props} />;
  if (props.sim.mode === "incline") return <InclinePulley {...props} />;
  return <TablePulley {...props} />;
}

function TablePulley({ sim, t, highlight, labels, showVectors, reveal = OPEN }: Props) {
  const shown = shownBy(reveal);
  const { hl, show } = useFocus(highlight);
  const L1 = labels?.m1 ?? "A";
  const L2 = labels?.m2 ?? "B";
  const tableTop = 190;
  const tableRight = 520;
  const tableLeft = 30;
  const bw = 64;
  const bh = 40;
  const r = 14;
  const stringY = tableTop - bh / 2;
  const pcx = tableRight + 6;
  const pcy = stringY + r;
  const bSize = 46;

  const travelA = Math.max(sim.sMover(sim.duration), 0.05);
  const fallB = sim.h > 0 ? sim.h : Math.max(sim.sFaller(sim.duration), 0.05);
  const yB0 = pcy + 34;
  const floorMax = H - 18;
  const k = Math.min((tableRight - tableLeft - bw - 70) / travelA, (floorMax - yB0 - bSize) / fallB, 160);

  const sA = sim.sMover(t);
  const sB = sim.sFaller(t);
  const xAEnd = pcx - r - 26;
  const xA = xAEnd - k * (travelA - sA); // right edge of A
  const yB = yB0 + k * sB;
  const bx = pcx + r;
  const floorY = sim.h > 0 ? yB0 + bSize + k * sim.h : undefined;
  const slack = sim.slack(t);
  const st = motion1D(sim.phases, t);

  const maxF = Math.max(sim.m1 * sim.g, sim.m2 * sim.g, sim.T, 1);
  const kF = 70 / maxF;
  const acx = xA - bw / 2;
  const T = slack ? 0 : sim.T;
  const frictionNow = sim.mu > 0 && (Math.abs(st.v) > 1e-6 || st.a !== 0 || sim.isStatic) ? (sim.isStatic ? sim.friction : sim.mu * sim.normal) : 0;

  return (
    <g>
      {/* floor */}
      <rect x={-1500} y={H - 14} width={W + 3000} height={1514} fill="url(#ground)" />
      {floorY !== undefined && <Hatch x1={pcx - 30} x2={pcx + 110} y={floorY} />}
      {/* table */}
      <rect x={tableLeft} y={tableTop} width={tableRight - tableLeft} height={14} fill={C.table} stroke="#d6a77a" />
      <rect x={tableLeft + 20} y={tableTop + 14} width={10} height={H - 14 - tableTop - 14} fill="#6b4423" />
      <rect x={tableRight - 30} y={tableTop + 14} width={10} height={H - 14 - tableTop - 14} fill="#6b4423" />
      {sim.mu > 0 && (
        <text x={tableLeft + 50} y={tableTop + 30} fill={C.muted} fontSize={11}>
          rough table, μ = {fmt(sim.mu, 3)}
        </text>
      )}
      <line x1={tableRight} y1={tableTop} x2={pcx} y2={pcy} stroke="#94a3b8" strokeWidth={3} />

      {/* string */}
      <g className={hl("string") ? "glow" : undefined} style={{ color: "#e2e8f0" }}>
        <line x1={xA} y1={stringY} x2={pcx} y2={pcy - r} stroke="#e2e8f0" strokeWidth={hl("string") ? 3 : 1.8} />
        {slack ? (
          <path d={slackPath(bx, pcy, yB, sA - sim.h)} fill="none" stroke="#e2e8f0" strokeWidth={1.8} />
        ) : (
          <line x1={bx} y1={pcy} x2={bx} y2={yB} stroke="#e2e8f0" strokeWidth={hl("string") ? 3 : 1.8} />
        )}
      </g>
      <Pulley cx={pcx} cy={pcy} r={r} />

      {/* drop height */}
      {floorY !== undefined && <DimLine x1={bx + 62} y1={yB0 + bSize} x2={bx + 62} y2={floorY} label={`${fmt(sim.h, 3)} m`} offset={-26} dim={t > 0.05} />}

      {/* particles */}
      <Mass x={xA - bw} y={tableTop - bh} w={bw} h={bh} label={L1} sub={`${fmt(sim.m1)} kg`} />
      <Mass x={bx - bSize / 2} y={yB} w={bSize} h={bSize} label={L2} sub={`${fmt(sim.m2)} kg`} color="#3f3f66" />

      {showVectors && (
        <g>
          {/* on A */}
          {T > 0 && <Arrow x1={xA} y1={stringY + 8} x2={xA + T * kF} y2={stringY + 8} color={C.tension} label="T" {...show("tension")} labelOffset={10} />}
          {frictionNow > 0 && <Arrow x1={xA - bw} y1={stringY} x2={xA - bw - frictionNow * kF} y2={stringY} color={C.friction} label={shown(frictionNow) ? `F ${fmt(frictionNow, 3)}` : "F"} {...show("friction")} labelOffset={26} />}
          <Arrow x1={acx} y1={tableTop - bh} x2={acx} y2={tableTop - bh - sim.normal * kF} color={C.normal} label={shown(sim.normal) ? `R ${fmt(sim.normal, 3)}` : "R"} {...show("normal")} />
          <Arrow x1={acx + 14} y1={tableTop} x2={acx + 14} y2={tableTop + sim.m1 * sim.g * kF} color={C.weight} label={`${fmt(sim.m1)}g`} {...show("weights")} />
          {/* on B */}
          {T > 0 && <Arrow x1={bx - 12} y1={yB} x2={bx - 12} y2={yB - T * kF} color={C.tension} label="T" {...show("tension")} labelSide="right" labelOffset={12} />}
          {!slack && <Arrow x1={bx} y1={yB + bSize} x2={bx} y2={yB + bSize + sim.m2 * sim.g * kF} color={C.weight} label={`${fmt(sim.m2)}g`} {...show("weights")} />}
        </g>
      )}

      {/* acceleration */}
      {Math.abs(st.a) > 1e-9 && (
        <g>
          <Arrow x1={xA + 14} y1={tableTop - bh - 34} x2={xA + 14 + 62 * Math.sign(st.a)} y2={tableTop - bh - 34} color={C.accel} double label={shown(st.a) ? `${fmt(Math.abs(st.a), 3)} m s⁻²` : "a"} glow={hl("acceleration", "system", "after_impact")} labelSide="left" labelOffset={-14} />
          {!slack && <Arrow x1={bx + 36} y1={yB} x2={bx + 36} y2={yB + 50} color={C.accel} double glow={hl("acceleration", "system")} />}
        </g>
      )}
    </g>
  );
}

function HangingPulley({ sim, t, highlight, labels, showVectors, reveal = OPEN }: Props) {
  const shown = shownBy(reveal);
  const { hl, show } = useFocus(highlight);
  const L1 = labels?.m1 ?? "A";
  const L2 = labels?.m2 ?? "B";
  const pcx = 400;
  const pcy = 78;
  const r = 26;
  const box = 54;
  const leftX = pcx - r;
  const rightX = pcx + r;
  const floorBottom = H - 22;

  const travelRise = Math.max(sim.sMover(sim.duration), 0.05);
  const fallDist = sim.h > 0 ? sim.h : travelRise;
  const k = Math.min(250 / (travelRise + fallDist), 140);
  const riserTop0 = pcy + 40 + k * travelRise;
  const fallerTop0 = sim.h > 0 ? floorBottom - box - k * sim.h : Math.min(riserTop0, floorBottom - box - k * fallDist);
  const riserTop = riserTop0 - k * sim.sMover(t);
  const fallerTop = fallerTop0 + k * sim.sFaller(t);
  const m2Falls = sim.dir === 1;
  const leftTop = m2Falls ? riserTop : fallerTop;
  const rightTop = m2Falls ? fallerTop : riserTop;
  const fallerX = m2Falls ? rightX : leftX;
  const slack = sim.slack(t);
  const st = motion1D(sim.phases, t);
  const T = slack ? 0 : sim.T;
  const maxF = Math.max(sim.m1 * sim.g, sim.m2 * sim.g, 1);
  const kF = 64 / maxF;
  const floorY = sim.h > 0 ? floorBottom : undefined;

  const stringFor = (x: number, top: number, isFaller: boolean) =>
    isFaller && slack ? (
      <path d={slackPath(x, pcy, top, sim.sMover(t) - sim.h)} fill="none" stroke="#e2e8f0" strokeWidth={1.8} />
    ) : (
      <line x1={x} y1={pcy} x2={x} y2={top} stroke="#e2e8f0" strokeWidth={hl("string") ? 3 : 1.8} />
    );

  return (
    <g>
      <rect x={-1500} y={H - 14} width={W + 3000} height={1514} fill="url(#ground)" />
      <Hatch x1={pcx - 120} x2={pcx + 120} y={22} flip />
      <line x1={pcx} y1={22} x2={pcx} y2={pcy} stroke="#94a3b8" strokeWidth={3} />
      <g className={hl("string") ? "glow" : undefined} style={{ color: "#e2e8f0" }}>
        <path d={`M ${leftX} ${pcy} A ${r} ${r} 0 0 1 ${rightX} ${pcy}`} fill="none" stroke="#e2e8f0" strokeWidth={1.8} />
        {stringFor(leftX, leftTop, !m2Falls)}
        {stringFor(rightX, rightTop, m2Falls)}
      </g>
      <Pulley cx={pcx} cy={pcy} r={r} />
      {floorY !== undefined && <Hatch x1={fallerX - 140} x2={fallerX + 140} y={floorY} />}
      {floorY !== undefined && <DimLine x1={fallerX + (m2Falls ? 125 : -125)} y1={fallerTop0 + box} x2={fallerX + (m2Falls ? 125 : -125)} y2={floorY} label={`${fmt(sim.h, 3)} m`} offset={m2Falls ? -26 : 26} dim={t > 0.05} />}

      <Mass x={leftX - box / 2} y={leftTop} w={box} h={box} label={L1} sub={`${fmt(sim.m1)} kg`} />
      <Mass x={rightX - box / 2} y={rightTop} w={box} h={box} label={L2} sub={`${fmt(sim.m2)} kg`} color="#3f3f66" />

      {showVectors && (
        <g>
          {T > 0 && <Arrow x1={leftX - 14} y1={leftTop} x2={leftX - 14} y2={leftTop - T * kF} color={C.tension} label="T" {...show("tension")} labelSide="left" labelOffset={12} />}
          {T > 0 && <Arrow x1={rightX + 14} y1={rightTop} x2={rightX + 14} y2={rightTop - T * kF} color={C.tension} label="T" {...show("tension")} labelSide="right" labelOffset={12} />}
          <Arrow x1={leftX} y1={leftTop + box} x2={leftX} y2={leftTop + box + sim.m1 * sim.g * kF} color={C.weight} label={`${fmt(sim.m1)}g`} {...show("weights")} />
          <Arrow x1={rightX} y1={rightTop + box} x2={rightX} y2={rightTop + box + sim.m2 * sim.g * kF} color={C.weight} label={`${fmt(sim.m2)}g`} {...show("weights")} />
        </g>
      )}
      {Math.abs(st.a) > 1e-9 && !slack && (
        <g>
          <Arrow x1={leftX - 60} y1={leftTop + box / 2 + (m2Falls ? 20 : -20)} x2={leftX - 60} y2={leftTop + box / 2 + (m2Falls ? -24 : 24)} color={C.accel} double glow={hl("acceleration", "system")} />
          <Arrow x1={rightX + 60} y1={rightTop + box / 2 + (m2Falls ? -20 : 20)} x2={rightX + 60} y2={rightTop + box / 2 + (m2Falls ? 24 : -24)} color={C.accel} double label={shown(sim.a) ? `${fmt(sim.a, 3)} m s⁻²` : "a"} glow={hl("acceleration", "system")} labelOffset={20} />
        </g>
      )}
    </g>
  );
}

function InclinePulley({ sim, t, highlight, labels, showVectors, reveal = OPEN }: Props) {
  const shown = shownBy(reveal);
  const { hl, show } = useFocus(highlight);
  const L1 = labels?.m1 ?? "A";
  const L2 = labels?.m2 ?? "B";
  const alpha = sim.alpha;
  const y0 = H - 24;
  const rightX = 560;
  const Lb = Math.min(470, 270 / Math.max(Math.tan(alpha), 1e-3));
  const Ht = Lb * Math.tan(alpha);
  const Bx = rightX - Lb;
  const Ty = y0 - Ht;
  const Ls = Math.hypot(Lb, Ht);
  const e = { x: Math.cos(alpha), y: -Math.sin(alpha) };
  const n = { x: -Math.sin(alpha), y: -Math.cos(alpha) };
  const r = 14;
  const P = { x: rightX + 4, y: Ty - r + 2 };
  const bw = 58;
  const bh = 34;
  const b2 = 44;

  const travel = Math.max(sim.sMover(sim.duration), 0.05);
  const up = sim.dir === 1;
  let k = Math.min((Ls - bw - 70) / travel, 140);
  if (up && sim.h > 0) k = Math.min(k, (y0 - b2 - (P.y + 30)) / sim.h);
  if (!up) k = Math.min(k, (y0 - b2 - (P.y + 30)) / travel);
  const dEnd = Ls - bw / 2 - 30;
  const d0 = up ? dEnd - k * travel : dEnd;
  const d = d0 + (up ? 1 : -1) * k * sim.sMover(t);
  const cx = Bx + e.x * d + n.x * (bh / 2);
  const cy = y0 + e.y * d + n.y * (bh / 2);
  const y2Top0 = up ? (sim.h > 0 ? y0 - b2 - k * sim.h : P.y + 30) : P.y + 30 + k * travel;
  const y2Top = y2Top0 + (up ? 1 : -1) * k * sim.sFaller(t);
  const hx = P.x + r;
  const slack = sim.slack(t);
  const st = motion1D(sim.phases, t);
  const T = slack ? 0 : sim.T;
  const maxF = Math.max(sim.m1 * sim.g, sim.m2 * sim.g, 1);
  const kF = 64 / maxF;
  const front = { x: cx + e.x * (bw / 2), y: cy + e.y * (bw / 2) };
  const back = { x: cx - e.x * (bw / 2), y: cy - e.y * (bw / 2) };
  const topC = { x: cx + n.x * (bh / 2), y: cy + n.y * (bh / 2) };
  // s is measured along the direction of motion, so m1 moves up the slope iff dir = +1
  const fSign = up ? -1 : 1;
  const m1Moving = Math.abs(st.v) > 1e-6 || Math.abs(st.a) > 1e-9 || sim.isStatic;

  return (
    <g>
      <rect x={-1500} y={y0} width={W + 3000} height={H - y0 + 1500} fill="url(#ground)" />
      <polygon points={`${Bx},${y0} ${rightX},${y0} ${rightX},${Ty}`} fill="#3b4252" stroke="#94a3b8" strokeWidth={1.5} />
      <AngleArc cx={Bx} cy={y0} r={46} from={0} to={alpha} label={`${fmt(alpha * (180 / Math.PI), 3)}°`} />
      {sim.mu > 0 && (
        <text x={Bx + 110} y={y0 - 8} fill={C.muted} fontSize={11}>
          μ = {fmt(sim.mu, 3)}
        </text>
      )}
      {sim.h > 0 && up && <Hatch x1={hx - 40} x2={hx + 90} y={y0} />}
      <g className={hl("string") ? "glow" : undefined} style={{ color: "#e2e8f0" }}>
        <line x1={front.x} y1={front.y} x2={P.x + n.x * r} y2={P.y + n.y * r} stroke="#e2e8f0" strokeWidth={1.8} />
        {slack ? <path d={slackPath(hx, P.y, y2Top, sim.sMover(t) - sim.h)} fill="none" stroke="#e2e8f0" strokeWidth={1.8} /> : <line x1={hx} y1={P.y} x2={hx} y2={y2Top} stroke="#e2e8f0" strokeWidth={1.8} />}
      </g>
      <Pulley cx={P.x} cy={P.y} r={r} />
      {sim.h > 0 && up && <DimLine x1={hx + 60} y1={y2Top0 + b2} x2={hx + 60} y2={y0} label={`${fmt(sim.h, 3)} m`} offset={-24} dim={t > 0.05} />}

      <Mass x={cx - bw / 2} y={cy - bh / 2} w={bw} h={bh} label={L1} sub={`${fmt(sim.m1)} kg`} rotate={-alpha * (180 / Math.PI)} cx={cx} cy={cy} />
      <Mass x={hx - b2 / 2} y={y2Top} w={b2} h={b2} label={L2} sub={`${fmt(sim.m2)} kg`} color="#3f3f66" />

      {showVectors && (
        <g>
          {T > 0 && <Arrow x1={front.x} y1={front.y} x2={front.x + e.x * T * kF} y2={front.y + e.y * T * kF} color={C.tension} label="T" {...show("tension")} labelSide="left" labelOffset={14} />}
          <Arrow x1={topC.x} y1={topC.y} x2={topC.x + n.x * sim.normal * kF} y2={topC.y + n.y * sim.normal * kF} color={C.normal} label={shown(sim.normal) ? `R ${fmt(sim.normal, 3)}` : "R"} {...show("normal")} />
          {sim.friction > 0 && m1Moving && (
            <Arrow x1={back.x} y1={back.y} x2={back.x + fSign * e.x * sim.friction * kF} y2={back.y + fSign * e.y * sim.friction * kF} color={C.friction} label={shown(sim.friction) ? `F ${fmt(sim.friction, 3)}` : "F"} {...show("friction")} />
          )}
          <Arrow x1={cx} y1={cy} x2={cx} y2={cy + sim.m1 * sim.g * kF} color={C.weight} label={`${fmt(sim.m1)}g`} {...show("weights")} />
          {T > 0 && <Arrow x1={hx - 12} y1={y2Top} x2={hx - 12} y2={y2Top - T * kF} color={C.tension} label="T" {...show("tension")} labelSide="right" labelOffset={12} />}
          <Arrow x1={hx} y1={y2Top + b2} x2={hx} y2={y2Top + b2 + sim.m2 * sim.g * kF} color={C.weight} label={`${fmt(sim.m2)}g`} {...show("weights")} />
        </g>
      )}
      {Math.abs(st.a) > 1e-9 && (
        <Arrow
          x1={topC.x + n.x * 30 - e.x * 26 * (up ? 1 : -1) * Math.sign(st.a)}
          y1={topC.y + n.y * 30 - e.y * 26 * (up ? 1 : -1) * Math.sign(st.a)}
          x2={topC.x + n.x * 30 + e.x * 30 * (up ? 1 : -1) * Math.sign(st.a)}
          y2={topC.y + n.y * 30 + e.y * 30 * (up ? 1 : -1) * Math.sign(st.a)}
          color={C.accel}
          double
          label={shown(st.a) ? `${fmt(Math.abs(st.a), 3)} m s⁻²` : "a"}
          glow={hl("acceleration", "system", "after_impact")}
          labelOffset={40}
        />
      )}
    </g>
  );
}
