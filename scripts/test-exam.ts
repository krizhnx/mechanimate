import { EXAMPLES } from "../src/fixtures";
import { expectedValue, localCheck, skeleton } from "../src/examCheck";
for (const ex of EXAMPLES) {
  console.log(`\n${ex.name}`);
  for (const p of ex.spec.parts) p.steps.forEach((s, i) => {
    const exp = expectedValue(s, p, i === p.steps.length - 1);
    console.log(`  ${p.id}${i + 1} expected=${JSON.stringify(exp)} skeleton=${skeleton(s) ? "yes" : "no"}`);
  });
}
console.log("\nlocalCheck('t = 3.19 s',[3.19]) =", localCheck("t = 3.19 s", [3.194]));
console.log("localCheck('H=29',[30]) =", localCheck("H=29", [30]));
console.log("localCheck('T - 5.88 = 3a',[]) =", localCheck("T - 5.88 = 3a", []));
