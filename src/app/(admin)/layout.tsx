import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requirePlatformAdmin } from "@/modules/auth/services/guards";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-brand-canvas">
      <AdminSidebar />
      <div className="flex min-h-screen flex-col md:pl-60">
        <AdminHeader userLabel={user.displayName} userEmail={user.email} />
        <main className="flex-1 bg-brand-canvas px-4 py-6 md:px-6 border-l border-border max-md:border-l-0">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
