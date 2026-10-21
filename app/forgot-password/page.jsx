import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export const metadata = { title: "AgentSolver · Recuperar contraseña" };

export default async function ForgotPasswordPage({ searchParams }) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-black px-6 text-[#f4f1e8]">
      <ForgotPasswordForm error={params?.error} sent={params?.sent === "1"} verified={params?.verified === "1"} />
    </main>
  );
}
