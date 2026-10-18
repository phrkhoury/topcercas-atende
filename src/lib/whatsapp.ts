import "server-only";

// Duas formas de enviar pelo WhatsApp:
// - Cloud API oficial da Meta (quando WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID estão definidos)
// - Conexão por QR Code (WhatsApp Web), configurada na tela WhatsApp
export const whatsappEnabled = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

export async function sendWhatsAppText(to: string, body: string) {
  if (!whatsappEnabled()) return false;
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
  });
  if (!res.ok) console.error("[whatsapp] falha ao enviar", res.status, await res.text());
  return res.ok;
}

/** Entrega uma mensagem ao contato pelo canal disponível. Retorna false se não foi possível enviar. */
export async function deliverWhatsApp(contact: { phone: string; waJid: string | null }, text: string) {
  if (whatsappEnabled()) return sendWhatsAppText(contact.phone, text);
  const { sendViaQr } = await import("./wa-qr");
  return sendViaQr(contact.waJid ?? `${contact.phone}@s.whatsapp.net`, text);
}
