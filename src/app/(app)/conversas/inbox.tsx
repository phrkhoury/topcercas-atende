"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChatMessages, type ChatMessage } from "@/components/chat-messages";
import type { StageInfo } from "@/lib/stages";

type ListItem = {
  id: string;
  mode: string;
  unread: number;
  lastMessageAt: string;
  contact: { name: string | null; phone: string; stage: string; channel: string };
  assignedTo: { id: string; name: string } | null;
  last: { text: string; role: string } | null;
};

type Detail = {
  id: string;
  mode: string;
  handoffReason: string | null;
  assignedTo: { id: string; name: string } | null;
  contact: {
    id: string;
    name: string | null;
    phone: string;
    stage: string;
    service: string | null;
    address: string | null;
    meters: number | null;
    notes: string | null;
    channel: string;
    appointments: { id: string; start: string }[];
  };
  messages: ChatMessage[];
};

const POLL_MS = 2500;
const displayName = (c: { name: string | null; phone: string }) => c.name || `+${c.phone}`;
const initials = (c: { name: string | null; phone: string }) => (c.name ? c.name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase() : "#");

type Props = {
  initialId?: string;
  initialAgent?: string;
  me: { id: string; role: "admin" | "colaborador" };
  team: { id: string; name: string }[]; // colaboradores ativos (para o admin filtrar e transferir)
  stages: StageInfo[];
};

export function Inbox({ initialId, initialAgent, me, team, stages }: Props) {
  const stageLabel = (id: string) => stages.find((s) => s.id === id)?.name ?? "Sem etapa";
  const stageColor = (id: string) => stages.find((s) => s.id === id)?.color ?? "#94a3b8";
  const isAdmin = me.role === "admin";
  const [list, setList] = useState<ListItem[]>([]);
  const [selected, setSelected] = useState<string | undefined>(initialId);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [filter, setFilter] = useState<"todas" | "humano" | "minhas">("todas");
  const [agentFilter, setAgentFilter] = useState(initialAgent ?? ""); // só admin: "" = todos, "livres" ou id do colaborador
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const loadList = useCallback(async () => {
    const qs = agentFilter ? `?atendente=${encodeURIComponent(agentFilter)}` : "";
    const res = await fetch(`/api/conversations${qs}`, { cache: "no-store" });
    if (res.ok) setList(await res.json());
  }, [agentFilter]);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
    if (res.ok) setDetail(await res.json());
  }, []);

  useEffect(() => {
    loadList();
    const t = setInterval(loadList, POLL_MS);
    return () => clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (!selected) return;
    loadDetail(selected);
    fetch(`/api/conversations/${selected}`, { method: "POST", body: JSON.stringify({ action: "read" }) });
    const t = setInterval(() => loadDetail(selected), POLL_MS);
    return () => clearInterval(t);
  }, [selected, loadDetail]);

  async function post(body: object) {
    if (!selected) return;
    await fetch(`/api/conversations/${selected}`, { method: "POST", body: JSON.stringify(body) });
    await Promise.all([loadDetail(selected), loadList()]);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    await post({ action: "send", text });
    setSending(false);
  }

  // "Precisa de você" = conversas com humano ainda sem responsável
  // Admin: "Sem responsável" = humano sem dono. Colaborador: "Aguardando resposta" = as dele em atendimento humano.
  const needsYou = (c: ListItem) => c.mode === "human" && (isAdmin ? !c.assignedTo : true);
  const mine = (c: ListItem) => c.assignedTo?.id === me.id;
  const visible = list.filter((c) => filter === "todas" || (filter === "humano" ? needsYou(c) : mine(c)));
  const humanCount = list.filter(needsYou).length;
  const mineCount = list.filter(mine).length;

  return (
    <div className="flex h-[calc(100vh-57px)] md:h-screen">
      {/* Lista */}
      <section className={`w-full shrink-0 flex-col border-r border-line md:flex md:w-80 ${selected ? "hidden" : "flex"}`}>
        <div className="border-b border-line p-4">
          <h1 className="text-lg font-semibold">Conversas</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button onClick={() => setFilter("todas")} className={`chip px-3 py-1 ${filter === "todas" ? "bg-brand/15 text-brand" : "bg-card text-muted"}`}>Todas ({list.length})</button>
            <button onClick={() => setFilter("humano")} className={`chip px-3 py-1 ${filter === "humano" ? "bg-amber-500/15 text-amber-400" : "bg-card text-muted"}`}>{isAdmin ? "Sem responsável" : "Aguardando resposta"} ({humanCount})</button>
            {isAdmin && <button onClick={() => setFilter("minhas")} className={`chip px-3 py-1 ${filter === "minhas" ? "bg-sky-500/15 text-sky-300" : "bg-card text-muted"}`}>Minhas ({mineCount})</button>}
          </div>
          {isAdmin && (
            <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="input mt-3 py-1.5 text-xs" aria-label="Filtrar por colaborador">
              <option value="">Todos os colaboradores</option>
              <option value="livres">Sem responsável (IA ou fila)</option>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </div>
        <ul className="flex-1 overflow-y-auto">
          {visible.length === 0 && (
            <li className="p-6 text-center text-sm text-dim">
              {isAdmin ? (<>Nenhuma conversa ainda. Use o <Link className="text-brand underline" href="/simulador">simulador</Link> para testar.</>) : "Nenhuma conversa atribuída a você ainda. O administrador distribui as conversas."}
            </li>
          )}
          {visible.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelected(c.id)}
                className={`flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition hover:bg-card ${selected === c.id ? "bg-card" : ""}`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">{initials(c.contact)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{displayName(c.contact)}</span>
                    <span className="shrink-0 text-[10px] text-dim">
                      {new Date(c.lastMessageAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-xs text-muted">{c.last?.text ?? ""}</span>
                    {c.unread > 0 && <span className="chip ml-auto shrink-0 bg-brand text-[#04210a]">{c.unread}</span>}
                  </span>
                  <span className="mt-1 flex gap-1.5">
                    <span className={`chip ${c.mode === "ai" ? "bg-brand/15 text-brand" : c.assignedTo ? "bg-sky-500/15 text-sky-300" : "bg-amber-500/15 text-amber-400"}`}>
                      {c.mode === "ai" ? "IA atendendo" : c.assignedTo ? (c.assignedTo.id === me.id ? "Você" : c.assignedTo.name) : "Sem responsável"}
                    </span>
                    <span className="chip bg-card-2 text-muted">{stageLabel(c.contact.stage)}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Conversa */}
      <section className={`min-w-0 flex-1 flex-col ${selected ? "flex" : "hidden md:flex"}`}>
        {!detail || detail.id !== selected ? (
          <div className="m-auto text-sm text-dim">{selected ? "Carregando…" : "Selecione uma conversa"}</div>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <button className="text-muted md:hidden" onClick={() => setSelected(undefined)} aria-label="Voltar">←</button>
              <span className="grid size-10 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">{initials(detail.contact)}</span>
              <div className="min-w-0">
                <div className="truncate font-semibold">{displayName(detail.contact)}</div>
                <div className="text-xs text-dim">+{detail.contact.phone} · {detail.contact.channel === "whatsapp" ? "WhatsApp" : "Simulador"}</div>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {isAdmin && (
                  <select
                    value={detail.assignedTo?.id ?? ""}
                    onChange={(e) => post({ action: "assign", userId: e.target.value || null })}
                    className="input w-auto py-1.5 text-xs"
                    aria-label="Responsável pela conversa"
                  >
                    <option value="">Sem responsável</option>
                    {team.map((u) => <option key={u.id} value={u.id}>{u.id === me.id ? `${u.name} (você)` : u.name}</option>)}
                  </select>
                )}
                {detail.mode === "ai" || (detail.assignedTo?.id !== me.id && !isAdmin) || !detail.assignedTo ? (
                  <button className="btn-ghost" onClick={() => post({ action: "mode", mode: "human" })}>Assumir conversa</button>
                ) : null}
                {detail.mode === "human" && (
                  <button className="btn-primary" onClick={() => post({ action: "mode", mode: "ai" })}>Devolver para a IA</button>
                )}
              </div>
            </header>
            {detail.mode === "human" && (
              <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
                {detail.assignedTo ? `Responsável: ${detail.assignedTo.id === me.id ? "você" : detail.assignedTo.name}` : "Sem responsável — aguardando alguém da equipe"}
                {detail.handoffReason ? ` · ${detail.handoffReason}` : ""}
              </div>
            )}
            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex-1 overflow-y-auto p-4">
                  <ChatMessages messages={detail.messages} customerSide="left" />
                </div>
                <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
                  <input
                    className="input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={detail.mode === "ai" ? "Escrever como atendente (pausa a IA)…" : "Escreva uma mensagem…"}
                  />
                  <button className="btn-primary" disabled={sending || !draft.trim()}>Enviar</button>
                </form>
              </div>

              {/* Ficha do lead */}
              <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-line p-4 text-sm xl:block">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-dim">Lead</h2>
                <div className="mb-4 flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ backgroundColor: stageColor(detail.contact.stage) }} />
                  {stageLabel(detail.contact.stage)}
                </div>
                <dl className="space-y-3">
                  {[
                    ["Serviço", detail.contact.service],
                    ["Endereço", detail.contact.address],
                    ["Metragem", detail.contact.meters ? `${detail.contact.meters} m` : null],
                    ["Observações", detail.contact.notes],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-dim">{k}</dt>
                      <dd className="whitespace-pre-wrap">{v || "—"}</dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-xs text-dim">Visitas agendadas</dt>
                    <dd>
                      {detail.contact.appointments.length
                        ? detail.contact.appointments.map((a) => (
                            <div key={a.id}>
                              {new Date(a.start).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </div>
                          ))
                        : "—"}
                    </dd>
                  </div>
                </dl>
                <Link href={`/crm?lead=${detail.contact.id}`} className="btn-ghost mt-5 w-full">Editar no CRM</Link>
              </aside>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
