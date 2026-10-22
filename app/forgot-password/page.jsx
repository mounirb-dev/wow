import ForgotPasswordForm from "@/components/ForgotPasswordForm";
import BrandLogo from "@/components/BrandLogo.jsx";
import ThemeToggle from "@/components/ThemeToggle.jsx";

export const metadata = { title: "wow · Recuperar contraseña" };

export default async function ForgotPasswordPage({ searchParams }) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="absolute right-5 top-5"><ThemeToggle compact /></div>
      <div className="flex flex-col items-center gap-6">
        <BrandLogo className="h-16" />
        <ForgotPasswordForm error={params?.error} sent={params?.sent === "1"} verified={params?.verified === "1"} />
      </div>
    </main>
  );
}
