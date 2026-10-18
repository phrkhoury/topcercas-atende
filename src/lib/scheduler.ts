import { db } from "./db";
import { sendToCustomer } from "./inbox";
import { formatDateTime } from "./time";
import { getSettings } from "./settings";

/** Envia lembrete às visitas que acontecem nas próximas 24h e ainda não foram lembradas. */
export async function sendDueReminders() {
  const now = new Date();
  const due = await db.appointment.findMany({
    where: { status: "agendada", reminderSentAt: null, start: { gt: now, lte: new Date(now.getTime() + 24 * 3_600_000) } },
    include: { contact: { include: { conversation: true } } },
  });
  if (!due.length) return;
  const { companyName } = await getSettings();
  for (const a of due) {
    const conversationId = a.contact.conversation?.id;
    if (conversationId) {
      const first = a.contact.name ? `, ${a.contact.name.split(" ")[0]}` : "";
      await sendToCustomer(
        conversationId,
        "ai",
        `Olá${first}! Lembrete da ${companyName}: sua visita técnica está marcada para ${formatDateTime(a.start)}${a.address ? `, em ${a.address}` : ""}. Se precisar remarcar, é só responder por aqui.`,
      );
    }
    await db.appointment.update({ where: { id: a.id }, data: { reminderSentAt: now } });
  }
}
