import { useRef, useState } from "react";
import { Check, CheckCircle2, Eye, Lightbulb, Loader2, Sparkles, XCircle, AlertCircle } from "lucide-react";
import { checkStep } from "../api";
import { expectedValue, localCheck, skeleton } from "../examCheck";
import type { Part, SceneSpec, Step } from "../shared/types";
import { RichText, Tex } from "./Tex";

export type StepStatus = "correct" | "hinted" | "revealed";
export interface StepResult {
  status: StepStatus;
  attempts: number;
  hints: number;
}

interface Props {
  spec: SceneSpec;
  stepIndex: number;
  step: Step;
  part: Part;
  n: number;
  isLast: boolean;
  online: boolean;
  model: string;
  onDone: (r: StepResult) => void;
}

type Status = "idle" | "checking" | "correct" | "partial" | "incorrect" | "self";

export function AttemptCard({ spec, stepIndex, step, part, n, isLast, online, model, onDone }: Props) {
  const [attempt, setAttempt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [feedback, setFeedback] = useState<string | undefined>();
  const [attempts, setAttempts] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [gemmaHint, setGemmaHint] = useState<string | undefined>();
  const [hintLoading, setHintLoading] = useState(false);
  const [explaining, setExplaining] = useState(false); // local check already said "wrong"; Gemma is finding out why
  const reqId = useRef(0); // ignore Gemma replies about an attempt the student has since edited
  const skel = skeleton(step);
  const maxHints = online ? 3 : skel ? 2 : 1;

  const finish = (s: StepStatus, delay: number, tries = attempts) => setTimeout(() => onDone({ status: s, attempts: tries, hints: hintLevel }), delay);

  async function check() {
    if (!attempt.trim() || status === "checking") return;
    const tries = attempts + 1;
    setAttempts(tries);
    const lv = localCheck(attempt, expectedValue(step, part, isLast));
    if (lv === "correct") {
      setStatus("correct");
      setFeedback("Your value matches the mark scheme.");
      finish(hintLevel > 0 ? "hinted" : "correct", 1300, tries);
      return;
    }
    if (!online) {
      if (lv === "incorrect") {
        setStatus("incorrect");
        setFeedback("That doesn't match the expected value - re-check your working, or take a hint.");
      } else setStatus("self");
      return;
    }
    const id = ++reqId.current;
    if (lv === "incorrect") {
      // instant answer from the local checker; Gemma's diagnosis streams in after
      setStatus("incorrect");
      setFeedback("That value doesn't match the mark scheme.");
      setGemmaHint(undefined);
      setExplaining(true);
    } else {
      setStatus("checking");
      setFeedback(undefined);
    }
    try {
      const r = await checkStep({ spec, stepIndex, attempt, mode: "check", hintsUsed: hintLevel, model });
      if (id !== reqId.current) return;
      let verdict = r.verdict ?? "incorrect";
      if (lv === "incorrect" && verdict === "correct") verdict = "partial"; // method ok, number off
      setFeedback(r.feedback);
      if (r.hint) setGemmaHint(r.hint);
      setStatus(verdict);
      if (verdict === "correct") finish(hintLevel > 0 ? "hinted" : "correct", 2200, tries);
    } catch (e) {
      if (id !== reqId.current) return;
      setStatus(lv === "incorrect" ? "incorrect" : "self");
      setFeedback(lv === "incorrect" ? "That doesn't match the expected value." : `Couldn't reach Gemma (${String((e as Error).message).slice(0, 60)}) - compare with the mark scheme below.`);
    } finally {
      if (id === reqId.current) setExplaining(false);
    }
  }

  async function hint() {
    if (hintLevel >= maxHints) return;
    const next = hintLevel === 1 && !skel ? 3 : hintLevel + 1;
    setHintLevel(next);
    if (next === 3 && online) {
      setHintLoading(true);
      try {
        const r = await checkStep({ spec, stepIndex, attempt, mode: "hint", hintsUsed: hintLevel, model });
        setGemmaHint(r.hint ?? "Think about which equation links the quantities you know to the one you want.");
      } catch {
        setGemmaHint("Gemma is unavailable - try the method and equation hints above.");
      } finally {
        setHintLoading(false);
      }
    }
  }

  return (
    <div className={`attempt ${status}`}>
      <div className="attempt-head">
        <span className="step-no">
          {part.id}
          {n}
        </span>
        <span style={{ fontWeight: 600 }}>Your turn - work out the next step</span>
        <span className="spacer" />
        {attempts > 0 && (
          <span className="faint" style={{ fontSize: 11.5 }}>
            {attempts} attempt{attempts > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {hintLevel >= 1 && (
        <div className="hint">
          <Lightbulb size={14} />
          <div>
            <div className="hint-label">Hint 1 · Method</div>
            {step.text}
          </div>
        </div>
      )}
      {hintLevel >= 2 && skel && (
        <div className="hint">
          <Lightbulb size={14} />
          <div style={{ minWidth: 0 }}>
            <div className="hint-label">Hint 2 · Equation</div>
            <div className="t-math">
              <Tex src={skel} display />
            </div>
          </div>
        </div>
      )}
      {hintLevel >= 3 && (
        <div className="hint gemma">
          <Sparkles size={14} />
          <div>
            <div className="hint-label">Hint 3 · Gemma, based on your attempt</div>
            {hintLoading ? <span className="faint">Gemma is thinking…</span> : gemmaHint && <RichText text={gemmaHint} />}
          </div>
        </div>
      )}

      <textarea
        className="textarea attempt-input"
        rows={2}
        value={attempt}
        disabled={status === "correct" || status === "checking"}
        placeholder={isLast ? `Your answer for (${part.id}), e.g. ${part.answer.unit ? `… ${part.answer.unit}` : "a value"}` : "Type your working or the value you get, e.g. t = 3.19 s"}
        onChange={(e) => {
          setAttempt(e.target.value);
          if (status === "incorrect" || status === "partial") {
            reqId.current++;
            setExplaining(false);
            setStatus("idle");
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            check();
          }
        }}
      />

      {status === "checking" && (
        <div className="feedback neutral">
          <Loader2 size={14} className="spin" /> Gemma is marking your working…
        </div>
      )}
      {status === "correct" && (
        <div className="feedback ok">
          <CheckCircle2 size={15} />
          <div>
            <b>Correct!</b> {feedback && <RichText text={feedback} />}
          </div>
        </div>
      )}
      {(status === "incorrect" || status === "partial") && (
        <div className={`feedback ${status === "partial" ? "warn" : "bad"}`}>
          {status === "partial" ? <AlertCircle size={15} /> : <XCircle size={15} />}
          <div>
            <b>{status === "partial" ? "Nearly there." : "Not quite."}</b> {feedback && <RichText text={feedback} />}
            {explaining && (
              <div className="faint" style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                <Loader2 size={12} className="spin" /> Gemma is finding where it went wrong…
              </div>
            )}
            {gemmaHint && hintLevel < 3 && (
              <div className="faint" style={{ marginTop: 4 }}>
                <RichText text={`Nudge: ${gemmaHint}`} />
              </div>
            )}
          </div>
        </div>
      )}
      {status === "self" && (
        <div className="feedback neutral" style={{ display: "block" }}>
          <div style={{ marginBottom: 4 }}>{feedback ?? "This step can't be auto-checked offline. Compare with the mark scheme:"}</div>
          <div className="t-math">
            <Tex src={step.latex ?? step.text} display />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm primary" onClick={() => onDone({ status: hintLevel > 0 ? "hinted" : "correct", attempts, hints: hintLevel })}>
              <Check size={13} /> I got this
            </button>
            <button className="btn sm" onClick={() => onDone({ status: "revealed", attempts, hints: hintLevel })}>
              I didn't
            </button>
          </div>
        </div>
      )}

      {status !== "correct" && status !== "self" && (
        <div className="attempt-actions">
          <button className="btn sm primary" onClick={check} disabled={!attempt.trim() || status === "checking" || explaining}>
            <Check size={13} /> Check
          </button>
          <button className="btn sm" onClick={hint} disabled={hintLevel >= maxHints || hintLoading}>
            <Lightbulb size={13} /> Hint {hintLevel < maxHints ? `(${maxHints - hintLevel} left)` : ""}
          </button>
          <span className="spacer" />
          <button className="btn sm ghost" onClick={() => onDone({ status: "revealed", attempts, hints: hintLevel })}>
            <Eye size={13} /> Reveal step
          </button>
        </div>
      )}
    </div>
  );
}
