import Terminal from "@/components/Terminal.jsx";
import { players } from "@/lib/players.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "AgentSolver · Preview local" };

export default function Preview() {
  return <Terminal players={players} user={{ name: "Agente demo", email: "demo@agentsolver.local" }} />;
}
