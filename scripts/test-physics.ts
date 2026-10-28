// Regression tests: the physics engine must reproduce hand-checked mark-scheme answers.
import { EXAMPLES } from "../src/fixtures";
import { simulate, verifySpec, close, fmt } from "../src/shared/physics";
import type { Params, Quantity, Topic } from "../src/shared/types";

let failures = 0;
function expect(name: string, got: number | undefined, want: number) {
  const ok = got !== undefined && close(got, want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}: engine=${fmt(got)} expected=${want}`);
}

for (const ex of EXAMPLES) {
  const v = verifySpec(ex.spec);
  console.log(`\n${ex.name}: ${v.ok} ok, ${v.mismatches} mismatch, ${v.unchecked} unchecked`);
  for (const c of v.checks) {
    if (c.status === "mismatch") failures++;
    console.log(`  ${c.status === "ok" ? "✓" : c.status === "mismatch" ? "✗" : "·"} ${c.label} [${c.quantity}] claimed=${c.claimed} engine=${fmt(c.engine)}`);
  }
}

console.log("\nExtra textbook cases");
const cases: [string, Topic, Params, Quantity, number][] = [
  // Atwood machine: 5 kg and 3 kg -> a = 2g/8 = 2.45, T = 2*5*3*9.8/8 = 36.75
  ["Atwood a", "pulley", { pulleyMode: "hanging", m1: 3, m2: 5 }, "acceleration", 2.45],
  ["Atwood T", "pulley", { pulleyMode: "hanging", m1: 3, m2: 5 }, "tension", 36.75],
  ["Atwood force on pulley", "pulley", { pulleyMode: "hanging", m1: 3, m2: 5 }, "forceOnPulley", 73.5],
  // Smooth table: 3 kg on table, 2 kg hanging -> a = 3.92, T = 11.76, force on pulley = T*sqrt2
  ["Smooth table a", "pulley", { pulleyMode: "table", m1: 3, m2: 2, mu: 0 }, "acceleration", 3.92],
  ["Smooth table T", "pulley", { pulleyMode: "table", m1: 3, m2: 2, mu: 0 }, "tension", 11.76],
  ["Smooth table pulley force", "pulley", { pulleyMode: "table", m1: 3, m2: 2, mu: 0 }, "forceOnPulley", 16.63],
  // Smooth 30° slope, 4 kg on slope, 3 kg hanging: a = (3g - 4g*0.5)/7 = 1.4, T = 3(9.8-1.4)=25.2
  ["Slope pulley a", "pulley", { pulleyMode: "incline", m1: 4, m2: 3, angleDeg: 30, mu: 0 }, "acceleration", 1.4],
  ["Slope pulley T", "pulley", { pulleyMode: "incline", m1: 4, m2: 3, angleDeg: 30, mu: 0 }, "tension", 25.2],
  // Block projected up rough slope: m=2, 30°, mu=0.3, u=8 -> decel = g(sin30 + 0.3cos30) = 7.4461; d = 64/(2*7.4461)=4.2975
  ["Rough slope decel", "incline", { mass: 2, angleDeg: 30, mu: 0.3, u: 8 }, "acceleration", 7.4461],
  ["Rough slope distance to rest", "incline", { mass: 2, angleDeg: 30, mu: 0.3, u: 8 }, "distanceToRest", 4.2975],
  ["Rough slope R", "incline", { mass: 2, angleDeg: 30, mu: 0.3, u: 8 }, "normalReaction", 16.974],
  // Horizontal projection from 20 m at 10 m/s: t = sqrt(40/9.8)=2.0203, range=20.203
  ["Horizontal projection time", "projectile", { speed: 10, angleDeg: 0, launchHeight: 20 }, "timeOfFlight", 2.0203],
  ["Horizontal projection range", "projectile", { speed: 10, angleDeg: 0, launchHeight: 20 }, "range", 20.203],
  // Ground-to-ground 20 m/s at 30°: T = 2.0408, range = 35.35, max height 5.102
  ["Ground projectile range", "projectile", { speed: 20, angleDeg: 30, launchHeight: 0 }, "range", 35.35],
  ["Ground projectile max h", "projectile", { speed: 20, angleDeg: 30, launchHeight: 0 }, "maxHeight", 5.102],
  // Braking car: 1200 kg, 20 m/s, resistance 3000 N -> decel 2.5, stops in 8 s, 80 m
  ["Braking time", "forces_line", { mass: 1200, u: 20, drivingForce: 0, resistance: 3000 }, "timeToRest", 8],
  ["Braking distance", "forces_line", { mass: 1200, u: 20, drivingForce: 0, resistance: 3000 }, "distanceToRest", 80],
];
for (const [name, topic, params, q, want] of cases) expect(name, simulate(topic, params, 9.8).derived[q], want);

// Static check: 5 kg on rough table mu=0.5 with 2 kg hanging -> 2g < 0.5*5g -> stays at rest
const st = simulate("pulley", { pulleyMode: "table", m1: 5, m2: 2, mu: 0.5 }, 9.8);
expect("Static table acceleration", st.derived.acceleration, 0);

console.log(failures === 0 ? "\nAll physics checks passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
