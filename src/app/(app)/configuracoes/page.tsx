import { PageHeader } from "@/components/page-header";
import { getSettings, servicesFrom } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Configurar IA" subtitle="Ensine a IA sobre a TOPCERCAS e defina como ela atende." />
      <SettingsForm settings={{ ...settings, services: servicesFrom(settings).join("\n") }} />
    </>
  );
}
