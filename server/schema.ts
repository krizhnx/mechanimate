// Validation + normalisation of Gemma's build_scene output (zod) and the
// Gemini function declaration that makes Gemma 4 return structured data.
import { z } from "zod";
import { Type } from "@google/genai";
import { HIGHLIGHTS, PULLEY_MODES, QUANTITIES, TOPICS } from "../src/shared/types";
import type { SceneSpec } from "../src/shared/types";

const toNum = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9eE+\-.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};
const optNum = z.any().transform(toNum);
const reqNum = z.any().transform((v, ctx) => {
  const n = toNum(v);
  if (n === undefined) {
    ctx.addIssue({ code: "custom", message: `expected a number, got ${JSON.stringify(v)}` });
    return z.NEVER;
  }
  return n;
});
const str = z.any().transform((v) => (v === null || v === undefined ? "" : String(v)));

const StepZ = z.object({
  text: str,
  latex: z.any().transform((v) => (typeof v === "string" && v.trim() ? v.trim().replace(/^\$+|\$+$/g, "") : undefined)),
  highlight: z.enum(HIGHLIGHTS).catch("none"),
});

const PartZ = z.object({
  id: str.transform((s) => s.replace(/[()]/g, "").trim() || "?"),
  question: str,
  steps: z.array(StepZ).min(1),
  answer: z.object({
    quantity: z.enum(QUANTITIES).catch("other"),
    value: reqNum,
    unit: str,
    display: z.any().transform((v) => (typeof v === "string" ? v : undefined)),
  }),
});

const GivenZ = z.object({
  symbol: str,
  value: optNum,
  unit: str,
  label: str,
  quantity: z.enum([...QUANTITIES, "none"] as [string, ...string[]]).catch("none"),
});

const NUM_PARAMS = ["speed", "angleDeg", "launchHeight", "mass", "u", "a", "drivingForce", "resistance", "duration", "m1", "m2", "mu", "dropHeight", "pullForce"] as const;

/** Tolerant params parsing: accepts JSON strings, numeric strings, extra keys; never throws. */
const ParamsZ = z.any().transform((v) => {
  let obj: unknown = v;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      obj = {};
    }
  }
  const src = obj && typeof obj === "object" ? (obj as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const k of NUM_PARAMS) {
    const n = toNum(src[k]);
    if (n !== undefined) out[k] = n;
  }
  const pm = String(src.pulleyMode ?? "");
  if ((PULLEY_MODES as readonly string[]).includes(pm)) out.pulleyMode = pm;
  return out;
});

export const SceneSpecZ = z.object({
  topic: z.enum(TOPICS).catch("other"),
  title: str,
  questionText: str,
  g: optNum.transform((g) => (g && g > 0 ? g : 9.8)),
  objectLabel: z.any().transform((v) => (typeof v === "string" ? v : undefined)),
  givens: z
    .array(GivenZ)
    .catch([])
    .transform((gs) => gs.filter((g) => g.value !== undefined)),
  params: ParamsZ,
  labels: z
    .any()
    .transform((v) => {
      if (!v || typeof v !== "object") return undefined;
      const out: Record<string, string> = {};
      for (const [k, val] of Object.entries(v)) if (val !== null && val !== undefined && String(val).trim()) out[k] = String(val);
      return out;
    }),
  assumptions: z.array(z.string()).optional().catch(undefined),
  parts: z.array(PartZ).min(1),
});

export function parseSpec(raw: unknown): { spec?: SceneSpec; error?: string } {
  const r = SceneSpecZ.safeParse(raw);
  if (!r.success) {
    return { error: r.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  // strip undefined params so the engine falls back to sensible defaults
  const params = Object.fromEntries(Object.entries(r.data.params ?? {}).filter(([, v]) => v !== undefined));
  return { spec: { ...(r.data as unknown as SceneSpec), params } };
}

// ---------------- Gemini function declaration ----------------
const S = (description: string) => ({ type: Type.STRING, description });
const N = (description: string) => ({ type: Type.NUMBER, description });

export const BUILD_SCENE = {
  name: "build_scene",
  description:
    "Return the fully solved mechanics question as a structured scene so the app can animate it, show mark-scheme style working and verify each answer with a physics engine.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: { type: Type.STRING, enum: [...TOPICS], description: "Animation template that best models the situation." },
      title: S("Short title, e.g. 'Stone projected from a cliff'."),
      questionText: S("Faithful transcription of the whole question including every part. Use unicode for superscripts."),
      g: N("Acceleration due to gravity used (9.8 unless the question states otherwise)."),
      objectLabel: S("What the moving object is: 'stone', 'car', 'ball', 'particle', 'box'..."),
      givens: {
        type: Type.ARRAY,
        description: "Every numerical value given in the question.",
        items: {
          type: Type.OBJECT,
          properties: {
            symbol: S("Symbol as written, e.g. 'U', 'NA', 'tan θ', 'm_A'."),
            value: N("Numeric value."),
            unit: S("SI unit, '' if none."),
            label: S("Plain-English meaning."),
            quantity: {
              type: Type.STRING,
              enum: [...QUANTITIES, "none"],
              description: "Engine quantity this value equals (angles in DEGREES), or 'none'. Use 'none' for tan/sin values, times, and anything ambiguous.",
            },
          },
          required: ["symbol", "value", "unit", "label", "quantity"],
        },
      },
      params: {
        type: Type.OBJECT,
        description: "FULLY SOLVED physical values needed to animate the situation. If a value was unknown in the question, put the value you solved for. SI units, angles in degrees.",
        properties: {
          speed: N("projectile: initial speed U."),
          angleDeg: N("projectile: angle of projection above horizontal (negative = below). incline / pulley 'incline' mode: angle of the slope."),
          launchHeight: N("projectile: height of the point of projection above the level where it lands (0 if from the ground)."),
          mass: N("forces_line / incline: mass of the object."),
          u: N("forces_line / incline: initial speed (incline: up the slope positive)."),
          a: N("forces_line: acceleration (negative for deceleration)."),
          drivingForce: N("forces_line: driving/tractive force (0 if none)."),
          resistance: N("forces_line: magnitude of total resistance (0 if none)."),
          duration: N("forces_line / incline: seconds of motion to animate (e.g. the time in the question)."),
          pulleyMode: { type: Type.STRING, enum: [...PULLEY_MODES], description: "pulley: 'table' (m1 on horizontal table, m2 hangs), 'hanging' (both hang; m1 left, m2 right), 'incline' (m1 on slope, m2 hangs)." },
          m1: N("pulley: mass of particle on table / slope, or left hanging particle."),
          m2: N("pulley: mass of the hanging particle that descends."),
          mu: N("pulley / incline: coefficient of friction (0 if smooth)."),
          dropHeight: N("pulley: height the hanging particle falls before hitting the ground (0 if not given)."),
          pullForce: N("incline: applied force parallel to the slope, up the slope positive (0 if none)."),
        },
      },
      labels: {
        type: Type.OBJECT,
        description: "Letters used in the diagram.",
        properties: {
          origin: S("projectile: launch point label, e.g. 'O'."),
          base: S("projectile: point on ground below launch, e.g. 'N'."),
          landing: S("projectile: landing point label, e.g. 'A'."),
          m1: S("pulley: label of particle m1, e.g. 'A'."),
          m2: S("pulley: label of particle m2, e.g. 'B'."),
        },
      },
      assumptions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Modelling assumptions." },
      parts: {
        type: Type.ARRAY,
        description: "One entry per question part, in order.",
        items: {
          type: Type.OBJECT,
          properties: {
            id: S("Part letter, e.g. 'a'."),
            question: S("What this part asks."),
            steps: {
              type: Type.ARRAY,
              description: "Mark-scheme style working. One idea per step.",
              items: {
                type: Type.OBJECT,
                properties: {
                  text: S("Short plain-English explanation of WHY (max ~20 words)."),
                  latex: S("One KaTeX equation for this step, without $ delimiters."),
                  highlight: { type: Type.STRING, enum: [...HIGHLIGHTS], description: "What the animation should emphasise during this step." },
                },
                required: ["text", "latex", "highlight"],
              },
            },
            answer: {
              type: Type.OBJECT,
              properties: {
                quantity: { type: Type.STRING, enum: [...QUANTITIES], description: "Engine quantity that this answer is, or 'other'." },
                value: N("Final numeric answer (magnitude, 4 s.f.)."),
                unit: S("Unit."),
                display: S("Answer as written in an exam, e.g. 'H = 30', '2.74 m s⁻²'."),
              },
              required: ["quantity", "value", "unit", "display"],
            },
          },
          required: ["id", "question", "steps", "answer"],
        },
      },
    },
    required: ["topic", "title", "questionText", "g", "givens", "params", "parts"],
  },
};
