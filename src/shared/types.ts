// Shared data contract between Gemma 4 (server), the physics engine and the UI.

export const TOPICS = ["projectile", "forces_line", "pulley", "incline", "other"] as const;
export type Topic = (typeof TOPICS)[number];

export const PULLEY_MODES = ["table", "hanging", "incline"] as const;
export type PulleyMode = (typeof PULLEY_MODES)[number];

export const HIGHLIGHTS = [
  "none",
  // projectile
  "components",
  "vertical",
  "horizontal",
  "time",
  "max_height",
  "landing",
  "trajectory",
  // straight line / forces
  "forces",
  "resultant",
  "velocity",
  "acceleration",
  // connected particles / slopes
  "weights",
  "tension",
  "friction",
  "normal",
  "string",
  "system",
  "after_impact",
] as const;
export type Highlight = (typeof HIGHLIGHTS)[number];

export const QUANTITIES = [
  // projectile
  "launchHeight",
  "maxHeight",
  "maxHeightAboveLaunch",
  "timeOfFlight",
  "range",
  "impactSpeed",
  "impactAngle",
  "timeToMaxHeight",
  "horizontalVelocity",
  "initialVerticalVelocity",
  // shared kinematics / dynamics
  "speed",
  "angle",
  "mass",
  "acceleration",
  "finalSpeed",
  "distance",
  "drivingForce",
  "resistance",
  "resultantForce",
  "timeToRest",
  "distanceToRest",
  // connected particles / slopes
  "tension",
  "frictionForce",
  "normalReaction",
  "timeToHit",
  "speedAtHit",
  "furtherDistance",
  "forceOnPulley",
  "coefficientOfFriction",
  "other",
] as const;
export type Quantity = (typeof QUANTITIES)[number];

export interface Params {
  // projectile
  speed?: number; // initial speed U (m/s)
  angleDeg?: number; // projectile: launch angle (+ above horizontal). incline / pulley-incline: slope angle
  launchHeight?: number; // height of launch point above landing level (m)
  // straight line
  mass?: number;
  u?: number; // initial speed
  a?: number; // acceleration (signed)
  drivingForce?: number;
  resistance?: number;
  duration?: number; // seconds of motion to animate
  // pulley
  pulleyMode?: PulleyMode;
  m1?: number; // on table / left / on slope
  m2?: number; // hanging (descending) particle
  mu?: number; // coefficient of friction
  dropHeight?: number; // distance hanging particle falls before hitting the ground
  // incline
  pullForce?: number; // force parallel to slope, up-slope positive
}

export interface Given {
  symbol: string;
  value: number;
  unit: string;
  label: string;
  quantity?: Quantity | "none";
}

export interface Step {
  text: string;
  latex?: string;
  highlight?: Highlight;
}

export interface Answer {
  quantity: Quantity;
  value: number;
  unit: string;
  display?: string;
}

export interface Part {
  id: string;
  question: string;
  steps: Step[];
  answer: Answer;
}

export interface SceneSpec {
  topic: Topic;
  title: string;
  questionText: string;
  g: number;
  objectLabel?: string;
  givens: Given[];
  params: Params;
  labels?: Record<string, string>;
  assumptions?: string[];
  parts: Part[];
}

export interface SolveMeta {
  model: string;
  ms: number;
  attempts: number;
  repaired: boolean;
  source: "gemma" | "fixture";
  notes?: string[];
}

export interface SolveResponse {
  spec: SceneSpec;
  meta: SolveMeta;
}
