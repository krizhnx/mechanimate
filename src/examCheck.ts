// Instant, offline step checking for exam mode. Gemma adds richer feedback on top.
import { close } from "./shared/physics";
import type { Part, Step } from "./shared/types";

const SPACING = /\\[,;:!]|\\ |~|\\quad|\\qquad/g;

/** Number the step evaluates to, if its LaTeX ends in "= <number> [units]". */
export function expectedValue(step: Step, part: Part, isLast: boolean): number[] {
  const out: number[] = [];
  if (isLast && Number.isFinite(part.answer.value)) out.push(part.answer.value);
  const latex = step.latex ?? "";
  const iEq = latex.lastIndexOf("=");
  const iAp = latex.lastIndexOf("\\approx");
  const idx = Math.max(iEq, iAp);
  if (idx >= 0) {
    let tail = latex.slice(idx + (idx === iAp ? 7 : 1));
    tail = tail
      .replace(/\\(text|mathrm|textrm)\{[^}]*\}/g, " ")
      .replace(SPACING, " ")
      .replace(/\^\{?-?\d\}?/g, " ")
      .replace(/\\circ|°/g, " ")
      .trim();
    const m = tail.match(/^(-?\d+(?:\.\d+)?)(?:\s+[A-Za-z\s]*)?$/); // "3a" is algebra, "2 m" is a value
    if (m) out.push(parseFloat(m[1]));
  }
  return out;
}

export function numbersIn(s: string): number[] {
  const norm = s.replace(/[−–]/g, "-").replace(/(\d),(\d{3})/g, "$1$2");
  return (norm.match(/-?\d+(?:\.\d+)?/g) ?? []).map(parseFloat).filter(Number.isFinite);
}

export type LocalVerdict = "correct" | "incorrect" | "unknown";

export function localCheck(attempt: string, expected: number[]): LocalVerdict {
  if (expected.length === 0) return "unknown";
  const nums = numbersIn(attempt);
  if (nums.length === 0) return "unknown";
  return expected.some((e) => nums.some((n) => close(n, e))) ? "correct" : "incorrect";
}

/** Hint level 2: the step's equation with its result blanked out. */
export function skeleton(step: Step): string | undefined {
  const latex = step.latex ?? "";
  const iEq = latex.lastIndexOf("=");
  const iAp = latex.lastIndexOf("\\approx");
  const idx = Math.max(iEq, iAp);
  if (idx < 0) return undefined;
  const head = latex.slice(0, idx + (idx === iAp ? 7 : 1));
  return `${head}\\ \\boxed{\\;?\\;}`;
}
