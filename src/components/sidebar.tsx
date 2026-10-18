"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/actions";

const NAV = [
  { href: "/painel", label: "Painel", icon: "▦" },
  { href: "/conversas", label: "Conversas", icon: "💬" },
  { href: "/crm", label: "CRM", icon: "◫" },
  { href: "/agenda", label: "Agenda", icon: "📅" },
  { href: "/simulador", label: "Simulador", icon: "📱" },
  { href: "/equipe", label: "Equipe", icon: "👥", adminOnly: true },
  { href: "/configuracoes", label: "Configurar IA", icon: "⚙", adminOnly: true },
];

export function Sidebar({ user }: { user: { name: string; role: "admin" | "colaborador" } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <nav className="flex flex-col gap-1">
      {NAV.filter((item) => !item.adminOnly || user.role === "admin").map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-brand/15 font-semibold text-brand" : "text-muted hover:bg-card hover:text-ink"}`}
          >
            <span className="w-5 text-center">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Barra superior no celular */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-panel px-4 py-3 md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="TOPCERCAS" className="h-5 w-auto" />
        <button className="btn-ghost px-3 py-1.5" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
          {open ? "✕" : "☰"}
        </button>
      </header>
      {open && (
        <div className="border-b border-line bg-panel p-3 md:hidden">
          {links}
          <form action={logout} className="mt-2 border-t border-line pt-2">
            <button className="w-full rounded-xl px-3 py-2 text-left text-sm text-dim">Sair ({user.name})</button>
          </form>
        </div>
      )}

      {/* Barra lateral no computador */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel p-4 md:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="TOPCERCAS" className="mb-1 h-6 w-auto self-start" />
        <p className="mb-6 text-xs text-dim">Atendimento com IA</p>
        {links}
        <div className="mt-auto border-t border-line pt-4">
          <div className="px-3 text-sm font-semibold">{user.name}</div>
          <div className="px-3 text-xs text-dim">{user.role === "admin" ? "Administrador" : "Colaborador"}</div>
          <form action={logout}>
            <button className="mt-2 w-full rounded-xl px-3 py-2 text-left text-sm text-dim hover:text-ink">Sair</button>
          </form>
        </div>
      </aside>
    </>
  );
}
