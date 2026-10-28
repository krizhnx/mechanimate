import type { CSSProperties } from "react";
import { Cpu, RotateCcw, Sparkles } from "lucide-react";
import type { Check, Sim } from "../shared/physics";
import { QUANTITY_INFO, fmt } from "../shared/physics";
import type { Params, PulleyMode, Quantity, SceneSpec } from "../shared/types";

type NumKey = Exclude<keyof Params, "pulleyMode">;

interface Ctl {
  key: NumKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  fallback: number;
}

const niceMax = (v: number, floor: number) => {
  const x = Math.max(floor, Math.abs(v) * 2.5);
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  return Math.ceil(x / p) * p;
};

function controlsFor(spec: SceneSpec, sim: Sim, orig: Params, params: Params): Ctl[] {
  const o = (k: NumKey, fb: number) => (typeof orig[k] === "number" ? (orig[k] as number) : fb);
  switch (spec.topic) {
    case "projectile":
      return [
        { key: "speed", label: "Speed of projection U", unit: "m/s", min: 0, max: niceMax(o("speed", 14), 30), step: 0.1, fallback: 14 },
        { key: "angleDeg", label: "Angle of projection θ", unit: "°", min: -89, max: 89, step: 0.5, fallback: 30 },
        { key: "launchHeight", label: "Launch height H", unit: "m", min: 0, max: niceMax(o("launchHeight", 0), 50), step: 0.5, fallback: 0 },
      ];
    case "forces_line": {
      const useForces = sim.topic === "forces_line" && sim.useForces;
      const base: Ctl[] = [{ key: "u", label: "Initial speed u", unit: "m/s", min: 0, max: niceMax(o("u", 0), 30), step: 0.5, fallback: 0 }];
      if (useForces)
        base.push(
          { key: "mass", label: "Mass m", unit: "kg", min: 1, max: niceMax(o("mass", 10), 10), step: 1, fallback: 10 },
          { key: "drivingForce", label: "Driving force D", unit: "N", min: 0, max: niceMax(o("drivingForce", 0), Math.max(100, o("resistance", 0) * 2)), step: 10, fallback: 0 },
          { key: "resistance", label: "Resistance R", unit: "N", min: 0, max: niceMax(o("resistance", 0), Math.max(100, o("drivingForce", 0))), step: 10, fallback: 0 }
        );
      else base.push({ key: "a", label: "Acceleration a", unit: "m/s²", min: -10, max: 10, step: 0.1, fallback: 0 });
      base.push({ key: "duration", label: "Time t", unit: "s", min: 0.5, max: niceMax(o("duration", 5), 10), step: 0.1, fallback: 5 });
      return base;
    }
    case "pulley": {
      const mode = params.pulleyMode ?? "table";
      const list: Ctl[] = [
        { key: "m1", label: mode === "hanging" ? "Mass m₁ (left)" : "Mass m₁ (on surface)", unit: "kg", min: 0.1, max: niceMax(o("m1", 3), 10), step: 0.1, fallback: 3 },
        { key: "m2", label: "Mass m₂ (hanging)", unit: "kg", min: 0.1, max: niceMax(o("m2", 2), 10), step: 0.1, fallback: 2 },
      ];
      if (mode !== "hanging") list.push({ key: "mu", label: "Coefficient of friction μ", unit: "", min: 0, max: 1, step: 0.01, fallback: 0 });
      if (mode === "incline") list.push({ key: "angleDeg", label: "Slope angle α", unit: "°", min: 0, max: 80, step: 0.5, fallback: 30 });
      list.push({ key: "dropHeight", label: "Drop height h", unit: "m", min: 0, max: niceMax(o("dropHeight", 1), 3), step: 0.05, fallback: 0 });
      return list;
    }
    case "incline":
      return [
        { key: "mass", label: "Mass m", unit: "kg", min: 0.1, max: niceMax(o("mass", 2), 10), step: 0.1, fallback: 2 },
        { key: "angleDeg", label: "Slope angle α", unit: "°", min: 0, max: 80, step: 0.5, fallback: 30 },
        { key: "mu", label: "Coefficient of friction μ", unit: "", min: 0, max: 1.5, step: 0.01, fallback: 0 },
        { key: "pullForce", label: "Pull up the slope P", unit: "N", min: -niceMax(o("pullForce", 0), 50), max: niceMax(o("pullForce", 0), 50), step: 0.5, fallback: 0 },
        { key: "u", label: "Initial velocity up slope u", unit: "m/s", min: -20, max: 20, step: 0.1, fallback: 0 },
      ];
    default:
      return [];
  }
}

interface Props {
  spec: SceneSpec;
  sim: Sim;
  params: Params;
  setParams: (p: Params) => void;
  changed: boolean;
  onReset: () => void;
  onResolve: () => void;
  busy: boolean;
  online: boolean;
  checks: Check[];
}

export function ExplorePanel({ spec, sim, params, setParams, changed, onReset, onResolve, busy, online, checks }: Props) {
  if (spec.topic === "other") return <div className="faint">No adjustable model for this question type.</div>;
  const ctls = controlsFor(spec, sim, spec.params, params);
  const answerQs = new Map<Quantity, string>();
  for (const c of checks) if (c.partId) answerQs.set(c.quantity, c.partId);
  const derived = Object.entries(sim.derived).filter(([q]) => !["speed", "angle", "mass", "coefficientOfFriction"].includes(q)) as [Quantity, number][];
  derived.sort((a, b) => Number(answerQs.has(b[0])) - Number(answerQs.has(a[0])));

  return (
    <div className="explore">
      <div className="sliders">
        {changed && (
          <div className="callout warn" style={{ marginBottom: 0 }}>
            <span>What-if mode - solution shows the original values.</span>
            <span className="spacer" />
            <button className="btn sm ghost" onClick={onReset}>
              <RotateCcw size={13} /> Reset
            </button>
            <button className="btn sm primary" onClick={onResolve} disabled={busy || !online}>
              <Sparkles size={13} /> Re-solve
            </button>
          </div>
        )}
        {spec.topic === "pulley" && (
          <div className="slider-row">
            <span className="lbl">Set-up</span>
            <span />
            <select className="select" style={{ gridColumn: "1 / -1", height: 30, padding: "0 8px" }} value={params.pulleyMode ?? "table"} onChange={(e) => setParams({ ...params, pulleyMode: e.target.value as PulleyMode })}>
              <option value="table">Particle on a table + hanging particle</option>
              <option value="hanging">Both particles hanging</option>
              <option value="incline">Particle on a slope + hanging particle</option>
            </select>
          </div>
        )}
        {ctls.map((c) => {
          const v = typeof params[c.key] === "number" ? (params[c.key] as number) : c.fallback;
          const max = Math.max(c.max, v);
          const p = ((v - c.min) / (max - c.min || 1)) * 100;
          return (
            <div key={c.key} className="slider-row">
              <span className="lbl">{c.label}</span>
              <label className="num-input">
                <input
                  type="number"
                  value={Number(v.toFixed(4))}
                  step={c.step}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    if (Number.isFinite(n)) setParams({ ...params, [c.key]: n });
                  }}
                />
                {c.unit && <em>{c.unit}</em>}
              </label>
              <input
                className="range"
                type="range"
                min={c.min}
                max={max}
                step={c.step}
                value={v}
                style={{ "--p": `${p}%` } as CSSProperties}
                onChange={(e) => setParams({ ...params, [c.key]: parseFloat(e.target.value) })}
              />
            </div>
          );
        })}
      </div>

      <div className="results">
        <div className="results-head">
          <Cpu size={13} /> Live results · exact physics engine
        </div>
        {sim.notes.map((n) => (
          <div key={n} className="callout">
            {n}
          </div>
        ))}
        <div className="metric-grid">
          {derived.map(([q, v]) => (
            <div key={q} className={`metric ${answerQs.has(q) ? "answer" : ""}`}>
              <div className="m-label">
                {answerQs.has(q) && <span className="part-tag">{answerQs.get(q)}</span>}
                {QUANTITY_INFO[q].label}
              </div>
              <div className="m-value">
                {fmt(v)}
                <small>{QUANTITY_INFO[q].unit}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
