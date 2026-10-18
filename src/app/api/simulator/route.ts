import { z } from "zod";
import { handleIncoming } from "@/lib/inbox";
import { getCurrentUser } from "@/lib/session";

const input = z.object({ phone: z.string().regex(/^\d{10,13}$/), name: z.string().max(80).optional(), text: z.string().min(1).max(2000) });

// Só o administrador usa o simulador (as conversas criadas ficam sem responsável).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return Response.json({ error: "Sem acesso" }, { status: 403 });
  const parsed = input.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  const result = await handleIncoming({ ...parsed.data, channel: "sim" });
  return Response.json(result);
}
