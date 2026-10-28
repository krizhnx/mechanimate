import { useEffect, useRef, useState } from "react";
import { ArrowRight, ImageUp, Sparkles, X } from "lucide-react";
import type { Example } from "../fixtures";
import { TopicIcon, TOPIC_NAMES } from "./TopicIcon";

interface Props {
  open: boolean;
  onClose: () => void;
  onFile: (f: Blob) => void;
  onText: (t: string) => void;
  examples: Example[];
  onExampleLive: (ex: Example) => void;
  online: boolean;
  model: string;
}

export function NewQuestionModal({ open, onClose, onFile, onText, examples, onExampleLive, online, model }: Props) {
  const [drag, setDrag] = useState(false);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <h2>New question</h2>
            <p className="muted" style={{ fontSize: 13 }}>
              Gemma 4 reads the text and the diagram, solves every part, and builds an interactive animation.
            </p>
          </div>
          <button className="btn ghost icon" onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {!online && (
            <div className="callout warn">
              Live solving is off - add <code className="mono">GEMINI_API_KEY</code> to <code className="mono">.env</code> and restart. Library examples still work offline.
            </div>
          )}
          <div
            className={`drop ${drag ? "drag" : ""} ${online ? "" : "disabled"}`}
            onClick={() => online && fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f && online) onFile(f);
            }}
          >
            <div className="drop-icon">
              <ImageUp size={22} />
            </div>
            <h3>Drop a screenshot or photo of the question</h3>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              or click to browse · or just press <span className="kbd">⌘</span> <span className="kbd">V</span> anywhere to paste
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="or">or type it</div>
          <textarea
            className="textarea"
            rows={3}
            value={text}
            disabled={!online}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) onText(text);
            }}
            placeholder="e.g. A ball is projected from ground level at 20 m/s at 30° above the horizontal. Find the range and the greatest height."
          />

          <div className="section-title">Or run a library question live through Gemma</div>
          <div className="example-grid">
            {examples.map((ex) => (
              <button key={ex.id} className="example-card" disabled={!online} onClick={() => onExampleLive(ex)}>
                <span className="sb-icon">
                  <TopicIcon topic={ex.spec.topic} />
                </span>
                <span className="sb-text" style={{ flex: 1 }}>
                  <span className="sb-title">{ex.name}</span>
                  <span className="sb-sub">{TOPIC_NAMES[ex.spec.topic]}</span>
                </span>
                <ArrowRight size={14} className="faint" />
              </button>
            ))}
          </div>
        </div>

        <div className="modal-foot">
          <span className="badge accent">
            <Sparkles size={12} /> {model}
          </span>
          <span className="faint" style={{ fontSize: 12 }}>
            <span className="kbd">⌘</span> <span className="kbd">↵</span> to solve
          </span>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!online || !text.trim()} onClick={() => onText(text)}>
            Solve with Gemma 4 <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
