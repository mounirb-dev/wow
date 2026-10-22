import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next.js";
import { getUser } from "@/lib/session.js";
import ModernAnimatedSignIn from "@/components/ModernAnimatedSignIn.jsx";

export const metadata = { title: "wow · Acceso" };

export default async function Login({ searchParams }) {
  const params = await searchParams;
  if (await getUser()) redirect(safeNext(params.next));
  const { error, next } = params;
  return <ModernAnimatedSignIn error={error} next={safeNext(next)} />;
}
