import { redirect } from "next/navigation";
import Terminal from "@/components/Terminal.jsx";
import { getUser } from "@/lib/session.js";
import { loadPlayers } from "@/lib/data.js";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");
  const players = await loadPlayers();
  return <Terminal players={players} user={{ name: user.name, email: user.email }} />;
}
