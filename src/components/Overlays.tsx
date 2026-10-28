import { AlertCircle, Check, Loader2, X } from "lucide-react";

export function GemmaMark({ size = 20 }: { size?: number }) {
  // four-point "gem" sparkle in Gemma blue
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="gemma-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8AB4F8" />
          <stop offset="0.55" stopColor="#4285F4" />
          <stop offset="1" stopColor="#1A5FD0" />
        </linearGradient>
      </defs>
      <path fill="url(#gemma-g)" d="M12 1.5c.5 5.6 4.9 10 10.5 10.5-5.6.5-10 4.9-10.5 10.5C11.5 16.9 7.1 12.5 1.5 12 7.1 11.5 11.5 7.1 12 1.5z" />
    </svg>
  );
}

export function GoogleG({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export const STAGES = [
  "Reading the question & diagram",
  "Extracting the given values",
  "Solving with Gemma 4 thinking",
  "Writing mark-scheme working",
  "Building the animation",
  "Verifying with the physics engine",
];

export function LoadingOverlay({ stage, elapsed, model, thinking, preview, stageSeconds = 6 }: { stage: number; elapsed: number; model: string; thinking: boolean; preview?: string; stageSeconds?: number }) {
  const pct = Math.min(96, ((stage + Math.min(1, (elapsed - stage * stageSeconds) / stageSeconds)) / STAGES.length) * 100);
  return (
    <div className="loading">
      <div className="loading-card">
        <div className="loading-top">
          <div className="loading-orb gemma">
            <GemmaMark size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Gemma 4 is analysing your question</div>
            <div className="faint mono" style={{ fontSize: 11.5 }}>
              {model} · {thinking ? "thinking on" : "fast mode"} · {elapsed.toFixed(0)}s
            </div>
          </div>
        </div>
        {preview && (
          <div className={`scan-preview ${stage >= 2 ? "read" : ""}`}>
            <img src={preview} alt="Uploaded question" />
            {stage < 2 && <div className="scan-line" />}
            <span className="scan-tag">
              <GemmaMark size={11} /> {stage < 1 ? "Reading text & diagram…" : stage < 2 ? "Extracting values…" : "Question understood"}
            </span>
          </div>
        )}
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
        <div className="powered">
          <GoogleG size={13} /> Powered by Google <b>Gemma 4</b> · open-weight model
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
