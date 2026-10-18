import "server-only";
import { db } from "./db";
import { runAgent } from "./agent";
import { getSettings } from "./settings";
import { deliverWhatsApp } from "./whatsapp";

// Processa uma conversa por vez, para a IA não responder em paralelo à mesma pessoa.
const locks = new Map<string, Promise<unknown>>();
function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(key, next.catch(() => {}));
  return next;
}

export async function addMessage(conversationId: string, role: "customer" | "ai" | "agent" | "system", text: string, userId?: string, waId?: string) {
  const message = await db.message.create({ data: { conversationId, role, text, userId, waId } });
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
  if (conversation.contact.channel === "whatsapp") {
    const delivered = await deliverWhatsApp(conversation.contact, text).catch((err) => {
      console.error("[whatsapp] envio", err);
      return false;
    });
    if (!delivered) await addMessage(conversationId, "system", "Mensagem não entregue: o WhatsApp está desconectado. Reconecte em WhatsApp.");
  }
}

type Incoming = { phone: string; name?: string; text: string; channel: "sim" | "whatsapp"; waJid?: string; waId?: string };

const alreadySaved = async (waId?: string) => Boolean(waId && (await db.message.findUnique({ where: { waId }, select: { id: true } })));

export async function handleIncoming({ phone, name, text, channel, waJid, waId }: Incoming) {
  if (await alreadySaved(waId)) return { conversationId: null };
  const contact = await db.contact.upsert({
    where: { phone },
    create: { phone, name: name || null, channel, waJid },
    update: waJid ? { waJid, channel } : {},
  });
  const conversation = await db.conversation.upsert({ where: { contactId: contact.id }, create: { contactId: contact.id }, update: {} });
  await addMessage(conversation.id, "customer", text, undefined, waId);

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

/** Alguém da equipe respondeu direto pelo celular: registra a mensagem e pausa a IA nessa conversa. */
export async function recordReplyFromPhone({ phone, waJid, text, waId }: { phone: string; waJid: string; text: string; waId?: string }) {
  if (await alreadySaved(waId)) return;
  const contact = await db.contact.upsert({
    where: { phone },
    create: { phone, channel: "whatsapp", waJid },
    update: { waJid, channel: "whatsapp" },
  });
  const conversation = await db.conversation.upsert({ where: { contactId: contact.id }, create: { contactId: contact.id }, update: {} });
  if (conversation.mode === "ai") {
    await db.conversation.update({ where: { id: conversation.id }, data: { mode: "human", handoffReason: "Respondido pelo celular" } });
    await addMessage(conversation.id, "system", "Respondido pelo celular. A IA está pausada nesta conversa.");
  }
  await addMessage(conversation.id, "agent", text, undefined, waId);
}

export type HistoryItem = { phone: string; waJid: string; name?: string; fromMe: boolean; text: string; at: Date; waId: string };

/**
 * Grava mensagens antigas vindas do celular ao conectar o WhatsApp.
 * Não aciona a IA, não marca como não lidas e ignora mensagens já salvas.
 */
export async function importHistory(items: HistoryItem[]) {
  const byPhone = new Map<string, HistoryItem[]>();
  for (const item of items) byPhone.set(item.phone, [...(byPhone.get(item.phone) ?? []), item]);

  let imported = 0;
  for (const [phone, list] of byPhone) {
    const name = list.find((i) => !i.fromMe && i.name)?.name ?? list.find((i) => i.name)?.name;
    const waJid = list[list.length - 1].waJid;
    const contact = await db.contact.upsert({
      where: { phone },
      create: { phone, name: name ?? null, channel: "whatsapp", waJid },
      update: { waJid, channel: "whatsapp" },
    });
    if (!contact.name && name) await db.contact.update({ where: { id: contact.id }, data: { name } });
    const conversation = await db.conversation.upsert({ where: { contactId: contact.id }, create: { contactId: contact.id }, update: {} });

    const existing = new Set(
      (await db.message.findMany({ where: { waId: { in: list.map((i) => i.waId) } }, select: { waId: true } })).map((m) => m.waId),
    );
    const fresh = list.filter((i) => !existing.has(i.waId)).sort((a, b) => a.at.getTime() - b.at.getTime());
    if (!fresh.length) continue;

    await db.message.createMany({
      data: fresh.map((i) => ({ conversationId: conversation.id, role: i.fromMe ? "agent" : "customer", text: i.text, createdAt: i.at, waId: i.waId })),
    });
    const newest = fresh[fresh.length - 1].at;
    if (newest > conversation.lastMessageAt) await db.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: newest } });
    imported += fresh.length;
  }
  return imported;
}
