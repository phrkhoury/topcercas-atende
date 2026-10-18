import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { STAGES, parseServices } from "@/lib/constants";
import { getServices } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { updateContact } from "@/app/actions";
import { Kanban } from "./kanban";

export const dynamic = "force-dynamic";

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead: leadId } = await searchParams;
  const services = await getServices();
  const contacts = await db.contact.findMany({ orderBy: { updatedAt: "desc" }, include: { conversation: { select: { id: true, mode: true } } } });
  const lead = leadId
    ? await db.contact.findUnique({ where: { id: leadId }, include: { conversation: true, appointments: { orderBy: { start: "desc" } } } })
    : null;

  return (
    <>
      <PageHeader title="CRM" subtitle="Arraste os cards entre as etapas. A IA também move os leads conforme a conversa avança." />
      <Kanban
        leads={contacts.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          stage: c.stage,
          service: c.service,
          address: c.address,
          meters: c.meters,
          value: c.value,
          mode: c.conversation?.mode ?? null,
        }))}
      />

      {lead && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50">
          <Link href="/crm" scroll={false} className="flex-1" aria-label="Fechar" />
          <aside className="h-full w-full max-w-md overflow-y-auto border-l border-line bg-panel p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{lead.name || `+${lead.phone}`}</h2>
                <p className="text-sm text-dim">+{lead.phone}</p>
              </div>
              <Link href="/crm" scroll={false} className="btn-ghost px-3 py-1">✕</Link>
            </div>

            <form action={updateContact} className="space-y-4">
              <input type="hidden" name="id" value={lead.id} />
              <div>
                <label className="label" htmlFor="name">Nome</label>
                <input id="name" name="name" defaultValue={lead.name ?? ""} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="stage">Etapa</label>
                <select id="stage" name="stage" defaultValue={lead.stage} className="input">
                  {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <fieldset>
                <legend className="label">Serviços (marque um ou mais)</legend>
                <div className="grid grid-cols-2 gap-2">
                  {[...new Set([...services, ...parseServices(lead.service)])].map((s) => (
                    <label key={s} className="cursor-pointer">
                      <input type="checkbox" name="service" value={s} defaultChecked={parseServices(lead.service).includes(s)} className="peer sr-only" />
                      <span className="block rounded-xl border border-line-2 px-3 py-2 text-sm text-muted peer-checked:border-brand peer-checked:bg-brand/15 peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-brand">
                        {s}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label className="label" htmlFor="address">Endereço / bairro</label>
                <input id="address" name="address" defaultValue={lead.address ?? ""} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="meters">Metragem (m)</label>
                  <input id="meters" name="meters" type="number" min={0} defaultValue={lead.meters ?? ""} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="value">Valor do orçamento (R$)</label>
                  <input id="value" name="value" type="number" min={0} step="0.01" defaultValue={lead.value ?? ""} className="input" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="notes">Observações</label>
                <textarea id="notes" name="notes" rows={4} defaultValue={lead.notes ?? ""} className="input" />
              </div>
              <button className="btn-primary w-full">Salvar</button>
            </form>

            <div className="mt-8 space-y-3 text-sm">
              {lead.conversation && (
                <Link href={`/conversas?id=${lead.conversation.id}`} className="btn-ghost w-full">Abrir conversa</Link>
              )}
              <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-dim">Visitas</h3>
              {lead.appointments.length === 0 && <p className="text-dim">Nenhuma visita.</p>}
              {lead.appointments.map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span>{formatDateTime(a.start)}</span>
                  <span className="text-muted">{a.status}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
