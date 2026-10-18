import "server-only";
import { db } from "./db";
import { runAgent } from "./agent";
import { getSettings } from "./settings";
import { sendWhatsAppText } from "./whatsapp";

// Processa uma conversa por vez, para a IA não responder em paralelo à mesma pessoa.
const locks = new Map<string, Promise<unknown>>();
function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(key, next.catch(() => {}));
  return next;
}

export async function addMessage(conversationId: string, role: "customer" | "ai" | "agent" | "system", text: string, userId?: string) {
  const message = await db.message.create({ data: { conversationId, role, text, userId } });
  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: message.createdAt, ...(role === "customer" ? { unread: { increment: 1 } } : {}) },
  });
  return message;
}

/** Envia uma mensagem da empresa (IA, atendente ou lembrete) e entrega pelo canal do contato. */
export async function sendToCustomer(conversationId: string, role: "ai" | "agent", text: string, userId?: string) {
  const conversation = await db.conversation.findUniqueOrThrow({ where: { id: conversationId }, include: { contact: true } });
  await addMessage(conversationId, role, text, userId);
  if (conversation.contact.channel === "whatsapp") await sendWhatsAppText(conversation.contact.phone, text);
}

export async function handleIncoming({ phone, name, text, channel }: { phone: string; name?: string; text: string; channel: "sim" | "whatsapp" }) {
  const contact = await db.contact.upsert({
    where: { phone },
    create: { phone, name: name || null, channel },
    update: {},
  });
  const conversation = await db.conversation.upsert({ where: { contactId: contact.id }, create: { contactId: contact.id }, update: {} });
  await addMessage(conversation.id, "customer", text);

  return serialize(conversation.id, async () => {
    const [current, settings] = await Promise.all([db.conversation.findUniqueOrThrow({ where: { id: conversation.id } }), getSettings()]);
    if (current.mode !== "ai" || !settings.aiEnabled) return { conversationId: conversation.id };

    const result = await runAgent(conversation.id);
    if (result.reply) await sendToCustomer(conversation.id, "ai", result.reply);
    if (result.error) await addMessage(conversation.id, "system", result.error);
    if (result.handedOff) await addMessage(conversation.id, "system", "Conversa transferida para atendimento humano.");
    return { conversationId: conversation.id };
  });
}
