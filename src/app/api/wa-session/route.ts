import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { whatsappEnabled } from "@/lib/whatsapp";
import { getWaState, logoutWhatsApp, startWhatsApp } from "@/lib/wa-qr";

// Status e controle da conexão por QR Code (só administrador).
async function admin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

export async function GET() {
  if (!(await admin())) return Response.json({ error: "Sem acesso" }, { status: 403 });
  return Response.json({ ...getWaState(), cloudApi: whatsappEnabled() });
}

const action = z.object({ action: z.enum(["connect", "logout"]) });

export async function POST(req: Request) {
  if (!(await admin())) return Response.json({ error: "Sem acesso" }, { status: 403 });
  const parsed = action.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Ação inválida" }, { status: 400 });
  if (parsed.data.action === "connect") await startWhatsApp();
  else await logoutWhatsApp();
  return Response.json(getWaState());
}
