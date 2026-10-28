import { useState } from "react";
import { Lightbulb, Pause, Play, Repeat, RotateCcw } from "lucide-react";
import type { Sim } from "../shared/physics";
import { fmt } from "../shared/physics";
import type { Highlight, SceneSpec } from "../shared/types";
import type { Clock } from "../useClock";
import { OPEN, phaseLabel, readouts } from "../sceneUtils";
import type { Reveal } from "../sceneUtils";
import { H, W } from "./scenes/common";
import { ProjectileScene } from "./scenes/ProjectileScene";
import { LineScene } from "./scenes/LineScene";
import { PulleyScene } from "./scenes/PulleyScene";
import { InclineScene } from "./scenes/InclineScene";

interface Props {
  spec: SceneSpec;
  sim: Sim;
  clock: Clock;
  highlight: Highlight;
  showVectors: boolean;
  caption?: { n: string; text: string };
  reveal?: Reveal;
}

export function Stage({ spec, sim, clock, highlight, showVectors, caption, reveal = OPEN }: Props) {
  const { t } = clock;
  const [hudOpen, setHudOpen] = useState(true);
  let scene = null;
  switch (sim.topic) {
    case "projectile":
      scene = <ProjectileScene sim={sim} t={t} highlight={highlight} labels={spec.labels} showVectors={showVectors} objectLabel={spec.objectLabel} reveal={reveal} />;
      break;
    case "forces_line":
      scene = <LineScene sim={sim} t={t} highlight={highlight} labels={spec.labels} showVectors={showVectors} objectLabel={spec.objectLabel} reveal={reveal} />;
      break;
    case "pulley":
      scene = <PulleyScene sim={sim} t={t} highlight={highlight} labels={spec.labels} showVectors={showVectors} reveal={reveal} />;
      break;
    case "incline":
      scene = <InclineScene sim={sim} t={t} highlight={highlight} showVectors={showVectors} objectLabel={spec.objectLabel} reveal={reveal} />;
      break;
  }
  const phase = phaseLabel(sim, t);
  const rdAll = readouts(sim, t);
  const rd = reveal.exam ? [...rdAll.slice(0, 1), ["exam mode", "values hidden"] as [string, string]] : rdAll;
  const pct = sim.duration > 0 ? (Math.min(t, sim.duration) / sim.duration) * 100 : 0;

  return (
    <div className="stage">
      <div className="canvas">
        {scene ? (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Animated mechanics diagram">
              <defs>
                <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1a2420" />
                  <stop offset="100%" stopColor="#0d1210" />
                </linearGradient>
                <linearGradient id="rock" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#262a33" />
                  <stop offset="100%" stopColor="#353b47" />
                </linearGradient>
              </defs>
              {scene}
            </svg>
            <div className={`hud ${hudOpen ? "" : "collapsed"}`} onClick={() => setHudOpen(!hudOpen)} title={hudOpen ? "Click to minimise" : "Click to expand readouts"}>
              {(hudOpen ? rd : rd.slice(0, 1)).map(([k, v]) => (
                <FragmentRow key={k} k={k} v={v} />
              ))}
            </div>
            {phase && (
              <div className="phase">
                <span className="pulse" /> {phase}
              </div>
            )}
          </>
        ) : (
          <div className="no-scene">
            <div>
              <h3 style={{ fontSize: 15, marginBottom: 6, color: "var(--text)" }}>No animation template for this one yet</h3>
              <p style={{ maxWidth: 420 }}>Gemma 4 has still solved it step by step in the Solution panel. Templates cover projectiles, forces in a line, connected particles and inclined planes.</p>
            </div>
          </div>
        )}
      </div>

      {scene &&
        (caption ? (
          <div className="caption">
            <span className="step-no">{caption.n}</span>
            <span className="txt" key={caption.n + caption.text} title={caption.text}>
              {caption.text}
            </span>
          </div>
        ) : (
          <div className="caption idle">
            <Lightbulb size={14} />
            <span className="txt">Click any step in the solution - the animation replays to that moment and highlights what matters. Use ← → to step through.</span>
          </div>
        ))}

      {scene && (
        <div className="player">
          <button className="play-btn" onClick={clock.toggle} title="Play / pause (Space)">
            {clock.playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" style={{ marginLeft: 2 }} />}
          </button>
          <button className="btn ghost icon" onClick={clock.restart} title="Replay">
            <RotateCcw size={15} />
          </button>
          <div className="scrub">
            <div className="rail" />
            <div className="fill" style={{ width: `${pct}%` }} />
            {sim.events.map((ev, i) => (
              <button key={i} className="event-tick" style={{ left: `${(ev.t / sim.duration) * 100}%` }} title={`${ev.label} · t = ${fmt(ev.t, 3)} s`} onClick={() => clock.seek(ev.t)} />
            ))}
            <input type="range" min={0} max={sim.duration} step={sim.duration / 1000} value={Math.min(t, sim.duration)} onChange={(e) => clock.seek(parseFloat(e.target.value))} onMouseDown={clock.pause} />
          </div>
          <span className="time">
            {fmt(Math.min(t, sim.duration), 3)}s / {fmt(sim.duration, 3)}s
          </span>
          <div className="seg" title="Playback speed">
            {[0.25, 0.5, 1, 2].map((r) => (
              <button key={r} className={clock.rate === r ? "on" : ""} onClick={() => clock.setRate(r)}>
                {r}×
              </button>
            ))}
          </div>
          <button className={`btn icon ${clock.loop ? "" : "ghost"}`} onClick={() => clock.setLoop(!clock.loop)} title="Loop">
            <Repeat size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span>{k}</span>
      <b>{v}</b>
    </>
  );
}
