# Mechanimate

**Snap an A-level Mechanics question → Gemma 4 reads it, solves it step by step → watch it move.**

Mechanimate turns static exam questions (projectiles, forces, pulleys, slopes) into interactive, physics-accurate animations with mark-scheme style working - and an exact physics engine that independently **verifies every answer Gemma gives**.

Built at **Hacktoberfest Hack Day Loughborough 2026** (DigiTech × MLH) for *Best Open-Source AI Project* and *Best Use of Gemma 4*.

## What it does

1. **Upload / paste (⌘V) / drop** a screenshot or phone photo of a mechanics question - or type one.
2. **Gemma 4** (vision + thinking mode) reads the text *and* the diagram, transcribes it, classifies it, solves every part, and returns a structured scene through **native function calling** (`build_scene`).
3. An **exact A-level mechanics engine** (particles, light inextensible strings, smooth pulleys, constant forces) animates the situation and re-computes every answer:
   - ✓ verified / ⚠ mismatch badge on each answer
   - if anything disagrees, the server runs a **self-correction loop**: it tells Gemma exactly which values don't match and asks it to fix them.
4. **Interact**
   - Click any step → the animation replays to that moment and highlights the relevant vectors/forces (e.g. "max height", "tension", "friction").
   - **Walkthrough** mode auto-plays the whole solution in sync with the animation; **Exam mode** hides the working so you can try first and reveal step by step.
   - **What-if sliders** (speed, angle, masses, μ, forces, …) update the animation, the v–t graph and all results instantly - then **Re-solve with Gemma** for new working.
   - Scrub the timeline, jump to events (max height, impact, string goes slack), change playback speed.
   - **Ask Gemma** tutor chat (knows the question, the working and your slider values), including *"give me a similar practice question"* → one click to solve & animate it.

### Supported animation templates

| Template | Covers |
|---|---|
| `projectile` | projection from ground or a cliff, horizontal projection, vertical motion |
| `forces_line` | SUVAT, Newton's 2nd law with driving force & resistance, braking |
| `pulley` | particle on (rough) table + hanging, both hanging (Atwood), particle on (rough) slope + hanging - including *after the string goes slack* |
| `incline` | particle on rough/smooth slope, projected up/down, applied force, limiting friction |
| `other` | Gemma still solves it step by step (no animation) |

## Quick start

```bash
npm install
cp .env.example .env        # add your GEMINI_API_KEY from https://aistudio.google.com/apikey
npm run dev                 # web on http://localhost:5173, API on :8787
```

The 4 built-in examples work **offline** (no key) - they're hand-checked against the mark scheme.

Other scripts:

```bash
npm test          # physics engine regression tests (hand-checked mark-scheme answers)
npm run typecheck
npm run build && npm start   # production: one server on :8787 serving the built app
```

Deep links for demos: `/?ex=pulley-table&t=1.2&step=3` (example id, time in s, step index).

## Model

- **Gemma 4** (`gemma-4-31b-it` by default, `gemma-4-26b-a4b-it` selectable) - Google DeepMind's **open-weight** model family, accessed through the Gemini API.
- Features used: image understanding, thinking mode (`thinkingLevel: HIGH`), system instructions, native function calling, multi-turn chat.
- Model card & license/terms: <https://ai.google.dev/gemma> (see the Gemma 4 model card for the license that applies to the weights).
- Because the weights are open, the same prompts/schema can run locally (e.g. `ollama run gemma4:e4b`) - the app only depends on the structured `build_scene` output.

## How it works

```
Browser (React + Vite + SVG)                       Server (Express)
 ├─ upload / paste / text  ──── POST /api/solve ──► Gemma 4 via @google/genai
 │                                                  ├─ image + system prompt + build_scene tool
 │                                                  ├─ zod validation (+1 repair round)
 │                                                  └─ physics engine verify → self-correct loop
 ├─ physics.ts (shared) - exact piecewise-constant-acceleration engine
 ├─ animated scenes, v–t graph, sliders, stepper (KaTeX)
 └─ tutor chat ─────────────── POST /api/ask ───► Gemma 4
```

Key files:

- `src/shared/physics.ts` - the mechanics engine + answer verification (shared by client & server)
- `src/shared/types.ts` - the `SceneSpec` contract between Gemma, the engine and the UI
- `server/schema.ts` - `build_scene` function declaration + zod validation
- `server/gemma.ts` - prompts, Gemma calls, verify-and-repair loop, tutor chat
- `src/components/scenes/*` - SVG animations for each template
- `src/fixtures/index.ts` - hand-checked example questions (also used as tests)

## Key dependencies

`@google/genai` (Gemini API SDK) · `react` · `vite` · `express` · `zod` · `katex` · `tsx` · `typescript`

## License

[MIT](./LICENSE)
