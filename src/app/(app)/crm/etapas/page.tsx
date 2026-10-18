import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";
import { getStages, STAGE_COLORS } from "@/lib/stages";
import { NewStageForm, StageRow } from "./stage-forms";

export const dynamic = "force-dynamic";

export default async function EtapasPage() {
  await requireAdmin();
  const [stages, counts] = await Promise.all([getStages(), db.contact.groupBy({ by: ["stage"], _count: true })]);
  const leadCount = (id: string) => counts.find((c) => c.stage === id)?._count ?? 0;

  return (
    <>
      <PageHeader title="Etapas do funil" subtitle="Crie, renomeie, reordene ou exclua as etapas do CRM. A primeira etapa recebe os contatos novos.">
        <Link href="/crm" className="btn-ghost">← Voltar ao CRM</Link>
      </PageHeader>
      <div className="grid gap-8 p-4 md:p-8 xl:grid-cols-[1fr_320px]">
        <div className="card divide-y divide-line">
          {stages.map((s, i) => (
            <StageRow
              key={`${s.id}-${s.name}-${s.color}-${s.isVisit}-${i}`}
              stage={s}
              others={stages.filter((o) => o.id !== s.id)}
              colors={STAGE_COLORS}
              index={i}
              total={stages.length}
              leadCount={leadCount(s.id)}
            />
          ))}
        </div>
        <aside className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">Nova etapa</h2>
          <NewStageForm colors={STAGE_COLORS} />
        </aside>
      </div>
    </>
  );
}
