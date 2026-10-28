import { AlertTriangle, CheckCircle2, Eye, Lightbulb, RotateCcw, ShieldCheck, Trophy } from "lucide-react";
import type { Check } from "../shared/physics";
import { fmt, QUANTITY_INFO } from "../shared/physics";
import type { SceneSpec, SolveMeta } from "../shared/types";
import { Tex } from "./Tex";
import { AttemptCard } from "./AttemptCard";
import type { StepResult } from "./AttemptCard";

interface Props {
  spec: SceneSpec;
  meta: SolveMeta;
  checks: Check[];
  activeIdx: number | null;
  onStep: (idx: number) => void;
  examMode: boolean;
  revealed: number;
  results: Record<number, StepResult>;
  onStepDone: (idx: number, r: StepResult) => void;
  onRestartExam: () => void;
  online: boolean;
  model: string;
}

export function SolutionPanel({ spec, meta, checks, activeIdx, onStep, examMode, revealed, results, onStepDone, onRestartExam, online, model }: Props) {
  const answerChecks = checks.filter((c) => c.partId);
  const checkable = answerChecks.filter((c) => c.status !== "unchecked");
  const verified = answerChecks.filter((c) => c.status === "ok").length;
  const mismatches = checks.filter((c) => c.status === "mismatch").length;
  const state = checkable.length === 0 ? "neutral" : mismatches ? "bad" : "good";
  const total = spec.parts.reduce((a, p) => a + p.steps.length, 0);
  let idx = 0;

  return (
    <div>
      {examMode ? (
        <ScoreCard total={total} revealed={revealed} results={results} onRestart={onRestartExam} />
      ) : (
        <div className={`verify ${state}`}>
          <div className="v-icon">{state === "bad" ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="v-title">
              {state === "neutral" ? "Not auto-checkable" : state === "bad" ? `Engine disagrees on ${mismatches} value${mismatches > 1 ? "s" : ""}` : `${verified}/${checkable.length} answers verified`}
            </div>
            <div className="v-sub">
              {state === "good" ? "Independently re-computed by the physics engine" : state === "bad" ? "Review the flagged working below" : "This question type has no engine model"}
              {" · "}
              {meta.source === "fixture" ? "hand-checked example" : `${meta.model} in ${(meta.ms / 1000).toFixed(1)}s${meta.repaired ? " · self-corrected" : ""}`}
            </div>
            {answerChecks.length > 0 && (
              <div className="v-bar">
                {answerChecks.map((c, i) => (
                  <span key={i} className={c.status === "ok" ? "" : c.status === "mismatch" ? "bad" : "unchecked"} title={`${c.label}: ${c.status}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {spec.parts.map((part) => {
        const check = checks.find((c) => c.partId === part.id);
        const startIdx = idx;
        const lastIdx = startIdx + part.steps.length - 1;
        idx += part.steps.length;
        const partDone = !examMode || revealed > lastIdx;
        const partStarted = !examMode || revealed >= startIdx;
        return (
          <section key={part.id} className={`part ${partStarted ? "" : "locked"}`}>
            <div className="part-head">
              <span className="part-letter">{part.id}</span>
              <div className="part-q">{part.question}</div>
            </div>
            {partStarted ? (
              <ol className="timeline">
                {part.steps.map((s, si) => {
                  const my = startIdx + si;
                  if (examMode && my > revealed) return null;
                  if (examMode && my === revealed)
                    return (
                      <li key={my} className="t-attempt" data-n={si + 1}>
                        <AttemptCard
                          key={`${spec.title}-${my}`}
                          spec={spec}
                          stepIndex={my}
                          step={s}
                          part={part}
                          n={si + 1}
                          isLast={si === part.steps.length - 1}
                          online={online}
                          model={model}
                          onDone={(r) => onStepDone(my, r)}
                        />
                      </li>
                    );
                  const res = results[my];
                  return (
                    <li key={my} data-n={si + 1} data-status={examMode ? res?.status ?? "revealed" : undefined} className={`t-step ${activeIdx === my ? "active" : ""}`} onClick={() => onStep(my)}>
                      <div className="t-text">
                        {s.text}
                        {examMode && res && <StatusChip r={res} />}
                      </div>
                      {s.latex && (
                        <div className="t-math">
                          <Tex src={s.latex} display />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="empty-steps">
                {part.steps.length} step{part.steps.length > 1 ? "s" : ""} · unlocks after part ({spec.parts[spec.parts.indexOf(part) - 1]?.id})
              </div>
            )}
            {partDone && (
              <div className="answer-box">
                <span className="a-label">Answer</span>
                <b>{part.answer.display || `${fmt(part.answer.value)} ${part.answer.unit}`}</b>
                <span className="spacer" />
                {check?.status === "ok" && (
                  <span className="badge ok" title={`Engine: ${fmt(check.engine)} ${QUANTITY_INFO[check.quantity].unit}`}>
                    <CheckCircle2 size={12} /> Verified
                  </span>
                )}
                {check?.status === "mismatch" && (
                  <span className="badge warn">
                    <AlertTriangle size={12} /> Engine: {fmt(check.engine)} {QUANTITY_INFO[check.quantity].unit}
                  </span>
                )}
                {check?.status === "unchecked" && <span className="badge">Not auto-checked</span>}
              </div>
            )}
          </section>
        );
      })}

      {!examMode && checks.some((c) => !c.partId && c.status === "mismatch") && (
        <div className="callout warn">
          {checks
            .filter((c) => !c.partId && c.status === "mismatch")
            .map((c) => `${c.label} = ${c.claimed}, but the model gives ${fmt(c.engine)}`)
            .join(" · ")}
        </div>
      )}
    </div>
  );
}

function StatusChip({ r }: { r: StepResult }) {
  if (r.status === "correct")
    return (
      <span className="badge ok" style={{ marginLeft: 8, height: 19 }}>
        <CheckCircle2 size={11} /> {r.attempts <= 1 ? "first try" : `${r.attempts} tries`}
      </span>
    );
  if (r.status === "hinted")
    return (
      <span className="badge warn" style={{ marginLeft: 8, height: 19 }}>
        <Lightbulb size={11} /> {r.hints} hint{r.hints > 1 ? "s" : ""}
      </span>
    );
  return (
    <span className="badge" style={{ marginLeft: 8, height: 19 }}>
      <Eye size={11} /> revealed
    </span>
  );
}

function ScoreCard({ total, revealed, results, onRestart }: { total: number; revealed: number; results: Record<number, StepResult>; onRestart: () => void }) {
  const vals = Object.values(results);
  const correct = vals.filter((r) => r.status === "correct").length;
  const hinted = vals.filter((r) => r.status === "hinted").length;
  const shown = Math.max(0, revealed - correct - hinted);
  const score = correct + hinted * 0.5;
  const done = revealed >= total;
  const pct = total ? Math.round((score / total) * 100) : 0;
  return (
    <div className={`score-card ${done ? "done" : ""}`}>
      <div className="score-ring" style={{ ["--pct" as string]: `${(score / Math.max(total, 1)) * 360}deg` }}>
        <span>{done ? `${pct}%` : `${revealed}/${total}`}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="v-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {done ? (
            <>
              <Trophy size={14} /> Finished · {fmt(score)} / {total} marks
            </>
          ) : (
            <>Exam mode · {fmt(score)} marks so far</>
          )}
        </div>
        <div className="v-sub">
          {correct} correct · {hinted} hinted · {shown} revealed
        </div>
        <div className="v-bar">
          {Array.from({ length: total }, (_, i) => {
            const r = results[i];
            const cls = i >= revealed ? "unchecked" : !r || r.status === "revealed" ? "revealed" : r.status === "hinted" ? "bad" : "";
            return <span key={i} className={cls} />;
          })}
        </div>
      </div>
      <button className="btn sm ghost icon" title="Restart" onClick={onRestart}>
        <RotateCcw size={14} />
      </button>
    </div>
  );
}
