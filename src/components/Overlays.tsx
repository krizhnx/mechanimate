import { AlertCircle, Check, Loader2, Sparkles, X } from "lucide-react";

export const STAGES = [
  "Reading the question & diagram",
  "Extracting the given values",
  "Solving with Gemma 4 thinking",
  "Writing mark-scheme working",
  "Building the animation",
  "Verifying with the physics engine",
];

export function LoadingOverlay({ stage, elapsed, model, thinking, preview }: { stage: number; elapsed: number; model: string; thinking: boolean; preview?: string }) {
  const pct = Math.min(95, ((stage + Math.min(1, (elapsed % 6) / 6)) / STAGES.length) * 100);
  return (
    <div className="loading">
      <div className="loading-card">
        <div className="loading-top">
          <div className="loading-orb">
            <Sparkles size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Gemma 4 is working on it</div>
            <div className="faint mono" style={{ fontSize: 11.5 }}>
              {model} · {thinking ? "thinking on" : "fast mode"} · {elapsed.toFixed(0)}s
            </div>
          </div>
          {preview && <img src={preview} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border-2)", background: "#fff" }} />}
        </div>
        <ul className="checklist">
          {STAGES.map((s, i) => (
            <li key={s} className={i < stage ? "done" : i === stage ? "now" : ""}>
              <span className="check-icon">{i < stage ? <Check size={11} strokeWidth={3} /> : i === stage ? <Loader2 size={11} className="spin" /> : null}</span>
              {s}
            </li>
          ))}
        </ul>
        <div className="progress">
          <div style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="toast" role="alert">
      <AlertCircle size={16} className="t-icon" />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>Couldn't solve that</div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          {message}
        </div>
      </div>
      <button className="btn ghost icon sm" onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
}
