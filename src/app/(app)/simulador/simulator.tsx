"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChatMessages, type ChatMessage } from "@/components/chat-messages";

type SimContact = { conversationId: string; phone: string; name: string | null };

const randomPhone = () => "55319" + String(Math.floor(10_000_000 + Math.random() * 89_999_999));

const SUGGESTIONS = [
  "Oi, quanto custa uma cerca elétrica?",
  "Quero colocar concertina no muro da minha casa",
  "Vocês fazem alambrado para chácara?",
  "Meu portão automático parou de funcionar",
];

export function Simulator() {
  const [contacts, setContacts] = useState<SimContact[]>([]);
  const [current, setCurrent] = useState<{ phone: string; name: string; conversationId?: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [newName, setNewName] = useState("");

  const loadContacts = useCallback(async () => {
    const res = await fetch("/api/conversations", { cache: "no-store" });
    if (!res.ok) return;
    const list: { id: string; contact: { phone: string; name: string | null; channel: string } }[] = await res.json();
    setContacts(list.filter((c) => c.contact.channel === "sim").map((c) => ({ conversationId: c.id, phone: c.contact.phone, name: c.contact.name })));
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const res = await fetch(`/api/conversations/${conversationId}`, { cache: "no-store" });
    if (res.ok) setMessages((await res.json()).messages);
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Atualiza para mostrar respostas da equipe e lembretes
  useEffect(() => {
    if (!current?.conversationId) return;
    const id = current.conversationId;
    loadMessages(id);
    const t = setInterval(() => loadMessages(id), 2500);
    return () => clearInterval(t);
  }, [current?.conversationId, loadMessages]);

  async function send(text: string) {
    if (!current || !text.trim() || waiting) return;
    setDraft("");
    setWaiting(true);
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "customer", text, createdAt: new Date().toISOString() }]);
    try {
      const res = await fetch("/api/simulator", {
        method: "POST",
        body: JSON.stringify({ phone: current.phone, name: current.name || undefined, text }),
      });
      if (res.ok) {
        const { conversationId } = await res.json();
        if (!current.conversationId) {
          setCurrent({ ...current, conversationId });
          loadContacts();
        }
        await loadMessages(conversationId);
      }
    } finally {
      setWaiting(false);
    }
  }

  function startNew(e: React.FormEvent) {
    e.preventDefault();
    setCurrent({ phone: randomPhone(), name: newName.trim() });
    setMessages([]);
    setNewName("");
  }

  // Mensagens que o cliente veria no WhatsApp (sem avisos internos)
  const visible = messages.filter((m) => m.role !== "system");

  return (
    <div className="grid gap-8 p-4 md:p-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div className="card p-5">
          <h2 className="font-semibold">Novo cliente de teste</h2>
          <p className="mt-1 text-sm text-muted">Cria um número fictício. A conversa aparece em Conversas e o lead no CRM, como se viesse do WhatsApp.</p>
          <form onSubmit={startNew} className="mt-4 flex flex-wrap gap-2">
            <input className="input max-w-xs" placeholder="Nome no WhatsApp (opcional)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button className="btn-primary">Começar conversa</button>
          </form>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold">Clientes de teste</h2>
          {contacts.length === 0 ? (
            <p className="mt-2 text-sm text-dim">Nenhum ainda.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {contacts.map((c) => (
                <li key={c.conversationId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    {c.name || "Sem nome"} <span className="whitespace-nowrap text-dim">+{c.phone}</span>
                  </span>
                  <span className="flex shrink-0 gap-2 whitespace-nowrap">
                    <button className="btn-ghost px-3 py-1" onClick={() => setCurrent({ phone: c.phone, name: c.name ?? "", conversationId: c.conversationId })}>Abrir</button>
                    <Link className="btn-ghost px-3 py-1" href={`/conversas?id=${c.conversationId}`}>Ver no painel</Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Celular */}
      <div className="mx-auto w-full max-w-[380px]">
        <div className="flex h-[680px] flex-col overflow-hidden rounded-[36px] border-8 border-[#1d2320] bg-[#0b141a] shadow-2xl">
          <div className="flex items-center gap-3 bg-[#1f2c33] px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="" className="size-9 rounded-full bg-white p-1" />
            <div>
              <div className="text-sm font-semibold">TOPCERCAS</div>
              <div className="text-[11px] text-muted">{waiting ? "digitando…" : "online"}</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] bg-[size:18px_18px] p-3">
            {!current ? (
              <p className="mt-20 px-6 text-center text-sm text-muted">Comece uma conversa com um novo cliente de teste ou abra um existente.</p>
            ) : visible.length === 0 && !waiting ? (
              <div className="mt-10 space-y-2 px-2">
                <p className="mb-3 text-center text-xs text-muted">Sugestões para começar:</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="block w-full rounded-xl border border-line-2 px-3 py-2 text-left text-sm hover:border-brand">
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <ChatMessages messages={visible} customerSide="right" typing={waiting} />
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex gap-2 bg-[#1f2c33] p-2"
          >
            <input
              className="flex-1 rounded-full bg-[#2a3942] px-4 py-2 text-sm outline-none placeholder:text-dim"
              placeholder={current ? "Mensagem" : "Comece uma conversa ao lado"}
              value={draft}
              disabled={!current}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button className="grid size-10 place-items-center rounded-full bg-brand text-[#04210a] disabled:opacity-50" disabled={!current || !draft.trim() || waiting} aria-label="Enviar">
              ➤
            </button>
          </form>
        </div>
        {current && <p className="mt-2 text-center text-xs text-dim">Você é: {current.name || "cliente sem nome"} · +{current.phone}</p>}
      </div>
    </div>
  );
}
