import "server-only";

// WhatsApp Cloud API (oficial da Meta). Fica inativo enquanto as variáveis não estiverem definidas.
export const whatsappEnabled = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

export async function sendWhatsAppText(to: string, body: string) {
  if (!whatsappEnabled()) return;
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
  });
  if (!res.ok) console.error("[whatsapp] falha ao enviar", res.status, await res.text());
}
