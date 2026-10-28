import type { SceneSpec, SolveResponse } from "./shared/types";

export interface ImagePayload {
  base64: string;
  mimeType: string;
  dataUrl: string;
}

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = src;
  });
}

/** Read an image, downscale big phone photos, return base64 for the Gemini API. */
export async function imageToPayload(file: Blob): Promise<ImagePayload> {
  const original = await readAsDataURL(file);
  const img = await loadImage(original);
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  let dataUrl = original;
  if (scale < 1 || file.size > 1_500_000 || !/^data:image\/(png|jpeg|webp)/.test(original)) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  }
  const [head, base64] = dataUrl.split(",");
  const mimeType = head.match(/data:(.*?);/)?.[1] ?? "image/png";
  return { base64, mimeType, dataUrl };
}

export async function urlToPayload(url: string): Promise<ImagePayload> {
  const blob = await (await fetch(url)).blob();
  return imageToPayload(blob);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server error (${res.status}). Is the API server running? (npm run dev)`);
  }
  if (!res.ok) throw new Error((json as { error?: string })?.error ?? `Request failed (${res.status})`);
  return json as T;
}

export interface Settings {
  model: string;
  thinking: boolean;
  verifyLoop: boolean;
}

export function solve(input: { image?: ImagePayload; text?: string }, s: Settings) {
  return post<SolveResponse>("/api/solve", {
    imageBase64: input.image?.base64,
    mimeType: input.image?.mimeType,
    text: input.text,
    model: s.model,
    thinking: s.thinking,
    verifyLoop: s.verifyLoop,
  });
}

export function ask(body: {
  spec: SceneSpec;
  question: string;
  history: { role: "user" | "model"; text: string }[];
  currentParams: unknown;
  derived: unknown;
  model: string;
}) {
  return post<{ text: string; ms: number; model: string }>("/api/ask", body);
}

export async function health(): Promise<{ ok: boolean; hasKey: boolean; model: string; models: string[] } | null> {
  try {
    const r = await fetch("/api/health");
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export interface CheckResult {
  verdict?: "correct" | "partial" | "incorrect";
  feedback?: string;
  hint?: string;
  ms: number;
}

export function checkStep(body: { spec: SceneSpec; stepIndex: number; attempt?: string; mode: "check" | "hint"; hintsUsed?: number; model: string }) {
  return post<CheckResult>("/api/check", body);
}
