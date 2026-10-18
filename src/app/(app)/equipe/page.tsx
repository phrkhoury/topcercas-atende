import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";
import { setUserActive } from "@/app/actions";
import { NewUserForm, ResetPasswordForm } from "./team-forms";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const me = await requireAdmin();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const users = await db.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          conversations: true,
          messages: { where: { createdAt: { gte: weekAgo } } },
        },
      },
    },
  });

  return (
    <>
      <PageHeader title="Equipe" subtitle="Crie acessos para os colaboradores. Como administrador, você vê e pode transferir todas as conversas." />
      <div className="grid gap-8 p-4 md:p-8 xl:grid-cols-[1fr_340px]">
        <div className="card divide-y divide-line">
          {users.map((u) => (
            <div key={u.id} className={`flex flex-wrap items-center gap-4 p-4 ${u.active ? "" : "opacity-50"}`}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                {u.name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {u.name} {u.id === me.id && <span className="text-xs font-normal text-dim">(você)</span>}
                </div>
                <div className="text-sm text-muted">{u.email}</div>
              </div>
              <span className={`chip ${u.role === "admin" ? "bg-violet-500/15 text-violet-300" : "bg-card-2 text-muted"}`}>{u.role === "admin" ? "Administrador" : "Colaborador"}</span>
              {!u.active && <span className="chip bg-rose-500/15 text-rose-300">Desativado</span>}
              <div className="text-xs text-muted">
                <div>{u._count.conversations} conversas atribuídas</div>
                <div>{u._count.messages} mensagens nos últimos 7 dias</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/conversas?atendente=${u.id}`} className="btn-ghost px-3 py-1">Ver conversas</Link>
                <ResetPasswordForm userId={u.id} />
                {u.id !== me.id && (
                  <form action={setUserActive.bind(null, u.id, !u.active)}>
                    <button className={`btn-ghost px-3 py-1 ${u.active ? "hover:border-rose-400" : ""}`}>{u.active ? "Desativar" : "Reativar"}</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>

        <aside className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">Novo acesso</h2>
          <NewUserForm />
          <p className="mt-4 text-xs text-dim">Passe o e-mail e a senha inicial para o colaborador. Ao desativar alguém, as conversas dele voltam para a fila.</p>
        </aside>
      </div>
    </>
  );
}
