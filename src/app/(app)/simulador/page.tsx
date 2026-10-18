import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";
import { Simulator } from "./simulator";

export default async function SimuladorPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Simulador de WhatsApp" subtitle="Converse como se fosse um cliente para testar a IA antes de conectar o número real." />
      <Simulator />
    </>
  );
}
