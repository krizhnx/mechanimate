import type { MouseEvent } from "react";
import type { Sim } from "../shared/physics";
import { fmt } from "../shared/physics";
import { graphSeries, niceStep } from "../sceneUtils";

const GW = 900;
const GH = 220;
const PL = 46;
const PR = 14;
const PT = 30;
const PB = 26;

export function MotionGraph({ sim, t, labels, onSeek }: { sim: Sim; t: number; labels?: Record<string, string>; onSeek: (t: number) => void }) {
  const g = graphSeries(sim, labels);
  if (!g) return <div className="faint">No graph for this question type.</div>;
  const N = 180;
  const T = sim.duration;
  let lo = 0;
  let hi = 0;
  const data = g.series.map((s) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const tt = (T * i) / N;
      const v = s.fn(tt);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      pts.push([tt, v]);
    }
    return pts;
  });
  if (hi - lo < 1e-6) hi = lo + 1;
  const pad = (hi - lo) * 0.12;
  if (lo < 0) lo -= pad;
  hi += pad;
  const X = (tt: number) => PL + (tt / T) * (GW - PL - PR);
  const Y = (v: number) => PT + (1 - (v - lo) / (hi - lo)) * (GH - PT - PB);
  const step = niceStep((hi - lo) / 4);
  const yTicks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) yTicks.push(v);
  const tStep = niceStep(T / 8);
  const xTicks: number[] = [];
  for (let v = 0; v <= T + 1e-9; v += tStep) xTicks.push(v);
  const tc = Math.min(t, T);

  const handle = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // account for preserveAspectRatio meet letterboxing
    const scale = Math.min(rect.width / GW, rect.height / GH);
    const offX = (rect.width - GW * scale) / 2;
    const x = (e.clientX - rect.left - offX) / scale;
    onSeek(Math.max(0, Math.min(T, ((x - PL) / (GW - PL - PR)) * T)));
  };

  const widths = g.series.map((s) => 26 + s.name.length * 6.6);
  let lx = GW - PR - widths.reduce((a, b) => a + b, 0);

  return (
    <svg viewBox={`0 0 ${GW} ${GH}`} className="graph-svg" onMouseDown={handle} onMouseMove={(e) => e.buttons === 1 && handle(e)}>
      <defs>
        {g.series.map((s, i) => (
          <linearGradient key={i} id={`gfill${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={s.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>
      <text x={PL} y={14} fill="#a1a1ab" fontSize={12} fontWeight={600}>
        {g.title}
      </text>
      {g.series.map((s, i) => {
        const x0 = lx;
        lx += widths[i];
        return (
          <g key={s.name}>
            <rect x={x0} y={5} width={10} height={10} fill={s.color} rx={3} />
            <text x={x0 + 15} y={14} fill="#a1a1ab" fontSize={11.5}>
              {s.name}
            </text>
          </g>
        );
      })}
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PL} x2={GW - PR} y1={Y(v)} y2={Y(v)} stroke={Math.abs(v) < 1e-9 ? "#3a3a45" : "#1c1c22"} />
          <text x={PL - 8} y={Y(v)} fill="#6b6b76" fontSize={10.5} textAnchor="end" dominantBaseline="middle" fontFamily="ui-monospace, Menlo, monospace">
            {fmt(v, 3)}
          </text>
        </g>
      ))}
      {xTicks.map((v) => (
        <text key={v} x={X(v)} y={GH - 8} fill="#6b6b76" fontSize={10.5} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace">
          {fmt(v, 3)}s
        </text>
      ))}
      {data.map((pts, i) => {
        const line = pts.map(([a, b]) => `${X(a).toFixed(1)},${Y(b).toFixed(1)}`).join(" ");
        const base = Y(Math.max(lo, Math.min(0, hi)));
        return (
          <g key={i}>
            <polygon points={`${X(0)},${base} ${line} ${X(T)},${base}`} fill={`url(#gfill${i})`} />
            <polyline points={line} fill="none" stroke={g.series[i].color} strokeWidth={2.2} strokeLinejoin="round" />
          </g>
        );
      })}
      <line x1={X(tc)} x2={X(tc)} y1={PT} y2={GH - PB} stroke="#ededf0" strokeOpacity={0.5} strokeDasharray="3 3" />
      {g.series.map((s) => (
        <g key={s.name}>
          <circle cx={X(tc)} cy={Y(s.fn(tc))} r={7} fill={s.color} opacity={0.18} />
          <circle cx={X(tc)} cy={Y(s.fn(tc))} r={4} fill={s.color} stroke="#0e0e11" strokeWidth={1.5} />
        </g>
      ))}
    </svg>
  );
}
