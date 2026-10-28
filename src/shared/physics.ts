// Deterministic A-level mechanics engine.
// Gemma 4 reads + solves the question; this engine animates the exact model
// (particles, light inextensible strings, smooth pulleys, constant forces)
// and independently re-computes every answer so we can verify the AI.

import type { Highlight, Params, PulleyMode, Quantity, SceneSpec, Topic } from "./types";

const DEG = Math.PI / 180;

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export type Derived = Partial<Record<Quantity, number>>;

export interface SimEvent {
  t: number;
  label: string;
}

// ---------- piecewise constant-acceleration motion (1D) ----------
export interface Phase {
  t0: number;
  t1: number;
  s0: number;
  v0: number;
  a: number;
  label: string;
}

export function motion1D(phases: Phase[], t: number) {
  if (phases.length === 0) return { s: 0, v: 0, a: 0, i: 0 };
  let i = phases.findIndex((p) => t <= p.t1);
  if (i === -1) i = phases.length - 1;
  const p = phases[i];
  const dt = clamp(t, p.t0, p.t1) - p.t0;
  return { s: p.s0 + p.v0 * dt + 0.5 * p.a * dt * dt, v: p.v0 + p.a * dt, a: p.a, i };
}

function endOf(p: Phase) {
  const dt = p.t1 - p.t0;
  return { s: p.s0 + p.v0 * dt + 0.5 * p.a * dt * dt, v: p.v0 + p.a * dt };
}

// ---------- result types ----------
interface SimBase {
  duration: number;
  derived: Derived;
  events: SimEvent[];
  notes: string[];
}

export interface ProjectileSim extends SimBase {
  topic: "projectile";
  U: number;
  theta: number; // radians
  H: number;
  ux: number;
  uy: number;
  g: number;
  tFlight: number;
  tMax: number;
  range: number;
  maxHeight: number;
  at(t: number): { x: number; y: number; vx: number; vy: number };
}

export interface LineSim extends SimBase {
  topic: "forces_line";
  m: number;
  D: number;
  R: number;
  u: number;
  a: number;
  useForces: boolean;
  phases: Phase[];
}

export interface PulleySim extends SimBase {
  topic: "pulley";
  mode: PulleyMode;
  m1: number;
  m2: number;
  mu: number;
  alpha: number; // radians (0 table, 90deg hanging, slope angle incline)
  g: number;
  a: number; // magnitude
  dir: 1 | -1; // +1: m2 descends, -1: m1 descends / slides down slope
  T: number;
  friction: number;
  normal: number;
  isStatic: boolean;
  h: number;
  tHit?: number;
  vHit?: number;
  phases: Phase[];
  /** distance moved by the particle that keeps moving (m1 in phase 2 when m2 lands) */
  sMover(t: number): number;
  /** distance moved by the particle that hits the floor (clipped at h) */
  sFaller(t: number): number;
  slack(t: number): boolean;
}

export interface InclineSim extends SimBase {
  topic: "incline";
  m: number;
  alpha: number;
  mu: number;
  P: number;
  u: number;
  g: number;
  normal: number;
  fMax: number;
  weightAlong: number;
  phases: Phase[];
  frictionAt(t: number): number; // signed, up-slope positive
}

export interface OtherSim extends SimBase {
  topic: "other";
}

export type Sim = ProjectileSim | LineSim | PulleySim | InclineSim | OtherSim;

// ---------- projectile ----------
export function simulateProjectile(p: Params, g: number): ProjectileSim {
  const U = Math.max(0, num(p.speed, 14));
  const theta = clamp(num(p.angleDeg, 30), -90, 90) * DEG;
  const H = Math.max(0, num(p.launchHeight, 0));
  const ux = U * Math.cos(theta);
  const uy = U * Math.sin(theta);
  const disc = uy * uy + 2 * g * H;
  let tFlight = (uy + Math.sqrt(disc)) / g;
  if (!(tFlight > 1e-6)) tFlight = 0;
  const tMax = uy > 0 ? uy / g : 0;
  const maxAbove = uy > 0 ? (uy * uy) / (2 * g) : 0;
  const range = ux * tFlight;
  const vyImpact = uy - g * tFlight;
  const impactSpeed = Math.hypot(ux, vyImpact);
  const impactAngle = Math.atan2(-vyImpact, Math.abs(ux)) / DEG;

  const events: SimEvent[] = [{ t: 0, label: "Projected" }];
  if (tMax > 0) events.push({ t: tMax, label: "Max height" });
  events.push({ t: tFlight, label: "Lands" });

  return {
    topic: "projectile",
    U,
    theta,
    H,
    ux,
    uy,
    g,
    tFlight,
    tMax,
    range,
    maxHeight: H + maxAbove,
    duration: Math.max(tFlight, 0.25),
    events,
    notes: [],
    derived: {
      launchHeight: H,
      maxHeight: H + maxAbove,
      maxHeightAboveLaunch: maxAbove,
      timeOfFlight: tFlight,
      range,
      impactSpeed,
      impactAngle,
      timeToMaxHeight: tMax,
      horizontalVelocity: ux,
      initialVerticalVelocity: uy,
      speed: U,
      angle: theta / DEG,
    },
    at(t: number) {
      const tc = clamp(t, 0, tFlight);
      return { x: ux * tc, y: H + uy * tc - 0.5 * g * tc * tc, vx: ux, vy: uy - g * tc };
    },
  };
}

// ---------- straight line (SUVAT + Newton II) ----------
export function simulateLine(p: Params, g: number): LineSim {
  void g;
  const m = Math.max(0, num(p.mass, 0));
  const D = num(p.drivingForce, 0);
  const R = Math.max(0, num(p.resistance, 0));
  const u = num(p.u, 0);
  const useForces = m > 0 && (D !== 0 || R !== 0);
  const a = useForces ? (D - R) / m : num(p.a, 0);
  const tStop = a < 0 && u > 0 ? u / -a : undefined;
  const duration = Math.max(0.5, num(p.duration, tStop ? tStop * 1.1 : 5));
  const stopAtRest = useForces && a < 0 && u > 0; // resistance can't push a car backwards
  const notes: string[] = [];
  const events: SimEvent[] = [{ t: 0, label: "Start" }];

  let phases: Phase[];
  if (stopAtRest && tStop !== undefined && tStop < duration) {
    const p1: Phase = { t0: 0, t1: tStop, s0: 0, v0: u, a, label: "Decelerating" };
    phases = [p1, { t0: tStop, t1: duration, s0: endOf(p1).s, v0: 0, a: 0, label: "At rest" }];
    events.push({ t: tStop, label: "Comes to rest" });
  } else {
    phases = [{ t0: 0, t1: duration, s0: 0, v0: u, a, label: a === 0 ? "Constant velocity" : "Constant acceleration" }];
    if (tStop !== undefined && tStop < duration) events.push({ t: tStop, label: "Instantaneously at rest" });
  }
  events.push({ t: duration, label: `t = ${fmt(duration)} s` });
  const end = motion1D(phases, duration);

  const derived: Derived = {
    acceleration: Math.abs(a),
    finalSpeed: Math.abs(end.v),
    distance: Math.abs(end.s),
    speed: u,
  };
  if (m > 0) {
    derived.mass = m;
    derived.resultantForce = Math.abs(m * a);
    derived.drivingForce = useForces ? D : m * a + R;
    derived.resistance = R;
  }
  if (tStop !== undefined) {
    derived.timeToRest = tStop;
    derived.distanceToRest = (u * u) / (2 * -a);
  }
  if (useForces && D < R && u === 0) notes.push("Driving force is less than resistance - it never starts moving.");
  return { topic: "forces_line", m, D, R, u, a, useForces, phases, duration, derived, events, notes };
}

// ---------- connected particles over a pulley ----------
export function simulatePulley(p: Params, g: number): PulleySim {
  const mode: PulleyMode = p.pulleyMode === "hanging" || p.pulleyMode === "incline" ? p.pulleyMode : "table";
  const m1 = Math.max(0.01, num(p.m1, 3));
  const m2 = Math.max(0.01, num(p.m2, 2));
  const mu = mode === "hanging" ? 0 : clamp(num(p.mu, 0), 0, 5);
  const h = Math.max(0, num(p.dropHeight, 0));
  const alphaDeg = mode === "table" ? 0 : mode === "hanging" ? 90 : clamp(num(p.angleDeg, 30), 0, 89);
  const alpha = alphaDeg * DEG;
  const notes: string[] = [];

  let signedA: number;
  let T: number;
  let friction = 0;
  let normal = 0;
  let isStatic = false;

  if (mode === "hanging") {
    signedA = ((m2 - m1) * g) / (m1 + m2);
    T = (2 * m1 * m2 * g) / (m1 + m2);
    if (Math.abs(signedA) < 1e-12) isStatic = true;
  } else {
    normal = m1 * g * Math.cos(alpha);
    const drive = m2 * g - m1 * g * Math.sin(alpha); // >0 means m2 descends
    const fr = mu * normal;
    if (Math.abs(drive) <= fr + 1e-9) {
      signedA = 0;
      isStatic = true;
      friction = Math.abs(drive);
      T = m2 * g;
      notes.push("Friction is strong enough - the system stays in (limiting) equilibrium.");
    } else {
      signedA = (drive - Math.sign(drive) * fr) / (m1 + m2);
      friction = fr;
      T = m2 * (g - signedA);
    }
  }

  const dir: 1 | -1 = signedA < 0 ? -1 : 1;
  const a = Math.abs(signedA);
  const phases: Phase[] = [];
  const events: SimEvent[] = [{ t: 0, label: "Released from rest" }];
  let tHit: number | undefined;
  let vHit: number | undefined;
  let further: number | undefined;

  // which particle can hit the floor? (the descending hanging one)
  const hasFloorEvent = h > 0 && a > 0 && (mode !== "incline" || dir === 1);

  if (isStatic || a === 0) {
    phases.push({ t0: 0, t1: 2, s0: 0, v0: 0, a: 0, label: "Equilibrium" });
  } else if (hasFloorEvent) {
    tHit = Math.sqrt((2 * h) / a);
    vHit = a * tHit;
    phases.push({ t0: 0, t1: tHit, s0: 0, v0: 0, a, label: "Accelerating together" });
    events.push({ t: tHit, label: "Hits the ground - string goes slack" });
    // after impact: the other particle moves on its own
    let a2: number;
    if (mode === "table") a2 = -mu * g;
    else if (mode === "incline") a2 = -(g * Math.sin(alpha) + mu * g * Math.cos(alpha));
    else a2 = -g; // hanging: rising particle moves freely under gravity
    if (a2 < 0) {
      const tStop = vHit / -a2;
      further = (vHit * vHit) / (2 * -a2);
      phases.push({ t0: tHit, t1: tHit + tStop, s0: h, v0: vHit, a: a2, label: "String slack - decelerating" });
      events.push({ t: tHit + tStop, label: mode === "hanging" ? "Greatest height" : "Comes to rest" });
      phases.push({ t0: tHit + tStop, t1: tHit + tStop + 0.6, s0: h + further, v0: 0, a: 0, label: "At rest" });
    } else {
      phases.push({ t0: tHit, t1: tHit + 1.5, s0: h, v0: vHit, a: 0, label: "String slack - constant speed" });
    }
  } else {
    phases.push({ t0: 0, t1: 2.5, s0: 0, v0: 0, a, label: "Accelerating together" });
  }

  const last = phases[phases.length - 1];
  const duration = last.t1;
  const derived: Derived = {
    acceleration: a,
    tension: T,
    forceOnPulley: T * Math.sqrt(2 + 2 * Math.sin(alpha)),
  };
  if (mode !== "hanging") {
    derived.frictionForce = friction;
    derived.normalReaction = normal;
    derived.coefficientOfFriction = mu;
  }
  if (tHit !== undefined && vHit !== undefined) {
    derived.timeToHit = tHit;
    derived.speedAtHit = vHit;
    derived.distance = h;
  }
  if (further !== undefined) derived.furtherDistance = further;

  return {
    topic: "pulley",
    mode,
    m1,
    m2,
    mu,
    alpha,
    g,
    a,
    dir,
    T,
    friction,
    normal,
    isStatic,
    h,
    tHit,
    vHit,
    phases,
    duration,
    derived,
    events,
    notes,
    sMover: (t) => motion1D(phases, t).s,
    sFaller: (t) => (hasFloorEvent ? Math.min(motion1D(phases, t).s, h) : motion1D(phases, t).s),
    slack: (t) => tHit !== undefined && t > tHit,
  };
}

// ---------- single particle on an inclined plane ----------
export function simulateIncline(p: Params, g: number): InclineSim {
  const m = Math.max(0.01, num(p.mass, 2));
  const alpha = clamp(num(p.angleDeg, 30), 0, 89) * DEG;
  const mu = clamp(num(p.mu, 0), 0, 5);
  const P = num(p.pullForce, 0);
  const u = num(p.u, 0);
  const normal = m * g * Math.cos(alpha);
  const fMax = mu * normal;
  const weightAlong = m * g * Math.sin(alpha);
  const notes: string[] = [];

  const accelMoving = (v: number) => (P - weightAlong - Math.sign(v) * fMax) / m;
  const restCheck = () => {
    const net = P - weightAlong;
    if (Math.abs(net) <= fMax + 1e-9) return { isStatic: true, a: 0, friction: -net };
    return { isStatic: false, a: (net - Math.sign(net) * fMax) / m, friction: -Math.sign(net) * fMax };
  };

  const a0 = u !== 0 ? accelMoving(u) : restCheck().a;
  const tStop0 = u !== 0 && Math.sign(a0) !== Math.sign(u) && a0 !== 0 ? Math.abs(u / a0) : undefined;
  const duration = Math.max(0.5, num(p.duration, tStop0 !== undefined ? tStop0 + 1.5 : 3));

  const phases: Phase[] = [];
  const events: SimEvent[] = [{ t: 0, label: u !== 0 ? "Projected" : "Released" }];
  let t = 0;
  let s = 0;
  let v = u;
  for (let k = 0; k < 4 && t < duration - 1e-9; k++) {
    let a: number;
    let label: string;
    if (Math.abs(v) < 1e-9) {
      const rc = restCheck();
      if (rc.isStatic) {
        phases.push({ t0: t, t1: duration, s0: s, v0: 0, a: 0, label: "At rest (friction holds it)" });
        if (k === 0) notes.push("Friction is limiting or better - the particle stays at rest.");
        break;
      }
      a = rc.a;
      label = a > 0 ? "Accelerating up the slope" : "Sliding down the slope";
    } else {
      a = accelMoving(v);
      label = v > 0 ? (a < 0 ? "Moving up, decelerating" : "Moving up the slope") : "Sliding down the slope";
    }
    if (v !== 0 && a !== 0 && Math.sign(a) !== Math.sign(v)) {
      const tStop = t + Math.abs(v / a);
      if (tStop < duration) {
        const ph: Phase = { t0: t, t1: tStop, s0: s, v0: v, a, label };
        phases.push(ph);
        events.push({ t: tStop, label: "Instantaneously at rest" });
        s = endOf(ph).s;
        v = 0;
        t = tStop;
        continue;
      }
    }
    phases.push({ t0: t, t1: duration, s0: s, v0: v, a, label });
    break;
  }
  if (phases.length === 0) phases.push({ t0: 0, t1: duration, s0: 0, v0: 0, a: 0, label: "At rest" });

  const end = motion1D(phases, duration);
  const rc0 = restCheck();
  const derived: Derived = {
    normalReaction: normal,
    frictionForce: u === 0 && rc0.isStatic ? Math.abs(rc0.friction) : fMax,
    acceleration: Math.abs(a0),
    resultantForce: Math.abs(m * a0),
    finalSpeed: Math.abs(end.v),
    distance: Math.abs(end.s),
    coefficientOfFriction: mu,
    mass: m,
    speed: Math.abs(u),
  };
  if (tStop0 !== undefined) {
    derived.timeToRest = tStop0;
    derived.distanceToRest = (u * u) / (2 * Math.abs(a0));
  }

  return {
    topic: "incline",
    m,
    alpha,
    mu,
    P,
    u,
    g,
    normal,
    fMax,
    weightAlong,
    phases,
    duration,
    derived,
    events,
    notes,
    frictionAt(tt: number) {
      const st = motion1D(phases, tt);
      if (Math.abs(st.v) < 1e-6 && st.a === 0) return restCheck().friction;
      if (Math.abs(st.v) < 1e-6) return -Math.sign(st.a) * fMax;
      return -Math.sign(st.v) * fMax;
    },
  };
}

// ---------- dispatcher ----------
export function simulate(topic: Topic, params: Params, g = 9.8): Sim {
  const gg = g > 0 ? g : 9.8;
  switch (topic) {
    case "projectile":
      return simulateProjectile(params, gg);
    case "forces_line":
      return simulateLine(params, gg);
    case "pulley":
      return simulatePulley(params, gg);
    case "incline":
      return simulateIncline(params, gg);
    default:
      return { topic: "other", duration: 1, derived: {}, events: [], notes: [] };
  }
}

// ---------- verification of Gemma's answers ----------
export interface Check {
  label: string;
  partId?: string;
  quantity: Quantity;
  claimed: number;
  engine?: number;
  status: "ok" | "mismatch" | "unchecked";
}

export function close(a: number, b: number) {
  const x = Math.abs(a);
  const y = Math.abs(b);
  return Math.abs(x - y) <= Math.max(0.015 * Math.max(x, y), 0.02);
}

export function verifySpec(spec: SceneSpec) {
  const sim = simulate(spec.topic, spec.params, spec.g);
  const checks: Check[] = [];
  for (const part of spec.parts) {
    const q = part.answer.quantity;
    const engine = sim.derived[q];
    const status: Check["status"] = q === "other" || engine === undefined ? "unchecked" : close(part.answer.value, engine) ? "ok" : "mismatch";
    checks.push({ label: `Part (${part.id})`, partId: part.id, quantity: q, claimed: part.answer.value, engine, status });
  }
  for (const gv of spec.givens) {
    const q = gv.quantity;
    if (!q || q === "none" || q === "other") continue;
    const engine = sim.derived[q];
    if (engine === undefined) continue;
    checks.push({
      label: `Given ${gv.symbol}`,
      quantity: q,
      claimed: gv.value,
      engine,
      status: close(gv.value, engine) ? "ok" : "mismatch",
    });
  }
  return {
    sim,
    checks,
    ok: checks.filter((c) => c.status === "ok").length,
    mismatches: checks.filter((c) => c.status === "mismatch").length,
    unchecked: checks.filter((c) => c.status === "unchecked").length,
  };
}

// ---------- step -> animation moment ----------
export function focusTime(sim: Sim, h: Highlight | undefined): number | undefined {
  if (!h || h === "none") return undefined;
  switch (sim.topic) {
    case "projectile":
      if (h === "max_height") return sim.tMax;
      if (h === "landing" || h === "time") return sim.tFlight;
      if (h === "trajectory") return sim.tFlight * 0.5;
      if (h === "components" || h === "horizontal" || h === "vertical") return 0;
      return undefined;
    case "forces_line":
      if (h === "velocity") return sim.duration;
      if (h === "forces" || h === "resultant") return 0;
      if (h === "acceleration") return sim.duration * 0.5;
      return undefined;
    case "pulley":
      if (h === "after_impact") return sim.tHit !== undefined ? sim.tHit + (sim.duration - sim.tHit) * 0.5 : undefined;
      if (h === "velocity") return sim.tHit ?? sim.duration;
      if (h === "acceleration" || h === "system") return (sim.tHit ?? sim.duration) * 0.5;
      if (h === "tension" || h === "weights" || h === "friction" || h === "normal" || h === "string") return (sim.tHit ?? sim.duration) * 0.3;
      return undefined;
    case "incline":
      if (h === "velocity") return sim.duration;
      return 0;
    default:
      return undefined;
  }
}

// ---------- display helpers ----------
export const QUANTITY_INFO: Record<Quantity, { label: string; unit: string }> = {
  launchHeight: { label: "Launch height", unit: "m" },
  maxHeight: { label: "Greatest height (above ground)", unit: "m" },
  maxHeightAboveLaunch: { label: "Greatest height above launch", unit: "m" },
  timeOfFlight: { label: "Time of flight", unit: "s" },
  range: { label: "Horizontal distance", unit: "m" },
  impactSpeed: { label: "Impact speed", unit: "m/s" },
  impactAngle: { label: "Impact angle (below horiz.)", unit: "°" },
  timeToMaxHeight: { label: "Time to greatest height", unit: "s" },
  horizontalVelocity: { label: "Horizontal velocity", unit: "m/s" },
  initialVerticalVelocity: { label: "Initial vertical velocity", unit: "m/s" },
  speed: { label: "Initial speed", unit: "m/s" },
  angle: { label: "Angle", unit: "°" },
  mass: { label: "Mass", unit: "kg" },
  acceleration: { label: "Acceleration", unit: "m/s²" },
  finalSpeed: { label: "Final speed", unit: "m/s" },
  distance: { label: "Distance", unit: "m" },
  drivingForce: { label: "Driving force", unit: "N" },
  resistance: { label: "Resistance", unit: "N" },
  resultantForce: { label: "Resultant force", unit: "N" },
  timeToRest: { label: "Time to come to rest", unit: "s" },
  distanceToRest: { label: "Distance to come to rest", unit: "m" },
  tension: { label: "Tension", unit: "N" },
  frictionForce: { label: "Friction", unit: "N" },
  normalReaction: { label: "Normal reaction", unit: "N" },
  timeToHit: { label: "Time until it hits the ground", unit: "s" },
  speedAtHit: { label: "Speed at impact", unit: "m/s" },
  furtherDistance: { label: "Further distance after impact", unit: "m" },
  forceOnPulley: { label: "Force on pulley", unit: "N" },
  coefficientOfFriction: { label: "Coefficient of friction μ", unit: "" },
  other: { label: "Other", unit: "" },
};

export function fmt(x: number | undefined, sf = 4): string {
  if (x === undefined || !Number.isFinite(x)) return "–";
  if (x === 0) return "0";
  const r = Number(x.toPrecision(sf));
  return r.toLocaleString("en-GB", { maximumFractionDigits: 4, useGrouping: false });
}
