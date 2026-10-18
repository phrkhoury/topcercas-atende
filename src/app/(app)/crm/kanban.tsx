"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { STAGES } from "@/lib/constants";
import { moveStage } from "@/app/actions";

export type LeadCard = {
  id: string;
  name: string | null;
  phone: string;
  stage: string;
  service: string | null;
  address: string | null;
  meters: number | null;
  value: number | null;
  mode: string | null;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function Kanban({ leads }: { leads: LeadCard[] }) {
  const [, startTransition] = useTransition();
  const [items, setOptimistic] = useOptimistic(leads, (state, { id, stage }: { id: string; stage: string }) =>
    state.map((l) => (l.id === id ? { ...l, stage } : l)),
  );

  function drop(e: React.DragEvent, stage: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const lead = items.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;
    startTransition(async () => {
      setOptimistic({ id, stage });
      await moveStage(id, stage);
    });
  }

  return (
    <div className="flex gap-4 overflow-x-auto p-4 md:p-8">
      {STAGES.map((stage) => {
        const col = items.filter((l) => l.stage === stage.id);
        const total = col.reduce((sum, l) => sum + (l.value ?? 0), 0);
        return (
          <section
            key={stage.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => drop(e, stage.id)}
            className="flex w-72 shrink-0 flex-col rounded-2xl bg-panel p-3"
          >
            <header className="mb-3 flex items-center gap-2 px-1">
              <span className={`size-2 rounded-full ${stage.color}`} />
              <h2 className="text-sm font-semibold">{stage.label}</h2>
              <span className="text-xs text-dim">{col.length}</span>
              {total > 0 && <span className="ml-auto text-xs text-muted">{brl(total)}</span>}
            </header>
            <div className="flex min-h-24 flex-col gap-2">
              {col.map((l) => (
                <Link
                  key={l.id}
                  href={`/crm?lead=${l.id}`}
                  scroll={false}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                  className="card cursor-grab p-3 text-sm transition hover:border-brand/40 active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{l.name || `+${l.phone}`}</span>
                    {l.mode === "human" && <span className="chip bg-amber-500/15 text-amber-400">Humano</span>}
                  </div>
                  {l.service && <div className="mt-1 text-xs text-brand">{l.service}</div>}
                  <div className="mt-1 text-xs text-muted">
                    {[l.address, l.meters ? `${l.meters} m` : null].filter(Boolean).join(" · ") || "Sem detalhes ainda"}
                  </div>
                  {l.value != null && <div className="mt-2 text-xs font-semibold">{brl(l.value)}</div>}
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
