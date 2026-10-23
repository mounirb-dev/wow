import Terminal from "@/components/Terminal.jsx";
import { requireUser } from "@/lib/session.js";
import { loadPlayers } from "@/lib/data.js";

// Raíz: exige sesión y entrega la cartera al cliente. force-dynamic porque depende de cookies.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [user, players] = await Promise.all([requireUser(), loadPlayers()]);
  return <Terminal players={players} user={{ name: user.name, email: user.email }} />;
}
