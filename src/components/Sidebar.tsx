import { useEffect, useRef, useState } from "react";
import { ChevronRight, Plus, Settings2, Sparkles, Trash2 } from "lucide-react";
import type { Settings } from "../api";
import type { Example } from "../fixtures";
import type { HistoryItem } from "../history";
import { timeAgo } from "../history";
import { TopicIcon, TOPIC_NAMES } from "./TopicIcon";

interface Props {
  examples: Example[];
  history: HistoryItem[];
  activeId?: string;
  onNew: () => void;
  onExample: (ex: Example) => void;
  onHistory: (h: HistoryItem) => void;
  onRemoveHistory: (id: string) => void;
  online: boolean;
  settings: Settings;
  setSettings: (s: Settings) => void;
  models: string[];
}

export function Sidebar({ examples, history, activeId, onNew, onExample, onHistory, onRemoveHistory, online, settings, setSettings, models }: Props) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Sparkles size={16} />
        </div>
        <div className="brand-name">Mechanimate</div>
        <span className="brand-tag">BETA</span>
      </div>

      <div className="sb-new">
        <button className="btn primary block" onClick={onNew}>
          <Plus size={15} /> New question <span className="spacer" /> <span className="kbd">N</span>
        </button>
      </div>

      <div className="sb-scroll">
        <div className="sb-section">
          <div className="sb-label">Library</div>
          {examples.map((ex) => (
            <button key={ex.id} className={`sb-item ${activeId === ex.id ? "active" : ""}`} onClick={() => onExample(ex)}>
              <span className="sb-icon">
                <TopicIcon topic={ex.spec.topic} />
              </span>
              <span className="sb-text">
                <span className="sb-title">{ex.name}</span>
                <span className="sb-sub">{TOPIC_NAMES[ex.spec.topic]}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="sb-section">
          <div className="sb-label">Recent</div>
          {history.length === 0 && <div className="sb-empty">Questions you solve with Gemma appear here.</div>}
          {history.map((h) => (
            <div key={h.id} className="row" style={{ gap: 0 }}>
              <button className={`sb-item ${activeId === h.id ? "active" : ""}`} onClick={() => onHistory(h)}>
                <span className="sb-icon">
                  <TopicIcon topic={h.spec.topic} />
                </span>
                <span className="sb-text">
                  <span className="sb-title">{h.spec.title || "Untitled question"}</span>
                  <span className="sb-sub">
                    {TOPIC_NAMES[h.spec.topic]} · {timeAgo(h.createdAt)}
                  </span>
                </span>
              </button>
              <button className="btn ghost icon sm" title="Remove" onClick={() => onRemoveHistory(h.id)}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="sb-foot" ref={popRef}>
        {open && (
          <div className="popover">
            <div>
              <label className="field-label">Model</label>
              <select className="select" value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })}>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <label className="switch">
              <input type="checkbox" checked={settings.thinking} onChange={(e) => setSettings({ ...settings, thinking: e.target.checked })} />
              <span className="track" /> Thinking mode
            </label>
            <label className="switch">
              <input type="checkbox" checked={settings.verifyLoop} onChange={(e) => setSettings({ ...settings, verifyLoop: e.target.checked })} />
              <span className="track" /> Self-correction loop
            </label>
            <div className="faint" style={{ fontSize: 11.5 }}>
              Thinking improves accuracy on multi-step questions. The self-correction loop re-asks Gemma if the physics engine disagrees.
            </div>
          </div>
        )}
        <button className="model-card" onClick={() => setOpen(!open)}>
          <span className={`dot ${online ? "ok" : "warn"}`} />
          <span className="sb-text" style={{ flex: 1 }}>
            <span className="sb-title">Gemma 4 · {settings.model.replace(/^gemma-4-/, "").replace(/-it$/, "").toUpperCase()}</span>
            <span className="sb-sub">{online ? "Connected · Gemini API" : "Offline · add GEMINI_API_KEY"}</span>
          </span>
          {open ? <ChevronRight size={14} style={{ transform: "rotate(90deg)" }} /> : <Settings2 size={14} className="faint" />}
        </button>
      </div>
    </aside>
  );
}
