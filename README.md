# Mechanimate

**Snap an A-level Mechanics question → Gemma 4 reads it, solves it step by step → watch it move, then try it yourself in exam mode.**

Mechanimate turns static exam questions (projectiles, forces, pulleys, slopes) into interactive, physics-accurate animations with mark-scheme style working. An exact physics engine independently **verifies every answer Gemma gives**, and an exam mode lets students answer each step themselves while Gemma marks their working and gives personalised hints.

Built at **Hacktoberfest Hack Day Loughborough 2026** (DigiTech × MLH) for *Best Open-Source AI Project* and *Best Use of Gemma 4*.

## What the AI does

Gemma 4 (an open-weight model) is the core of the app. Without it you only get the 4 hand-written examples.

| Where | What Gemma 4 does |
|---|---|
| **Reading** | Reads a photo or screenshot of a question: the text *and* the diagram (angles, masses, labels) |
| **Solving** | Solves every part with mark-scheme style steps (LaTeX), and classifies the situation into an animation template with its physical parameters |
| **Structured output** | Returns a typed `SceneSpec` (JSON mode, falling back to native function calling with a `build_scene` tool). The server validates it with zod |
| **Self-correction** | Our physics engine re-computes every answer. If anything disagrees, the server tells Gemma exactly which values are wrong and asks it to fix them |
| **Marking (exam mode)** | Marks a student's typed working for one step (correct / partial / incorrect) and explains the specific mistake without giving the answer away |
| **Hints (exam mode)** | Writes a personalised hint based on what the student wrote |
| **Tutor** | Chats about the question, knowing the working and the current slider values, and generates similar practice questions that can be solved and animated in one click |

## Features

1. **Upload / paste (⌘V) / drop** a screenshot or phone photo of a mechanics question, or type one.
2. **Animated, verified solution**: ✓ verified / ⚠ mismatch badge on each answer, checked by an exact A-level mechanics engine (particles, light inextensible strings, smooth pulleys, constant forces).
3. **Click any step**: the animation replays to that moment and highlights the relevant vectors/forces (max height, tension, friction…). **Walkthrough** auto-plays the whole solution in sync.
4. **Exam mode**: every unknown value is hidden in the diagram, HUD, sliders and graphs until you solve that part.
   - Type your answer for each step and press **Check**. Correct numbers are marked instantly on-device; otherwise Gemma explains what went wrong.
   - 3 levels of **hints**: the method → the equation with the result blanked out → a personalised Gemma hint.
   - Score card: correct = 1 mark, with hints = ½, revealed = 0.
5. **What-if sliders** (speed, angle, masses, μ, forces…) update the animation, v–t graph and results instantly, then **Re-solve with Gemma** for new working.
6. Timeline scrubbing, event markers (max height, impact, string goes slack), playback speed.

### Supported animation templates

| Template | Covers |
|---|---|
| `projectile` | projection from ground or a cliff, horizontal projection, vertical motion |
| `forces_line` | SUVAT, Newton's 2nd law with driving force & resistance, braking |
| `pulley` | particle on (rough) table + hanging, both hanging (Atwood), particle on (rough) slope + hanging, including *after the string goes slack* |
| `incline` | particle on rough/smooth slope, projected up/down, applied force, limiting friction |
| `other` | Gemma still solves it step by step (no animation) |

## Quick start

Requires **Node.js 22+** (developed on Node 26) and a free Gemini API key for the live Gemma features.

```bash
git clone https://github.com/krizhnx/mechanimate
cd mechanimate
npm install
cp .env.example .env        # then set GEMINI_API_KEY (free key: https://aistudio.google.com/apikey)
npm run dev                 # open http://localhost:5173  (API runs on :8787)
```

**Try it:**
- Pick an example from the sidebar (these work **without a key**; they are hand-checked against the mark scheme).
- Press **New question** (or `N`) and paste a screenshot of any A-level Mechanics question. With the 31B model and thinking on, a solve takes about 30–60 s.
- Toggle **Exam mode** in the top bar and answer the steps yourself.

Other scripts:

```bash
npm test                     # physics engine regression tests (hand-checked mark-scheme answers)
npm run typecheck
npm run build && npm start   # production: one server on :8787 serving the built app
```

Deep links for demos: `/?ex=pulley-table&t=1.2&step=3` (example id, time in s, step index), `/?ex=q5-projectile&exam=1` (exam mode).

## Model

| | |
|---|---|
| **Model** | **Gemma 4 31B instruction-tuned** (`gemma-4-31b-it`, default): dense, 30.7B parameters. Optional: **Gemma 4 26B A4B** (`gemma-4-26b-a4b-it`): Mixture-of-Experts, 25.2B total / 3.8B active, faster but less accurate in our tests. Both are *large* language models (>10B parameters) |
| **Provider** | Google DeepMind, open-weight |
| **License** | **Apache 2.0** (as stated on the model card). Model card & weights: <https://huggingface.co/google/gemma-4-31B-it> · License text: <https://www.apache.org/licenses/LICENSE-2.0> · Gemma docs: <https://ai.google.dev/gemma> |
| **How we run it** | Hosted inference through the Gemini API (`@google/genai`), so it runs on any laptop. The weights are open, so the same prompts and `SceneSpec` schema can be served locally (e.g. vLLM or Transformers) |
| **Gemma features used** | image understanding, thinking mode (`thinkingLevel`), system instructions, JSON output, native function calling, multi-turn chat |

## How it works

```
Browser (React + Vite + SVG)                       Server (Express)
 ├─ upload / paste / text  ──── POST /api/solve ──► Gemma 4 via @google/genai
 │                                                  ├─ image + system prompt → SceneSpec (JSON / build_scene tool)
 │                                                  ├─ zod validation (+ repair round)
 │                                                  └─ physics engine verify → self-correct loop
 ├─ physics.ts (shared) - exact piecewise-constant-acceleration engine
 ├─ animated scenes, v–t graph, sliders, stepper (KaTeX)
 ├─ exam mode: local numeric check ─ POST /api/check ─► Gemma 4 marks the step / writes a hint
 └─ tutor chat ─────────────── POST /api/ask ───► Gemma 4
```

Key files:

- `src/shared/physics.ts`: the mechanics engine + answer verification (shared by client & server)
- `src/shared/types.ts`: the `SceneSpec` contract between Gemma, the engine and the UI
- `server/gemma.ts`: prompts, Gemma calls (retry + model fallback), verify-and-repair loop, step marking, hints, tutor chat
- `server/schema.ts`: `build_scene` function declaration + zod validation
- `src/examCheck.ts` and `src/components/AttemptCard.tsx`: exam-mode answer checking and hints
- `src/components/scenes/*`: SVG animations for each template
- `src/fixtures/index.ts`: hand-checked example questions (also used as tests)

## Key dependencies

| Package | Used for |
|---|---|
| [`@google/genai`](https://www.npmjs.com/package/@google/genai) | Gemini API SDK used to call Gemma 4 |
| [`react`](https://react.dev) 19 + [`vite`](https://vite.dev) 8 | front end |
| [`express`](https://expressjs.com) 5 | API server |
| [`zod`](https://zod.dev) 4 | validating Gemma's structured output |
| [`katex`](https://katex.org) | rendering the maths |
| [`lucide-react`](https://lucide.dev) | icons |
| `typescript`, `tsx`, `concurrently`, `dotenv` | tooling |

Exact versions are pinned in `package.json` / `package-lock.json`.

## License

Code: [MIT](./LICENSE). Gemma 4 model weights are licensed separately by Google under Apache 2.0 (see **Model** above).
