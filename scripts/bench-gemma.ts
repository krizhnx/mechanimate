import "dotenv/config";
import fs from "node:fs";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { SYSTEM_PROMPT, JSON_FALLBACK } from "../server/gemma";
import { BUILD_SCENE } from "../server/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const img = fs.readFileSync("public/examples/q5-projectile.png").toString("base64");
const [model, mode, think] = process.argv.slice(2);
const t0 = Date.now();
const parts: any[] = [{ inlineData: { mimeType: "image/png", data: img } }, { text: "The image above is an A-level Mechanics exam question. Read it carefully, solve every part, and call build_scene." + (mode === "json" ? JSON_FALLBACK : "") }];
const config: any = { systemInstruction: SYSTEM_PROMPT, thinkingConfig: { thinkingLevel: think === "high" ? ThinkingLevel.HIGH : ThinkingLevel.MINIMAL } };
if (mode === "tools") config.tools = [{ functionDeclarations: [BUILD_SCENE] }];
try {
  const res = await ai.models.generateContent({ model, contents: [{ role: "user", parts }], config });
  const fc = res.functionCalls?.[0];
  const out = fc ? fc.args : res.text;
  const s = typeof out === "string" ? out : JSON.stringify(out);
  const pm = s.match(/"params"\s*:\s*(\{[^}]*\}|"[^"]*")/);
  console.log(`${model} ${mode} ${think}: ${((Date.now() - t0) / 1000).toFixed(1)}s via=${fc ? "fc" : "text"} len=${s.length} params=${pm?.[1]?.slice(0, 200)}`);
  fs.writeFileSync(`/var/folders/lj/b8t2rz0d0zs_9zqmwsx1ksvw0000gn/T/opencode/bench-${model}-${mode}-${think}.txt`, s);
} catch (e: any) {
  console.log(`${model} ${mode} ${think}: ERROR after ${((Date.now() - t0) / 1000).toFixed(1)}s ${String(e.message).slice(0, 150)}`);
}
