import ForgotPasswordForm from "@/components/ForgotPasswordForm";
import ThemeToggle from "@/components/ThemeToggle.jsx";

export const metadata = { title: "AgentSolver · Recuperar contraseña" };

export default async function ForgotPasswordPage({ searchParams }) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="absolute right-5 top-5"><ThemeToggle compact /></div>
      <ForgotPasswordForm error={params?.error} sent={params?.sent === "1"} verified={params?.verified === "1"} />
    </main>
  );
}
