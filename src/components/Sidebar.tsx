import "../styles/sidebar-extras.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, History, ImageIcon, Plus, Search, Settings2, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import type { Settings } from "../api";
import type { Example } from "../fixtures";
import type { HistoryItem } from "../history";
import { timeAgo } from "../history";
import type { SceneSpec, Topic } from "../shared/types";
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

const TOPIC_SHORT: Record<Topic, string> = {
  projectile: "Projectiles",
  forces_line: "Forces",
  pulley: "Pulleys",
  incline: "Inclines",
  other: "General",
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function specMeta(spec: SceneSpec) {
  const parts = spec.parts?.length ?? 0;
  const steps = (spec.parts ?? []).reduce((n, p) => n + (p.steps?.length ?? 0), 0);
  return `${plural(parts, "part")} · ${plural(steps, "step")}`;
}

function matches(q: string, ...fields: (string | undefined)[]) {
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
}

export function Sidebar({ examples, history, activeId, onNew, onExample, onHistory, onRemoveHistory, online, settings, setSettings, models }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const popRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  // "/" focuses the library search (when not typing elsewhere)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const libItems = useMemo(
    () => examples.filter((ex) => matches(q, ex.name, ex.spec.title, ex.blurb, TOPIC_NAMES[ex.spec.topic], TOPIC_SHORT[ex.spec.topic])),
    [examples, q]
  );
  const recentItems = useMemo(
    () => history.filter((h) => matches(q, h.spec.title, TOPIC_NAMES[h.spec.topic], TOPIC_SHORT[h.spec.topic])),
    [history, q]
  );
  const noResults = q && libItems.length === 0 && recentItems.length === 0;

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

      <div className="sbx-search">
        <Search size={13} className="sbx-search-icon" />
        <input
          ref={searchRef}
          type="text"
          value={query}
          placeholder="Search library…"
          aria-label="Search library"
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              e.currentTarget.blur();
            }
          }}
        />
        {query ? (
          <button className="sbx-search-clear" title="Clear search" aria-label="Clear search" onClick={() => setQuery("")}>
            <X size={12} />
          </button>
        ) : (
          <span className="sbx-search-kbd">/</span>
        )}
      </div>

      <div className="sb-scroll">
        {noResults ? (
          <div className="sbx-empty">
            <Search size={14} />
            <span>
              No matches for <strong>“{query.trim()}”</strong>
            </span>
          </div>
        ) : (
          <>
            {(!q || libItems.length > 0) && (
              <div className="sb-section">
                <div className="sb-label">
                  <span className="sbx-label">
                    Library <span className="sbx-count">{libItems.length}</span>
                  </span>
                </div>
                <div className="sbx-list">
                  {libItems.map((ex) => (
                    <button
                      key={ex.id}
                      className={`sb-item sbx-item ${activeId === ex.id ? "active" : ""}`}
                      data-topic={ex.spec.topic}
                      title={ex.blurb}
                      aria-current={activeId === ex.id ? "true" : undefined}
                      onClick={() => onExample(ex)}
                    >
                      <span className="sb-icon">
                        <TopicIcon topic={ex.spec.topic} />
                      </span>
                      <span className="sb-text">
                        <span className="sbx-title-row">
                          <span className="sb-title">{ex.name}</span>
                          {ex.image && (
                            <span className="sbx-badge" title="Includes the original exam image" aria-label="Has image">
                              <ImageIcon size={10} />
                            </span>
                          )}
                        </span>
                        <span className="sb-sub">
                          <span className="sbx-topic">{TOPIC_SHORT[ex.spec.topic]}</span> · {specMeta(ex.spec)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                {!q && (
                  <div className="sbx-trust" title="Every library example is hand-checked against the mark scheme">
                    <ShieldCheck size={12} />
                    <span>Hand-checked vs. mark scheme</span>
                  </div>
                )}
              </div>
            )}

            {(!q || recentItems.length > 0) && (
              <div className="sb-section">
                <div className="sb-label">
                  <span className="sbx-label">
                    Recent <span className="sbx-count">{recentItems.length}</span>
                  </span>
                </div>
                {history.length === 0 && (
                  <div className="sbx-empty">
                    <History size={14} />
                    <span>Questions you solve with Gemma appear here</span>
                  </div>
                )}
                <div className="sbx-list">
                  {recentItems.map((h) => (
                    <div key={h.id} className="sbx-row">
                      <button
                        className={`sb-item sbx-item ${activeId === h.id ? "active" : ""}`}
                        data-topic={h.spec.topic}
                        aria-current={activeId === h.id ? "true" : undefined}
                        onClick={() => onHistory(h)}
                      >
                        <span className="sb-icon">
                          <TopicIcon topic={h.spec.topic} />
                        </span>
                        <span className="sb-text">
                          <span className="sbx-title-row">
                            <span className="sb-title">{h.spec.title || "Untitled question"}</span>
                            {h.image && (
                              <span className="sbx-badge" title="Solved from an image">
                                <ImageIcon size={10} />
                              </span>
                            )}
                          </span>
                          <span className="sb-sub">
                            <span className="sbx-topic">{TOPIC_SHORT[h.spec.topic]}</span> · {plural(h.spec.parts?.length ?? 0, "part")} · {timeAgo(h.createdAt)}
                          </span>
                        </span>
                      </button>
                      <button className="sbx-remove" title="Remove from recent" aria-label="Remove from recent" onClick={() => onRemoveHistory(h.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
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
