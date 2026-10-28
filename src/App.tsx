import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, FileText, LineChart, Lock, MessageSquare, Moon, Play, ShieldCheck, SlidersHorizontal, Square, Sun, AlertTriangle } from "lucide-react";
import { health, imageToPayload, solve, urlToPayload } from "./api";
import type { ImagePayload, Settings } from "./api";
import { EXAMPLES, practiceProjectile } from "./fixtures";
import type { Example } from "./fixtures";
import { useHistory } from "./history";
import type { HistoryItem } from "./history";
import { close, focusTime, simulate, verifySpec } from "./shared/physics";
import { OPEN } from "./sceneUtils";
import type { Reveal } from "./sceneUtils";
import type { StepResult } from "./components/AttemptCard";
import type { Highlight, Params, SceneSpec, SolveMeta } from "./shared/types";
import { useClock } from "./useClock";
import { Sidebar } from "./components/Sidebar";
import { Stage } from "./components/Stage";
import { MotionGraph } from "./components/MotionGraph";
import { ExplorePanel } from "./components/ParamControls";
import { SolutionPanel } from "./components/SolutionPanel";
import { QuestionPanel } from "./components/QuestionPanel";
import { AskPanel } from "./components/AskPanel";
import { NewQuestionModal } from "./components/NewQuestionModal";
import { LoadingOverlay, STAGES, Toast } from "./components/Overlays";
import { TopicIcon, TOPIC_NAMES } from "./components/TopicIcon";

// Presentation mode (opt-in with ?demo=1): an uploaded/pasted/dropped screenshot is discarded, the Gemma
// analysis is replayed (~10 s), and the hand-checked projectile question is loaded - so the live demo
// doesn't depend on venue Wi-Fi or a 30-60 s solve. Typed questions still go to Gemma live.
// Without ?demo=1, images are sent to Gemma for real.
const DEMO_UPLOAD = new URLSearchParams(location.search).has("demo");
const DEMO_STAGE_SECONDS = 1.6;

const FIXTURE_META: SolveMeta = { model: "fixture", ms: 0, attempts: 0, repaired: false, source: "fixture" };
const DEFAULT_MODELS = ["gemma-4-31b-it", "gemma-4-26b-a4b-it"];

type DockTab = "explore" | "graph";
type InspTab = "solution" | "question" | "tutor";

export default function App() {
  const [spec, setSpec] = useState<SceneSpec>(EXAMPLES[0].spec);
  const [meta, setMeta] = useState<SolveMeta>(FIXTURE_META);
  const [imageUrl, setImageUrl] = useState<string | undefined>(EXAMPLES[0].image);
  const [activeId, setActiveId] = useState<string | undefined>(EXAMPLES[0].id);
  const [params, setParams] = useState<Params>(EXAMPLES[0].spec.params);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [examMode, setExamMode] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const q = new URLSearchParams(location.search).get("theme");
    if (q === "light" || q === "dark") return q;
    return localStorage.getItem("mech-theme") === "light" ? "light" : "dark";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("mech-theme", theme);
  }, [theme]);
  const [revealed, setRevealed] = useState(0);
  const [stepResults, setStepResults] = useState<Record<number, StepResult>>({});
  const [walking, setWalking] = useState(false);
  const [showVectors, setShowVectors] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [models, setModels] = useState<string[]>(DEFAULT_MODELS);
  const [settings, setSettings] = useState<Settings>({ model: DEFAULT_MODELS[0], thinking: true, verifyLoop: true });
  const [specVersion, setSpecVersion] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [dockTab, setDockTab] = useState<DockTab>("explore");
  const [inspTab, setInspTab] = useState<InspTab>("solution");
  const history = useHistory();

  const sim = useMemo(() => simulate(spec.topic, params, spec.g), [spec, params]);
  const verification = useMemo(() => verifySpec(spec), [spec]);
  const clock = useClock(sim.duration);
  const { restart, playTo, toggle, pause, seek } = clock;
  const flat = useMemo(() => spec.parts.flatMap((p) => p.steps.map((s, i) => ({ ...s, partId: p.id, n: i + 1 }))), [spec]);
  const activeStep = activeIdx !== null ? flat[activeIdx] : undefined;
  const highlight: Highlight = activeStep?.highlight ?? "none";
  const changed = JSON.stringify(params) !== JSON.stringify(spec.params);
  const answerChecks = verification.checks.filter((c) => c.partId && c.status !== "unchecked");
  const examActive = examMode && revealed < flat.length;

  // exam mode: the diagram may only label values that were given or already solved
  const reveal = useMemo<Reveal>(() => {
    if (!examActive) return OPEN;
    const known: number[] = [...spec.givens.map((g) => g.value), spec.g];
    let i = 0;
    for (const p of spec.parts) {
      if (revealed > i + p.steps.length - 1) known.push(p.answer.value);
      i += p.steps.length;
    }
    return { exam: true, known: (v: number) => known.some((k) => close(k, v)) };
  }, [examActive, spec, revealed]);

  const onStepDone = useCallback(
    (idx: number, r: StepResult) => {
      setStepResults((prev) => ({ ...prev, [idx]: r }));
      setRevealed((rv) => Math.max(rv, idx + 1));
      setActiveIdx(idx);
      const ft = focusTime(sim, flat[idx]?.highlight);
      if (ft !== undefined) playTo(ft);
    },
    [sim, flat, playTo]
  );

  const setExam = (v: boolean) => {
    setExamMode(v);
    setRevealed(0);
    setStepResults({});
    setActiveIdx(null);
    setWalking(false);
    setInspTab("solution");
    if (v) setParams(spec.params);
  };

  const loadSpec = useCallback(
    (s: SceneSpec, m: SolveMeta, img: string | undefined, id: string | undefined) => {
      setSpec(s);
      setMeta(m);
      setParams(s.params);
      setImageUrl(img);
      setActiveId(id);
      setActiveIdx(null);
      setRevealed(0);
      setStepResults({});
      setWalking(false);
      setError(null);
      setSpecVersion((v) => v + 1);
      restart();
    },
    [restart]
  );

  // health + deep links (?ex=pulley-table&t=1.2&step=3&params={...})
  useEffect(() => {
    health().then((h) => {
      setOnline(!!h?.hasKey);
      if (h?.models?.length) {
        setModels(h.models);
        setSettings((s) => ({ ...s, model: h.model || h.models[0] }));
      }
    });
    const q = new URLSearchParams(location.search);
    const ex = EXAMPLES.find((e) => e.id === q.get("ex"));
    if (ex) loadSpec(ex.spec, FIXTURE_META, ex.image, ex.id);
    const tab = q.get("tab");
    if (tab === "question" || tab === "tutor" || tab === "solution") setInspTab(tab);
    if (q.get("dock") === "graph") setDockTab("graph");
    if (q.get("modal")) setModalOpen(true);
    if (q.get("fakeupload")) {
      // replays the demo upload with the bundled screenshot (backup trigger for the presentation)
      fetch("/examples/q5-projectile.png")
        .then((r) => r.blob())
        .then((b) => runDemoUploadRef.current(b));
    }
    setTimeout(() => {
      try {
        const override = q.get("params");
        if (override) setParams({ ...(ex ?? EXAMPLES[0]).spec.params, ...JSON.parse(override) });
      } catch {
        /* ignore */
      }
      if (q.get("exam")) {
        // ?exam=1&solved=N - exam mode with the first N steps already answered (for demos/screenshots)
        const solved = parseInt(q.get("solved") ?? "0", 10) || 0;
        setExamMode(true);
        setRevealed(solved);
        setStepResults(Object.fromEntries(Array.from({ length: solved }, (_, i) => [i, { status: i % 3 === 1 ? "hinted" : "correct", attempts: 1, hints: i % 3 === 1 ? 1 : 0 }])));
        setInspTab("solution");
      }
      const step = parseInt(q.get("step") ?? "", 10);
      if (Number.isFinite(step)) setActiveIdx(step);
      const t = parseFloat(q.get("t") ?? "");
      if (Number.isFinite(t)) {
        pause();
        seek(t);
      }
    }, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activate = useCallback(
    (idx: number) => {
      setActiveIdx(idx);
      setInspTab("solution");
      const ft = focusTime(sim, flat[idx]?.highlight);
      if (ft !== undefined) playTo(ft);
    },
    [flat, sim, playTo]
  );

  // walkthrough
  useEffect(() => {
    if (!walking) return;
    const next = activeIdx === null ? 0 : activeIdx + 1;
    if (next >= flat.length) {
      setWalking(false);
      return;
    }
    const id = setTimeout(
      () => {
        activate(next);
        if (examMode) setRevealed((r) => Math.max(r, next + 1));
      },
      activeIdx === null ? 50 : 4200
    );
    return () => clearTimeout(id);
  }, [walking, activeIdx, flat.length, activate, examMode]);

  // loading ticker
  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    setStage(0);
    setElapsed(0);
    const id = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setElapsed(s);
      setStage(Math.min(STAGES.length - 1, Math.floor(s / (fakeRef.current ? DEMO_STAGE_SECONDS : 6))));
    }, 200);
    return () => clearInterval(id);
  }, [busy]);

  const runSolve = useCallback(
    async (input: { image?: ImagePayload; text?: string }) => {
      setModalOpen(false);
      setBusy(true);
      setError(null);
      setPreview(input.image?.dataUrl);
      try {
        const r = await solve(input, settings);
        const id = history.add(r.spec, r.meta, input.image?.dataUrl);
        loadSpec(r.spec, r.meta, input.image?.dataUrl, id);
        setInspTab("solution");
      } catch (e) {
        setError(String((e as Error).message));
      } finally {
        setBusy(false);
      }
    },
    [settings, history, loadSpec]
  );

  const fakeRef = useRef(false);
  const runDemoUpload = useCallback(
    async (f: Blob) => {
      setModalOpen(false);
      fakeRef.current = true;
      setPreview(URL.createObjectURL(f)); // shown while "Gemma reads it", then discarded
      setError(null);
      setBusy(true);
      const ms = Math.round((STAGES.length * DEMO_STAGE_SECONDS + 0.6) * 1000);
      await new Promise((r) => setTimeout(r, ms));
      const ex = EXAMPLES.find((e) => e.id === "q5-projectile") ?? EXAMPLES[0];
      const meta: SolveMeta = { model: settings.model, ms, attempts: 1, repaired: false, source: "gemma" };
      const id = history.add(ex.spec, meta, ex.image);
      loadSpec(ex.spec, meta, ex.image, id);
      setInspTab("solution");
      setBusy(false);
      fakeRef.current = false;
    },
    [settings.model, history, loadSpec]
  );

  const runDemoUploadRef = useRef(runDemoUpload);
  runDemoUploadRef.current = runDemoUpload;

  const onFile = useCallback(
    async (f: Blob) => {
      if (busy) return;
      if (DEMO_UPLOAD && f.type.startsWith("image/")) return runDemoUpload(f);
      if (!online) {
        setError("Live solving needs a GEMINI_API_KEY in .env - library examples work offline.");
        return;
      }
      try {
        await runSolve({ image: await imageToPayload(f) });
      } catch (e) {
        setError(String((e as Error).message));
      }
    },
    [busy, online, runSolve, runDemoUpload]
  );
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;

  // global: paste screenshot, keyboard shortcuts
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (f) {
        e.preventDefault();
        onFileRef.current(f);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || modalOpen) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setModalOpen(true);
      } else if (e.key === "ArrowRight") {
        const limit = examMode ? revealed - 1 : flat.length - 1;
        const n = Math.min(limit, (activeIdx ?? -1) + 1);
        if (n >= 0) activate(n);
      } else if (e.key === "ArrowLeft" && activeIdx !== null) activate(Math.max(0, activeIdx - 1));
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKey);
    };
  }, [toggle, flat.length, activeIdx, activate, examMode, modalOpen, revealed]);

  const onExampleLive = async (ex: Example) => {
    if (ex.image) await runSolve({ image: await urlToPayload(ex.image) });
    else await runSolve({ text: ex.spec.questionText });
  };

  const onResolve = () => {
    const changes = Object.entries(params)
      .filter(([k, v]) => JSON.stringify(v) !== JSON.stringify((spec.params as Record<string, unknown>)[k]))
      .map(([k, v]) => `${k} = ${v}`)
      .join(", ");
    runSolve({
      text: `${spec.questionText}\n\nWHAT-IF VERSION: keep the same situation and parts, but use these modified values instead of the original ones (parameter names refer to the animation model): ${changes}. Rewrite the question text with the new numbers, then solve every part.`,
    });
  };

  const verifyBadge =
    answerChecks.length === 0 ? null : verification.mismatches ? (
      <span className="badge warn">
        <AlertTriangle size={12} /> {verification.mismatches} to review
      </span>
    ) : (
      <span className="badge ok">
        <ShieldCheck size={12} /> {answerChecks.length}/{answerChecks.length} verified
      </span>
    );

  return (
    <div className="shell">
      <Sidebar
        examples={EXAMPLES}
        history={history.items}
        activeId={activeId}
        onNew={() => setModalOpen(true)}
        onExample={(ex) => loadSpec(ex.spec, FIXTURE_META, ex.image, ex.id)}
        onHistory={(h: HistoryItem) => loadSpec(h.spec, h.meta, h.image, h.id)}
        onRemoveHistory={history.remove}
        online={online}
        settings={settings}
        setSettings={setSettings}
        models={models}
      />

      <main className="main">
        <header className="topbar">
          <span className="sb-icon" style={{ width: 32, height: 32, borderRadius: 9 }}>
            <TopicIcon topic={spec.topic} size={16} />
          </span>
          <div className="tb-title">
            <h1>{spec.title || "Mechanics question"}</h1>
            <div className="tb-meta">
              <span>{TOPIC_NAMES[spec.topic]}</span>
              <span>·</span>
              <span>
                {spec.parts.length} part{spec.parts.length === 1 ? "" : "s"}
              </span>
              <span>·</span>
              <span>{meta.source === "fixture" ? "Library example" : `Solved by ${meta.model}`}</span>
            </div>
          </div>
          {verifyBadge}
          <span className="spacer" />
          <button
            className="btn ghost icon theme-toggle"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle colour theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <label className="switch">
            <input type="checkbox" checked={showVectors} onChange={(e) => setShowVectors(e.target.checked)} />
            <span className="track" /> Vectors
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={examMode}
              onChange={(e) => setExam(e.target.checked)}
            />
            <span className="track" /> Exam mode
          </label>
          <span className="divider-v" />
          <button
            className={`btn ${walking ? "" : "primary"}`}
            disabled={examMode}
            title={examMode ? "Walkthrough is off in exam mode - solve each step yourself" : "Auto-play every step with the animation"}
            onClick={() => {
              if (walking) setWalking(false);
              else {
                setActiveIdx(null);
                setInspTab("solution");
                setWalking(true);
              }
            }}
          >
            {walking ? <Square size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
            {walking ? "Stop walkthrough" : "Walkthrough"}
          </button>
        </header>

        <div className="workspace">
          <Stage spec={spec} sim={sim} clock={clock} highlight={highlight} showVectors={showVectors} reveal={reveal} caption={activeStep ? { n: `${activeStep.partId}${activeStep.n}`, text: activeStep.text } : undefined} />

          <div className="panel dock">
            <div className="tabs">
              <button className={`tab ${dockTab === "explore" ? "active" : ""}`} onClick={() => setDockTab("explore")}>
                <SlidersHorizontal size={14} /> Explore values
                {changed && <span className="count">edited</span>}
              </button>
              <button className={`tab ${dockTab === "graph" ? "active" : ""}`} onClick={() => setDockTab("graph")}>
                <LineChart size={14} /> Motion graph
              </button>
            </div>
            <div className="tab-body">
              {examActive ? (
                <div className="locked-dock">
                  <div>
                    <div className="l-icon">
                      <Lock size={18} />
                    </div>
                    <div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>Hidden in exam mode</div>
                    <div style={{ maxWidth: 380, fontSize: 12.5 }}>Live results, sliders and graphs would give the answers away. Finish every part (or turn exam mode off) to unlock them.</div>
                  </div>
                </div>
              ) : dockTab === "explore" ? (
                <ExplorePanel
                  spec={spec}
                  sim={sim}
                  params={params}
                  setParams={setParams}
                  changed={changed}
                  onReset={() => setParams(spec.params)}
                  onResolve={onResolve}
                  busy={busy}
                  online={online}
                  checks={verification.checks}
                />
              ) : (
                <MotionGraph
                  sim={sim}
                  t={clock.t}
                  labels={spec.labels}
                  onSeek={(t) => {
                    pause();
                    seek(t);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      <aside className="inspector">
        <div className="tabs">
          <button className={`tab ${inspTab === "solution" ? "active" : ""}`} onClick={() => setInspTab("solution")}>
            <BookOpen size={14} /> Solution
          </button>
          <button className={`tab ${inspTab === "question" ? "active" : ""}`} onClick={() => setInspTab("question")}>
            <FileText size={14} /> Question
          </button>
          <button className={`tab ${inspTab === "tutor" ? "active" : ""}`} onClick={() => setInspTab("tutor")}>
            <MessageSquare size={14} /> Tutor
          </button>
        </div>
        {inspTab === "tutor" ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <AskPanel
              key={`a${specVersion}`}
              spec={spec}
              params={params}
              derived={sim.derived}
              model={settings.model}
              activeStepText={activeStep?.text}
              onAnimate={(q) => runSolve({ text: q })}
              onDemoPractice={() => {
                loadSpec(practiceProjectile, FIXTURE_META, undefined, "practice-demo");
                setInspTab("solution");
              }}
              online={online}
            />
          </div>
        ) : (
          <div className="insp-body">
            {inspTab === "solution" ? (
              <SolutionPanel
                spec={spec}
                meta={meta}
                checks={verification.checks}
                activeIdx={activeIdx}
                onStep={activate}
                examMode={examMode}
                revealed={revealed}
                results={stepResults}
                onStepDone={onStepDone}
                onRestartExam={() => setExam(true)}
                online={online}
                model={settings.model}
              />
            ) : (
              <QuestionPanel key={`q${specVersion}`} spec={spec} imageUrl={imageUrl} />
            )}
          </div>
        )}
      </aside>

      <NewQuestionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onFile={onFile}
        onText={(t) => runSolve({ text: t })}
        examples={EXAMPLES}
        onExampleLive={onExampleLive}
        online={online}
        model={settings.model}
      />
      {busy && <LoadingOverlay stage={stage} elapsed={elapsed} model={settings.model} thinking={settings.thinking} preview={preview} stageSeconds={fakeRef.current ? DEMO_STAGE_SECONDS : 6} />}
      {error && <Toast message={error} onClose={() => setError(null)} />}
    </div>
  );
}
