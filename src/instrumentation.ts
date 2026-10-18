// Roda uma vez ao iniciar o servidor: liga o envio automático de lembretes.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_SCHEDULER === "1") return;
  const { sendDueReminders } = await import("./lib/scheduler");
  const g = globalThis as unknown as { __reminders?: NodeJS.Timeout };
  if (g.__reminders) return;
  const tick = () => sendDueReminders().catch((err) => console.error("[lembretes]", err));
  g.__reminders = setInterval(tick, 60_000);
  tick();
}
