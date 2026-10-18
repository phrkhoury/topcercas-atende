import { PageHeader } from "@/components/page-header";
import { Simulator } from "./simulator";

export default function SimuladorPage() {
  return (
    <>
      <PageHeader title="Simulador de WhatsApp" subtitle="Converse como se fosse um cliente para testar a IA antes de conectar o número real." />
      <Simulator />
    </>
  );
}
