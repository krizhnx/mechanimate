import "../styles/modal-extras.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, FileText, Info, Send, Smartphone, Sparkles, Type, Upload, X } from "lucide-react";
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

type Tab = "upload" | "phone" | "type";

const TABS: { id: Tab; label: string; icon: typeof Upload }[] = [
  { id: "upload", label: "Upload file", icon: Upload },
  { id: "phone", label: "Scan with phone", icon: Smartphone },
  { id: "type", label: "Type it", icon: Type },
];

const FORMATS = ["PNG", "JPG", "HEIC", "PDF", "DOCX"];
const FAKE_PAGES = 3;

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Deterministic fake QR (version-2 sized, 25x25) - looks right, encodes nothing. */
function useFakeQr(size = 25, seed = 0x7a4c) {
  return useMemo(() => {
    let s = seed >>> 0;
    const rand = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const grid: boolean[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => rand() < 0.5));
    const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    const put = (r: number, c: number, on: boolean) => {
      if (r < 0 || c < 0 || r >= size || c >= size) return;
      grid[r][c] = on;
      reserved[r][c] = true;
    };
    // finder patterns + 1-module separator
    for (const [r0, c0] of [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ]) {
      for (let r = -1; r <= 7; r++)
        for (let c = -1; c <= 7; c++) {
          const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
          const ring = inside && (r === 0 || r === 6 || c === 0 || c === 6);
          const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          put(r0 + r, c0 + c, ring || core);
        }
    }
    // timing patterns
    for (let i = 8; i < size - 8; i++) {
      if (!reserved[6][i]) put(6, i, i % 2 === 0);
      if (!reserved[i][6]) put(i, 6, i % 2 === 0);
    }
    // alignment pattern centred at (size-7, size-7)
    const a = size - 7;
    for (let r = -2; r <= 2; r++)
      for (let c = -2; c <= 2; c++) put(a + r, a + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);

    let d = "";
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (grid[r][c]) d += `M${c} ${r}h1v1h-1z`;
    return d;
  }, [size, seed]);
}

function FakeQr() {
  const d = useFakeQr();
  const quiet = 2;
  const n = 25 + quiet * 2;
  return (
    <div className="nq-qr" aria-label="QR code to connect your phone">
      <svg viewBox={`${-quiet} ${-quiet} ${n} ${n}`} shapeRendering="crispEdges">
        <path d={d} fill="currentColor" />
      </svg>
    </div>
  );
}

export function NewQuestionModal({ open, onClose, onFile, onText, examples, onExampleLive, online, model }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.search).get("nqtab");
    return TABS.some((x) => x.id === t) ? (t as Tab) : "upload";
  });
  const [drag, setDrag] = useState(false);
  const [text, setText] = useState("");
  const [doc, setDoc] = useState<File | null>(null);
  const [docReady, setDocReady] = useState(false);
  const [page, setPage] = useState(0);
  const [docNotice, setDocNotice] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // reset preview-only state when the modal closes
  useEffect(() => {
    if (open) return;
    setDoc(null);
    setLinkSent(false);
  }, [open]);

  // fake "reading pages" pass for non-image documents
  useEffect(() => {
    if (!doc) return;
    setDocReady(false);
    setPage(0);
    setDocNotice(false);
    const t = window.setTimeout(() => setDocReady(true), 1200);
    return () => window.clearTimeout(t);
  }, [doc]);

  if (!open) return null;

  const handleFile = (f: File) => {
    if (f.type.startsWith("image/")) onFile(f);
    else setDoc(f);
  };

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

          <div className="nq-tabs" role="tablist">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`nq-tab ${tab === id ? "on" : ""}`}
                onClick={() => setTab(id)}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {tab === "upload" &&
            (doc ? (
              <div className="nq-doc">
                <div className="nq-doc-head">
                  <span className="nq-doc-icon">
                    <FileText size={18} />
                  </span>
                  <span className="nq-doc-meta">
                    <span className="nq-doc-name" title={doc.name}>
                      {doc.name}
                    </span>
                    <span className="faint">
                      {formatSize(doc.size)}
                      {docReady && ` · ${FAKE_PAGES} pages detected`}
                    </span>
                  </span>
                  <button className="btn ghost icon sm" onClick={() => setDoc(null)} title="Remove file">
                    <X size={14} />
                  </button>
                </div>

                {!docReady ? (
                  <div className="nq-reading">
                    <span className="muted">Reading pages…</span>
                    <div className="nq-progress">
                      <span />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="nq-pages">
                      {Array.from({ length: FAKE_PAGES }, (_, i) => (
                        <button
                          key={i}
                          className={`nq-page ${page === i ? "on" : ""}`}
                          onClick={() => {
                            setPage(i);
                            setDocNotice(false);
                          }}
                          title={`Page ${i + 1}`}
                        >
                          <span className="nq-page-sheet">
                            <i style={{ width: "55%" }} />
                            <i />
                            <i style={{ width: "80%" }} />
                            <i className="nq-page-fig" />
                            <i style={{ width: "70%" }} />
                            <i />
                          </span>
                          <span className="nq-page-num">{i + 1}</span>
                        </button>
                      ))}
                      <div className="nq-doc-actions">
                        <button className="btn primary sm" disabled={!online} onClick={() => setDocNotice(true)}>
                          Solve page {page + 1} <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                    {docNotice && (
                      <div className="callout nq-notice">
                        <Info size={14} />
                        <span>
                          PDF import is in preview - for now, paste a screenshot of the page (<span className="kbd">⌘</span>{" "}
                          <span className="kbd">V</span>).
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
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
                  if (f && online) handleFile(f);
                }}
              >
                <div className="drop-icon">
                  <Upload size={22} />
                </div>
                <h3>Drop a screenshot, photo or PDF of the question</h3>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                  or click to browse · or just press <span className="kbd">⌘</span> <span className="kbd">V</span> anywhere to paste
                </p>
                <div className="nq-chips">
                  {FORMATS.map((f) => (
                    <span key={f} className="nq-chip">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}

          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,.pdf,.heic,.docx"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />

          {tab === "phone" && (
            <div className="nq-phone">
              <FakeQr />
              <div className="nq-phone-side">
                <ol className="nq-steps">
                  <li>
                    <span className="nq-step-n">1</span> Scan with your phone camera
                  </li>
                  <li>
                    <span className="nq-step-n">2</span> Snap the question - we straighten and crop it
                  </li>
                  <li>
                    <span className="nq-step-n">3</span> It appears here and Gemma starts solving
                  </li>
                </ol>
                <div className="nq-waiting">
                  <span className="nq-pulse" /> Waiting for your phone…
                </div>
                <div className="nq-phone-foot">
                  <span className="nq-session faint">Session MECH-7Q4K · expires in 10 min</span>
                  <span className="spacer" />
                  <button className="btn ghost sm" onClick={() => setLinkSent(true)} disabled={linkSent}>
                    {linkSent ? (
                      <>
                        <Check size={13} /> Link sent
                      </>
                    ) : (
                      <>
                        <Send size={13} /> Send link to my phone
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "type" && (
            <textarea
              className="textarea"
              rows={4}
              autoFocus
              value={text}
              disabled={!online}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) onText(text);
              }}
              placeholder="e.g. A ball is projected from ground level at 20 m/s at 30° above the horizontal. Find the range and the greatest height."
            />
          )}

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
