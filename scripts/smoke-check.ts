import { EXAMPLES } from "../src/fixtures";
const spec = EXAMPLES[0].spec;
async function call(body: any) {
  const t0 = Date.now();
  const r = await fetch("http://localhost:8787/api/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec, model: "gemma-4-31b-it", ...body }) });
  console.log(body.mode, `${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(await r.json()));
}
await Promise.all([
  call({ stepIndex: 2, attempt: "t = 40/14 = 2.86 s", mode: "check", hintsUsed: 0 }),
  call({ stepIndex: 3, attempt: "H = 6.26t + 4.9t^2", mode: "hint", hintsUsed: 2 }),
]);
