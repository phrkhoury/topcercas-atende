import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";
import { WhatsAppConnection } from "./connection";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="WhatsApp" subtitle="Conecte o número da empresa lendo o QR Code com o celular." />
      <WhatsAppConnection />
    </>
  );
}
