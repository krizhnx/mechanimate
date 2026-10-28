// Smoke test for the live Gemma 4 path: npx tsx scripts/smoke-gemma.ts [imagePath]
import "dotenv/config";
import fs from "node:fs";
import { solveQuestion } from "../server/gemma";
import { verifySpec } from "../src/shared/physics";

const img = process.argv[2] ?? "public/examples/q5-projectile.png";
const t0 = Date.now();
const out = await solveQuestion({ imageBase64: fs.readFileSync(img).toString("base64"), mimeType: "image/png" });
const v = verifySpec(out.spec);
console.log(JSON.stringify({ topic: out.spec.topic, title: out.spec.title, params: out.spec.params, answers: out.spec.parts.map((p) => [p.id, p.answer.quantity, p.answer.value]), verified: `${v.ok} ok / ${v.mismatches} mismatch`, meta: out.meta }, null, 2));
console.log(`took ${((Date.now() - t0) / 1000).toFixed(1)}s`);
