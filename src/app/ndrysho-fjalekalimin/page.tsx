import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PagaProLogo, PagaProMark } from "@/components/branding/logo";
import { getCurrentUser } from "@/modules/auth/services/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "Ndrysho fjalëkalimin — PagaPRO",
};

export default async function NdryshoFjalekaliminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/hyrje");

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <PagaProMark size={48} />
          <PagaProLogo ariaHidden />
          <p className="text-center text-sm text-muted-foreground">
            {user.mustChangePassword
              ? "Për arsye sigurie, ndryshoni fjalëkalimin e përkohshëm para se të vazhdoni."
              : "Ndryshoni fjalëkalimin e llogarisë suaj."}
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
