"use client";

import { useOptimistic, useTransition } from "react";
import { Bot, CalendarDays, Columns3, LayoutGrid, Smartphone, Wifi, type LucideIcon } from "lucide-react";
import { setPageHidden } from "@/app/actions";

const ICONS: Record<string, LucideIcon> = { agenda: CalendarDays, whatsapp: Wifi, simulador: Smartphone, etapas: Columns3, ia: Bot };

type Item = { key: string; label: string; description: string; hidden: boolean };

/** Interruptores para mostrar/esconder páginas na sidebar de todos. */
export function PageToggles({ items }: { items: Item[] }) {
  const [, startTransition] = useTransition();
  const [state, setOptimistic] = useOptimistic(items, (current, { key, hidden }: { key: string; hidden: boolean }) =>
    current.map((i) => (i.key === key ? { ...i, hidden } : i)),
  );

  return (
    <div className="space-y-2">
      {state.map((i) => {
        const Icon = ICONS[i.key] ?? LayoutGrid;
        const on = !i.hidden;
        return (
          <div key={i.key} className="flex items-center gap-3 rounded-xl border border-line bg-panel p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{i.label}</span>
              <span className="block text-xs text-dim">{i.description}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`${on ? "Esconder" : "Mostrar"} ${i.label} na sidebar`}
              onClick={() =>
                startTransition(async () => {
                  setOptimistic({ key: i.key, hidden: on });
                  await setPageHidden(i.key, on);
                })
              }
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-card-2 ring-1 ring-line-2"}`}
            >
              <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
