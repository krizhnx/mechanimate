import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, GraduationCap, PlayCircle, Sparkles, User } from "lucide-react";
import { ask } from "../api";
import { PRACTICE_TEXT } from "../fixtures";
import type { Derived } from "../shared/physics";
import type { Params, SceneSpec } from "../shared/types";
import { RichText } from "./Tex";

interface Msg {
  role: "user" | "model";
  text: string;
  practice?: boolean;
  demo?: boolean; // scripted offline demo - "Solve & animate" loads the hand-checked spec instantly
  error?: boolean;
}

interface Props {
  spec: SceneSpec;
  params: Params;
  derived: Derived;
  model: string;
  activeStepText?: string;
  onAnimate: (questionText: string) => void;
  onDemoPractice: () => void;
  online: boolean;
}

export function AskPanel({ spec, params, derived, model, activeStepText, onAnimate, onDemoPractice, online }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  async function send(question: string, practice = false) {
    if (!question.trim() || busy) return;
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const r = await ask({ spec, question, history, currentParams: params, derived, model });
      setMsgs((m) => [...m, { role: "model", text: r.text, practice }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "model", text: String((e as Error).message), error: true }]);
    } finally {
      setBusy(false);
    }
  }

  // Scripted example of the practice-question flow, so it can be shown without a key or a 30 s wait.
  function playDemo() {
    if (busy) return;
    setMsgs((m) => [...m, { role: "user", text: "Give me a similar practice question with different numbers (no solution)." }]);
    setBusy(true);
    setTimeout(() => {
      setMsgs((m) => [
        ...m,
        {
          role: "model",
          practice: true,
          demo: true,
          text: `Here's one that uses exactly the same method with new numbers:\n\n${PRACTICE_TEXT}\n\nTip: $\\tan\\theta = \\tfrac34$ gives a 3-4-5 triangle, so the components come out as whole numbers.`,
        },
      ]);
      setBusy(false);
    }, 1400);
  }

  const chips: { label: string; q: string; practice?: boolean }[] = [
    { label: "Explain the key idea", q: "Explain the key physics idea behind this question simply, as if I'm stuck." },
    ...(activeStepText ? [{ label: "Why this step?", q: `Why does this step work: "${activeStepText}"?` }] : []),
    { label: "Common mistakes", q: "What mistakes do students commonly make on this question, and how do examiners mark them?" },
    { label: "Practice question", q: "Give me a similar practice question with different numbers (no solution).", practice: true },
  ];

  return (
    <div className="chat">
      <div className="chat-scroll">
        {msgs.length === 0 && (
          <div className="chat-empty">
            <div className="e-icon">
              <GraduationCap size={22} />
            </div>
            <h3 style={{ fontSize: 14.5, marginBottom: 4 }}>Your Gemma 4 tutor</h3>
            <p className="muted" style={{ fontSize: 12.5, maxWidth: 300, margin: "0 auto" }}>
              Knows this question, the full working and your current slider values. Ask why, what-if, or for a practice question.
            </p>
            {spec.topic === "projectile" && (
              <button className="btn sm demo-btn" onClick={playDemo}>
                <PlayCircle size={14} /> Demo: similar practice question
              </button>
            )}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role} ${m.error ? "error" : ""}`}>
            <div className="avatar">{m.role === "model" ? <Bot size={14} /> : <User size={14} />}</div>
            <div className="bubble">
              {m.role === "model" ? <RichText text={m.text} /> : m.text}
              {m.practice && !m.error && (
                <button className="btn sm primary" onClick={() => (m.demo ? onDemoPractice() : onAnimate(m.text))}>
                  <Sparkles size={13} /> Solve & animate this
                </button>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="msg model">
            <div className="avatar">
              <Bot size={14} />
            </div>
            <div className="bubble typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="composer">
        <div className="chips">
          {chips.map((c) => (
            <button key={c.label} className="chip" disabled={busy || !online} onClick={() => send(c.q, c.practice)}>
              {c.label}
            </button>
          ))}
        </div>
        <form
          className="composer-box"
          onSubmit={(e) => {
            e.preventDefault();
            send(input, /practice|similar question|another question/i.test(input));
          }}
        >
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input, /practice|similar question|another question/i.test(input));
              }
            }}
            placeholder={online ? "Ask a follow-up…" : "Add GEMINI_API_KEY to chat with Gemma"}
            disabled={!online}
          />
          <button className="btn primary icon sm" disabled={busy || !input.trim() || !online} title="Send">
            <ArrowUp size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
