// Tarefas de fundo que só rodam no servidor Node (nunca no ambiente edge):
// lembretes de visita e reconexão do WhatsApp por QR Code.
import { sendDueReminders } from "./lib/scheduler";
import { hasSavedSession, startWhatsApp } from "./lib/wa-qr";

const g = globalThis as unknown as { __reminders?: NodeJS.Timeout };

if (process.env.DISABLE_SCHEDULER !== "1" && !g.__reminders) {
  const tick = () => sendDueReminders().catch((err) => console.error("[lembretes]", err));
  g.__reminders = setInterval(tick, 60_000);
  tick();
}

if (hasSavedSession()) startWhatsApp().catch((err) => console.error("[whatsapp] início", err));
