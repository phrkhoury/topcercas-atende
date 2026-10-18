import { Sidebar } from "@/components/sidebar";
import { db } from "@/lib/db";
import { splitKeys } from "@/lib/pages";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, prefs] = await Promise.all([getSettings(), db.user.findUnique({ where: { id: user.id }, select: { shortcuts: true } })]);
  return (
    <div className="min-h-full md:flex">
      <Sidebar
        user={{ name: user.name, role: user.role }}
        companyName={settings.companyName}
        shortcuts={splitKeys(prefs?.shortcuts)}
        hiddenPages={splitKeys(settings.hiddenPages)}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
