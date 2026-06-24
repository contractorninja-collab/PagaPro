import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PagaProLogo, PagaProMark } from "@/components/branding/logo";
import { getCurrentUser } from "@/modules/auth/services/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Hyrje — PagaPRO",
};

export default async function HyrjePage() {
  const user = await getCurrentUser();
  if (user) {
    if (user.mustChangePassword) redirect("/ndrysho-fjalekalimin");
    redirect(user.isPlatformAdmin ? "/admin" : "/paneli");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <PagaProMark size={48} />
          <PagaProLogo ariaHidden />
          <p className="text-sm text-muted-foreground">Hyni në llogarinë tuaj</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Nuk keni llogari? Kontaktoni administratorin e PagaPRO.
        </p>
      </div>
    </main>
  );
}
