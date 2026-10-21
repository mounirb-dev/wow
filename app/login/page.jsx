import { redirect } from "next/navigation";
import { getUser } from "@/lib/session.js";
import ModernAnimatedSignIn from "@/components/ModernAnimatedSignIn.jsx";

export const metadata = { title: "AgentSolver · Acceso" };

export default async function Login({ searchParams }) {
  if (await getUser()) redirect("/");
  const { error } = await searchParams;
  return <ModernAnimatedSignIn error={error} />;
}
