import { createHmac, timingSafeEqual } from "node:crypto";
import { handleIncoming } from "@/lib/inbox";

// Verificação do webhook pela Meta (GET com hub.challenge)
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const ok = params.get("hub.mode") === "subscribe" && process.env.WHATSAPP_VERIFY_TOKEN && params.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN;
  return ok ? new Response(params.get("hub.challenge")) : new Response("Forbidden", { status: 403 });
}

function validSignature(body: string, header: string | null) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(body).digest("hex"));
  const received = Buffer.from(header.slice(7));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

type WebhookPayload = {
  entry?: { changes?: { value?: { contacts?: { wa_id: string; profile?: { name?: string } }[]; messages?: { from: string; type: string; text?: { body: string } }[] } }[] }[];
};

export async function POST(req: Request) {
  const body = await req.text();
  if (!validSignature(body, req.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });

  const payload = JSON.parse(body) as WebhookPayload;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      for (const msg of value?.messages ?? []) {
        const name = value?.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name;
        const text = msg.type === "text" && msg.text ? msg.text.body : `[${msg.type} recebido — abra o WhatsApp para ver]`;
        // Responde 200 rápido; a IA roda em segundo plano.
        handleIncoming({ phone: msg.from, name, text, channel: "whatsapp" }).catch((err) => console.error("[webhook]", err));
      }
    }
  }
  return new Response("OK");
}
