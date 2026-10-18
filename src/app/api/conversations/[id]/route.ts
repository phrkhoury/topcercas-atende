import { z } from "zod";
import { db } from "@/lib/db";
import { addMessage, sendToCustomer } from "@/lib/inbox";
import { canAccessConversation, getCurrentUser } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

const forbidden = () => Response.json({ error: "Sem acesso a esta conversa" }, { status: 403 });

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  if (!(await canAccessConversation(user, id))) return forbidden();

  const conversation = await db.conversation.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      contact: { include: { appointments: { where: { status: "agendada" }, orderBy: { start: "asc" } } } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 500,
        select: { id: true, role: true, text: true, createdAt: true, user: { select: { name: true } } },
      },
    },
  });
  if (!conversation) return Response.json({ error: "Não encontrada" }, { status: 404 });
  return Response.json({
    ...conversation,
    messages: conversation.messages.map(({ user: author, ...m }) => ({ ...m, author: author?.name ?? null })),
  });
}

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), text: z.string().min(1).max(4000) }),
  z.object({ action: z.literal("mode"), mode: z.enum(["ai", "human"]) }),
  z.object({ action: z.literal("assign"), userId: z.string().nullable() }),
  z.object({ action: z.literal("read") }),
]);

export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  if (!(await canAccessConversation(user, id))) return forbidden();

  const parsed = action.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Ação inválida" }, { status: 400 });
  const body = parsed.data;
  const conv = await db.conversation.findUniqueOrThrow({ where: { id } });

  if (body.action === "send") {
    // Quem responde assume a conversa (se estiver livre) e a IA pausa até ser reativada.
    if (conv.mode === "ai" || !conv.assignedToId) {
      await db.conversation.update({
        where: { id },
        data: { mode: "human", handoffReason: conv.mode === "ai" ? `${user.name} assumiu a conversa` : undefined, assignedToId: conv.assignedToId ?? user.id },
      });
      if (!conv.assignedToId) await addMessage(id, "system", `${user.name} assumiu a conversa. A IA está pausada.`);
    }
    await sendToCustomer(id, "agent", body.text, user.id);
  } else if (body.action === "mode") {
    if (body.mode === "ai") {
      // A conversa continua com o mesmo responsável; só a IA volta a responder.
      await db.conversation.update({ where: { id }, data: { mode: "ai", handoffReason: null } });
      await addMessage(id, "system", `${user.name} devolveu a conversa para a IA.`);
    } else {
      await db.conversation.update({ where: { id }, data: { mode: "human", handoffReason: `${user.name} assumiu a conversa`, assignedToId: user.id } });
      await addMessage(id, "system", `${user.name} assumiu a conversa. A IA está pausada.`);
    }
  } else if (body.action === "assign") {
    if (user.role !== "admin") return forbidden();
    const target = body.userId ? await db.user.findFirst({ where: { id: body.userId, active: true } }) : null;
    if (body.userId && !target) return Response.json({ error: "Colaborador não encontrado" }, { status: 400 });
    await db.conversation.update({
      where: { id },
      data: { assignedToId: target?.id ?? null, ...(target ? { mode: "human", handoffReason: `Transferida para ${target.name}` } : {}) },
    });
    await addMessage(id, "system", target ? `${user.name} transferiu a conversa para ${target.name}.` : `${user.name} liberou a conversa para a fila.`);
  }

  await db.conversation.update({ where: { id }, data: { unread: 0 } });
  return Response.json({ ok: true });
}
