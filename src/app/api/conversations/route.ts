import { db } from "@/lib/db";
import { conversationScope, getCurrentUser } from "@/lib/session";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  // O administrador pode filtrar pelas conversas de um colaborador (?atendente=ID ou "livres")
  const atendente = user.role === "admin" ? new URL(req.url).searchParams.get("atendente") : null;
  const byAgent = atendente === "livres" ? { assignedToId: null } : atendente ? { assignedToId: atendente } : {};

  const conversations = await db.conversation.findMany({
    where: { AND: [conversationScope(user), byAgent] },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    include: {
      contact: { select: { name: true, phone: true, stage: true, channel: true } },
      assignedTo: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { text: true, role: true } },
    },
  });
  return Response.json(
    conversations.map((c) => ({
      id: c.id,
      mode: c.mode,
      unread: c.unread,
      lastMessageAt: c.lastMessageAt,
      contact: c.contact,
      assignedTo: c.assignedTo,
      last: c.messages[0] ?? null,
    })),
  );
}
