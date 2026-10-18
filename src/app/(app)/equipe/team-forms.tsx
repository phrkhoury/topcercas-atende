"use client";

import { useActionState, useState } from "react";
import { createUser, resetPassword } from "@/app/actions";

export function NewUserForm() {
  const [message, action, pending] = useActionState(createUser, null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="name">Nome</label>
        <input id="name" name="name" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">E-mail (login)</label>
        <input id="email" name="email" type="email" required className="input" autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="password">Senha inicial (mín. 8 caracteres)</label>
        <input id="password" name="password" type="text" required minLength={8} className="input" autoComplete="new-password" />
      </div>
      <div>
        <label className="label" htmlFor="role">Perfil</label>
        <select id="role" name="role" defaultValue="colaborador" className="input">
          <option value="colaborador">Colaborador — vê as conversas livres e as suas</option>
          <option value="admin">Administrador — vê tudo e gerencia a equipe</option>
        </select>
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Criando…" : "Criar acesso"}</button>
      {message && <p className={`text-sm ${message.endsWith("criado.") ? "text-brand" : "text-rose-400"}`}>{message}</p>}
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [message, action, pending] = useActionState(resetPassword, null);
  if (!open) {
    return <button className="btn-ghost px-3 py-1" onClick={() => setOpen(true)}>Redefinir senha</button>;
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input name="password" type="text" minLength={8} required placeholder="Nova senha" className="input w-40 py-1" autoComplete="new-password" />
      <button className="btn-primary px-3 py-1" disabled={pending}>Salvar</button>
      {message && <span className={`text-xs ${message === "Senha redefinida." ? "text-brand" : "text-rose-400"}`}>{message}</span>}
    </form>
  );
}
