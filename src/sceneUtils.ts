import { fmt, motion1D } from "./shared/physics";
import type { Sim } from "./shared/physics";

export const C = {
  vx: "#5cc8ff",
  vy: "#ff7a7a",
  v: "#ffd166",
  driving: "#4ade80",
  resistance: "#f87171",
  resultant: "#c084fc",
  tension: "#c084fc",
  weight: "#fb923c",
  normal: "#60a5fa",
  friction: "#f87171",
  accel: "#facc15",
  pull: "#4ade80",
  path: "#9fb4ff",
  ink: "#e6e9f2",
  muted: "#8b95b2",
  ground: "#2a3a2f",
  rock: "#4b5563",
  table: "#8b5e3c",
};

export function phaseLabel(sim: Sim, t: number): string {
  switch (sim.topic) {
    case "projectile":
      if (t >= sim.tFlight - 1e-6) return "Landed";
      return sim.tMax > 0 && t < sim.tMax ? "Rising - vertical speed decreasing" : "Falling - vertical speed increasing";
    case "forces_line":
    case "pulley":
    case "incline": {
      const st = motion1D(sim.phases, t);
      return sim.phases[st.i]?.label ?? "";
    }
    default:
      return "";
  }
}

export function readouts(sim: Sim, t: number): [string, string][] {
  switch (sim.topic) {
    case "projectile": {
      const p = sim.at(t);
      return [
        ["t", `${fmt(Math.min(t, sim.tFlight), 3)} s`],
        ["x", `${fmt(p.x, 3)} m`],
        ["height", `${fmt(p.y, 3)} m`],
        ["vₓ", `${fmt(p.vx, 3)} m/s`],
        ["v_y", `${fmt(p.vy, 3)} m/s`],
        ["speed", `${fmt(Math.hypot(p.vx, p.vy), 3)} m/s`],
      ];
    }
    case "forces_line": {
      const st = motion1D(sim.phases, t);
      return [
        ["t", `${fmt(t, 3)} s`],
        ["s", `${fmt(st.s, 3)} m`],
        ["v", `${fmt(st.v, 3)} m/s`],
        ["a", `${fmt(st.a, 3)} m/s²`],
      ];
    }
    case "pulley": {
      const st = motion1D(sim.phases, t);
      const out: [string, string][] = [
        ["t", `${fmt(t, 3)} s`],
        ["distance", `${fmt(st.s, 3)} m`],
        ["speed", `${fmt(Math.abs(st.v), 3)} m/s`],
        ["a", `${fmt(Math.abs(st.a), 3)} m/s²`],
        ["T", sim.slack(t) ? "0 (slack)" : `${fmt(sim.T, 3)} N`],
      ];
      return out;
    }
    case "incline": {
      const st = motion1D(sim.phases, t);
      return [
        ["t", `${fmt(t, 3)} s`],
        ["s (up slope)", `${fmt(st.s, 3)} m`],
        ["v", `${fmt(st.v, 3)} m/s`],
        ["a", `${fmt(st.a, 3)} m/s²`],
        ["friction", `${fmt(Math.abs(sim.frictionAt(t)), 3)} N`],
      ];
    }
    default:
      return [];
  }
}

export interface Series {
  name: string;
  color: string;
  fn: (t: number) => number;
}

export function graphSeries(sim: Sim, labels?: Record<string, string>): { title: string; unit: string; series: Series[] } | null {
  switch (sim.topic) {
    case "projectile":
      return {
        title: "Velocity components against time",
        unit: "m/s",
        series: [
          { name: "vₓ (constant)", color: C.vx, fn: (t) => sim.at(t).vx },
          { name: "v_y (gradient −g)", color: C.vy, fn: (t) => sim.at(t).vy },
        ],
      };
    case "forces_line":
      return { title: "Velocity-time graph (gradient = acceleration, area = distance)", unit: "m/s", series: [{ name: "v", color: C.v, fn: (t) => motion1D(sim.phases, t).v }] };
    case "pulley": {
      const L1 = labels?.m1 ?? "A";
      const L2 = labels?.m2 ?? "B";
      const moverName = sim.mode === "hanging" ? (sim.dir === 1 ? L1 : L2) : L1;
      const fallerName = sim.mode === "hanging" ? (sim.dir === 1 ? L2 : L1) : L2;
      return {
        title: "Speed-time graph of both particles",
        unit: "m/s",
        series: [
          { name: moverName, color: C.v, fn: (t) => Math.abs(motion1D(sim.phases, t).v) },
          { name: fallerName, color: C.tension, fn: (t) => (sim.slack(t) ? 0 : Math.abs(motion1D(sim.phases, t).v)) },
        ],
      };
    }
    case "incline":
      return { title: "Velocity-time graph (up the slope positive)", unit: "m/s", series: [{ name: "v", color: C.v, fn: (t) => motion1D(sim.phases, t).v }] };
    default:
      return null;
  }
}

export function niceStep(raw: number) {
  if (!(raw > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}

/** Exam-mode masking: only label values that were given or already solved. */
export interface Reveal {
  exam: boolean;
  known: (v: number) => boolean;
}
export const OPEN: Reveal = { exam: false, known: () => true };
export const shownBy = (r: Reveal) => (v: number) => !r.exam || r.known(Math.abs(v));
