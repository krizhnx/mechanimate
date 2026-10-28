// Gemma 4 (via the Gemini API) - reads mechanics questions from images/text,
// solves them and returns a structured scene via native function calling.
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { Part as GPart, Content } from "@google/genai";
import { BUILD_SCENE, parseSpec } from "./schema";
import { verifySpec, fmt, QUANTITY_INFO } from "../src/shared/physics";
import type { SceneSpec, SolveResponse } from "../src/shared/types";

export const MODELS = ["gemma-4-31b-it", "gemma-4-26b-a4b-it"];
export const DEFAULT_MODEL = process.env.GEMMA_MODEL || MODELS[0];

let client: GoogleGenAI | null = null;
function ai() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY. Copy .env.example to .env and add your Google AI Studio key.");
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

export const SYSTEM_PROMPT = `You are Mechanimate, an expert A-level Mathematics (Mechanics) examiner and tutor (Edexcel, AQA, OCR).
You receive an exam question as an image and/or text. You must:

1. TRANSCRIBE the question faithfully into questionText (all parts). Read values from BOTH the text and the diagram.
2. CLASSIFY it into one animation template (topic):
   - "projectile": particle projected with speed U at angle θ (negative = below horizontal) from height H above the landing level (0 if from ground). Also use for vertical motion under gravity (angle 90) and horizontal projection (angle 0).
   - "forces_line": straight-line motion with constant acceleration (SUVAT), optionally with driving force and resistance (F = ma). Cars, trains, cyclists, particles on horizontal ground.
   - "pulley": two particles joined by a light inextensible string over a smooth pulley. pulleyMode "table" (m1 on a horizontal table, m2 hangs), "hanging" (both hang; m2 is the heavier, descending particle), "incline" (m1 on a slope at angleDeg, m2 hangs).
   - "incline": single particle on an inclined plane at angleDeg, possibly rough (mu), possibly pulled by a force parallel to the slope (pullForce), possibly projected up the slope with speed u.
   - "other": anything that doesn't fit - still solve it fully.
3. SOLVE every part like a perfect mark scheme. One idea per step. Each step: a short plain-English "text" explaining WHY, and one KaTeX "latex" equation (no $ signs). Keep exact values (surds, fractions) through the working; round final answers sensibly (3 s.f., or 2 s.f. if g = 9.8 was used and the answer is not exact).
4. Fill "params" with the FULLY SOLVED values needed to animate the physical situation (e.g. if H was unknown, put your solved H). SI units, angles in DEGREES (e.g. tan θ = 1/2 -> angleDeg = 26.565).
5. For each step choose the "highlight" that matches what it is about (components, horizontal, vertical, time, max_height, landing, forces, resultant, velocity, acceleration, weights, tension, friction, normal, string, system, after_impact).
6. Tag each answer with the engine "quantity" it represents so a physics engine can verify it:
   projectile: launchHeight, maxHeight (greatest height above the GROUND/landing level), maxHeightAboveLaunch, timeOfFlight, range, impactSpeed, impactAngle (degrees below horizontal), timeToMaxHeight, horizontalVelocity, initialVerticalVelocity.
   forces_line: acceleration, finalSpeed (speed at the end of 'duration'), distance (displacement during 'duration'), drivingForce, resistance, resultantForce, timeToRest, distanceToRest.
   pulley: acceleration, tension, frictionForce, normalReaction (on m1), timeToHit, speedAtHit, furtherDistance (extra distance the other particle moves after the hanging one hits the ground, until rest / greatest height), forceOnPulley.
   incline: normalReaction, frictionForce, acceleration (initial), finalSpeed, distance, timeToRest, distanceToRest, coefficientOfFriction.
   Use "other" when nothing fits exactly. Answer values are magnitudes.
Conventions: g = 9.8 m s^-2 unless stated. Particles, light strings, smooth pulleys unless stated.
Return the complete result exactly once - as the build_scene function call, or as the equivalent single JSON object when asked for JSON.`;

export const JSON_FALLBACK = `\n\nIMPORTANT: Respond ONLY with a single JSON object (no prose) matching this JSON schema for build_scene:\n${JSON.stringify(
  BUILD_SCENE.parameters
)}`;

function userPrompt(text: string | undefined, hasImage: boolean) {
  const parts: string[] = [];
  if (hasImage) parts.push("The image above is an A-level Mechanics exam question.");
  if (text?.trim()) parts.push(`${hasImage ? "Additional instructions / question text" : "Question"}:\n${text.trim()}`);
  parts.push("Read it carefully (text and diagram), solve every part, and call build_scene.");
  return parts.join("\n\n");
}

// Models often write LaTeX inside JSON strings with single backslashes: "\frac" parses as a
// form-feed + "rac", "\sqrt" throws. Double any lone backslash that starts a LaTeX command
// (2+ letters, or a non-JSON-escape char) before parsing. Valid "\\frac" is left untouched.
// \b \f \n \r \t are valid JSON escapes, so only treat them as LaTeX when a known command follows.
const LATEX_ON_JSON_ESCAPE =
  "b(?:eta|ar|f|oxed|egin|ig|inom|ot|ullet)|f(?:rac|orall)|n(?:abla|eq|e\\b|u\\b|ot|eg|ewline)|r(?:ho|ight|angle|m\\b)|t(?:heta|an|imes|ext|frac|o\\b|au|ilde|riangle|op)";
const LATEX_FIX = new RegExp(`(?<!\\\\)((?:\\\\\\\\)*)\\\\(?=${LATEX_ON_JSON_ESCAPE}|[^"\\\\/bfnrtu]|u(?![0-9a-fA-F]{4}))`, "g");
export function repairLatexEscapes(s: string): string {
  return s.replace(LATEX_FIX, (_m, pre: string) => `${pre}\\\\`);
}

export function extractJson(text: string): unknown | undefined {
  if (!text) return undefined;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = [fence?.[1], text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)].filter(Boolean) as string[];
  const candidates = raw.flatMap((c) => [repairLatexEscapes(c), c]);
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* try next */
    }
  }
  return undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const RETRYABLE = /429|503|500|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|INTERNAL|deadline/i;

/** Call Gemma with retry; if the chosen model is overloaded, fall back to the other Gemma 4 model. */
async function generate(model: string, contents: Content[], config: Record<string, unknown>) {
  const alt = MODELS.find((m) => m !== model) ?? model;
  const plan = [model, model, alt];
  let lastErr: unknown;
  for (let i = 0; i < plan.length; i++) {
    try {
      const res = await ai().models.generateContent({ model: plan[i], contents, config });
      if (plan[i] !== model) console.warn(`[gemma] ${model} unavailable - answered by ${plan[i]}`);
      return res;
    } catch (e: unknown) {
      lastErr = e;
      const msg = String((e as Error)?.message ?? e);
      if (RETRYABLE.test(msg) && i < plan.length - 1) {
        console.warn(`[gemma] ${plan[i]} error (${msg.slice(0, 80)}), retrying…`);
        await sleep(1200);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

interface RawResult {
  raw: unknown;
  via: "function" | "json";
}

async function askForScene(model: string, parts: GPart[], thinking: boolean): Promise<RawResult> {
  const base = {
    systemInstruction: SYSTEM_PROMPT,
    thinkingConfig: { thinkingLevel: thinking ? ThinkingLevel.HIGH : ThinkingLevel.MINIMAL },
  };
  // 1) schema-guided JSON (fastest + most reliable for Gemma on the Gemini API)
  try {
    const res = await generate(model, [{ role: "user", parts: [...parts, { text: JSON_FALLBACK }] }], base);
    const j = extractJson(res.text ?? "");
    if (j) return { raw: j, via: "json" };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (/API key|PERMISSION|401|403/i.test(msg)) throw e;
    console.warn("[gemma] JSON attempt failed, trying native function calling:", msg.slice(0, 160));
  }
  // 2) native function calling fallback
  const res = await generate(model, [{ role: "user", parts }], { ...base, tools: [{ functionDeclarations: [BUILD_SCENE] }] });
  const fc = res.functionCalls?.find((f) => f.name === "build_scene") ?? res.functionCalls?.[0];
  if (fc?.args) return { raw: fc.args, via: "function" };
  const j = extractJson(res.text ?? "");
  if (!j) throw new Error("Gemma did not return a structured scene. Try again or switch model.");
  return { raw: j, via: "json" };
}

export interface SolveInput {
  imageBase64?: string;
  mimeType?: string;
  text?: string;
  model?: string;
  thinking?: boolean;
  verifyLoop?: boolean;
}

export async function solveQuestion(input: SolveInput): Promise<SolveResponse> {
  const t0 = Date.now();
  const model = input.model && MODELS.includes(input.model) ? input.model : DEFAULT_MODEL;
  const thinking = input.thinking !== false;
  const notes: string[] = [];
  if (!input.imageBase64 && !input.text?.trim()) throw new Error("Send an image or some question text.");

  const parts: GPart[] = [];
  if (input.imageBase64) parts.push({ inlineData: { mimeType: input.mimeType || "image/png", data: input.imageBase64 } });
  parts.push({ text: userPrompt(input.text, !!input.imageBase64) });

  let attempts = 0;
  let spec: SceneSpec | undefined;
  let lastError = "";

  // attempt + schema-repair
  for (let i = 0; i < 2 && !spec; i++) {
    attempts++;
    const p = i === 0 ? parts : [...parts, { text: `Your previous output failed validation: ${lastError}. Call build_scene again with a complete, valid result.` }];
    const { raw, via } = await askForScene(model, p, thinking);
    const parsed = parseSpec(raw);
    if (parsed.spec) {
      spec = parsed.spec;
      notes.push(`Structured output via ${via === "function" ? "native function calling" : "JSON mode"}.`);
    } else lastError = parsed.error ?? "unknown";
  }
  if (!spec) throw new Error(`Gemma's output failed validation: ${lastError}`);

  // verify-and-repair loop: the physics engine checks Gemma's answers
  let repaired = false;
  const v1 = verifySpec(spec);
  if (input.verifyLoop !== false && v1.mismatches > 0) {
    const report = v1.checks
      .filter((c) => c.status === "mismatch")
      .map((c) => `- ${c.label} (${QUANTITY_INFO[c.quantity].label}): you said ${c.claimed}, but simulating YOUR params gives ${fmt(c.engine)}`)
      .join("\n");
    notes.push(`Physics engine flagged ${v1.mismatches} inconsistency(ies); asked Gemma to self-correct.`);
    try {
      attempts++;
      const fix = [
        ...parts,
        {
          text: `You previously returned this scene:\n${JSON.stringify(spec)}\n\nAn exact physics engine simulated your params and found:\n${report}\n\nEither your params or your answers/quantity tags are wrong. Re-check the working carefully (including which quantity each answer really is) and call build_scene again with a corrected, consistent result.`,
        },
      ];
      const { raw } = await askForScene(model, fix, thinking);
      const parsed = parseSpec(raw);
      if (parsed.spec) {
        const v2 = verifySpec(parsed.spec);
        if (v2.mismatches < v1.mismatches) {
          spec = parsed.spec;
          repaired = true;
          notes.push(`Self-correction reduced mismatches ${v1.mismatches} → ${v2.mismatches}.`);
        } else notes.push("Self-correction did not improve consistency; kept the first answer.");
      }
    } catch (e) {
      notes.push(`Self-correction failed: ${String((e as Error).message).slice(0, 120)}`);
    }
  }

  return { spec, meta: { model, ms: Date.now() - t0, attempts, repaired, source: "gemma", notes } };
}

// ---------------- tutor chat ----------------
const TUTOR_PROMPT = `You are Mechanimate's friendly A-level Mechanics tutor, powered by Gemma 4.
You are helping a student with the question in the CONTEXT block (transcription, solved working, and the current simulation values).
- Be concise (under 150 words) unless asked for a practice question or full explanation.
- Write maths with LaTeX inside $...$ (inline) or $$...$$ (display).
- Encourage understanding: explain the physics idea, common mistakes, and mark-scheme tips.
- If the student changed the simulation values, use those values.
- If asked for a similar/practice question, write ONE complete exam-style question with numbers and lettered parts, and do NOT include the solution.`;

export interface AskInput {
  spec: SceneSpec;
  question: string;
  history?: { role: "user" | "model"; text: string }[];
  currentParams?: Record<string, unknown>;
  derived?: Record<string, unknown>;
  model?: string;
  thinking?: boolean;
}

export async function askTutor(input: AskInput) {
  const t0 = Date.now();
  const model = input.model && MODELS.includes(input.model) ? input.model : DEFAULT_MODEL;
  const context = {
    questionText: input.spec.questionText,
    topic: input.spec.topic,
    parts: input.spec.parts.map((p) => ({ id: p.id, question: p.question, steps: p.steps.map((s) => `${s.text} ${s.latex ?? ""}`), answer: p.answer.display ?? p.answer.value })),
    originalParams: input.spec.params,
    currentSimulationParams: input.currentParams,
    currentSimulationResults: input.derived,
  };
  const contents: Content[] = [
    { role: "user", parts: [{ text: `CONTEXT:\n${JSON.stringify(context)}` }] },
    { role: "model", parts: [{ text: "Got it - I have the question, the worked solution and the simulation values." }] },
    ...(input.history ?? []).slice(-8).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: "user", parts: [{ text: input.question }] },
  ];
  const res = await generate(model, contents, {
    systemInstruction: TUTOR_PROMPT,
    thinkingConfig: { thinkingLevel: input.thinking ? ThinkingLevel.HIGH : ThinkingLevel.MINIMAL },
  });
  return { text: (res.text ?? "").trim() || "(no answer)", model, ms: Date.now() - t0 };
}

// ---------------- step marking + hints (exam mode) ----------------
const MARKER_PROMPT = `You are a supportive but precise A-level Mechanics examiner marking ONE step of a student's working.
You are given the question, the official working so far, the official version of THIS step, and the student's attempt.
Judge whether the attempt achieves what this step achieves (equivalent equations, rearrangements, correct numbers to sensible accuracy, or a correct alternative method all count).
Respond ONLY with a JSON object, no prose:
{"verdict":"correct"|"partial"|"incorrect","feedback":"max 45 words: first what they did right, then exactly what is wrong or missing (e.g. sign, wrong component, unit, rounding). Never state the final number of this step.","hint":"max 30 words: a nudge towards the next move without giving the answer away"}
Use $...$ for maths.`;

const HINT_PROMPT = `You are a supportive A-level Mechanics tutor. The student is stuck on ONE step of a question.
Give a single short, personalised hint (max 35 words) that moves them forward WITHOUT revealing the result of the step. If they wrote an attempt, address their specific misconception.
Respond ONLY with JSON: {"hint":"..."}. Use $...$ for maths.`;

export interface CheckInput {
  spec: SceneSpec;
  stepIndex: number; // index into the flattened steps
  attempt?: string;
  mode: "check" | "hint";
  hintsUsed?: number;
  model?: string;
}

export async function checkStep(input: CheckInput) {
  const t0 = Date.now();
  const model = input.model && MODELS.includes(input.model) ? input.model : DEFAULT_MODEL;
  const flat = input.spec.parts.flatMap((p) => p.steps.map((s, i) => ({ ...s, part: p, n: i + 1 })));
  const step = flat[input.stepIndex];
  if (!step) throw new Error("Unknown step");
  const before = flat.slice(0, input.stepIndex).map((s) => `(${s.part.id}${s.n}) ${s.text} ${s.latex ?? ""}`);
  const context = [
    `QUESTION:\n${input.spec.questionText}`,
    `CURRENT PART (${step.part.id}): ${step.part.question}`,
    `OFFICIAL WORKING SO FAR:\n${before.join("\n") || "(none - this is the first step)"}`,
    `OFFICIAL THIS STEP (${step.part.id}${step.n}) - SECRET, do not reveal its result: ${step.text} | ${step.latex ?? ""}`,
    step.n === step.part.steps.length ? `This is the last step of the part; official final answer: ${step.part.answer.display ?? step.part.answer.value}` : "",
    `STUDENT ATTEMPT:\n${input.attempt?.trim() || "(nothing written yet)"}`,
    `Hints already used: ${input.hintsUsed ?? 0}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await generate(model, [{ role: "user", parts: [{ text: context }] }], {
    systemInstruction: input.mode === "hint" ? HINT_PROMPT : MARKER_PROMPT,
    thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
  });
  const j = (extractJson(res.text ?? "") ?? {}) as { verdict?: string; feedback?: string; hint?: string };
  const verdict = j.verdict === "correct" || j.verdict === "partial" || j.verdict === "incorrect" ? j.verdict : undefined;
  return { verdict, feedback: j.feedback ?? (input.mode === "check" ? (res.text ?? "").slice(0, 300) : undefined), hint: j.hint, ms: Date.now() - t0 };
}
