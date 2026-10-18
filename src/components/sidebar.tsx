"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition, type ComponentType } from "react";
import {
  Bot,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Columns3,
  House,
  LayoutGrid,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Smartphone,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { logout, setShortcuts } from "@/app/actions";
import { PAGES, type PageDef } from "@/lib/pages";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  painel: House,
  conversas: MessageCircle,
  crm: Users,
  agenda: CalendarDays,
  ia: Bot,
  whatsapp: Wifi,
  simulador: Smartphone,
  etapas: Columns3,
  workspace: Building2,
};

type Props = {
  user: { name: string; role: "admin" | "colaborador" };
  companyName: string;
  shortcuts: string[];
  hiddenPages: string[];
};

export function Sidebar({ user, companyName, shortcuts, hiddenPages }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(true);
  const [picking, setPicking] = useState(false);
  const [, startTransition] = useTransition();
  const [myShortcuts, setMyShortcuts] = useOptimistic(shortcuts);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Lembra se o grupo "Mais" está aberto (só neste navegador).
  useEffect(() => {
    try {
      if (localStorage.getItem("tc-more-open") === "0") setMoreOpen(false);
    } catch {}
  }, []);
  function toggleMore() {
    const next = !moreOpen;
    setMoreOpen(next);
    try {
      localStorage.setItem("tc-more-open", next ? "1" : "0");
    } catch {}
  }

  // Fecha o seletor de atalhos ao clicar fora.
  useEffect(() => {
    if (!picking) return;
    const close = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPicking(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [picking]);

  const visible = PAGES.filter((p) => (!p.adminOnly || user.role === "admin") && !hiddenPages.includes(p.key));
  const main = visible.filter((p) => p.main);
  const secondary = visible.filter((p) => !p.main);
  const pinned = myShortcuts.map((k) => secondary.find((p) => p.key === k)).filter((p): p is PageDef => Boolean(p));
  const more = secondary.filter((p) => !myShortcuts.includes(p.key));

  // Item ativo = página com o caminho mais longo que combina (ex.: /crm/etapas não acende /crm).
  const activeKey = visible
    .filter((p) => pathname === p.href || pathname.startsWith(p.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.key;

  function updateShortcuts(next: string[]) {
    startTransition(async () => {
      setMyShortcuts(next);
      await setShortcuts(next);
    });
  }

  const item = (p: PageDef, opts: { removable?: boolean } = {}) => {
    const Icon = ICONS[p.key] ?? LayoutGrid;
    const active = activeKey === p.key;
    return (
      <div key={p.key} className="group relative">
        <Link
          href={p.href}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
            active ? "bg-card-2 font-semibold text-brand ring-1 ring-line-2" : "text-muted hover:bg-card hover:text-ink"
          }`}
        >
          <Icon className="size-4 shrink-0" />
          <span className="truncate">{p.label}</span>
        </Link>
        {opts.removable && (
          <button
            type="button"
            onClick={() => updateShortcuts(myShortcuts.filter((k) => k !== p.key))}
            className="absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-md p-1 text-dim hover:bg-card-2 hover:text-ink group-hover:block focus-visible:block"
            aria-label={`Remover atalho ${p.label}`}
            title="Remover atalho"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    );
  };

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Navegação">
      {main.map((p) => item(p))}

      <div className="mt-5 mb-1 px-3 text-[10px] font-semibold tracking-wider text-dim uppercase">Seus atalhos</div>
      {pinned.map((p) => item(p, { removable: true }))}
      <div className="relative" ref={pickerRef}>
        <button
          type="button"
          onClick={() => setPicking(!picking)}
          disabled={!more.length}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-card hover:text-ink disabled:opacity-40"
        >
          <Plus className="size-4" />
          Adicionar atalho
        </button>
        {picking && (
          <div className="absolute left-0 z-50 mt-1 w-full overflow-hidden rounded-xl border border-line-2 bg-card-2 shadow-xl">
            {more.map((p) => {
              const Icon = ICONS[p.key] ?? LayoutGrid;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    updateShortcuts([...myShortcuts, p.key]);
                    setPicking(false);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-muted hover:bg-card hover:text-ink"
                >
                  <Icon className="size-4" />
                  {p.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {more.length > 0 && (
        <>
          <div className="my-3 border-t border-line" />
          <button
            type="button"
            onClick={toggleMore}
            aria-expanded={moreOpen}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-card hover:text-ink"
          >
            <LayoutGrid className="size-4" />
            <span className="flex-1 text-left">Mais</span>
            <span className="chip bg-card-2 text-dim">+{more.length}</span>
            {moreOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          {moreOpen && more.map((p) => item(p))}
        </>
      )}
    </nav>
  );

  const workspaceCard = (
    <Link
      href={user.role === "admin" ? "/equipe" : "/painel"}
      onClick={() => setMobileOpen(false)}
      className="flex items-center gap-3 rounded-2xl border border-brand/40 bg-brand/10 p-3 transition hover:border-brand"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand/40 bg-brand/15 text-brand">
        <Building2 className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{companyName}</span>
        <span className="block text-xs text-muted">{user.role === "admin" ? "Administrador" : "Colaborador"}</span>
      </span>
    </Link>
  );

  const footer = (
    <div className="border-t border-line pt-3">
      <div className="flex items-center gap-3 px-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card-2 text-xs font-bold text-muted">
          {user.name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{user.name}</span>
        <form action={logout}>
          <button className="rounded-lg p-1.5 text-dim hover:bg-card hover:text-ink" aria-label="Sair" title="Sair">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Barra superior no celular */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-panel px-4 py-3 md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="TOPCERCAS" className="h-5 w-auto" />
        <button className="btn-ghost px-3 py-1.5" onClick={() => setMobileOpen(!mobileOpen)} aria-expanded={mobileOpen} aria-label="Menu">
          {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </header>
      {mobileOpen && (
        <div className="space-y-4 border-b border-line bg-panel p-3 md:hidden">
          {workspaceCard}
          {nav}
          {footer}
        </div>
      )}

      {/* Barra lateral no computador */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-panel p-3 md:flex">
        <div className="px-2 pt-1 text-[10px] font-semibold tracking-wider text-dim uppercase">Workspace atual</div>
        {workspaceCard}
        <div className="flex-1">{nav}</div>
        {footer}
      </aside>
    </>
  );
}
