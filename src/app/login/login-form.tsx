"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoFocus className="input" autoComplete="username" />
      </div>
      <div>
        <label className="label" htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" required className="input" autoComplete="current-password" />
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Entrando..." : "Entrar"}</button>
    </form>
  );
}
