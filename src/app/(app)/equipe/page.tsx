import Link from "next/link";
import { Building2, Check, Crown, LayoutGrid, Users } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { PAGES, splitKeys } from "@/lib/pages";
import { setUserActive } from "@/app/actions";
import { NewUserForm, ResetPasswordForm } from "./team-forms";
import { PageToggles } from "./page-toggles";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const me = await requireAdmin();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [settings, leads, messages, users] = await Promise.all([
    getSettings(),
    db.contact.count(),
    db.message.count({ where: { role: { in: ["customer", "ai", "agent"] } } }),
    db.user.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { conversations: true, messages: { where: { createdAt: { gte: weekAgo } } } } } },
    }),
  ]);
  const activeMembers = users.filter((u) => u.active).length;
  const hidden = splitKeys(settings.hiddenPages);

  return (
    <>
      <PageHeader title="Workspace" subtitle="Gerencie a equipe e personalize as páginas visíveis na sidebar." />
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        {/* Workspace ativo */}
        <section className="card p-5">
          <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-dim uppercase">
            <Check className="size-3 text-brand" /> Workspace ativo
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-brand/40 bg-brand/15 text-brand">
              <Building2 className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-semibold">{settings.companyName}</div>
              <span className="chip mt-1 gap-1 bg-card-2 text-muted">
                <Crown className="size-3" /> Administrador
              </span>
            </div>
            <div className="flex gap-8 text-center">
              {[
                ["Leads", leads],
                ["Mensagens", messages],
                ["Membros", activeMembers],
              ].map(([label, n]) => (
                <div key={label}>
                  <div className="text-xl font-semibold">{n}</div>
                  <div className="text-xs text-dim">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Equipe */}
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-brand/10 text-brand">
              <Users className="size-4" />
            </span>
            <div>
              <h2 className="font-semibold">Equipe</h2>
              <p className="text-xs text-dim">{activeMembers} membro{activeMembers === 1 ? "" : "s"} ativo{activeMembers === 1 ? "" : "s"}</p>
            </div>
          </div>
          <div className="divide-y divide-line rounded-xl border border-line">
            {users.map((u) => (
              <div key={u.id} className={`flex flex-wrap items-center gap-4 p-4 ${u.active ? "" : "opacity-50"}`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                  {u.name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {u.name} {u.id === me.id && <span className="chip ml-1 bg-card-2 text-muted">Você</span>}
                  </div>
                  <div className="text-sm text-muted">{u.email}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-dim">
                    <span className={`chip gap-1 ${u.role === "admin" ? "bg-amber-500/15 text-amber-300" : "bg-card-2 text-muted"}`}>
                      {u.role === "admin" && <Crown className="size-3" />}
                      {u.role === "admin" ? "Administrador" : "Colaborador"}
                    </span>
                    {!u.active && <span className="chip bg-rose-500/15 text-rose-300">Desativado</span>}
                    <span>Desde {u.createdAt.toLocaleDateString("pt-BR")}</span>
                    <span>· {u._count.conversations} conversas · {u._count.messages} mensagens em 7 dias</span>
                  </div>
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
          <details className="mt-4 rounded-xl border border-line p-4">
            <summary className="cursor-pointer text-sm font-semibold text-brand">+ Convidar colaborador</summary>
            <div className="mt-4 max-w-md">
              <NewUserForm />
              <p className="mt-3 text-xs text-dim">Passe o e-mail e a senha inicial para a pessoa. Ao desativar alguém, as conversas dela voltam para a fila.</p>
            </div>
          </details>
        </section>

        {/* Páginas da sidebar */}
        <section className="card p-5">
          <div className="mb-1 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-brand/10 text-brand">
              <LayoutGrid className="size-4" />
            </span>
            <h2 className="font-semibold">Páginas da sidebar</h2>
          </div>
          <p className="mb-4 text-sm text-muted">Escolha quais páginas aparecem na navegação de todos. Os dados salvos não são apagados.</p>
          <PageToggles
            items={PAGES.filter((p) => p.hideable).map((p) => ({ key: p.key, label: p.label, description: p.description, hidden: hidden.includes(p.key) }))}
          />
        </section>
      </div>
    </>
  );
}
