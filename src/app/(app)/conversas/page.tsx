import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getStages } from "@/lib/stages";
import { Inbox } from "./inbox";

export const dynamic = "force-dynamic";

export default async function ConversasPage({ searchParams }: { searchParams: Promise<{ id?: string; atendente?: string }> }) {
  const { id, atendente } = await searchParams;
  const me = await requireUser();
  const team = me.role === "admin" ? await db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];
  return <Inbox initialId={id} initialAgent={me.role === "admin" ? atendente : undefined} me={{ id: me.id, role: me.role }} team={team} stages={await getStages()} />;
}
