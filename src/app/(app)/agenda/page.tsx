import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import { formatDayLong, formatTime, fromLocal, toLocalParts } from "@/lib/time";
import { getSettings } from "@/lib/settings";
import { createAppointment, setAppointmentStatus } from "@/app/actions";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  agendada: "bg-brand/15 text-brand",
  concluida: "bg-sky-500/15 text-sky-300",
  cancelada: "bg-rose-500/15 text-rose-300 line-through",
};

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver } = await searchParams;
  const showPast = ver === "passadas";
  const today = fromLocal(`${toLocalParts(new Date()).date}T00:00`);

  const [appointments, contacts, settings] = await Promise.all([
    db.appointment.findMany({
      where: showPast ? { start: { lt: today } } : { start: { gte: today } },
      orderBy: { start: showPast ? "desc" : "asc" },
      take: 200,
      include: { contact: { include: { conversation: { select: { id: true } } } } },
    }),
    db.contact.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, phone: true, address: true } }),
    getSettings(),
  ]);

  const byDay = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const key = toLocalParts(a.start).date;
    byDay.set(key, [...(byDay.get(key) ?? []), a]);
  }

  return (
    <>
      <PageHeader title="Agenda de visitas" subtitle="Visitas marcadas pela IA ou pela equipe. Os clientes recebem lembrete automático 24h antes.">
        <div className="flex gap-2">
          <Link href="/agenda" className={showPast ? "btn-ghost" : "btn-primary"}>Próximas</Link>
          <Link href="/agenda?ver=passadas" className={showPast ? "btn-primary" : "btn-ghost"}>Passadas</Link>
        </div>
      </PageHeader>

      <div className="grid gap-8 p-4 md:p-8 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {byDay.size === 0 && <div className="card p-8 text-center text-sm text-dim">Nenhuma visita {showPast ? "passada" : "agendada"}.</div>}
          {[...byDay.entries()].map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-semibold capitalize text-muted">{formatDayLong(fromLocal(`${day}T12:00`))}</h2>
              <div className="card divide-y divide-line">
                {items.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="w-14 text-lg font-semibold">{formatTime(a.start)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{a.contact.name || `+${a.contact.phone}`}</div>
                      <div className="text-sm text-muted">{a.address || a.contact.address || "Endereço não informado"}</div>
                      {a.notes && <div className="mt-1 text-xs text-dim">{a.notes}</div>}
                    </div>
                    <span className={`chip ${STATUS_STYLE[a.status]}`}>{APPOINTMENT_STATUS[a.status]}</span>
                    {a.reminderSentAt && <span className="chip bg-card-2 text-muted">Lembrete enviado</span>}
                    <div className="flex gap-2">
                      {a.contact.conversation && <Link href={`/conversas?id=${a.contact.conversation.id}`} className="btn-ghost px-3 py-1">Conversa</Link>}
                      {a.status === "agendada" && (
                        <>
                          <form action={setAppointmentStatus.bind(null, a.id, "concluida")}><button className="btn-ghost px-3 py-1">Concluir</button></form>
                          <form action={setAppointmentStatus.bind(null, a.id, "cancelada")}><button className="btn-ghost px-3 py-1 hover:border-rose-400">Cancelar</button></form>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="card h-fit p-5">
          <h2 className="font-semibold">Agendar manualmente</h2>
          {contacts.length === 0 ? (
            <p className="mt-2 text-sm text-dim">Cadastre um lead primeiro (pelo simulador ou WhatsApp).</p>
          ) : (
            <form action={createAppointment} className="mt-4 space-y-3">
              <div>
                <label className="label" htmlFor="contactId">Cliente</label>
                <select id="contactId" name="contactId" required className="input">
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name || `+${c.phone}`}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="date">Data</label>
                  <input id="date" name="date" type="date" required defaultValue={toLocalParts(new Date()).date} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="time">Hora</label>
                  <input id="time" name="time" type="time" required defaultValue={settings.workStart} className="input" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="durationMin">Duração (min)</label>
                <input id="durationMin" name="durationMin" type="number" min={15} step={15} defaultValue={settings.visitMinutes} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="address">Endereço</label>
                <input id="address" name="address" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="notes">Observações</label>
                <input id="notes" name="notes" className="input" />
              </div>
              <button className="btn-primary w-full">Agendar</button>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
