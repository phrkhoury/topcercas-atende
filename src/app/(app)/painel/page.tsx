import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { STAGES } from "@/lib/constants";
import { formatDateTime, fromLocal, toLocalParts } from "@/lib/time";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function PainelPage() {
  const today = fromLocal(`${toLocalParts(new Date()).date}T00:00`);
  const [settings, todayCustomerMsgs, todayAiMsgs, newLeads, humanQueue, byStage, upcoming] = await Promise.all([
    getSettings(),
    db.message.count({ where: { role: "customer", createdAt: { gte: today } } }),
    db.message.count({ where: { role: "ai", createdAt: { gte: today } } }),
    db.contact.count({ where: { createdAt: { gte: today } } }),
    db.conversation.findMany({ where: { mode: "human", assignedToId: null }, include: { contact: true }, orderBy: { lastMessageAt: "desc" }, take: 8 }),
    db.contact.groupBy({ by: ["stage"], _count: true }),
    db.appointment.findMany({ where: { status: "agendada", start: { gte: new Date() } }, include: { contact: true }, orderBy: { start: "asc" }, take: 6 }),
  ]);
  const stageCount = (id: string) => byStage.find((s) => s.stage === id)?._count ?? 0;
  const totalLeads = byStage.reduce((n, s) => n + s._count, 0);
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

  const stats = [
    { label: "Mensagens de clientes hoje", value: todayCustomerMsgs },
    { label: "Respostas da IA hoje", value: todayAiMsgs },
    { label: "Novos leads hoje", value: newLeads },
    { label: "Visitas agendadas", value: upcoming.length },
  ];

  return (
    <>
      <PageHeader title="Painel" subtitle="Resumo do atendimento">
        <span className={`chip px-3 py-1 text-xs ${settings.aiEnabled ? "bg-brand/15 text-brand" : "bg-rose-500/15 text-rose-300"}`}>
          {settings.aiEnabled ? `● IA ${settings.assistantName} ligada` : "● IA desligada"}
        </span>
      </PageHeader>

      <div className="space-y-6 p-4 md:p-8">
        {!hasKey && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            A IA ainda não tem chave configurada. Preencha <code className="rounded bg-black/30 px-1">ANTHROPIC_API_KEY</code> no arquivo <code className="rounded bg-black/30 px-1">.env</code> e reinicie o servidor.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="card p-5">
              <div className="text-3xl font-semibold">{s.value}</div>
              <div className="mt-1 text-sm text-muted">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="card p-5">
            <h2 className="mb-4 font-semibold">Funil ({totalLeads} leads)</h2>
            <div className="space-y-3">
              {STAGES.map((s) => {
                const n = stageCount(s.id);
                return (
                  <div key={s.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{s.label}</span>
                      <span className="text-muted">{n}</span>
                    </div>
                    <div className="h-2 rounded-full bg-card-2">
                      <div className={`h-2 rounded-full ${s.color}`} style={{ width: `${totalLeads ? (n / totalLeads) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <Link href="/crm" className="btn-ghost mt-5 w-full">Abrir CRM</Link>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-semibold">Precisa de você ({humanQueue.length})</h2>
            {humanQueue.length === 0 && <p className="text-sm text-dim">Nenhuma conversa aguardando atendente.</p>}
            <ul className="space-y-3">
              {humanQueue.map((c) => (
                <li key={c.id}>
                  <Link href={`/conversas?id=${c.id}`} className="block rounded-xl border border-line p-3 hover:border-amber-400/50">
                    <div className="text-sm font-semibold">{c.contact.name || `+${c.contact.phone}`}</div>
                    <div className="text-xs text-amber-300">{c.handoffReason || "Atendimento humano"}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-semibold">Próximas visitas</h2>
            {upcoming.length === 0 && <p className="text-sm text-dim">Nenhuma visita agendada.</p>}
            <ul className="space-y-3">
              {upcoming.map((a) => (
                <li key={a.id} className="text-sm">
                  <div className="font-semibold">{formatDateTime(a.start)}</div>
                  <div className="text-muted">{a.contact.name || `+${a.contact.phone}`} · {a.address || a.contact.address || "sem endereço"}</div>
                </li>
              ))}
            </ul>
            <Link href="/agenda" className="btn-ghost mt-5 w-full">Abrir agenda</Link>
          </section>
        </div>
      </div>
    </>
  );
}
