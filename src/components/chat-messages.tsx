"use client";

import { useEffect, useRef } from "react";

export type ChatMessage = { id: string; role: string; text: string; createdAt: string; author?: string | null };

const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Lista de mensagens. `side` define de que lado ficam as mensagens do cliente. */
export function ChatMessages({ messages, customerSide, typing }: { messages: ChatMessage[]; customerSide: "left" | "right"; typing?: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, typing]);

  return (
    <div className="flex flex-col gap-2">
      {messages.map((m) => {
        if (m.role === "system") {
          return (
            <div key={m.id} className="self-center rounded-full bg-card-2 px-3 py-1 text-center text-[11px] text-muted">
              {m.text}
            </div>
          );
        }
        const fromCustomer = m.role === "customer";
        const right = fromCustomer ? customerSide === "right" : customerSide === "left";
        const bubble = fromCustomer
          ? "bg-card-2 text-ink"
          : m.role === "ai"
            ? "border border-brand/30 bg-brand/15 text-[#d9fbe6]"
            : "border border-sky-400/30 bg-sky-500/15 text-sky-50";
        return (
          <div key={m.id} className={`flex max-w-[82%] flex-col ${right ? "items-end self-end" : "items-start self-start"}`}>
            {!fromCustomer && customerSide === "left" && (
              <span className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-dim">{m.role === "ai" ? "IA" : m.author ?? "Atendente"}</span>
            )}
            <div className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${bubble}`}>{m.text}</div>
            <span className="mt-0.5 text-[10px] text-dim">{time(m.createdAt)}</span>
          </div>
        );
      })}
      {typing && <div className="self-start rounded-2xl bg-card-2 px-3.5 py-2 text-sm text-muted">digitando…</div>}
      <div ref={end} />
    </div>
  );
}
