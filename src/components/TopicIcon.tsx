import { Atom, Car, Link2, Orbit, Triangle } from "lucide-react";
import type { Topic } from "../shared/types";

export const TOPIC_NAMES: Record<Topic, string> = {
  projectile: "Projectiles",
  forces_line: "Forces & SUVAT",
  pulley: "Connected particles",
  incline: "Inclined plane",
  other: "General",
};

export function TopicIcon({ topic, size = 14 }: { topic: Topic; size?: number }) {
  switch (topic) {
    case "projectile":
      return <Orbit size={size} />;
    case "forces_line":
      return <Car size={size} />;
    case "pulley":
      return <Link2 size={size} />;
    case "incline":
      return <Triangle size={size} />;
    default:
      return <Atom size={size} />;
  }
}
