import { Sidebar } from "@/components/sidebar";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-full md:flex">
      <Sidebar user={{ name: user.name, role: user.role }} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
