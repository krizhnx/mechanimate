// Hand-checked example questions. Used as (1) instant offline demos,
// (2) regression tests for the physics engine, (3) few-shot style reference.
import type { SceneSpec } from "../shared/types";

export interface Example {
  id: string;
  name: string;
  blurb: string;
  image?: string;
  spec: SceneSpec;
}

const projectileCliff: SceneSpec = {
  topic: "projectile",
  title: "Stone projected from a cliff",
  questionText:
    "A small stone is projected with speed 14 m s⁻¹ from a point O on the top of a cliff. The point O is H metres vertically above the point N. Point N is on horizontal ground. The stone is projected at an angle θ above the horizontal, where tan θ = 1/2. The stone strikes the horizontal ground at the point A, where NA = 40 m. The stone is modelled as a particle moving freely under gravity. Using this model, find (a) the value of H, (b) the maximum height of the stone above the horizontal ground.",
  g: 9.8,
  objectLabel: "stone",
  givens: [
    { symbol: "U", value: 14, unit: "m/s", label: "Speed of projection", quantity: "speed" },
    { symbol: "tan θ", value: 0.5, unit: "", label: "Angle of projection (θ ≈ 26.57°)", quantity: "none" },
    { symbol: "NA", value: 40, unit: "m", label: "Horizontal distance to landing point", quantity: "range" },
    { symbol: "g", value: 9.8, unit: "m/s²", label: "Acceleration due to gravity", quantity: "none" },
  ],
  params: { speed: 14, angleDeg: (Math.atan(0.5) * 180) / Math.PI, launchHeight: 30 },
  labels: { origin: "O", base: "N", landing: "A" },
  assumptions: ["Stone modelled as a particle", "No air resistance", "g = 9.8 m s⁻²"],
  parts: [
    {
      id: "a",
      question: "Find the value of H.",
      steps: [
        {
          text: "Resolve the initial velocity. tan θ = ½ gives a 1-2-√5 right-angled triangle.",
          latex: "\\tan\\theta=\\tfrac12 \\;\\Rightarrow\\; \\sin\\theta=\\tfrac{1}{\\sqrt5},\\quad \\cos\\theta=\\tfrac{2}{\\sqrt5}",
          highlight: "components",
        },
        {
          text: "The horizontal component of velocity is constant (no horizontal force).",
          latex: "u_x = 14\\cos\\theta = \\tfrac{28}{\\sqrt5} \\approx 12.52\\ \\text{m s}^{-1}",
          highlight: "horizontal",
        },
        {
          text: "Use horizontal motion from O to A to find the time of flight.",
          latex: "40 = \\tfrac{28}{\\sqrt5}\\,t \\;\\Rightarrow\\; t = \\tfrac{10\\sqrt5}{7} \\approx 3.19\\ \\text{s}",
          highlight: "time",
        },
        {
          text: "Vertical motion (up positive): the stone ends H metres below O, so s = −H.",
          latex: "-H = \\left(14\\sin\\theta\\right)t - \\tfrac12(9.8)t^2",
          highlight: "vertical",
        },
        {
          text: "Substitute: (14/√5)·t = 20 and 4.9t² = 50.",
          latex: "-H = 20 - 50 \\;\\Rightarrow\\; H = 30",
          highlight: "landing",
        },
      ],
      answer: { quantity: "launchHeight", value: 30, unit: "m", display: "H = 30" },
    },
    {
      id: "b",
      question: "Find the maximum height of the stone above the horizontal ground.",
      steps: [
        {
          text: "At the highest point the vertical velocity is zero. Use v² = u² + 2as vertically.",
          latex: "0^2 = \\left(\\tfrac{14}{\\sqrt5}\\right)^2 - 2(9.8)s",
          highlight: "vertical",
        },
        {
          text: "Solve for the height gained above O.",
          latex: "s = \\dfrac{39.2}{19.6} = 2\\ \\text{m above } O",
          highlight: "max_height",
        },
        {
          text: "Add the height of the cliff.",
          latex: "30 + 2 = 32\\ \\text{m}",
          highlight: "max_height",
        },
      ],
      answer: { quantity: "maxHeight", value: 32, unit: "m", display: "32 m" },
    },
  ],
};

const carForces: SceneSpec = {
  topic: "forces_line",
  title: "Car accelerating past a signpost",
  questionText:
    "A car moves in a straight line along a horizontal road with constant acceleration 2 m s⁻². The car is moving with speed 15 m s⁻¹ in the direction of the acceleration when it passes a signpost on the road. The car is modelled as a particle. (a) Use the model to find the speed of the car 4 s after passing the signpost. Figure 1 shows the horizontal forces acting on the car. Given that the car has mass 800 kg, the driving force of the engine has magnitude D newtons, the resistance to the motion of the car has magnitude 400 N, the acceleration of the car is 2 m s⁻² in the direction of the driving force, (b) use the model to find the value of D.",
  g: 9.8,
  objectLabel: "car",
  givens: [
    { symbol: "a", value: 2, unit: "m/s²", label: "Acceleration", quantity: "acceleration" },
    { symbol: "u", value: 15, unit: "m/s", label: "Speed at signpost", quantity: "speed" },
    { symbol: "t", value: 4, unit: "s", label: "Time after signpost", quantity: "none" },
    { symbol: "m", value: 800, unit: "kg", label: "Mass of car", quantity: "mass" },
    { symbol: "R", value: 400, unit: "N", label: "Resistance", quantity: "resistance" },
  ],
  params: { mass: 800, u: 15, a: 2, drivingForce: 2000, resistance: 400, duration: 4 },
  labels: { start: "signpost" },
  assumptions: ["Car modelled as a particle", "Constant acceleration", "Constant resistance"],
  parts: [
    {
      id: "a",
      question: "Find the speed of the car 4 s after passing the signpost.",
      steps: [
        { text: "Constant acceleration, so use the SUVAT equation linking v, u, a and t.", latex: "v = u + at", highlight: "acceleration" },
        { text: "Substitute u = 15, a = 2, t = 4.", latex: "v = 15 + 2(4) = 23\\ \\text{m s}^{-1}", highlight: "velocity" },
      ],
      answer: { quantity: "finalSpeed", value: 23, unit: "m/s", display: "23 m s⁻¹" },
    },
    {
      id: "b",
      question: "Find the value of D.",
      steps: [
        { text: "Draw the horizontal forces: D forwards, 400 N resistance backwards.", latex: "\\text{Resultant} = D - 400", highlight: "forces" },
        { text: "Newton's second law in the direction of motion.", latex: "F = ma \\;\\Rightarrow\\; D - 400 = 800 \\times 2", highlight: "resultant" },
        { text: "Solve for D.", latex: "D = 1600 + 400 = 2000", highlight: "forces" },
      ],
      answer: { quantity: "drivingForce", value: 2000, unit: "N", display: "D = 2000" },
    },
  ],
};

const pulleyTable: SceneSpec = {
  topic: "pulley",
  title: "Connected particles over a pulley",
  questionText:
    "Two particles A and B have masses 3 kg and 2 kg respectively. They are attached to the ends of a light inextensible string. Particle A is held at rest on a rough horizontal table. The string passes over a small smooth pulley fixed at the edge of the table and B hangs freely, 1.5 m above the ground. The coefficient of friction between A and the table is 0.2. The system is released from rest with the string taut. Find (a) the acceleration of B, (b) the tension in the string, (c) the speed of B as it hits the ground. B does not rebound and A does not reach the pulley. (d) Find the further distance A travels before coming to rest.",
  g: 9.8,
  objectLabel: "particles",
  givens: [
    { symbol: "m_A", value: 3, unit: "kg", label: "Mass of A (on table)", quantity: "none" },
    { symbol: "m_B", value: 2, unit: "kg", label: "Mass of B (hanging)", quantity: "none" },
    { symbol: "μ", value: 0.2, unit: "", label: "Coefficient of friction", quantity: "coefficientOfFriction" },
    { symbol: "h", value: 1.5, unit: "m", label: "Height of B above ground", quantity: "distance" },
  ],
  params: { pulleyMode: "table", m1: 3, m2: 2, mu: 0.2, dropHeight: 1.5 },
  labels: { m1: "A", m2: "B" },
  assumptions: ["Light inextensible string", "Small smooth pulley", "Particles", "g = 9.8 m s⁻²"],
  parts: [
    {
      id: "a",
      question: "Find the acceleration of B.",
      steps: [
        { text: "A doesn't accelerate vertically, so R = 3g. Friction is limiting while A slides.", latex: "F = \\mu R = 0.2 \\times 3g = 5.88\\ \\text{N}", highlight: "friction" },
        { text: "Equation of motion for A (towards the pulley).", latex: "T - 5.88 = 3a", highlight: "tension" },
        { text: "Equation of motion for B (downwards).", latex: "2g - T = 2a", highlight: "weights" },
        { text: "Add the equations to eliminate T.", latex: "19.6 - 5.88 = 5a \\;\\Rightarrow\\; a = 2.744 \\approx 2.74\\ \\text{m s}^{-2}", highlight: "acceleration" },
      ],
      answer: { quantity: "acceleration", value: 2.744, unit: "m/s²", display: "2.74 m s⁻²" },
    },
    {
      id: "b",
      question: "Find the tension in the string.",
      steps: [{ text: "Substitute a back into B's equation.", latex: "T = 2g - 2(2.744) = 14.112 \\approx 14.1\\ \\text{N}", highlight: "tension" }],
      answer: { quantity: "tension", value: 14.112, unit: "N", display: "14.1 N" },
    },
    {
      id: "c",
      question: "Find the speed of B as it hits the ground.",
      steps: [
        { text: "B falls 1.5 m from rest with constant acceleration.", latex: "v^2 = u^2 + 2as = 0 + 2(2.744)(1.5)", highlight: "system" },
        { text: "Square root.", latex: "v = \\sqrt{8.232} \\approx 2.87\\ \\text{m s}^{-1}", highlight: "velocity" },
      ],
      answer: { quantity: "speedAtHit", value: 2.869, unit: "m/s", display: "2.87 m s⁻¹" },
    },
    {
      id: "d",
      question: "Find the further distance A travels before coming to rest.",
      steps: [
        { text: "B has landed so the string is slack: only friction acts on A.", latex: "-0.2(3g) = 3a' \\;\\Rightarrow\\; a' = -1.96\\ \\text{m s}^{-2}", highlight: "after_impact" },
        { text: "A starts this phase at 2.87 m/s and decelerates to rest.", latex: "0 = 8.232 - 2(1.96)s \\;\\Rightarrow\\; s = 2.1\\ \\text{m}", highlight: "after_impact" },
      ],
      answer: { quantity: "furtherDistance", value: 2.1, unit: "m", display: "2.1 m" },
    },
  ],
};

const roughSlope: SceneSpec = {
  topic: "incline",
  title: "Particle projected up a rough slope",
  questionText:
    "A particle P of mass 2 kg is projected with speed 8 m s⁻¹ up a line of greatest slope of a rough plane inclined at 30° to the horizontal. The coefficient of friction between P and the plane is 0.3. (a) Find the magnitude of the normal reaction on P. (b) Find the deceleration of P as it moves up the plane. (c) Find the distance P travels up the plane before coming to instantaneous rest. (d) Determine whether P remains at rest, giving a reason.",
  g: 9.8,
  objectLabel: "P",
  givens: [
    { symbol: "m", value: 2, unit: "kg", label: "Mass of P", quantity: "mass" },
    { symbol: "u", value: 8, unit: "m/s", label: "Speed of projection up the slope", quantity: "speed" },
    { symbol: "α", value: 30, unit: "°", label: "Angle of the plane", quantity: "none" },
    { symbol: "μ", value: 0.3, unit: "", label: "Coefficient of friction", quantity: "coefficientOfFriction" },
  ],
  params: { mass: 2, angleDeg: 30, mu: 0.3, u: 8, pullForce: 0 },
  assumptions: ["P modelled as a particle", "Friction is limiting while P slides", "g = 9.8 m s⁻²"],
  parts: [
    {
      id: "a",
      question: "Find the normal reaction on P.",
      steps: [{ text: "Resolve perpendicular to the plane: no acceleration in that direction.", latex: "R = 2g\\cos30^\\circ = 16.97\\ \\text{N}", highlight: "normal" }],
      answer: { quantity: "normalReaction", value: 16.97, unit: "N", display: "17.0 N" },
    },
    {
      id: "b",
      question: "Find the deceleration of P.",
      steps: [
        { text: "P is sliding, so friction is limiting and acts down the slope (against motion).", latex: "F = \\mu R = 0.3 \\times 16.97 = 5.092\\ \\text{N}", highlight: "friction" },
        { text: "Newton's second law up the slope: weight component and friction both act down the slope.", latex: "-2g\\sin30^\\circ - 5.092 = 2a", highlight: "weights" },
        { text: "Solve.", latex: "a = -7.446 \\;\\Rightarrow\\; \\text{deceleration} \\approx 7.45\\ \\text{m s}^{-2}", highlight: "acceleration" },
      ],
      answer: { quantity: "acceleration", value: 7.446, unit: "m/s²", display: "7.45 m s⁻²" },
    },
    {
      id: "c",
      question: "Find the distance P travels up the plane before coming to rest.",
      steps: [{ text: "Use v² = u² + 2as with v = 0.", latex: "0 = 8^2 - 2(7.446)s \\;\\Rightarrow\\; s = 4.30\\ \\text{m}", highlight: "velocity" }],
      answer: { quantity: "distanceToRest", value: 4.298, unit: "m", display: "4.30 m" },
    },
    {
      id: "d",
      question: "Determine whether P remains at rest.",
      steps: [
        { text: "Compare the weight component down the slope with the maximum friction available.", latex: "2g\\sin30^\\circ = 9.8\\ \\text{N} \\;>\\; F_{\\max} = 5.09\\ \\text{N}", highlight: "friction" },
        { text: "Friction can't hold P, so it slides back down the plane.", latex: "\\tan30^\\circ = 0.577 > \\mu = 0.3", highlight: "after_impact" },
      ],
      answer: { quantity: "frictionForce", value: 5.092, unit: "N", display: "F_max = 5.09 N < 9.8 N → slides back down" },
    },
  ],
};

export const EXAMPLES: Example[] = [
  { id: "q5-projectile", name: "Projectile from a cliff", blurb: "Edexcel-style Q5 · find H and max height", image: "/examples/q5-projectile.png", spec: projectileCliff },
  { id: "q1-car", name: "Car & forces", blurb: "SUVAT + Newton's 2nd law · find v and D", image: "/examples/q1-car.png", spec: carForces },
  { id: "pulley-table", name: "Pulley on a rough table", blurb: "Connected particles · a, T, impact, further distance", spec: pulleyTable },
  { id: "rough-slope", name: "Up a rough slope", blurb: "Inclined plane · R, friction, deceleration, slides back?", spec: roughSlope },
];
